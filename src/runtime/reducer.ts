import type { RunTrace } from '../schemas/run.js';
import {
  Snapshot,
  type SnapshotStatus,
  type StepState,
  type StepStatus,
} from '../schemas/snapshot.js';
import type { RunClosedOutcome, TraceEntry } from '../schemas/trace-entry.js';

// Pure reducer: (RunTrace) -> Snapshot. Authored against the Snapshot
// schema in src/schemas/snapshot.ts (i.e. state.json).
//
// `reduce = fold(applyTraceEntry, seed)`. Seed comes from the
// `run.bootstrapped` trace_entry (always the first entry in a well-formed
// RunTrace). Subsequent entries mutate a structural clone of the prior
// snapshot; we never mutate in place.
//
// `trace_entries_consumed` is bound to log length at every step, so a
// prefix snapshot equals `reduce(log.slice(0, k))` exactly — the property
// the delete-an-entry mismatch test depends on.

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

function applyTraceEntry(prev: Snapshot, trace_entry: TraceEntry): Snapshot {
  // Non-bootstrap entries assume prev exists. Bootstrap is handled outside
  // this function because it seeds from nothing.
  const next: Snapshot = {
    ...prev,
    steps: prev.steps.map(cloneStepState),
    trace_entries_consumed: prev.trace_entries_consumed + 1,
    updated_at: trace_entry.recorded_at,
  };

  switch (trace_entry.kind) {
    case 'run.bootstrapped':
      // Duplicate bootstrap is rejected at RunTrace parse time. If we
      // reach here, the caller passed an unvalidated log; surface the
      // violation loudly rather than silently building an inconsistent
      // snapshot.
      throw new Error(
        'reducer: duplicate run.bootstrapped trace_entry; RunTrace parsing should have rejected this',
      );
    case 'step.entered': {
      const stepId = trace_entry.step_id as unknown as string;
      return {
        ...next,
        current_step: trace_entry.step_id,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'in_progress' as StepStatus,
          attempts: Math.max(s.attempts, trace_entry.attempt),
        })),
      };
    }
    case 'step.report_written': {
      const stepId = trace_entry.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          last_report_path: trace_entry.report_path,
        })),
      };
    }
    case 'check.evaluated': {
      const stepId = trace_entry.step_id as unknown as string;
      if (trace_entry.outcome === 'fail') {
        return {
          ...next,
          steps: mutateStep(next.steps, stepId, (s) => ({
            ...s,
            status: 'check_failed' as StepStatus,
          })),
        };
      }
      return next;
    }
    case 'checkpoint.requested':
      return next;
    case 'checkpoint.resolved': {
      const stepId = trace_entry.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          last_checkpoint_selection: trace_entry.selection,
        })),
      };
    }
    case 'relay.started': {
      const stepId = trace_entry.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'in_progress' as StepStatus,
        })),
      };
    }
    case 'relay.request':
    case 'relay.failed':
    case 'relay.receipt':
    case 'relay.result':
      // Durable relay transcript entries. Carry request/receipt/result
      // identifiers for round-trip auditability; no snapshot-shape change
      // — the relay outcome still flows into the step via step.completed.
      return next;
    case 'relay.completed':
      // Relay outcomes flow into the step via step.completed; no
      // snapshot-shape change here.
      return next;
    case 'sub_run.started':
    case 'sub_run.completed':
    case 'fanout.started':
    case 'fanout.branch_started':
    case 'fanout.branch_completed':
    case 'fanout.joined':
      // Sub-run / fanout linkage entries are audit-only here. The parent
      // step's status flows through step.entered / step.completed /
      // step.aborted just like other orchestrator-executed steps. The
      // child run's own snapshot lives in the child run-folder and is not
      // merged into the parent — every run is scoped to its own RunId.
      return next;
    case 'step.completed': {
      const stepId = trace_entry.step_id as unknown as string;
      return {
        ...next,
        steps: mutateStep(next.steps, stepId, (s) => ({
          ...s,
          status: 'complete' as StepStatus,
          last_route_taken: trace_entry.route_taken,
        })),
      };
    }
    case 'step.aborted': {
      const stepId = trace_entry.step_id as unknown as string;
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
        status: OUTCOME_TO_STATUS[trace_entry.outcome],
      };
  }
}

function seedFromBootstrap(trace_entry: TraceEntry, totalTraceEntries: number): Snapshot {
  if (trace_entry.kind !== 'run.bootstrapped') {
    throw new Error(
      `reducer: first trace_entry must be run.bootstrapped, got ${trace_entry.kind}; RunTrace parsing should have rejected this`,
    );
  }
  const seed = {
    schema_version: 1 as const,
    run_id: trace_entry.run_id,
    flow_id: trace_entry.flow_id,
    depth: trace_entry.depth,
    change_kind: trace_entry.change_kind,
    status: 'in_progress' as SnapshotStatus,
    steps: [] as StepState[],
    trace_entries_consumed: 1,
    manifest_hash: trace_entry.manifest_hash,
    updated_at: trace_entry.recorded_at,
    ...(trace_entry.invocation_id === undefined
      ? {}
      : { invocation_id: trace_entry.invocation_id }),
  };
  // trace_entries_consumed starts at 1 for the bootstrap entry itself;
  // further entries advance it one-by-one.
  void totalTraceEntries;
  return Snapshot.parse(seed);
}

export function reduce(log: RunTrace): Snapshot {
  if (log.length === 0) {
    throw new Error('reducer: empty RunTrace');
  }
  const first = log[0];
  if (first === undefined) throw new Error('reducer: empty RunTrace');
  let state: Snapshot = seedFromBootstrap(first, log.length);
  for (let i = 1; i < log.length; i++) {
    const ev = log[i];
    if (ev === undefined) continue;
    state = applyTraceEntry(state, ev);
  }
  // Final validation: the snapshot must parse cleanly, which includes
  // trace_entries_consumed matching log length.
  return Snapshot.parse(state);
}
