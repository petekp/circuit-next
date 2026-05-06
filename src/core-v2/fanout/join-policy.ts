import {
  type FanoutJoinInput,
  type FanoutJoinOutcome,
  type FanoutJoinResult,
  evaluateFanoutJoinPolicy,
} from '../../shared/fanout-join-policy.js';
import type { BranchOutcomeV2, FanoutJoinPolicyV2 } from './types.js';

export interface FanoutJoinOutcomeV2 extends Omit<FanoutJoinOutcome, 'child_outcome'> {
  readonly child_outcome: BranchOutcomeV2['child_outcome'];
}

export interface FanoutJoinInputV2 extends Omit<FanoutJoinInput, 'policy' | 'outcomes'> {
  readonly policy: FanoutJoinPolicyV2;
  readonly outcomes: readonly FanoutJoinOutcomeV2[];
}

export type FanoutJoinResultV2 = FanoutJoinResult;

export function evaluateFanoutJoinPolicyV2(input: FanoutJoinInputV2): FanoutJoinResultV2 {
  return evaluateFanoutJoinPolicy(input);
}
