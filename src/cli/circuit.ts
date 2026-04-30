import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ChangeKindDeclaration } from '../schemas/change-kind.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { Depth } from '../schemas/depth.js';
import { RunId } from '../schemas/ids.js';
import {
  type ProgressDisplay,
  ProgressEvent,
  type ProgressEvent as ProgressEventValue,
} from '../schemas/progress-event.js';

import { discoverConfigLayers } from '../runtime/config-loader.js';
import { writeOperatorSummary } from '../runtime/operator-summary-writer.js';
import { validateCompiledFlowKindPolicy } from '../runtime/policy/flow-kind-policy.js';
import { classifyCompiledFlowTask } from '../runtime/router.js';
import {
  type ChildCompiledFlowResolver,
  type CompiledFlowInvocation,
  type ComposeWriterFn,
  type RelayFn,
  resumeCompiledFlowCheckpoint,
  runCompiledFlow,
} from '../runtime/runner.js';
import { runCreateCommand } from './create.js';
import { runHandoffCommand } from './handoff.js';
import { runRunsCommand } from './runs.js';

// Runtime CLI entry point — invoked through ./bin/circuit-next.
//
// Loads the named flow fixture at generated/flows/<flow-name>/circuit.json,
// parses it through the CompiledFlow schema, validates kind-canonical
// stage-set policy, composes the runtime boundary via the runner, and
// prints the <run-folder> path on success.
//
// Invocation-layer flags stay narrow (--goal, --depth, --run-folder,
// --fixture, --flow-root). The product path discovers user-global and
// project config files and supplies them as LayeredConfigs to the
// selection resolver.
//
// `--dry-run` fails closed. An earlier version accepted the flag as a
// no-op while still spawning the real connector — a safety bug. The
// flag stays rejected until real dry-run support lands.

const DEFAULT_RUNS_BASE = '.circuit-next/runs';
const MAX_PROGRESS_DISPLAY_TEXT_CHARS = 240;

interface ParsedArgs {
  command?: 'run' | 'resume';
  flowName?: string;
  goal?: string;
  depth?: Depth;
  depthProvided: boolean;
  entryMode?: string;
  runFolder?: string;
  fixturePath?: string;
  flowRoot?: string;
  checkpointChoice?: string;
  progress?: 'jsonl';
  includeUntrackedContent: boolean;
}

interface ResolvedCompiledFlowRoute {
  flowName: string;
  source: 'explicit' | 'classifier';
  reason: string;
  matched_signal?: string;
  inferredEntryModeName?: string;
  inferredEntryModeReason?: string;
}

interface ResolvedEntryModeSelection {
  entryModeName?: string;
  source?: 'explicit' | 'classifier';
  reason?: string;
}

export interface CliMainOptions {
  relayer?: RelayFn;
  composeWriter?: ComposeWriterFn;
  now?: () => Date;
  runId?: string;
  configHomeDir?: string;
  configCwd?: string;
}

