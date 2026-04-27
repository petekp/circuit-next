import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId, WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { ManifestSnapshot } from '../../src/schemas/manifest.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

// Slice 27d — runner smoke test exercising one synthesis + one dispatch
// step end-to-end via the dry-run agent adapter (per ADR-0001 Addendum B
// §Phase 1.5 Close Criteria #4/#5/#6/#7). The test reads the production
// dogfood-run-0 workflow fixture — the same JSON a user invocation of
// `./bin/circuit-next dogfood-run-0 ...` would load — and composes
// the runtime boundary via `runWorkflow`.
//
// Two-run acceptance: same fixture, two different goals, two different
// result.json files with differing `goal` and `run_id` fields satisfy
// Close Criterion #4 "two different fixtures or goals ... differing
// result artifacts". The byte-match gate is also exercised end-to-end.

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

// Slice 43b: deterministic stub dispatcher so the runner smoke doesn't
// spawn a real `claude` subprocess. The capability-boundary assertion at
// parseAgentStdout is a real-subprocess-only concern; the stub satisfies
// the DispatchResult shape without traversing that path. The
// AGENT_SMOKE-gated explore e2e (Slice 43c) exercises the real adapter
// end-to-end.
//
// Slice 45a (P2.6 HIGH 3 fold-in): lifted into the structured
// `DispatchFn` descriptor shape. The stub binds `adapterName: 'agent'`
// so the runner's `dispatch.started` event records the agent identity
// for this smoke suite; Slice 45a's dedicated codex-routing regression
// test at `runner-dispatch-adapter-identity.test.ts` exercises the
// `adapterName: 'codex'` branch.
function stubDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-dogfood-run-0',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'dogfood-run-0 smoke needs end-to-end product proof',
    acceptance_evidence:
      'runner smoke test closes a run with events/state/manifest/result artifacts',
    alternate_framing:
      'skip the runner smoke entirely — not viable because Close Criterion #5 requires reducer-derived state.json and result.json evidence.',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-27d-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Slice 27d — dogfood-run-0 runner smoke', () => {
  it('closes one run producing events.ndjson / state.json / manifest.snapshot.json / artifacts/result.json', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'run-a');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('11111111-1111-1111-1111-111111111111'),
      goal: 'prove circuit-next can close one run',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 20, 12, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runRoot, 'events.ndjson'))).toBe(true);
    expect(existsSync(join(runRoot, 'state.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'manifest.snapshot.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);

    // Snapshot parses cleanly and advances to status=complete.
    const snap = Snapshot.parse(JSON.parse(readFileSync(join(runRoot, 'state.json'), 'utf8')));
    expect(snap.status).toBe('complete');
    expect(snap.events_consumed).toBe(outcome.events.length);

    // RunLog reconstructed from NDJSON parses cleanly; last event is
    // run.closed; bootstrap is first.
    const log = readRunLog(runRoot);
    expect(log).toHaveLength(outcome.events.length);
    const first = log[0];
    const last = log[log.length - 1];
    if (first === undefined || first.kind !== 'run.bootstrapped') {
      throw new Error('expected run.bootstrapped first');
    }
    if (last === undefined || last.kind !== 'run.closed') {
      throw new Error('expected run.closed last');
    }

    // RunProjection binds log and snapshot (RUN-I6..I7).
    const projection = RunProjection.safeParse({ log, snapshot: snap });
    expect(projection.success).toBe(true);

    // ManifestSnapshot parses and its hash equals the run's manifest_hash.
    const manifest = ManifestSnapshot.parse(
      JSON.parse(readFileSync(join(runRoot, 'manifest.snapshot.json'), 'utf8')),
    );
    expect(manifest.hash).toBe(outcome.result.manifest_hash);
    expect(manifest.algorithm).toBe('sha256-raw');

    // result.json parses as RunResult with the expected bindings.
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
    );
    expect(result.workflow_id).toBe(WorkflowId.parse('dogfood-run-0'));
    expect(result.goal).toBe('prove circuit-next can close one run');
    expect(result.outcome).toBe('complete');
    expect(result.events_observed).toBe(log.length);
  });

  it('exercises synthesis + dispatch + gate event kinds via the injected-stub dispatcher', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'run-kinds');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('22222222-2222-2222-2222-222222222222'),
      goal: 'exercise the broader event-kind subset',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 20, 13, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const kinds = new Set(outcome.events.map((e) => e.kind));
    // Closure criterion: more than 27c's 4-kind subset is exercised. Slice
    // 43b widens the dispatch trail to the five-event transcript per
    // ADR-0007 §Amendment Slice 37; all five kinds must appear.
    expect(kinds.has('run.bootstrapped')).toBe(true);
    expect(kinds.has('step.entered')).toBe(true);
    expect(kinds.has('step.artifact_written')).toBe(true);
    expect(kinds.has('gate.evaluated')).toBe(true);
    expect(kinds.has('dispatch.started')).toBe(true);
    expect(kinds.has('dispatch.request')).toBe(true);
    expect(kinds.has('dispatch.receipt')).toBe(true);
    expect(kinds.has('dispatch.result')).toBe(true);
    expect(kinds.has('dispatch.completed')).toBe(true);
    expect(kinds.has('step.completed')).toBe(true);
    expect(kinds.has('run.closed')).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(11);

    // The dispatch.started event carries the dry-run agent adapter.
    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    expect(dispatchStarted.adapter).toEqual({ kind: 'builtin', name: 'agent' });
    // Slice 47a — `resolved_from` is now derived from the runner's
    // actual decision path (see runner.ts `deriveResolvedFrom`):
    // the test injects a stub dispatcher via `WorkflowInvocation.dispatcher`,
    // so the honest claim is `source: 'explicit'`. Pre-Slice-47a the
    // materializer hardcoded `source: 'default'` regardless of caller
    // (CONVERGENT HIGH A in the Phase 2-to-date comprehensive review).
    expect(dispatchStarted.resolved_from).toEqual({ source: 'explicit' });
    // Slice 47a — `resolved_selection` is now derived from
    // `workflow.default_selection` + `step.selection` (right-biased per
    // SEL precedence). The dogfood-run-0 fixture and the explore
    // fixture both use empty default selections at v0, so the canonical
    // empty selection is the honest claim — but it is now genuinely
    // empty, not fabricated.
    expect(dispatchStarted.resolved_selection).toEqual({ skills: [], invocation_options: {} });

    // run.closed is single and last.
    const closedEvents = outcome.events.filter((e) => e.kind === 'run.closed');
    expect(closedEvents).toHaveLength(1);
    expect(outcome.events[outcome.events.length - 1]?.kind).toBe('run.closed');
  });

  it('produces DIFFERING result.json artifacts from two runs with different goals (Close Criterion #4)', async () => {
    const { workflow, bytes } = loadFixture();

    const runA = await runWorkflow({
      runRoot: join(runRootBase, 'run-a'),
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      goal: 'prove circuit-next can close one run',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 20, 12, 0, 0)),
      dispatcher: stubDispatcher(),
    });
    const runB = await runWorkflow({
      runRoot: join(runRootBase, 'run-b'),
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      goal: 'prove circuit-next can close a SECOND run with a different goal',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 20, 13, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const resultA = readFileSync(join(runA.runRoot, 'artifacts', 'result.json'), 'utf8');
    const resultB = readFileSync(join(runB.runRoot, 'artifacts', 'result.json'), 'utf8');
    expect(resultA).not.toBe(resultB);
    expect(runA.result.run_id).not.toBe(runB.result.run_id);
    expect(runA.result.goal).not.toBe(runB.result.goal);
    expect(runA.result.summary).not.toBe(runB.result.summary);
    // Same workflow fixture ⇒ same manifest hash; this is the byte-match
    // property, not a freshness failure.
    expect(runA.result.manifest_hash).toBe(runB.result.manifest_hash);
  });

  it.skipIf(process.env.CLI_SMOKE !== '1')(
    'CLI entrypoint loads the fixture and closes a run end-to-end from a clean run-root (CLI_SMOKE=1)',
    async () => {
      // ADR-0001 Addendum B Close Criterion "CLI loading of
      // .claude-plugin/skills/dogfood-run-0/circuit.json is tested."
      //
      // Slice 47b (Codex Slice 47a comprehensive review HIGH 1 fold-in) —
      // pre-Slice-47b this test shelled the CLI through `tsx` to
      // exercise the same invocation `./bin/circuit-next` uses, but
      // tsx's parent-child IPC mechanism allocates `/tmp/tsx-<uid>/*.pipe`
      // and fails with `listen EPERM` in restricted-filesystem agent
      // sandboxes (Codex CLI sandbox; potentially CI workers under
      // hardened mounts). The CLI's exported `main(argv)` function is
      // the same entrypoint tsx invokes, so importing it directly
      // exercises every code path the subprocess version exercised
      // (argv parsing, fixture load, schema parse, runWorkflow
      // composition, JSON serialization to stdout) without depending
      // on the IPC pipe directory. The launcher binding is separately pinned
      // by the package.json contract test below so the binary path remains
      // covered.
      //
      // Slice 52 (Codex H11 fold-in — Clean-Clone Reality Gate): the
      // launcher binding moved from tsx to compiled JS. tsx's same
      // `/tmp/tsx-<uid>/*.pipe` EPERM failure class reproduces in
      // operator-local restricted-filesystem runs (not just sandboxed
      // agents), so the real launcher now invokes `dist/cli/circuit.js`.
      // The direct `main()` import strategy this test uses is unchanged —
      // `main()` is the same entrypoint both bindings converge on.
      //
      // Slice 47d (Codex HIGH 1 fold-in + Slice 47b Codex MED 1 deferred
      // subprocess-boundary contract trigger): `main()` invokes the real
      // `dispatchAgent` default (which spawns an authenticated `claude`
      // CLI subprocess). That default fails in sandboxed agent
      // environments where the `claude` CLI is unauthenticated, making
      // the test non-portable across operator-local and sandboxed
      // environments. Env-gated under CLI_SMOKE=1 (same pattern as
      // AGENT_SMOKE at Slice 43c + CODEX_SMOKE at Slice 45) so the
      // default `npm run verify` path does not depend on a live CLI.
      // Operator-local full coverage via `CLI_SMOKE=1 npm run verify`.
      // The env-gate IS the subprocess-boundary contract the Slice 47b
      // Codex MED 1 deferred trigger required (env-gated subprocess
      // smoke form per that MED's "static wrapper-pattern assert OR
      // env-gated subprocess smoke" disjunction).
      const runRoot = join(runRootBase, 'cli-run');
      const { main } = await import('../../src/cli/circuit.js');
      let captured = '';
      const origWrite = process.stdout.write;
      process.stdout.write = ((chunk: string | Uint8Array): boolean => {
        captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
        return true;
      }) as typeof process.stdout.write;
      let exit = -1;
      try {
        exit = await main(
          [
            'dogfood-run-0',
            '--goal',
            'smoke via CLI',
            '--rigor',
            'standard',
            '--run-root',
            runRoot,
          ],
          {
            configHomeDir: join(runRootBase, 'empty-home'),
            configCwd: join(runRootBase, 'empty-cwd'),
          },
        );
      } finally {
        process.stdout.write = origWrite;
      }
      expect(exit).toBe(0);
      const parsed: unknown = JSON.parse(captured);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('CLI output was not a JSON object');
      }
      const obj = parsed as Record<string, unknown>;
      expect(obj.outcome).toBe('complete');
      expect(obj.run_root).toBe(runRoot);
      expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);

      const result = RunResult.parse(
        JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
      );
      expect(result.goal).toBe('smoke via CLI');
    },
    15000,
  );

  // Slice 47b — CLI binding pin. Pre-Slice-47b, the
  // execFileSync('node_modules/.bin/tsx', ['src/cli/circuit.ts', ...])
  // call implicitly verified that `circuit:run` was wired to tsx +
  // the CLI entry. Replacing the subprocess invocation with a direct
  // main() import drops that coverage; this contract test re-pins it
  // statically without spawning a subprocess.
  //
  // Slice 102 direct-launcher cleanup: the public test path now goes through
  // ./bin/circuit-next, which invokes dist/cli/circuit.js directly instead of
  // surfacing npm-script or dogfood.js names to plugin users.
  it("package.json's circuit:run script delegates to the direct Circuit launcher", () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      bin?: Record<string, string>;
    };
    expect(pkg.scripts?.['circuit:run']).toBe('./bin/circuit-next');
    expect(pkg.bin?.['circuit-next']).toBe('./bin/circuit-next');
  });
});
