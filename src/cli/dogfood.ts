import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RunId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { Rigor } from '../schemas/rigor.js';
import { Workflow } from '../schemas/workflow.js';

import { validateWorkflowKindPolicy } from '../runtime/policy/workflow-kind-policy.js';
import { classifyWorkflowTask } from '../runtime/router.js';
import { type DispatchFn, type DogfoodInvocation, runDogfood } from '../runtime/runner.js';

// Slice 27d CLI entrypoint (extended at Slice 43c to accept `explore`
// alongside `dogfood-run-0`). Loads the named workflow fixture at
// `.claude-plugin/skills/<workflow-name>/circuit.json`, parses it through
// the production `Workflow` schema, calls `validateWorkflowKindPolicy`,
// composes the runtime boundary via `runDogfood`, and prints the
// <run-root> path on success.
//
// Invocation-layer config only (`--goal`, `--rigor`, `--run-root`,
// `--fixture`). No user-global or project config layer yet.
//
// Slice 44 arc-close fold-in (Codex HIGH 4): `--dry-run` is no longer
// silently accepted as a no-op. Pre-Slice-44, the flag was accepted for
// forward compatibility but did nothing — the real `dispatchAgent`
// adapter (Slice 42) + five-event materialization (Slice 43b) ran
// regardless, while the JSON output reported `dry_run: true`. That is a
// safety + evidence-labeling bug: a user running `--dry-run` would
// spawn `claude -p` while believing they were in a dry-run mode.
// Pre-ceremony behavior: flag now fails closed with a clear error
// pointing at the future slice where dry-run support lands. See
// specs/reviews/arc-slices-41-to-43-composition-review-codex.md §HIGH 4.

const DEFAULT_RUNS_BASE = '.circuit-next/runs';

interface ParsedArgs {
  workflowName?: string;
  goal: string;
  rigor: Rigor;
  runRoot?: string;
  fixturePath?: string;
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
}

function usage(): string {
  return [
    'usage: circuit:run -- [workflow-name] --goal "<goal>" [--rigor <lite|standard|deep|tournament|autonomous>] [--run-root <path>] [--fixture <path>]',
    '',
    'v0.1 scope: with an explicit workflow name, loads .claude-plugin/skills/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review workflows and then composes the runtime boundary via runDogfood against the real `dispatchAgent`.',
    '',
    'Note: `--dry-run` is not implemented. Pre-Slice-44 the flag was accepted as a no-op while the real adapter ran anyway; the arc-close review flagged this as a safety bug and the flag is now rejected until dry-run support lands (tracked in specs/plans/phase-2-implementation.md post-Slice-44 backlog).',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the workflow name.
  let workflowName: string | undefined;
  let goal: string | undefined;
  let rigor: Rigor | undefined;
  let runRoot: string | undefined;
  let fixturePath: string | undefined;

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
    if (tok === '--dry-run') {
      // Slice 44 arc-close fold-in (Codex HIGH 4): fail-closed. The flag
      // previously accepted silently while the real adapter still ran;
      // see specs/reviews/arc-slices-41-to-43-composition-review-codex.md
      // §HIGH 4. Re-enable once dry-run support actually lands (inject a
      // deterministic dry dispatcher + event log marker).
      throw new Error(
        '--dry-run is not currently implemented. Pre-Slice-44 the flag silently invoked the real adapter while reporting dry_run:true; the arc-close review (specs/reviews/arc-slices-41-to-43-composition-review-codex.md §HIGH 4) flagged this as a safety bug. The flag is rejected until dry-run support lands.',
      );
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (tok.startsWith('--')) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if (workflowName === undefined) {
      workflowName = tok;
      continue;
    }
    throw new Error(`unexpected positional argument: ${tok}`);
  }

  if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    goal,
    rigor: rigor ?? Rigor.parse('standard'),
  };
  if (workflowName !== undefined) result.workflowName = workflowName;
  if (runRoot !== undefined) result.runRoot = runRoot;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  return result;
}

function resolveFixturePath(workflowName: string, override: string | undefined): string {
  if (override !== undefined) return resolve(override);
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

  const route = resolveWorkflowRoute(args);
  const fixturePath = resolveFixturePath(route.workflowName, args.fixturePath);
  const { workflow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(workflow, route);
  const runId = RunId.parse(options.runId ?? randomUUID());
  const now = options.now ?? (() => new Date());
  const runRoot = resolve(args.runRoot ?? `${DEFAULT_RUNS_BASE}/${runId as unknown as string}`);

  const lane: LaneDeclaration = {
    lane: 'ratchet-advance',
    failure_mode: 'dogfood-run-0 invocation has no executable product proof',
    acceptance_evidence:
      'events.ndjson + state.json + manifest.snapshot.json + artifacts/result.json from clean checkout',
    alternate_framing:
      'defer Alpha Proof to post-Phase-2; not an option because ADR-0001 Addendum B gates Phase 2 on this.',
  };

  const invocation: DogfoodInvocation = {
    runRoot,
    workflow,
    workflowBytes: bytes,
    runId,
    goal: args.goal,
    rigor: args.rigor,
    lane,
    now,
  };
  if (options.dispatcher !== undefined) invocation.dispatcher = options.dispatcher;

  const outcome = await runDogfood(invocation);

  process.stdout.write(
    `${JSON.stringify(
      {
        run_id: outcome.result.run_id,
        workflow_id: outcome.result.workflow_id,
        selected_workflow: route.workflowName,
        routed_by: route.source,
        router_reason: route.reason,
        ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
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

const invokedDirectly =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].split('/').pop() ?? ''));

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`error: ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
