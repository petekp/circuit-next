import type { BranchOutcomeV2, FanoutJoinPolicyV2 } from './types.js';

export interface FanoutAggregateBodyV2 {
  readonly schema_version: 1;
  readonly join_policy: FanoutJoinPolicyV2;
  readonly branch_count: number;
  readonly winner_branch_id?: string;
  readonly branches: ReadonlyArray<{
    readonly branch_id: string;
    readonly child_run_id: string;
    readonly child_outcome: BranchOutcomeV2['child_outcome'];
    readonly verdict: string;
    readonly admitted: boolean;
    readonly result_path: string;
    readonly duration_ms: number;
    readonly result_body?: unknown;
  }>;
}

export function buildFanoutAggregateV2(
  policy: FanoutJoinPolicyV2,
  outcomes: readonly BranchOutcomeV2[],
  winnerBranchId?: string,
): FanoutAggregateBodyV2 {
  return {
    schema_version: 1,
    join_policy: policy,
    branch_count: outcomes.length,
    ...(winnerBranchId === undefined ? {} : { winner_branch_id: winnerBranchId }),
    branches: outcomes.map((outcome) => ({
      branch_id: outcome.branch_id,
      child_run_id: outcome.child_run_id,
      child_outcome: outcome.child_outcome,
      verdict: outcome.verdict,
      admitted: outcome.admitted,
      result_path: outcome.result_path,
      duration_ms: outcome.duration_ms,
      ...(outcome.result_body === undefined ? {} : { result_body: outcome.result_body }),
    })),
  };
}
