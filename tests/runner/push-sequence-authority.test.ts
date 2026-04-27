import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

// Adversarial-review fix #3 + #12: push() is the single sequence-
// assignment authority. Regardless of any sequence value a caller bakes
// into an event literal, push() overwrites it with the current
// state.sequence and increments — so on-disk sequences are always
// 0..N-1 contiguous monotonic (RUN-I2). This pins the invariant
// specifically across the dispatch path, which previously bypassed
// push() by mutating state.events directly + setting state.sequence
// from the materializer's sequenceAfter. If a future contributor
// reverts to direct state.events.push (or otherwise emits without
// going through the central push), this test fails.

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
      receipt_id: 'stub-receipt-push-authority',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'pre-fix, the dispatch path bypassed push() and could desync sequence numbers',
    acceptance_evidence: 'on-disk event sequences are 0..N-1 contiguous monotonic',
    alternate_framing: 'lean only on RUN-I2 schema parsing — rejected; want a focused regression pin',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-push-authority-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('push() is the single sequence-assignment authority — fix #3 + #12', () => {
  it('on-disk events have sequence === array index across synthesis + dispatch + close', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'run');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('99999999-aaaa-bbbb-cccc-000000000001'),
      goal: 'pin push() as the single sequence-assignment authority',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('complete');

    // The on-disk log: parse via the schema-aware reader and assert
    // every event's sequence equals its zero-based index. RUN-I2
    // already enforces 0..N-1 contiguous monotonic at parse time, but
    // pinning the value-equals-index property explicitly catches any
    // regression where push() stops overwriting and a caller's stale
    // sequence sneaks through.
    const log = readRunLog(runRoot);
    expect(log.length).toBeGreaterThan(0);
    log.forEach((event, index) => {
      expect(event.sequence).toBe(index);
    });

    // The runtime-returned events array must agree with the on-disk
    // log — same sequences, same order. If push() ever returned events
    // with a different sequence than what landed on disk (impossible
    // under the current fix; possible if direct state.events.push is
    // ever revived), this assertion catches it.
    expect(outcome.events).toHaveLength(log.length);
    outcome.events.forEach((event, index) => {
      expect(event.sequence).toBe(index);
      expect(event.sequence).toBe(log[index]?.sequence);
    });

    // The dispatch transcript must thread through push() in the
    // correct order: started → request → receipt → result → completed,
    // each strictly increasing in sequence. Pre-fix the materializer's
    // events bypassed push() via direct state.events.push and the
    // sequence advance was a manual state.sequence = sequenceAfter
    // assignment — both fragile. This assertion proves the materialized
    // batch flows through push() now.
    const dispatchEvents = log.filter((e) => e.kind.startsWith('dispatch.'));
    expect(dispatchEvents.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < dispatchEvents.length; i += 1) {
      const prev = dispatchEvents[i - 1];
      const curr = dispatchEvents[i];
      if (prev === undefined || curr === undefined) throw new Error('unreachable');
      expect(curr.sequence).toBeGreaterThan(prev.sequence);
    }
  });
});