function usage(): string {
  return [
    'usage: circuit-next run [flow-name] --goal "<goal>" [--mode <default|lite|deep|autonomous>] [--depth <lite|standard|deep|tournament|autonomous>] [--run-folder <path>] [--fixture <path>] [--flow-root <path>] [--progress jsonl]',
    '       circuit-next resume --run-folder <path> --checkpoint-choice <choice> [--progress jsonl]',
    '       circuit-next runs show --run-folder <path> --json',
    '       circuit-next handoff [save|resume|done] [options]',
    '       circuit-next create --description "<flow idea>" [--name <slug>] [--publish --yes]',
    '',
    '`--mode` is the friendly alias for `--entry-mode`; supplying both forms of that option is an error.',
    '',
    'With an explicit flow name, loads generated/flows/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review/fix/build/migrate/sweep flows and then composes the runtime boundary using the configured relay connector.',
    '',
    'Config: if present, loads ~/.config/circuit-next/config.yaml and ./.circuit/config.yaml from the current working directory into the selection resolver before relay.',
    '',
    'Note: `--dry-run` is not implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug; the flag stays rejected until real dry-run support lands.',
    '',
    'Review evidence: untracked file contents are omitted by default. Add `--include-untracked-content` only when those files are safe to relay to the configured worker.',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the flow name.
  let flowName: string | undefined;
  let command: 'run' | 'resume' | undefined;
  let goal: string | undefined;
  let depth: Depth | undefined;
  let depthProvided = false;
  let entryMode: string | undefined;
  let runFolder: string | undefined;
  let fixturePath: string | undefined;
  let flowRoot: string | undefined;
  let checkpointChoice: string | undefined;
  let progress: 'jsonl' | undefined;
  let includeUntrackedContent = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok === '--goal') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--goal requires a value');
      goal = next;
      i += 1;
      continue;
    }
    if (tok === '--depth') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (depthProvided) {
        throw new Error('supply --depth only once');
      }
      depth = Depth.parse(next);
      depthProvided = true;
      i += 1;
      continue;
    }
    if (tok === '--entry-mode' || tok === '--mode') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (next.length === 0) throw new Error(`${tok} requires a non-empty value`);
      if (entryMode !== undefined) {
        throw new Error('use either --mode or --entry-mode, not both');
      }
      entryMode = next;
      i += 1;
      continue;
    }
    if (tok === '--run-folder') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (runFolder !== undefined) {
        throw new Error('supply --run-folder only once');
      }
      runFolder = next;
      i += 1;
      continue;
    }
    if (tok === '--fixture') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--fixture requires a value');
      fixturePath = next;
      i += 1;
      continue;
    }
    if (tok === '--flow-root') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--flow-root requires a value');
      if (next.length === 0) throw new Error('--flow-root requires a non-empty value');
      if (flowRoot !== undefined) {
        throw new Error('supply --flow-root only once');
      }
      flowRoot = next;
      i += 1;
      continue;
    }
    if (tok === '--checkpoint-choice') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--checkpoint-choice requires a value');
      checkpointChoice = next;
      i += 1;
      continue;
    }
    if (tok === '--progress') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--progress requires a value');
      if (next !== 'jsonl') throw new Error("--progress only supports 'jsonl'");
      progress = 'jsonl';
      i += 1;
      continue;
    }
    if (tok === '--dry-run') {
      // Fail closed. An earlier version accepted the flag silently while
      // the real connector still ran. Re-enable once real dry-run support
      // lands (deterministic dry relayer + trace marker).
      throw new Error(
        '--dry-run is not currently implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug. The flag stays rejected until real dry-run support lands.',
      );
    }
    if (tok === '--include-untracked-content') {
      includeUntrackedContent = true;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (tok.startsWith('--')) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if ((tok === 'run' || tok === 'resume') && flowName === undefined && command === undefined) {
      command = tok;
      continue;
    }
    if (flowName === undefined) {
      flowName = tok;
      continue;
    }
    throw new Error(`unexpected positional argument: ${tok}`);
  }

  if (command === 'resume' || checkpointChoice !== undefined) {
    if (command !== 'resume') {
      throw new Error('checkpoint resume must use the `resume` subcommand');
    }
    if (runFolder === undefined) throw new Error('--run-folder is required for checkpoint resume');
    if (checkpointChoice === undefined || checkpointChoice.length === 0) {
      throw new Error('--checkpoint-choice is required for checkpoint resume');
    }
    if (flowName !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit flow-name');
    }
    if (goal !== undefined) {
      throw new Error('checkpoint resume reuses the saved run goal; omit --goal');
    }
    if (fixturePath !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit --fixture');
    }
    if (flowRoot !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit --flow-root');
    }
    if (depthProvided) {
      throw new Error('checkpoint resume reuses the saved run depth; omit --depth');
    }
    if (entryMode !== undefined) {
      throw new Error('checkpoint resume reuses the saved flow position; omit --mode/--entry-mode');
    }
    if (includeUntrackedContent) {
      throw new Error(
        'checkpoint resume reuses the saved evidence policy; omit --include-untracked-content',
      );
    }
  } else if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    depthProvided,
    includeUntrackedContent,
  };
  if (depth !== undefined) result.depth = depth;
  if (entryMode !== undefined) result.entryMode = entryMode;
  if (command !== undefined) result.command = command;
  if (goal !== undefined) result.goal = goal;
  if (flowName !== undefined) result.flowName = flowName;
  if (runFolder !== undefined) result.runFolder = runFolder;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  if (flowRoot !== undefined) result.flowRoot = flowRoot;
  if (checkpointChoice !== undefined) result.checkpointChoice = checkpointChoice;
  if (progress !== undefined) result.progress = progress;
  return result;
}

