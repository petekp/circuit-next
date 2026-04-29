#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fileIsPresent,
  formatWithBiome,
  listMarkdownBasenames,
  loadConnectorSchemas,
  loadCurrentCatalog,
  loadReleaseSchemas,
  loadRouter,
  projectRoot,
  readJson,
  stableJson,
  writeOrCheck,
} from './lib.mjs';

const check = process.argv.includes('--check');
const OUT_REL = 'generated/release/current-capabilities.json';
const EXECUTABLE_SCHEMATIC_ROUTES = new Set(['continue', 'complete']);
const CANONICAL_STAGE_ORDER = ['frame', 'analyze', 'plan', 'act', 'verify', 'review', 'close'];

function flowDir(id) {
  return resolve(projectRoot, 'generated/flows', id);
}

function readGeneratedFlowFiles(id) {
  const dir = flowDir(id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => ({
      rel: `generated/flows/${id}/${entry}`,
      json: readJson(`generated/flows/${id}/${entry}`),
    }));
}

function entryModesFor(id) {
  const modes = new Map();
  for (const file of readGeneratedFlowFiles(id)) {
    for (const mode of file.json.entry_modes ?? []) {
      modes.set(mode.name, mode);
    }
  }
  return [...modes.keys()].sort();
}

function stageAxisLabel(stage) {
  const canonical = stage.canonical ?? stage.id;
  if (canonical === 'plan' && /decision/i.test(stage.title ?? '')) return 'Plan or Decision';
  return canonical;
}

function stagesFor(id) {
  const stages = new Map();
  for (const file of readGeneratedFlowFiles(id)) {
    for (const stage of file.json.stages ?? []) {
      const label = stageAxisLabel(stage);
      if (typeof label !== 'string') continue;
      const canonical = stage.canonical ?? stage.id;
      const order = CANONICAL_STAGE_ORDER.indexOf(canonical);
      stages.set(label, {
        label,
        order: order === -1 ? Number.MAX_SAFE_INTEGER : order,
      });
    }
  }
  return [...stages.values()]
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map((stage) => stage.label);
}

function reportsFor(pkg) {
  const reports = new Set(pkg.relayReports.map((report) => report.schemaName));
  for (const file of readGeneratedFlowFiles(pkg.id)) {
    for (const step of file.json.steps ?? []) {
      const writes = step.writes ?? {};
      if (typeof writes.report?.schema === 'string') reports.add(writes.report.schema);
      if (typeof writes.aggregate?.schema === 'string') reports.add(writes.aggregate.schema);
    }
  }
  return [...reports].sort();
}

function readSchematic(pkg) {
  return JSON.parse(readFileSync(resolve(projectRoot, pkg.paths.schematic), 'utf8'));
}

function routeOutcomesFor(pkg) {
  const schematic = readSchematic(pkg);
  const outcomes = new Set();
  const unsupported = new Set();
  for (const item of schematic.items ?? []) {
    for (const outcome of Object.keys(item.routes ?? {})) {
      outcomes.add(outcome);
      if (!EXECUTABLE_SCHEMATIC_ROUTES.has(outcome)) unsupported.add(outcome);
    }
    for (const outcome of Object.keys(item.route_overrides ?? {})) {
      outcomes.add(outcome);
      if (!EXECUTABLE_SCHEMATIC_ROUTES.has(outcome)) unsupported.add(outcome);
    }
  }
  return {
    route_outcomes: [...outcomes].sort(),
    unsupported_route_outcomes: [...unsupported].sort(),
  };
}

