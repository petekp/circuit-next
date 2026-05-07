export type RunId = string;

export type RunClosedOutcome = 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated';

export type RuntimeRunStatus =
  | 'not_started'
  | 'running'
  | 'complete'
  | 'aborted'
  | 'handoff'
  | 'stopped'
  | 'escalated';
