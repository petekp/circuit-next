import type { RunClosedOutcomeV2 } from '../domain/run.js';

export type FanoutJoinPolicyV2 = 'pick-winner' | 'disjoint-merge' | 'aggregate-only';

export interface ResolvedSubRunBranchV2 {
  readonly kind: 'sub-run';
  readonly branch_id: string;
  readonly flowRef: string;
  readonly entryMode: string;
  readonly version?: string;
  readonly goal: string;
  readonly depth: string;
  readonly selection?: unknown;
}

export interface ResolvedRelayBranchV2 {
  readonly kind: 'relay';
  readonly branch_id: string;
  readonly role: string;
  readonly goal: string;
  readonly report_schema: string;
  readonly provenance_field?: string;
  readonly selection?: unknown;
}

export type ResolvedBranchV2 = ResolvedSubRunBranchV2 | ResolvedRelayBranchV2;

export interface BranchOutcomeV2 {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly worktree_path: string;
  readonly child_outcome: RunClosedOutcomeV2;
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body?: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
  readonly failure_reason?: string;
}

export const NO_VERDICT_SENTINEL_V2 = '<no-verdict>';