function flowRecord(pkg) {
  const routing = pkg.routing;
  const routeOutcomes = routeOutcomesFor(pkg);
  return {
    id: pkg.id,
    source: pkg.paths.schematic,
    ...(pkg.paths.command === undefined ? {} : { command_path: pkg.paths.command }),
    ...(pkg.paths.contract === undefined ? {} : { contract_path: pkg.paths.contract }),
    routing: {
      routable: routing !== undefined,
      is_default: routing?.isDefault === true,
      ...(routing?.order === undefined ? {} : { order: routing.order }),
      signal_labels: routing?.signals.map((signal) => signal.label).sort() ?? [],
      ...(routing?.defaultReason === undefined ? {} : { default_reason: routing.defaultReason }),
    },
    entry_modes: entryModesFor(pkg.id),
    stages: stagesFor(pkg.id),
    reports: reportsFor(pkg),
    writers: {
      compose: pkg.writers.compose.length,
      close: pkg.writers.close.length,
      verification: pkg.writers.verification.length,
      checkpoint: pkg.writers.checkpoint.length,
    },
    ...routeOutcomes,
  };
}

function commandCapability(id, host, present) {
  return {
    id: host === 'root' ? `command:${id}` : `command:${host}:${id}`,
    kind: 'flow',
    title: `${host} command ${id}`,
    status: present ? 'implemented' : 'missing',
    summary: present
      ? `Command ${id} is present for ${host}.`
      : `Command ${id} is absent for ${host}.`,
    evidence: present ? [`commands/${id}.md`] : [],
    readiness_refs: present ? [] : ['REL-004'],
  };
}

function implementedIntentHintsByFlow(routerIntents) {
  const byFlow = new Map();
  for (const intent of routerIntents) {
    if (intent.status !== 'implemented') continue;
    const hints = byFlow.get(intent.actual_flow) ?? [];
    hints.push(`${intent.id}:`);
    byFlow.set(intent.actual_flow, hints);
  }
  return byFlow;
}

function capabilityFromFlow(record, intentHintsByFlow) {
  const isRuntimeOnly = record.id === 'runtime-proof';
  const intentHints = intentHintsByFlow.get(record.id)?.sort() ?? [];
  return {
    id: `flow:${record.id}`,
    kind: 'flow',
    title: `${record.id} flow`,
    status: 'implemented',
    summary: isRuntimeOnly
      ? 'Runtime proof flow is present as an internal test surface.'
      : `Flow ${record.id} is registered in the catalog.`,
    evidence: [record.source, `generated/flows/${record.id}/circuit.json`],
    axes: {
      intent_hints: intentHints,
      modes: record.entry_modes,
      stage_path: record.stages,
      outputs: record.reports,
    },
  };
}

function modeCapabilities(record) {
  return record.entry_modes.map((mode) => ({
    id: `mode:${record.id}:${mode}`,
    kind: 'mode',
    title: `${record.id} ${mode}`,
    status: 'implemented',
    summary: `${record.id} declares entry mode ${mode}.`,
    evidence: [`generated/flows/${record.id}`],
  }));
}

function routeCapabilities(record) {
  return record.route_outcomes.map((outcome) => {
    const supported = !record.unsupported_route_outcomes.includes(outcome);
    return {
      id: `route-outcome:${record.id}:${outcome}`,
      kind: 'route_outcome',
      title: `${record.id} route ${outcome}`,
      status: supported ? 'implemented' : 'partial',
      summary: supported
        ? `${outcome} maps to an executable compiled route.`
        : `${outcome} is declared in the schematic but not executable in compiled routes.`,
      evidence: [record.source],
      readiness_refs: supported ? [] : ['REL-003'],
    };
  });
}

