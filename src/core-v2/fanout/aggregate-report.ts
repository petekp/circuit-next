import {
  type FanoutAggregateBody,
  buildFanoutAggregate,
} from '../../shared/fanout-aggregate-report.js';
import type { BranchOutcomeV2, FanoutJoinPolicyV2 } from './types.js';

export type FanoutAggregateBodyV2 = FanoutAggregateBody<
  FanoutJoinPolicyV2,
  BranchOutcomeV2['child_outcome']
>;

export function buildFanoutAggregateV2(
  policy: FanoutJoinPolicyV2,
  outcomes: readonly BranchOutcomeV2[],
  winnerBranchId?: string,
): FanoutAggregateBodyV2 {
  return buildFanoutAggregate(policy, outcomes, winnerBranchId);
}
