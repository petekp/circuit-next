import type { RunClosedOutcomeV2, RunStatusV2 } from '../domain/run.js';
import type { TraceEntryV2 } from '../domain/trace.js';

function isRunClosedOutcome(value: unknown): value is RunClosedOutcomeV2 {
  return (
    value === 'complete' ||
    value === 'aborted' ||
    value === 'handoff' ||
    value === 'stopped' ||
    value === 'escalated'
  );
}

export function projectStatusFromTraceV2(entries: readonly TraceEntryV2[]): RunStatusV2 {
  const closed = [...entries].reverse().find((entry) => entry.kind === 'run.closed');
  if (closed !== undefined) {
    const outcome = closed.outcome ?? closed.data?.outcome;
    if (isRunClosedOutcome(outcome)) return outcome;
    return 'aborted';
  }
  if (entries.some((entry) => entry.kind === 'run.bootstrapped')) return 'running';
  return 'not_started';
}
