import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RunId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { Rigor } from '../schemas/rigor.js';
import { Workflow } from '../schemas/workflow.js';

import { runDogfood } from '../runtime/runner.js';

// Slice 27d CLI entrypoint for `npm run circuit:run -- dogfood-run-0 ...`.
// Loads the dogfood-run-0 workflow fixture at
// `.claude-plugin/skills/dogfood-run-0/circuit.json`, parses it through
// the production `Workflow` schema, composes the runtime boundary via
// `runDogfood`, and prints the <run-root> path on success.
//
// v0.1 scope: invocation-layer config only (`--goal`, `--rigor`, `--dry-run`,
// `--run-root`). No user-global or project config layer yet. `--dry-run`
// is accepted for forward compatibility but is a no-op in v0.1 because the
// dogfood loop has no real dispatch to suppress; the dry-run agent adapter
// is structural to the loop.

const DEFAULT_FIXTURE_RELATIVE = '.claude-plugin/skills/dogfood-run-0/circuit.json';
const DEFAULT_RUNS_BASE = '.circuit-next/runs';

interface ParsedArgs {
  workflowName: string;
  goal: string;
  rigor: Rigor;
  dryRun: boolean;
  runRoot?: string;
  fixturePath?: string;
}

function usage(): string {
  return [
    'usage: circuit:run -- <workflow-name> --goal "<goal>" [--rigor <lite|standard|deep|tournament|autonomous>] [--dry-run] [--run-root <path>] [--fixture <path>]',
    '',
    'v0.1 scope: dogfood-run-0 only. Loads .claude-plugin/skills/<name>/circuit.json and composes the runtime boundary.',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the workflow name.
  let workflowName: string | undefined;
  let goal: string | undefined;
  let rigor: Rigor | undefined;
  let dryRun = false;
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
      dryRun = true;
      continue;
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

  if (workflowName === undefined) {
    throw new Error(`workflow name is required.\n${usage()}`);
  }
  if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    workflowName,
    goal,
    rigor: rigor ?? Rigor.parse('standard'),
    dryRun,
  };
  if (runRoot !== undefined) result.runRoot = runRoot;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  return result;
}

function resolveFixturePath(workflowName: string, override: string | undefined): string {
  if (override !== undefined) return resolve(override);
  return resolve(`.claude-plugin/skills/${workflowName}/circuit.json`);
}

function loadFixture(fixturePath: string): { workflow: Workflow; bytes: Buffer } {
  if (!existsSync(fixturePath)) {
    throw new Error(`workflow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync(fixturePath);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const workflow = Workflow.parse(raw);
  return { workflow, bytes };
}

export function main(argv: readonly string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  const fixturePath = resolveFixturePath(args.workflowName, args.fixturePath);
  if (args.workflowName !== 'dogfood-run-0' && fixturePath.includes(DEFAULT_FIXTURE_RELATIVE)) {
    process.stderr.write(
      `warning: v0.1 only exercises 'dogfood-run-0'; '${args.workflowName}' is not yet supported\n`,
    );
  }

  const { workflow, bytes } = loadFixture(fixturePath);
  const runId = RunId.parse(randomUUID());
  const now = () => new Date();
  const runRoot = resolve(args.runRoot ?? `${DEFAULT_RUNS_BASE}/${runId as unknown as string}`);

  const lane: LaneDeclaration = {
    lane: 'ratchet-advance',
    failure_mode: 'dogfood-run-0 invocation has no executable product proof',
    acceptance_evidence:
      'events.ndjson + state.json + manifest.snapshot.json + artifacts/result.json from clean checkout',
    alternate_framing:
      'defer Alpha Proof to post-Phase-2; not an option because ADR-0001 Addendum B gates Phase 2 on this.',
  };

  const outcome = runDogfood({
    runRoot,
    workflow,
    workflowBytes: bytes,
    runId,
    goal: args.goal,
    rigor: args.rigor,
    lane,
    now,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        run_id: outcome.result.run_id,
        run_root: outcome.runRoot,
        outcome: outcome.result.outcome,
        events_observed: outcome.result.events_observed,
        result_path: `${outcome.runRoot}/artifacts/result.json`,
        dry_run: args.dryRun,
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
  const code = main(process.argv.slice(2));
  process.exit(code);
}