function routerIntentCases(classifyCompiledFlowTask) {
  const cases = [
    {
      id: 'fix',
      input: 'fix: handle the missing token edge case',
      expected_flow: 'fix',
      readiness_refs: [],
    },
    {
      id: 'develop',
      input: 'develop: add SSO flow',
      expected_flow: 'build',
      expected_entry_mode: 'default',
      readiness_refs: [],
    },
    {
      id: 'decide',
      input: 'decide: choose the queue architecture',
      expected_flow: 'explore',
      expected_entry_mode: 'tournament',
      readiness_refs: [],
    },
    {
      id: 'migrate',
      input: 'migrate: replace the legacy SDK',
      expected_flow: 'migrate',
      expected_entry_mode: 'deep',
      readiness_refs: [],
    },
    {
      id: 'cleanup',
      input: 'cleanup: remove safe dead code',
      expected_flow: 'sweep',
      expected_entry_mode: 'default',
      readiness_refs: [],
    },
    {
      id: 'overnight',
      input: 'overnight: improve repo quality',
      expected_flow: 'sweep',
      expected_entry_mode: 'autonomous',
      readiness_refs: [],
    },
    {
      id: 'plan-execution',
      input: 'Execute this plan: ./docs/public-release-readiness.md',
      expected_flow: 'first-executable-slice',
      readiness_refs: ['REL-016'],
    },
  ];
  return cases.map((item) => {
    const decision = classifyCompiledFlowTask(item.input);
    const flowOk = decision.flowName === item.expected_flow;
    const entryModeOk =
      item.expected_entry_mode === undefined ||
      decision.inferredEntryModeName === item.expected_entry_mode;
    const planSpecial = item.id === 'plan-execution';
    return {
      id: item.id,
      input: item.input,
      expected_flow: item.expected_flow,
      actual_flow: decision.flowName,
      ...(item.expected_entry_mode === undefined
        ? {}
        : { expected_entry_mode: item.expected_entry_mode }),
      ...(decision.inferredEntryModeName === undefined
        ? {}
        : { actual_entry_mode: decision.inferredEntryModeName }),
      status:
        flowOk && entryModeOk && !planSpecial && item.readiness_refs.length === 0
          ? 'implemented'
          : 'partial',
      readiness_refs: item.readiness_refs,
    };
  });
}

function routerCapabilities(routerIntents) {
  return routerIntents.map((intent) => ({
    id: `router:intent:${intent.id}`,
    kind: intent.id === 'plan-execution' ? 'plan_execution' : 'router_intent',
    title: `${intent.id} routing`,
    status: intent.status,
    summary:
      intent.actual_entry_mode === undefined
        ? `${intent.input} routed to ${intent.actual_flow}; expected ${intent.expected_flow}.`
        : `${intent.input} routed to ${intent.actual_flow} with ${intent.actual_entry_mode} mode; expected ${intent.expected_flow}.`,
    evidence: ['src/runtime/router.ts'],
    readiness_refs: intent.readiness_refs,
    axes: {
      intent_hints: [`${intent.id}:`],
      modes: intent.actual_entry_mode === undefined ? [] : [intent.actual_entry_mode],
    },
  }));
}

function connectorRecords(connectorSchemas) {
  const records = connectorSchemas.EnabledConnector.options.map((name) => {
    const caps = connectorSchemas.BUILTIN_CONNECTOR_CAPABILITIES[name];
    const implemented = name !== 'codex-isolated';
    return {
      id: name,
      status: implemented ? 'implemented' : 'missing',
      filesystem: caps.filesystem,
      structured_output: caps.structured_output,
      protocol: 'builtin-json',
      summary: implemented
        ? `${name} is a built-in connector.`
        : `${name} is declared but not implemented by relay selection.`,
      readiness_refs: implemented ? [] : ['REL-002'],
    };
  });
  records.push({
    id: 'custom',
    status: 'implemented',
    filesystem: 'read-only',
    structured_output: 'json',
    protocol: connectorSchemas.PromptTransport.options.join(', '),
    summary:
      'Custom connectors receive prompt and output file paths and return a JSON response through the output file.',
    readiness_refs: [],
  });
  return records;
}

function connectorCapabilities(records) {
  return records.map((record) => ({
    id: `connector:${record.id}`,
    kind: 'connector',
    title: `${record.id} connector`,
    status: record.status,
    summary: record.summary,
    evidence: ['src/schemas/connector.ts', 'src/runtime/relay-selection.ts'],
    readiness_refs: record.readiness_refs,
    axes: {
      worker_handoff:
        record.id === 'custom'
          ? 'Wrapper receives a prompt and returns structured output.'
          : record.protocol,
      ...(record.id === 'custom' ? { proof: 'Working custom connector example.' } : {}),
    },
  }));
}