function resolveFixturePath(
  flowName: string,
  modeName: string | undefined,
  override: string | undefined,
  flowRoot: string | undefined,
): string {
  if (override !== undefined) return resolve(override);
  const root = resolve(flowRoot ?? 'generated/flows');
  // When a mode is explicitly requested, prefer the per-mode file if the
  // schematic author emitted one. Schematics with route_overrides produce
  // <mode>.json siblings of circuit.json — see scripts/emit-flows.mjs.
  // Falls back to circuit.json otherwise.
  if (modeName !== undefined) {
    const perMode = resolve(root, flowName, `${modeName}.json`);
    if (existsSync(perMode)) return perMode;
  }
  return resolve(root, flowName, 'circuit.json');
}

function progressReporter(enabled: boolean): ((event: ProgressEventValue) => void) | undefined {
  if (!enabled) return undefined;
  return (event) => {
    const parsed = ProgressEvent.parse(event);
    process.stderr.write(`${JSON.stringify(parsed)}\n`);
  };
}

function progressDisplay(
  text: string,
  importance: ProgressDisplay['importance'],
  tone: ProgressDisplay['tone'],
): ProgressDisplay {
  if (text.length <= MAX_PROGRESS_DISPLAY_TEXT_CHARS) return { text, importance, tone };
  return {
    text: `${text.slice(0, MAX_PROGRESS_DISPLAY_TEXT_CHARS - 14)} [truncated]`,
    importance,
    tone,
  };
}

function resolveCompiledFlowRoute(args: ParsedArgs): ResolvedCompiledFlowRoute {
  if (args.flowName !== undefined) {
    return {
      flowName: args.flowName,
      source: 'explicit',
      reason: 'explicit flow positional argument',
    };
  }
  if (args.goal === undefined) {
    throw new Error('--goal is required when not resuming a checkpoint');
  }
  return classifyCompiledFlowTask(args.goal);
}

function resolveEntryModeSelection(
  args: ParsedArgs,
  route: ResolvedCompiledFlowRoute,
): ResolvedEntryModeSelection {
  if (args.entryMode !== undefined) {
    return {
      entryModeName: args.entryMode,
      source: 'explicit',
      reason: 'explicit --mode/--entry-mode argument',
    };
  }
  if (args.depthProvided) return {};
  if (route.inferredEntryModeName !== undefined) {
    return {
      entryModeName: route.inferredEntryModeName,
      source: 'classifier',
      ...(route.inferredEntryModeReason === undefined
        ? {}
        : { reason: route.inferredEntryModeReason }),
    };
  }
  return {};
}

