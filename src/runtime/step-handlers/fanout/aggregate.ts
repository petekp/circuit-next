import type { FanoutStep } from '../../../schemas/step.js';
import type { BranchOutcome, FanoutAggregateBody } from './types.js';

export function buildAggregate(
  policy: FanoutStep['check']['join']['policy'],
  outcomes: readonly BranchOutcome[],
  winnerBranchId: string | undefined,
): FanoutAggregateBody {
  return {
    schema_version: 1,
    join_policy: policy,
    branch_count: outcomes.length,
    ...(winnerBranchId === undefined ? {} : { winner_branch_id: winnerBranchId }),
    branches: outcomes.map((b) => ({
      branch_id: b.branch_id,
      child_run_id: b.child_run_id as unknown as string,
      child_outcome: b.child_outcome,
      verdict: b.verdict,
      admitted: b.admitted,
      result_path: b.result_path,
      duration_ms: b.duration_ms,
      ...(b.result_body === undefined ? {} : { result_body: b.result_body }),
    })),
  };
}