function hostRecords() {
  return [
    {
      id: 'claude-code-command',
      status: fileIsPresent('commands/run.md') ? 'partial' : 'missing',
      summary: 'Claude Code command surface exists but remains model-mediated.',
      evidence: ['commands/run.md'],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'codex-plugin',
      status: fileIsPresent('plugins/circuit/.codex-plugin/plugin.json') ? 'partial' : 'missing',
      summary: 'Codex plugin files exist and are model-mediated until native support lands.',
      evidence: [
        'plugins/circuit/.codex-plugin/plugin.json',
        'plugins/circuit/scripts/circuit-next.mjs',
      ],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'generic-shell',
      status: 'partial',
      summary:
        'Generic shell can consume JSONL/final JSON, but human text progress is still pending.',
      evidence: ['src/cli/circuit.ts'],
      readiness_refs: ['REL-019'],
    },
    {
      id: 'native-codex-app-server',
      status: 'planned',
      summary: 'Native Codex App Server adapter is a planned host expansion.',
      evidence: ['docs/contracts/native-host-adapters.md'],
      readiness_refs: ['REL-026'],
    },
    {
      id: 'native-claude-agent-sdk',
      status: 'planned',
      summary: 'Claude Agent SDK bridge is a planned host expansion.',
      evidence: ['docs/contracts/native-host-adapters.md'],
      readiness_refs: ['REL-026'],
    },
  ];
}

function hostCapabilities(records) {
  return records.map((record) => ({
    id: `host:${record.id}`,
    kind: 'host',
    title: `${record.id} host`,
    status: record.status,
    summary: record.summary,
    evidence: record.evidence,
    readiness_refs: record.readiness_refs,
  }));
}

function supportCapabilities(rootCommands) {
  const commandSet = new Set(rootCommands);
  return [
    {
      id: 'utility:review',
      kind: 'utility',
      title: 'Review utility',
      status: commandSet.has('review') ? 'implemented' : 'missing',
      summary: 'Standalone Review is present as a flow command.',
      evidence: ['commands/review.md', 'src/flows/review/schematic.json'],
    },
    {
      id: 'utility:create',
      kind: 'customization',
      title: 'Create utility',
      status: commandSet.has('create') ? 'implemented' : 'missing',
      summary: 'Create utility command is not present in the current command surface.',
      evidence: [],
      readiness_refs: ['REL-013'],
    },
    {
      id: 'utility:handoff',
      kind: 'continuity',
      title: 'Handoff utility',
      status: commandSet.has('handoff') ? 'implemented' : 'missing',
      summary: 'Handoff utility command is not present in the current command surface.',
      evidence: [],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'feature:checkpoints',
      kind: 'checkpoint',
      title: 'Checkpoints',
      status: 'implemented',
      summary: 'Checkpoint waiting and resume paths exist in the runner and CLI.',
      evidence: ['src/runtime/runner.ts', 'src/cli/circuit.ts'],
    },
    {
      id: 'feature:continuity',
      kind: 'continuity',
      title: 'Continuity',
      status: 'partial',
      summary:
        'Run records and checkpoint resume exist; original handoff utility parity is still tracked separately.',
      evidence: ['src/runtime/snapshot-writer.ts', 'src/runtime/runner.ts'],
      readiness_refs: ['REL-014'],
    },
    {
      id: 'feature:plan-execution',
      kind: 'plan_execution',
      title: 'Plan execution',
      status: 'partial',
      summary: 'Plan-execution requests can still finish as analysis-only Explore runs.',
      evidence: ['src/runtime/router.ts', 'docs/public-release-readiness.md'],
      readiness_refs: ['REL-016'],
    },
    {
      id: 'safety:review-untracked-evidence',
      kind: 'safety',
      title: 'Review untracked evidence policy',
      status: 'implemented',
      summary:
        'Review sends untracked paths and sizes by default; file contents require explicit opt-in and still skip binary, unreadable, and oversized samples safely.',
      evidence: [
        'src/flows/review/writers/intake.ts',
        'tests/runner/review-runtime-wiring.test.ts',
        'tests/runner/cli-router.test.ts',
      ],
      readiness_refs: [],
    },
    {
      id: 'safety:accept-with-fixes',
      kind: 'safety',
      title: 'Accept with fixes semantics',
      status: 'implemented',
      summary:
        'Build reports needs_attention and Fix reports partial when review accepts with required follow-up fixes.',
      evidence: ['src/flows/build/writers/close.ts', 'src/flows/fix/writers/close.ts'],
      readiness_refs: [],
    },
    {
      id: 'safety:write-capable-worker',
      kind: 'safety',
      title: 'Write-capable worker disclosure',
      status: 'partial',
      summary: 'Write-capable Claude Code worker behavior needs first-run disclosure.',
      evidence: ['src/runtime/connectors/claude-code.ts'],
      readiness_refs: ['REL-007'],
    },
    {
      id: 'matrix:flow-mode-parity',
      kind: 'docs',
      title: 'Flow and mode parity matrix',
      status: 'partial',
      summary: 'Generated matrix exists, but behavioral parity gaps remain tracked.',
      evidence: ['docs/release/parity-matrix.generated.md'],
      readiness_refs: ['REL-004'],
    },
    {
      id: 'route-outcomes:rich',
      kind: 'route_outcome',
      title: 'Rich route outcomes',
      status: 'partial',
      summary: 'Rich route outcomes are inventoried but not yet executable.',
      evidence: ['src/runtime/compile-schematic-to-flow.ts'],
      readiness_refs: ['REL-003'],
    },
    {
      id: 'proof:golden-runs',
      kind: 'proof',
      title: 'Golden release runs',
      status: 'missing',
      summary: 'Golden example runs are defined but not captured.',
      evidence: ['docs/release/proofs/index.yaml'],
      readiness_refs: ['REL-011'],
    },
  ];
}

