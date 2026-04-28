import { describe, expect, it } from 'vitest';
import {
  DispatchFailedEvent,
  DispatchReceiptEvent,
  DispatchRequestEvent,
  DispatchResultEvent,
  Event,
  RunLog,
  RunProjection,
} from '../../src/index.js';
import { reduce } from '../../src/runtime/reducer.js';

// ADR-0007 CC#P2-2 names
// `dispatch.request` / `dispatch.receipt` / `dispatch.result` as
// non-substitutable close-criterion evidence. Before this slice the
// three event kinds were prose-only; the Event discriminated union
// rejected them. This test file binds the schema-level widening to the
// ADR §Amendment so the governance surface and the runtime surface
// agree. Authority: composition review §HIGH 2 + ADR-0007 §Amendment
// + `src/schemas/event.ts`.

const RUN_A = '0191d2f0-aaaa-7fff-8aaa-000000000000';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const lane = {
  lane: 'ratchet-advance' as const,
  failure_mode: 'event-schema/CC#P2-2 incoherence',
  acceptance_evidence: 'five-event sequence parses end-to-end',
  alternate_framing: 'weaken CC#P2-2 to info-equivalence',
};

const bootstrapEvent = {
  schema_version: 1 as const,
  sequence: 0,
  recorded_at: '2026-04-21T12:00:00.000Z',
  run_id: RUN_A,
  kind: 'run.bootstrapped' as const,
  workflow_id: 'explore',
  rigor: 'deep',
  goal: 'dispatch-transcript fixture',
  manifest_hash: 'abc',
  lane,
};

const stepEnteredEvent = {
  schema_version: 1 as const,
  sequence: 1,
  recorded_at: '2026-04-21T12:01:00.000Z',
  run_id: RUN_A,
  kind: 'step.entered' as const,
  step_id: 'frame',
  attempt: 1,
};

const dispatchStartedEvent = {
  schema_version: 1 as const,
  sequence: 2,
  recorded_at: '2026-04-21T12:02:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.started' as const,
  step_id: 'frame',
  attempt: 1,
  adapter: { kind: 'builtin' as const, name: 'codex' as const },
  role: 'researcher' as const,
  resolved_selection: { skills: [] },
  resolved_from: { source: 'explicit' as const },
};

const dispatchRequestEvent = {
  schema_version: 1 as const,
  sequence: 3,
  recorded_at: '2026-04-21T12:03:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.request' as const,
  step_id: 'frame',
  attempt: 1,
  request_payload_hash: HASH_A,
};

const dispatchReceiptEvent = {
  schema_version: 1 as const,
  sequence: 4,
  recorded_at: '2026-04-21T12:04:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.receipt' as const,
  step_id: 'frame',
  attempt: 1,
  receipt_id: 'rc_01HXYZabc',
};

const dispatchResultEvent = {
  schema_version: 1 as const,
  sequence: 5,
  recorded_at: '2026-04-21T12:05:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.result' as const,
  step_id: 'frame',
  attempt: 1,
  result_artifact_hash: HASH_B,
};

const dispatchFailedEvent = {
  schema_version: 1 as const,
  sequence: 4,
  recorded_at: '2026-04-21T12:04:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.failed' as const,
  step_id: 'frame',
  attempt: 1,
  adapter: { kind: 'builtin' as const, name: 'codex' as const },
  role: 'researcher' as const,
  resolved_selection: { skills: [] },
  resolved_from: { source: 'explicit' as const },
  request_payload_hash: HASH_A,
  reason: 'adapter invocation failed (spawn ENOENT)',
};

const dispatchCompletedEvent = {
  schema_version: 1 as const,
  sequence: 6,
  recorded_at: '2026-04-21T12:06:00.000Z',
  run_id: RUN_A,
  kind: 'dispatch.completed' as const,
  step_id: 'frame',
  attempt: 1,
  verdict: 'pass',
  duration_ms: 1000,
  result_path: 'artifacts/result.json',
  receipt_path: 'artifacts/receipt.json',
};

