import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

// Adversarial-review fix #4: a handler that throws unexpectedly must not
// leave the run-root half-bootstrapped (step.entered on disk, no
// step.aborted, no run.closed, no result.json). Pre-fix, an uncaught
// throw out of executeWorkflow produced exactly that state — and the
// next run on the same run-root failed claimFreshRunRoot because the
// directory was non-empty, forcing manual cleanup. The wrapper around
// runStepHandler now emits step.aborted + run.closed + result.json on
// any non-path-escape throw.

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

function stubDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-handler-throw',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'pre-fix, an uncaught handler throw left the run-root half-bootstrapped and blocked retries',
    acceptance_evidence:
      'runWorkflow resolves with outcome=aborted, step.aborted + run.closed events, and a parseable result.json',
    alternate_framing:
      'allow handler exceptions to propagate raw — rejected; corrupts the run-root',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-handler-throw-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('handler-throw recovery — fix #4', () => {
  it('graceful-aborts when a step has an unsupported kind, writes step.aborted + run.closed + result.json', async () => {
    const { workflow, bytes } = loadFixture();

    // Mutate one step's `kind` to a value the dispatcher's default case
    // rejects ("no handler registered"). The Workflow schema validates
    // kind at parse time, so the cast bypasses author-time validation —
    // which is exactly the failure mode the wrapper guards against
    // (corrupted-runtime / mid-flight unexpected throws).
    const badWorkflow = structuredClone(workflow);
    const firstStep = badWorkflow.steps[0];
    if (firstStep === undefined) throw new Error('fixture drift: dogfood-run-0 has no first step');
    (firstStep as { kind: string }).kind = 'bogus-kind';

    const runRoot = join(runRootBase, 'run-bogus');
    const outcome = await runWorkflow({
      runRoot,
      workflow: badWorkflow,
      workflowBytes: bytes,
      runId: RunId.parse('11111111-2222-3333-4444-555555555555'),
      goal: 'prove handler throws fall through to a graceful aborted run',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    // Did not throw. Outcome surfaces the abort with a reason naming the
    // unsupported kind so the operator can diagnose without reading the
    // event log.
    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toBeDefined();
    expect(outcome.result.reason).toMatch(/handler threw/);
    expect(outcome.result.reason).toMatch(/bogus-kind/);

    // The run-root is now in a closed state — events.ndjson, state.json,
    // manifest.snapshot.json, artifacts/result.json all exist. A retry
    // uses a fresh run-root; this one is preserved as audit evidence.
    expect(existsSync(join(runRoot, 'events.ndjson'))).toBe(true);
    expect(existsSync(join(runRoot, 'state.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'manifest.snapshot.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);

    // result.json parses through RunResult and pins the abort.
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/handler threw/);

    // Event log invariants: step.entered → step.aborted → run.closed.
    // run.closed is single and last (no step.completed for the bad
    // step).
    const log = readRunLog(runRoot);
    const lastEvent = log[log.length - 1];
    expect(lastEvent?.kind).toBe('run.closed');
    if (lastEvent?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(lastEvent.outcome).toBe('aborted');

    const stepAborted = log.find((event) => event.kind === 'step.aborted');
    expect(stepAborted).toBeDefined();
    if (stepAborted?.kind !== 'step.aborted') throw new Error('expected step.aborted in log');
    expect(stepAborted.reason).toMatch(/handler threw/);
    expect(stepAborted.reason).toMatch(/bogus-kind/);

    const stepCompletedForBad = log.some(
      (event) =>
        event.kind === 'step.completed' &&
        (event.step_id as unknown as string) === (firstStep.id as unknown as string),
    );
    expect(stepCompletedForBad).toBe(false);
  });
});
