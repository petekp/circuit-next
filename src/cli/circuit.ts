import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ChangeKindDeclaration } from '../schemas/change-kind.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { Depth } from '../schemas/depth.js';
import { RunId } from '../schemas/ids.js';

import { discoverConfigLayers } from '../runtime/config-loader.js';
import { validateCompiledFlowKindPolicy } from '../runtime/policy/flow-kind-policy.js';
import { classifyCompiledFlowTask } from '../runtime/router.js';
import {
  type CompiledFlowInvocation,
  type RelayFn,
  resumeCompiledFlowCheckpoint,
  runCompiledFlow,
} from '../runtime/runner.js';

// Runtime CLI entry point — invoked through ./bin/circuit-next. Loads the
// named flow fixture at `.claude-plugin/skills/<flow-name>/circuit.json`,
// parses it through the production `CompiledFlow` schema, calls
// `validateCompiledFlowKindPolicy`, composes the runtime boundary via the runner,
// and prints the <run-folder> path on success.
//
// Invocation-layer config remains narrow (`--goal`, `--depth`, `--run-folder`,
// `--fixture`), but the product path now discovers user-global and project
// config files and supplies them as `LayeredConfig`s to the selection
// resolver.
//
// `--dry-run` fails closed. An earlier version accepted the flag as a
// no-op while still spawning the real connector — a safety bug. The flag
// stays rejected until real dry-run support lands.

const DEFAULT_RUNS_BASE = '.circuit-next/runs';

interface ParsedArgs {
  command?: 'resume';
  flowName?: string;
  goal?: string;
  depth?: Depth;
  depthProvided: boolean;
  entryMode?: string;
  runFolder?: string;
  fixturePath?: string;
  checkpointChoice?: string;
}

interface ResolvedCompiledFlowRoute {
  flowName: string;
  source: 'explicit' | 'classifier';
  reason: string;
  matched_signal?: string;
}

export interface CliMainOptions {
  relayer?: RelayFn;
  now?: () => Date;
  runId?: string;
  configHomeDir?: string;
  configCwd?: string;
}

function usage(): string {
  return [
    'usage: circuit-next [flow-name] --goal "<goal>" [--mode <default|lite|deep|autonomous>] [--depth <lite|standard|deep|tournament|autonomous>] [--run-folder <path>] [--fixture <path>]',
    '       circuit-next resume --run-folder <path> --checkpoint-choice <choice>',
    '',
    '`--mode` is the friendly alias for `--entry-mode`; `--depth` is the friendly alias for `--depth`; `--run-folder` is the friendly alias for `--run-folder`. The legacy flag names are still accepted; supplying both forms of the same option is an error.',
    '',
    'With an explicit flow name, loads .claude-plugin/skills/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review/fix/build flows and then composes the runtime boundary against the real `relayAgent`.',
    '',
    'Config: if present, loads ~/.config/circuit-next/config.yaml and ./.circuit/config.yaml from the current working directory into the selection resolver before relay.',
    '',
    'Note: `--dry-run` is not implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug; the flag stays rejected until real dry-run support lands.',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the flow name.
  let flowName: string | undefined;
  let command: 'resume' | undefined;
  let goal: string | undefined;
  let depth: Depth | undefined;
  let depthProvided = false;
  let entryMode: string | undefined;
  let runFolder: string | undefined;
  let fixturePath: string | undefined;
  let checkpointChoice: string | undefined;

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
    if (tok === '--depth' || tok === '--depth') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (depthProvided) {
        throw new Error('use either --depth or --depth, not both');
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
    if (tok === '--run-folder' || tok === '--run-folder') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (runFolder !== undefined) {
        throw new Error('use either --run-folder or --run-folder, not both');
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
    if (tok === '--checkpoint-choice') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--checkpoint-choice requires a value');
      checkpointChoice = next;
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
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (tok.startsWith('--')) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if (tok === 'resume' && flowName === undefined && command === undefined) {
      command = 'resume';
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
    if (runFolder === undefined)
      throw new Error('--run-folder (or --run-folder) is required for checkpoint resume');
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
    if (depthProvided) {
      throw new Error('checkpoint resume reuses the saved run depth; omit --depth/--depth');
    }
    if (entryMode !== undefined) {
      throw new Error('checkpoint resume reuses the saved flow position; omit --mode/--entry-mode');
    }
  } else if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    depthProvided,
  };
  if (depth !== undefined) result.depth = depth;
  if (entryMode !== undefined) result.entryMode = entryMode;
  if (command !== undefined) result.command = command;
  if (goal !== undefined) result.goal = goal;
  if (flowName !== undefined) result.flowName = flowName;
  if (runFolder !== undefined) result.runFolder = runFolder;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  if (checkpointChoice !== undefined) result.checkpointChoice = checkpointChoice;
  return result;
}

function resolveFixturePath(
  flowName: string,
  modeName: string | undefined,
  override: string | undefined,
): string {
  if (override !== undefined) return resolve(override);
  // When a mode is explicitly requested, prefer the per-mode file if the
  // schematic author emitted one (schematics with route_overrides produce
  // <mode>.json siblings of circuit.json — see scripts/emit-flows.mjs).
  // Falls back to the canonical circuit.json otherwise.
  if (modeName !== undefined) {
    const perMode = resolve(`.claude-plugin/skills/${flowName}/${modeName}.json`);
    if (existsSync(perMode)) return perMode;
  }
  return resolve(`.claude-plugin/skills/${flowName}/circuit.json`);
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

function loadFixture(fixturePath: string): { flow: CompiledFlow; bytes: Buffer } {
  if (!existsSync(fixturePath)) {
    throw new Error(`flow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync(fixturePath);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const flow = CompiledFlow.parse(raw);
  // Enforce flow-kind canonical stage-set policy at runtime fixture
  // load. See src/runtime/policy/flow-kind-policy.ts for the
  // validator.
  const policy = validateCompiledFlowKindPolicy(flow);
  if (!policy.ok) {
    throw new Error(`flow fixture policy violation (${fixturePath}):\n  ${policy.reason}`);
  }
  return { flow, bytes };
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
    const outcome = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: args.checkpointChoice,
      projectRoot: resolve(options.configCwd ?? process.cwd()),
      now: options.now ?? (() => new Date()),
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers }),
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: 1,
          run_id: outcome.result.run_id,
          flow_id: outcome.result.flow_id,
          run_folder: outcome.runFolder,
          outcome: outcome.result.outcome,
          trace_entries_observed: outcome.result.trace_entries_observed,
          result_path: `${outcome.runFolder}/reports/result.json`,
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
  const fixturePath = resolveFixturePath(route.flowName, args.entryMode, args.fixturePath);
  const { flow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(flow, route);
  const runId = RunId.parse(options.runId ?? randomUUID());
  const now = options.now ?? (() => new Date());
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
      'defer Alpha Proof to post-Stage-2; not an option because ADR-0001 Addendum B checks Stage 2 on this.',
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
  if (args.entryMode !== undefined) invocation.entryModeName = args.entryMode;
  if (options.relayer !== undefined) invocation.relayer = options.relayer;
  if (selectionConfigLayers.length > 0) {
    invocation.selectionConfigLayers = selectionConfigLayers;
  }

  const outcome = await runCompiledFlow(invocation);
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
        run_folder: outcome.runFolder,
        outcome: outcome.result.outcome,
        trace_entries_observed: outcome.result.trace_entries_observed,
        ...resultPath,
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