async function main() {
  const [{ CurrentCapabilitySnapshot }, { flowPackages }, router, connectorSchemas] =
    await Promise.all([
      loadReleaseSchemas(),
      loadCurrentCatalog(),
      loadRouter(),
      loadConnectorSchemas(),
    ]);

  const flows = flowPackages.map(flowRecord);
  const routerIntents = routerIntentCases(router.classifyCompiledFlowTask);
  const intentHintsByFlow = implementedIntentHintsByFlow(routerIntents);
  const rootCommands = listMarkdownBasenames('commands');
  const codexCommands = listMarkdownBasenames('plugins/circuit/commands');
  const claudeSkills = existsSync(resolve(projectRoot, '.claude-plugin/skills'))
    ? readdirSync(resolve(projectRoot, '.claude-plugin/skills')).filter((entry) =>
        statSync(resolve(projectRoot, '.claude-plugin/skills', entry)).isDirectory(),
      )
    : [];
  const connectors = connectorRecords(connectorSchemas);
  const hosts = hostRecords();

  const capabilities = [
    ...flows.map((record) => capabilityFromFlow(record, intentHintsByFlow)),
    ...flows.flatMap(modeCapabilities),
    ...flows.flatMap(routeCapabilities),
    ...routerCapabilities(routerIntents),
    ...rootCommands.map((id) => commandCapability(id, 'root', true)),
    ...['create', 'handoff', 'migrate', 'sweep'].map((id) =>
      commandCapability(id, 'root', rootCommands.includes(id)),
    ),
    ...connectorCapabilities(connectors),
    ...hostCapabilities(hosts),
    ...supportCapabilities(rootCommands),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const snapshot = CurrentCapabilitySnapshot.parse({
    schema_version: 1,
    generated_by: 'scripts/release/emit-current-capabilities.mjs',
    flows,
    router_intents: routerIntents,
    commands: {
      root: rootCommands,
      codex_plugin: codexCommands,
      claude_plugin_skills: claudeSkills.sort(),
    },
    connectors,
    hosts,
    capabilities,
  });

  writeOrCheck(OUT_REL, formatWithBiome(OUT_REL, stableJson(snapshot)), check);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