function loadFixture(fixturePath: string): { flow: CompiledFlow; bytes: Buffer } {
  if (!existsSync(fixturePath)) {
    throw new Error(`flow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync(fixturePath);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const flow = CompiledFlow.parse(raw);
  // Enforce flow-kind canonical stage-set policy at fixture load.
  // Validator: src/runtime/policy/flow-kind-policy.ts.
  const policy = validateCompiledFlowKindPolicy(flow);
  if (!policy.ok) {
    throw new Error(`flow fixture policy violation (${fixturePath}):\n  ${policy.reason}`);
  }
  return { flow, bytes };
}

function defaultChildCompiledFlowResolver(flowRoot: string | undefined): ChildCompiledFlowResolver {
  return (ref) => {
    const fixturePath = resolveFixturePath(
      ref.flow_id as unknown as string,
      ref.entry_mode as unknown as string | undefined,
      undefined,
      flowRoot,
    );
    return loadFixture(fixturePath);
  };
}

function assertFixtureMatchesRoute(flow: CompiledFlow, route: ResolvedCompiledFlowRoute): void {
  const flowId = flow.id as unknown as string;
  if (flowId !== route.flowName) {
    throw new Error(
      `flow fixture id mismatch: selected flow '${route.flowName}' but fixture declares '${flowId}'`,
    );
  }
}

export async function main(argv: readonly string[], options: CliMainOptions = {}): Promise<number> {
  if (argv[0] === 'handoff') {
    return runHandoffCommand(argv.slice(1), {
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }
  if (argv[0] === 'create') {
    return runCreateCommand(argv.slice(1), {
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }
  if (argv[0] === 'runs') {
    return runRunsCommand(argv.slice(1));
  }

  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  if (
    args.command === 'resume' &&
    args.runFolder !== undefined &&
    args.checkpointChoice !== undefined
  ) {
    const runFolder = resolve(args.runFolder);
    const selectionConfigLayers = discoverConfigLayers({
      ...(options.configHomeDir !== undefined ? { homeDir: options.configHomeDir } : {}),
      ...(options.configCwd !== undefined ? { cwd: options.configCwd } : {}),
    });
    const progress = progressReporter(args.progress === 'jsonl');
    const outcome = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: args.checkpointChoice,
      projectRoot: resolve(options.configCwd ?? process.cwd()),
      now: options.now ?? (() => new Date()),
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      childCompiledFlowResolver: defaultChildCompiledFlowResolver(undefined),
      ...(progress === undefined ? {} : { progress }),
      ...(selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers }),
    });
    const operatorSummary = writeOperatorSummary({
      runFolder: outcome.runFolder,
      runResult: outcome.result,
      route: {
        selectedFlow: outcome.result.flow_id as unknown as string,
      },
    });
    const resumeResultPath =
      outcome.result.outcome === 'checkpoint_waiting'
        ? {}
        : { result_path: `${outcome.runFolder}/reports/result.json` };
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: 1,
          run_id: outcome.result.run_id,
          flow_id: outcome.result.flow_id,
          run_folder: outcome.runFolder,
          outcome: outcome.result.outcome,
          trace_entries_observed: outcome.result.trace_entries_observed,
          ...resumeResultPath,
          operator_summary_path: operatorSummary.jsonPath,
          operator_summary_markdown_path: operatorSummary.markdownPath,
          ...(outcome.result.outcome === 'checkpoint_waiting'
            ? { checkpoint: outcome.result.checkpoint }
            : {}),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  if (args.goal === undefined) {
    throw new Error('internal error: --goal missing outside checkpoint resume mode');
  }

  const route = resolveCompiledFlowRoute(args);
  const entryModeSelection = resolveEntryModeSelection(args, route);
  const fixturePath = resolveFixturePath(
    route.flowName,
    entryModeSelection.entryModeName,
    args.fixturePath,
    args.flowRoot,
  );
  const { flow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(flow, route);
  const runId = RunId.parse(options.runId ?? randomUUID());
  const now = options.now ?? (() => new Date());
  const progress = progressReporter(args.progress === 'jsonl');
  progress?.({
    schema_version: 1,
    type: 'route.selected',
    run_id: runId,
    flow_id: flow.id,
    recorded_at: now().toISOString(),
    label: `Selected ${route.flowName}`,
    display: progressDisplay(
      entryModeSelection.entryModeName === undefined
        ? `Circuit selected ${route.flowName}: ${route.reason}`
        : `Circuit selected ${route.flowName} with ${entryModeSelection.entryModeName} thoroughness: ${route.reason}`,
      'major',
      'info',
    ),
    selected_flow: flow.id,
    routed_by: route.source,
    router_reason: route.reason,
    ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
    ...(entryModeSelection.entryModeName === undefined
      ? {}
      : { entry_mode: entryModeSelection.entryModeName }),
    ...(entryModeSelection.source === undefined
      ? {}
      : { entry_mode_source: entryModeSelection.source }),
  });
  const runFolder = resolve(args.runFolder ?? `${DEFAULT_RUNS_BASE}/${runId as unknown as string}`);
  const selectionConfigLayers = discoverConfigLayers({
    ...(options.configHomeDir !== undefined ? { homeDir: options.configHomeDir } : {}),
    ...(options.configCwd !== undefined ? { cwd: options.configCwd } : {}),
  });

  const change_kind: ChangeKindDeclaration = {
    change_kind: 'ratchet-advance',
    failure_mode: 'circuit flow invocation has no executable product proof',
    acceptance_evidence:
      'trace.ndjson + state.json + manifest.snapshot.json + reports/result.json from clean checkout',
    alternate_framing:
      'defer the runtime proof; not an option because the CLI is the proof harness and must produce a real run-folder per invocation.',
  };

  const invocation: CompiledFlowInvocation = {
    runFolder,
    flow,
    flowBytes: bytes,
    projectRoot: resolve(options.configCwd ?? process.cwd()),
    runId,
    goal: args.goal,
    change_kind,
    now,
  };
  if (args.depth !== undefined) invocation.depth = args.depth;
  if (entryModeSelection.entryModeName !== undefined) {
    invocation.entryModeName = entryModeSelection.entryModeName;
  }
  if (options.relayer !== undefined) invocation.relayer = options.relayer;
  if (options.composeWriter !== undefined) invocation.composeWriter = options.composeWriter;
  invocation.childCompiledFlowResolver = defaultChildCompiledFlowResolver(args.flowRoot);
  if (progress !== undefined) invocation.progress = progress;
  if (selectionConfigLayers.length > 0) {
    invocation.selectionConfigLayers = selectionConfigLayers;
  }
  if (args.includeUntrackedContent) {
    invocation.evidencePolicy = { includeUntrackedFileContent: true };
  }

  const outcome = await runCompiledFlow(invocation);
  const operatorSummary = writeOperatorSummary({
    runFolder: outcome.runFolder,
    runResult: outcome.result,
    route: {
      selectedFlow: route.flowName,
      routedBy: route.source,
      routerReason: route.reason,
    },
  });
  const resultPath =
    outcome.result.outcome === 'checkpoint_waiting'
      ? {}
      : { result_path: `${outcome.runFolder}/reports/result.json` };

  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        run_id: outcome.result.run_id,
        flow_id: outcome.result.flow_id,
        selected_flow: route.flowName,
        routed_by: route.source,
        router_reason: route.reason,
        ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
        ...(entryModeSelection.entryModeName === undefined
          ? {}
          : { entry_mode: entryModeSelection.entryModeName }),
        ...(entryModeSelection.source === undefined
          ? {}
          : { entry_mode_source: entryModeSelection.source }),
        run_folder: outcome.runFolder,
        outcome: outcome.result.outcome,
        trace_entries_observed: outcome.result.trace_entries_observed,
        ...resultPath,
        operator_summary_path: operatorSummary.jsonPath,
        operator_summary_markdown_path: operatorSummary.markdownPath,
        ...(outcome.result.outcome === 'checkpoint_waiting'
          ? { checkpoint: outcome.result.checkpoint }
          : {}),
      },
      null,
      2,
    )}\n`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].split('/').pop() ?? ''));

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
