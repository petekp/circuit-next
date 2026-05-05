export type RunId = string;

export type RunClosedOutcomeV2 = 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated';

export type RunStatusV2 =
  | 'not_started'
  | 'running'
  | 'complete'
  | 'aborted'
  | 'handoff'
  | 'stopped'
  | 'escalated';
