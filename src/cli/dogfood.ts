import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RunId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { Rigor } from '../schemas/rigor.js';
import { Workflow } from '../schemas/workflow.js';

import { discoverConfigLayers } from '../runtime/config-loader.js';
import { validateWorkflowKindPolicy } from '../runtime/policy/workflow-kind-policy.js';
import { classifyWorkflowTask } from '../runtime/router.js';
import {
  type DispatchFn,
  type DogfoodInvocation,
  resumeDogfoodCheckpoint,
  runDogfood,
} from '../runtime/runner.js';

// Runtime CLI entrypoint (grown from the Slice 27d dogfood proof and now
// exposed through src/cli/circuit.ts + ./bin/circuit-next). Loads the named workflow fixture at
// `.claude-plugin/skills/<workflow-name>/circuit.json`, parses it through
// the production `Workflow` schema, calls `validateWorkflowKindPolicy`,
// composes the runtime boundary via the runner, and prints the
// <run-root> path on success.
//
// Invocation-layer config remains narrow (`--goal`, `--rigor`, `--run-root`,
// `--fixture`), but the product path now discovers user-global and project
// config files and supplies them as `LayeredConfig`s to the selection
// resolver.
//
// `--dry-run` fails closed. An earlier version accepted the flag as a
// no-op while still spawning the real adapter — a safety bug. The flag
// stays rejected until real dry-run support lands.

const DEFAULT_RUNS_BASE = '.circuit-next/runs';

interface ParsedArgs {
  command?: 'resume';
  workflowName?: string;
  goal?: string;
  rigor?: Rigor;
  rigorProvided: boolean;
  entryMode?: string;
  runRoot?: string;
  fixturePath?: string;
  checkpointChoice?: string;
}

interface ResolvedWorkflowRoute {
  workflowName: string;
  source: 'explicit' | 'classifier';
  reason: string;
  matched_signal?: string;
}

export interface CliMainOptions {
  dispatcher?: DispatchFn;
  now?: () => Date;
  runId?: string;
  configHomeDir?: string;
  configCwd?: string;
}

function usage(): string {
  return [
    'usage: circuit-next [workflow-name] --goal "<goal>" [--entry-mode <default|lite|deep|autonomous>] [--rigor <lite|standard|deep|tournament|autonomous>] [--run-root <path>] [--fixture <path>]',
    '       circuit-next resume --run-root <path> --checkpoint-choice <choice>',
    '',
    'With an explicit workflow name, loads .claude-plugin/skills/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review/build workflows and then composes the runtime boundary against the real `dispatchAgent`.',
    '',
    'Config: if present, loads ~/.config/circuit-next/config.yaml and ./.circuit/config.yaml from the current working directory into the selection resolver before dispatch.',
    '',
    'Note: `--dry-run` is not implemented and is rejected. An earlier version silently invoked the real adapter while reporting dry_run:true, which is a safety bug; the flag stays rejected until real dry-run support lands.',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the workflow name.
  let workflowName: string | undefined;
  let command: 'resume' | undefined;
  let goal: string | undefined;
  let rigor: Rigor | undefined;
  let rigorProvided = false;
  let entryMode: string | undefined;
  let runRoot: string | undefined;
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
    if (tok === '--rigor') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--rigor requires a value');
      rigor = Rigor.parse(next);
      rigorProvided = true;
      i += 1;
      continue;
    }
    if (tok === '--entry-mode') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--entry-mode requires a value');
      if (next.length === 0) throw new Error('--entry-mode requires a non-empty value');
      entryMode = next;
      i += 1;
      continue;
    }
    if (tok === '--run-root') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--run-root requires a value');
      runRoot = next;
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
      // the real adapter still ran. Re-enable once real dry-run support
      // lands (deterministic dry dispatcher + event log marker).
      throw new Error(
        '--dry-run is not currently implemented and is rejected. An earlier version silently invoked the real adapter while reporting dry_run:true, which is a safety bug. The flag stays rejected until real dry-run support lands.',
      );
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (tok.startsWith('--')) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if (tok === 'resume' && workflowName === undefined && command === undefined) {
      command = 'resume';
      continue;
    }
    if (workflowName === undefined) {
      workflowName = tok;
      continue;
    }
    throw new Error(`unexpected positional argument: ${tok}`);
  }

  if (command === 'resume' || checkpointChoice !== undefined) {
    if (command !== 'resume') {
      throw new Error('checkpoint resume must use the `resume` subcommand');
    }
    if (runRoot === undefined) throw new Error('--run-root is required for checkpoint resume');
    if (checkpointChoice === undefined || checkpointChoice.length === 0) {
      throw new Error('--checkpoint-choice is required for checkpoint resume');
    }
    if (workflowName !== undefined) {
      throw new Error('checkpoint resume loads the saved workflow manifest; omit workflow-name');
    }
    if (goal !== undefined) {
      throw new Error('checkpoint resume reuses the saved run goal; omit --goal');
    }
    if (fixturePath !== undefined) {
      throw new Error('checkpoint resume loads the saved workflow manifest; omit --fixture');
    }
    if (rigorProvided) {
      throw new Error('checkpoint resume reuses the saved run rigor; omit --rigor');
    }
    if (entryMode !== undefined) {
      throw new Error('checkpoint resume reuses the saved workflow position; omit --entry-mode');
    }
  } else if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    rigorProvided,
  };
  if (rigor !== undefined) result.rigor = rigor;
  if (entryMode !== undefined) result.entryMode = entryMode;
  if (command !== undefined) result.command = command;
  if (goal !== undefined) result.goal = goal;
  if (workflowName !== undefined) result.workflowName = workflowName;
  if (runRoot !== undefined) result.runRoot = runRoot;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  if (checkpointChoice !== undefined) result.checkpointChoice = checkpointChoice;
  return result;
}

