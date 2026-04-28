// Shared event-shape builders for the RUN-I* invariant family
// (runlog-schema.test.ts and adjacent suites that exercise
// Event/Snapshot/RunLog/RunProjection schemas).
//
// RUN_A is also imported by adapter-schema.test.ts because
// DispatchStartedEvent fixtures need a stable run_id placeholder.

export const RUN_A = '0191d2f0-aaaa-7fff-8aaa-000000000000';
export const RUN_B = '0191d2f0-bbbb-7fff-8aaa-000000000001';

export const lane = {
  lane: 'discovery' as const,
  failure_mode: 'evidence gap',
  acceptance_evidence: 'evidence draft complete',
  alternate_framing: 'directly author contract',
};

export const bootstrapAt = (
  sequence: number,
  runId: string = RUN_A,
  overrides: Record<string, unknown> = {},
) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:00:00.000Z',
  run_id: runId,
  kind: 'run.bootstrapped',
  workflow_id: 'explore',
  rigor: 'deep',
  goal: 'Test',
  manifest_hash: 'abc',
  lane,
  ...overrides,
});

export const stepEntered = (sequence: number, runId: string = RUN_A) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:01:00.000Z',
  run_id: runId,
  kind: 'step.entered',
  step_id: 'frame',
  attempt: 1,
});

export const runClosed = (
  sequence: number,
  runId: string = RUN_A,
  outcome: 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated' = 'complete',
) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:02:00.000Z',
  run_id: runId,
  kind: 'run.closed',
  outcome,
});
