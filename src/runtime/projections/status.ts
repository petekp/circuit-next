import type { RunClosedOutcome, RuntimeRunStatus } from '../domain/run.js';
import type { TraceEntry } from '../domain/trace.js';

function isRunClosedOutcome(value: unknown): value is RunClosedOutcome {
  return (
    value === 'complete' ||
    value === 'aborted' ||
    value === 'handoff' ||
    value === 'stopped' ||
    value === 'escalated'
  );
}

export function projectStatusFromTrace(entries: readonly TraceEntry[]): RuntimeRunStatus {
  const closed = [...entries].reverse().find((entry) => entry.kind === 'run.closed');
  if (closed !== undefined) {
    const outcome = closed.outcome;
    if (isRunClosedOutcome(outcome)) return outcome;
    return 'aborted';
  }
  if (entries.some((entry) => entry.kind === 'run.bootstrapped')) return 'running';
  return 'not_started';
}