function resolveFixturePath(
  workflowName: string,
  modeName: string | undefined,
  override: string | undefined,
): string {
  if (override !== undefined) return resolve(override);
  // When a mode is explicitly requested, prefer the per-mode file if the
  // recipe author emitted one (recipes with route_overrides produce
  // <mode>.json siblings of circuit.json — see scripts/emit-workflows.mjs).
  // Falls back to the canonical circuit.json otherwise.
  if (modeName !== undefined) {
    const perMode = resolve(`.claude-plugin/skills/${workflowName}/${modeName}.json`);
    if (existsSync(perMode)) return perMode;
  }
  return resolve(`.claude-plugin/skills/${workflowName}/circuit.json`);
}

function resolveWorkflowRoute(args: ParsedArgs): ResolvedWorkflowRoute {
  if (args.workflowName !== undefined) {
    return {
      workflowName: args.workflowName,
      source: 'explicit',
      reason: 'explicit workflow positional argument',
    };
  }
  if (args.goal === undefined) {
    throw new Error('--goal is required when not resuming a checkpoint');
  }
  return classifyWorkflowTask(args.goal);
}

function loadFixture(fixturePath: string): { workflow: Workflow; bytes: Buffer } {
  if (!existsSync(fixturePath)) {
    throw new Error(`workflow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync(fixturePath);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const workflow = Workflow.parse(raw);
  // Slice 43a (P2.5 HIGH 5): enforce workflow-kind canonical phase-set
  // policy at runtime fixture load. Same table used by
  // scripts/audit.mjs Check 24. See src/runtime/policy/
  // workflow-kind-policy.ts for the validator.
  const policy = validateWorkflowKindPolicy(workflow);
  if (!policy.ok) {
    throw new Error(`workflow fixture policy violation (${fixturePath}):\n  ${policy.reason}`);
  }
  return { workflow, bytes };
}

function assertFixtureMatchesRoute(workflow: Workflow, route: ResolvedWorkflowRoute): void {
  const workflowId = workflow.id as unknown as string;
  if (workflowId !== route.workflowName) {
    throw new Error(
      `workflow fixture id mismatch: selected workflow '${route.workflowName}' but fixture declares '${workflowId}'`,
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
    args.runRoot !== undefined &&
    args.checkpointChoice !== undefined
  ) {
    const runRoot = resolve(args.runRoot);
    const selectionConfigLayers = discoverConfigLayers({
      ...(options.configHomeDir !== undefined ? { homeDir: options.configHomeDir } : {}),
      ...(options.configCwd !== undefined ? { cwd: options.configCwd } : {}),
    });
    const outcome = await resumeDogfoodCheckpoint({
      runRoot,
      selection: args.checkpointChoice,
      projectRoot: resolve(options.configCwd ?? process.cwd()),
      now: options.now ?? (() => new Date()),
      ...(options.dispatcher === undefined ? {} : { dispatcher: options.dispatcher }),
      ...(selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers }),
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: 1,
          run_id: outcome.result.run_id,
          workflow_id: outcome.result.workflow_id,
          run_root: outcome.runRoot,
          outcome: outcome.result.outcome,
          events_observed: outcome.result.events_observed,
          result_path: `${outcome.runRoot}/artifacts/result.json`,
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

  const route = resolveWorkflowRoute(args);
  const fixturePath = resolveFixturePath(route.workflowName, args.entryMode, args.fixturePath);
  const { workflow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(workflow, route);
  const runId = RunId.parse(options.runId ?? randomUUID());
  const now = options.now ?? (() => new Date());
  const runRoot = resolve(args.runRoot ?? `${DEFAULT_RUNS_BASE}/${runId as unknown as string}`);
  const selectionConfigLayers = discoverConfigLayers({
    ...(options.configHomeDir !== undefined ? { homeDir: options.configHomeDir } : {}),
    ...(options.configCwd !== undefined ? { cwd: options.configCwd } : {}),
  });

  const lane: LaneDeclaration = {
    lane: 'ratchet-advance',
    failure_mode: 'circuit workflow invocation has no executable product proof',
    acceptance_evidence:
      'events.ndjson + state.json + manifest.snapshot.json + artifacts/result.json from clean checkout',
    alternate_framing:
      'defer Alpha Proof to post-Phase-2; not an option because ADR-0001 Addendum B gates Phase 2 on this.',
  };

  const invocation: DogfoodInvocation = {
    runRoot,
    workflow,
    workflowBytes: bytes,
    projectRoot: resolve(options.configCwd ?? process.cwd()),
    runId,
    goal: args.goal,
    lane,
    now,
  };
  if (args.rigor !== undefined) invocation.rigor = args.rigor;
  if (args.entryMode !== undefined) invocation.entryModeName = args.entryMode;
  if (options.dispatcher !== undefined) invocation.dispatcher = options.dispatcher;
  if (selectionConfigLayers.length > 0) {
    invocation.selectionConfigLayers = selectionConfigLayers;
  }

  const outcome = await runDogfood(invocation);
  const resultPath =
    outcome.result.outcome === 'checkpoint_waiting'
      ? {}
      : { result_path: `${outcome.runRoot}/artifacts/result.json` };

  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        run_id: outcome.result.run_id,
        workflow_id: outcome.result.workflow_id,
        selected_workflow: route.workflowName,
        routed_by: route.source,
        router_reason: route.reason,
        ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
        run_root: outcome.runRoot,
        outcome: outcome.result.outcome,
        events_observed: outcome.result.events_observed,
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
