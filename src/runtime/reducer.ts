import type { Event, RunClosedOutcome } from '../schemas/event.js';
import type { RunLog } from '../schemas/run.js';
import {
  Snapshot,
  type SnapshotStatus,
  type StepState,
  type StepStatus,
} from '../schemas/snapshot.js';

// Pure reducer: (RunLog) -> Snapshot. Authored fresh against production
// src/schemas/snapshot.ts per Slice 26a artifact binding (run.snapshot ==
// state.json). NOT a cherry-pick of spike/kernel-replay/reducer.ts —
// spike's Snapshot is narrower (no SnapshotStatus / StepStatus / StepState)
// and would silently regress the Slice 26a binding.
//
// Design: `reduce = fold(applyEvent, seed)` per 27a mining lesson 10.
// Seed is produced by the `run.bootstrapped` event (the first event in
// any well-formed RunLog per RUN-I1). Subsequent events mutate a
// structural clone of the prior snapshot; we never mutate in place.
//
// `events_consumed` is bound to log length at every step, so a prefix
// snapshot equals `reduce(log.slice(0, k))` exactly. This is the
// property dogfood-run-0's delete-an-event mismatch test depends on.

const OUTCOME_TO_STATUS: Record<RunClosedOutcome, Exclude<SnapshotStatus, 'in_progress'>> = {
  complete: 'complete',
  aborted: 'aborted',
  handoff: 'handoff',
  stopped: 'stopped',
  escalated: 'escalated',
};

function cloneStepState(step: StepState): StepState {
  return { ...step };
}

function upsertStep(steps: StepState[], stepId: string): { steps: StepState[]; index: number } {
  const index = steps.findIndex((s) => s.step_id === stepId);
  if (index >= 0) {
    const next = steps.map(cloneStepState);
    return { steps: next, index };
  }
  const seed: StepState = {
    step_id: stepId as StepState['step_id'],
    status: 'pending',
    attempts: 0,
  };
  return { steps: [...steps.map(cloneStepState), seed], index: steps.length };
}

function mutateStep(
  steps: StepState[],
  stepId: string,
  fn: (step: StepState) => StepState,
): StepState[] {
  const { steps: upserted, index } = upsertStep(steps, stepId);
  const prev = upserted[index];
  if (prev === undefined) return upserted;
  upserted[index] = fn(prev);
  return upserted;
}

function applyEvent(prev: Snapshot, event: Event): Snapshot {
  // Non-bootstrap events assume prev exists. Bootstrap is handled outside
  // this function because it seeds from nothing.
  const next: Snapshot = {
    ...prev,
    steps: prev.steps.map(cloneStepState),
    events_consumed: prev.events_consumed + 1,
    updated_at: event.recorded_at,
  };

  switch (event.kind) {
    case 'run.bootstrapped':
      // A second bootstrap violates RUN-I4 and is rejected at RunLog
      // parse time. If we reach here with a second bootstrap, the caller
      // passed an unvalidated log; we surface the violation loudly.
      throw new Error(
        'reducer: duplicate run.bootstrapped event; RunLog parsing should have rejected this',
      );
    case 'step.entered': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        current_step: event.step_id,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'in_progress' as StepStatus,
          attempts: Math.max(s.attempts, event.attempt),
        })),
      };
    }
    case 'step.artifact_written': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          last_artifact_path: event.artifact_path,
        })),
      };
    }
    case 'gate.evaluated': {
      const stepId = event.step_id as unknown as string;
      if (event.outcome === 'fail') {
        return {
          ...next,
          steps: mutateStep(next.steps, stepId, (s) => ({
            ...s,
            status: 'gate_failed' as StepStatus,
          })),
        };
      }
      return next;
    }
    case 'checkpoint.requested':
      return next;
    case 'checkpoint.resolved': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          last_checkpoint_selection: event.selection,
        })),
      };
    }
    case 'dispatch.started': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'in_progress' as StepStatus,
        })),
      };
    }
    case 'dispatch.request':
    case 'dispatch.failed':
    case 'dispatch.receipt':
    case 'dispatch.result':
      // Durable dispatch transcript events (ADR-0007 CC#P2-2 §Amendment
      // Slice 37). Carry request/receipt/result identifiers for the
      // P2.4 round-trip close criterion; no snapshot-shape change — the
      // dispatch outcome still flows into the step via step.completed.
      return next;
    case 'dispatch.completed':
      // Dispatch outcomes flow into the step via step.completed; no
      // snapshot-shape change here.
      return next;
    case 'sub_run.started':
    case 'sub_run.completed':
    case 'fanout.started':
    case 'fanout.branch_started':
    case 'fanout.branch_completed':
    case 'fanout.joined':
      // Sub-run / fanout linkage events are audit-only at this slice;
      // the parent step's status flows through step.entered / step.completed
      // / step.aborted just like other orchestrator-executed steps. The
      // child run's own snapshot lives in the child run-root and is not
      // merged into the parent (RUN-I3 scoping).
      return next;
    case 'step.completed': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'complete' as StepStatus,
          last_route_taken: event.route_taken,
        })),
      };
    }
    case 'step.aborted': {
      const stepId = event.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'aborted' as StepStatus,
        })),
      };
    }
    case 'run.closed':
      return {
        ...next,
        status: OUTCOME_TO_STATUS[event.outcome],
      };
  }
}

function seedFromBootstrap(event: Event, totalEvents: number): Snapshot {
  if (event.kind !== 'run.bootstrapped') {
    throw new Error(
      `reducer: first event must be run.bootstrapped, got ${event.kind}; RunLog parsing should have rejected this`,
    );
  }
  const seed = {
    schema_version: 1 as const,
    run_id: event.run_id,
    workflow_id: event.workflow_id,
    rigor: event.rigor,
    lane: event.lane,
    status: 'in_progress' as SnapshotStatus,
    steps: [] as StepState[],
    events_consumed: 1,
    manifest_hash: event.manifest_hash,
    updated_at: event.recorded_at,
    ...(event.invocation_id === undefined ? {} : { invocation_id: event.invocation_id }),
  };
  // Ensure events_consumed starts at 1 for the bootstrap event itself;
  // further events advance it one-by-one.
  void totalEvents;
  return Snapshot.parse(seed);
}

export function reduce(log: RunLog): Snapshot {
  if (log.length === 0) {
    throw new Error('reducer: empty RunLog');
  }
  const first = log[0];
  if (first === undefined) throw new Error('reducer: empty RunLog');
  let state: Snapshot = seedFromBootstrap(first, log.length);
  for (let i = 1; i < log.length; i++) {
    const ev = log[i];
    if (ev === undefined) continue;
    state = applyEvent(state, ev);
  }
  // Final validation: the snapshot must parse cleanly, which includes
  // events_consumed matching log length (RUN-I7 on the projection side).
  return Snapshot.parse(state);
}
