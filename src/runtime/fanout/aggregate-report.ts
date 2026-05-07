import {
  type FanoutAggregateBody,
  buildFanoutAggregate as buildSharedFanoutAggregate,
} from '../../shared/fanout-aggregate-report.js';
import type { BranchOutcome, FanoutJoinPolicy } from './types.js';

export type RuntimeFanoutAggregateBody = FanoutAggregateBody<
  FanoutJoinPolicy,
  BranchOutcome['child_outcome']
>;

export function buildFanoutAggregate(
  policy: FanoutJoinPolicy,
  outcomes: readonly BranchOutcome[],
  winnerBranchId?: string,
): RuntimeFanoutAggregateBody {
  return buildSharedFanoutAggregate(policy, outcomes, winnerBranchId);
}