const stepCompletedEvent = {
  schema_version: 1 as const,
  sequence: 7,
  recorded_at: '2026-04-21T12:07:00.000Z',
  run_id: RUN_A,
  kind: 'step.completed' as const,
  step_id: 'frame',
  attempt: 1,
  route_taken: 'pass',
};

const runClosedEvent = {
  schema_version: 1 as const,
  sequence: 8,
  recorded_at: '2026-04-21T12:08:00.000Z',
  run_id: RUN_A,
  kind: 'run.closed' as const,
  outcome: 'complete' as const,
};

describe('DispatchRequestEvent', () => {
  it('parses a well-formed dispatch.request event', () => {
    const parsed = DispatchRequestEvent.safeParse(dispatchRequestEvent);
    expect(parsed.success).toBe(true);
  });

  it('rejects a dispatch.request missing request_payload_hash', () => {
    const { request_payload_hash, ...rest } = dispatchRequestEvent;
    void request_payload_hash;
    const bad = DispatchRequestEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request whose request_payload_hash is not 64-char lowercase hex', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      request_payload_hash: 'not-a-hash',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request whose request_payload_hash is uppercase hex', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      request_payload_hash: 'A'.repeat(64),
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request whose request_payload_hash is 63 chars', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      request_payload_hash: 'a'.repeat(63),
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request with surplus top-level key (RUN-I8 strictness)', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request with attempt = 0 (StepId invariant)', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      attempt: 0,
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.request with negative sequence', () => {
    const bad = DispatchRequestEvent.safeParse({
      ...dispatchRequestEvent,
      sequence: -1,
    });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchReceiptEvent', () => {
  it('parses a well-formed dispatch.receipt event', () => {
    const parsed = DispatchReceiptEvent.safeParse(dispatchReceiptEvent);
    expect(parsed.success).toBe(true);
  });

  it('rejects a dispatch.receipt missing receipt_id', () => {
    const { receipt_id, ...rest } = dispatchReceiptEvent;
    void receipt_id;
    const bad = DispatchReceiptEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.receipt with empty receipt_id', () => {
    const bad = DispatchReceiptEvent.safeParse({
      ...dispatchReceiptEvent,
      receipt_id: '',
    });
    expect(bad.success).toBe(false);
  });

  it('accepts a dispatch.receipt with UUID-shaped receipt_id', () => {
    const ok = DispatchReceiptEvent.safeParse({
      ...dispatchReceiptEvent,
      receipt_id: '0191d2f0-cccc-7fff-8aaa-000000000002',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a dispatch.receipt with surplus top-level key (RUN-I8 strictness)', () => {
    const bad = DispatchReceiptEvent.safeParse({
      ...dispatchReceiptEvent,
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.receipt missing step_id', () => {
    const { step_id, ...rest } = dispatchReceiptEvent;
    void step_id;
    const bad = DispatchReceiptEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  // receipt_id must contain at least
  // one non-whitespace character. A spaces-only string has length > 0
  // and would have passed the naive `z.string().min(1)` constraint,
  // but such a value is useless as audit evidence.
  it('rejects a dispatch.receipt with whitespace-only receipt_id', () => {
    const bad = DispatchReceiptEvent.safeParse({
      ...dispatchReceiptEvent,
      receipt_id: '   ',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.receipt with tab+newline-only receipt_id', () => {
    const bad = DispatchReceiptEvent.safeParse({
      ...dispatchReceiptEvent,
      receipt_id: '\t\n\r ',
    });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchResultEvent', () => {
  it('parses a well-formed dispatch.result event', () => {
    const parsed = DispatchResultEvent.safeParse(dispatchResultEvent);
    expect(parsed.success).toBe(true);
  });

  it('rejects a dispatch.result missing result_artifact_hash', () => {
    const { result_artifact_hash, ...rest } = dispatchResultEvent;
    void result_artifact_hash;
    const bad = DispatchResultEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.result whose result_artifact_hash is not hex', () => {
    const bad = DispatchResultEvent.safeParse({
      ...dispatchResultEvent,
      result_artifact_hash: 'z'.repeat(64),
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.result whose result_artifact_hash is empty', () => {
    const bad = DispatchResultEvent.safeParse({
      ...dispatchResultEvent,
      result_artifact_hash: '',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.result with surplus top-level key (RUN-I8 strictness)', () => {
    const bad = DispatchResultEvent.safeParse({
      ...dispatchResultEvent,
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a dispatch.result with non-integer attempt', () => {
    const bad = DispatchResultEvent.safeParse({
      ...dispatchResultEvent,
      attempt: 1.5,
    });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchFailedEvent', () => {
  it('parses a well-formed dispatch.failed event with full dispatch provenance', () => {
    const parsed = DispatchFailedEvent.safeParse(dispatchFailedEvent);
    expect(parsed.success).toBe(true);
  });

  it('rejects dispatch.failed without request_payload_hash', () => {
    const { request_payload_hash, ...rest } = dispatchFailedEvent;
    void request_payload_hash;
    const bad = DispatchFailedEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it('rejects dispatch.failed without reason', () => {
    const { reason, ...rest } = dispatchFailedEvent;
    void reason;
    const bad = DispatchFailedEvent.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it('rejects dispatch.failed with surplus top-level key (RUN-I8 strictness)', () => {
    const bad = DispatchFailedEvent.safeParse({
      ...dispatchFailedEvent,
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('Event union rejects role-sourced dispatch.failed when resolved_from.role disagrees', () => {
    const bad = Event.safeParse({
      ...dispatchFailedEvent,
      resolved_from: { source: 'role', role: 'reviewer' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('Event discriminated union admits the three new dispatch transcript kinds', () => {
  it('parses dispatch.request via the Event union', () => {
    const parsed = Event.safeParse(dispatchRequestEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('dispatch.request');
    }
  });

  it('parses dispatch.receipt via the Event union', () => {
    const parsed = Event.safeParse(dispatchReceiptEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('dispatch.receipt');
    }
  });

  it('parses dispatch.result via the Event union', () => {
    const parsed = Event.safeParse(dispatchResultEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('dispatch.result');
    }
  });

  it('parses dispatch.failed via the Event union', () => {
    const parsed = Event.safeParse(dispatchFailedEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('dispatch.failed');
    }
  });

  it('rejects an unknown dispatch.* kind (closed union discrimination)', () => {
    const bad = Event.safeParse({
      ...dispatchRequestEvent,
      kind: 'dispatch.unknown',
    });
    expect(bad.success).toBe(false);
  });
});

describe('Five-event durable dispatch transcript sequence (ADR-0007 CC#P2-2)', () => {
  it('parses the canonical five-event sequence as a well-formed RunLog', () => {
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      dispatchRequestEvent,
      dispatchReceiptEvent,
      dispatchResultEvent,
      dispatchCompletedEvent,
      stepCompletedEvent,
      runClosedEvent,
    ];
    const parsed = RunLog.safeParse(log);
    if (!parsed.success) {
      // Surface the first Zod issue to make failure actionable.
      throw new Error(`RunLog.safeParse failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    expect(parsed.success).toBe(true);
  });

  it('parses the adapter-invocation failure sequence as a well-formed RunLog', () => {
    const gateFailed = {
      schema_version: 1 as const,
      sequence: 5,
      recorded_at: '2026-04-21T12:05:00.000Z',
      run_id: RUN_A,
      kind: 'gate.evaluated' as const,
      step_id: 'frame',
      attempt: 1,
      gate_kind: 'result_verdict' as const,
      outcome: 'fail' as const,
      reason: dispatchFailedEvent.reason,
    };
    const stepAborted = {
      schema_version: 1 as const,
      sequence: 6,
      recorded_at: '2026-04-21T12:06:00.000Z',
      run_id: RUN_A,
      kind: 'step.aborted' as const,
      step_id: 'frame',
      attempt: 1,
      reason: dispatchFailedEvent.reason,
    };
    const runAborted = {
      schema_version: 1 as const,
      sequence: 7,
      recorded_at: '2026-04-21T12:07:00.000Z',
      run_id: RUN_A,
      kind: 'run.closed' as const,
      outcome: 'aborted' as const,
      reason: dispatchFailedEvent.reason,
    };
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      dispatchRequestEvent,
      dispatchFailedEvent,
      gateFailed,
      stepAborted,
      runAborted,
    ];
    const parsed = RunLog.safeParse(log);
    if (!parsed.success) {
      throw new Error(`RunLog.safeParse failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    const snapshot = reduce(parsed.data);
    expect(snapshot.status).toBe('aborted');
    expect(snapshot.events_consumed).toBe(log.length);
    const projection = RunProjection.safeParse({ log: parsed.data, snapshot });
    if (!projection.success) {
      throw new Error(`RunProjection.safeParse failed: ${JSON.stringify(projection.error.issues)}`);
    }
    expect(projection.success).toBe(true);
  });

  it('parses a dry-run-shaped dispatch log (no transcript events) as a RunLog', () => {
    // CC#P2-2 Enforcement binding: transcript events are required for a
    // non-dry-run adapter. The dry-run path remains legal at the schema
    // layer — only dispatch.started + dispatch.completed on a pair.
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      { ...dispatchCompletedEvent, sequence: 3 },
      { ...stepCompletedEvent, sequence: 4 },
      { ...runClosedEvent, sequence: 5 },
    ];
    const parsed = RunLog.safeParse(log);
    expect(parsed.success).toBe(true);
  });
});

// ADR-0007 CC#P2-2 Enforcement
// binding requires that "the reducer must have consumed that
// sequence" (adr-0007 §CC#P2-2:136). This file proves the
// schema/reducer half of that obligation here; the P2.4 adapter test
// proves the full real-adapter round-trip. Without this test the
// reducer-consumption claim is only implicit (via `noImplicitReturns`
// exhaustiveness); this describe block makes it executable.
describe('Reducer consumes the five-event dispatch transcript', () => {
  it('reduce() advances events_consumed by the full log length on the canonical sequence', () => {
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      dispatchRequestEvent,
      dispatchReceiptEvent,
      dispatchResultEvent,
      dispatchCompletedEvent,
      stepCompletedEvent,
      runClosedEvent,
    ];
    const parsed = RunLog.safeParse(log);
    if (!parsed.success) {
      throw new Error(`RunLog.safeParse failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    const snapshot = reduce(parsed.data);
    expect(snapshot.events_consumed).toBe(log.length);
    // The terminal run.closed has outcome=complete, so the snapshot
    // status must be `complete` (RUN-I7 binding).
    expect(snapshot.status).toBe('complete');
  });

  it('RunProjection.safeParse accepts {log, snapshot} for the canonical sequence', () => {
    // RUN-I6/I7 binding: bootstrap-frozen fields must agree, and
    // events_consumed on the snapshot must equal the log length.
    // Passing this for the five-event transcript proves the reducer
    // did not silently drop any transcript event — otherwise
    // events_consumed would underflow and RUN-I6 would reject the
    // projection.
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      dispatchRequestEvent,
      dispatchReceiptEvent,
      dispatchResultEvent,
      dispatchCompletedEvent,
      stepCompletedEvent,
      runClosedEvent,
    ];
    const parsed = RunLog.safeParse(log);
    if (!parsed.success) {
      throw new Error(`RunLog.safeParse failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    const snapshot = reduce(parsed.data);
    const projection = RunProjection.safeParse({ log: parsed.data, snapshot });
    if (!projection.success) {
      throw new Error(`RunProjection.safeParse failed: ${JSON.stringify(projection.error.issues)}`);
    }
    expect(projection.success).toBe(true);
  });

  it('reduce() on the dry-run-shaped log still advances events_consumed by the full length', () => {
    const log = [
      bootstrapEvent,
      stepEnteredEvent,
      dispatchStartedEvent,
      { ...dispatchCompletedEvent, sequence: 3 },
      { ...stepCompletedEvent, sequence: 4 },
      { ...runClosedEvent, sequence: 5 },
    ];
    const parsed = RunLog.safeParse(log);
    if (!parsed.success) {
      throw new Error(`RunLog.safeParse failed: ${JSON.stringify(parsed.error.issues)}`);
    }
    const snapshot = reduce(parsed.data);
    expect(snapshot.events_consumed).toBe(log.length);
  });
});
