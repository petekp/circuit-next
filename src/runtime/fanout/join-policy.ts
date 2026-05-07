import {
  type FanoutJoinInput,
  type FanoutJoinOutcome,
  type FanoutJoinResult,
  evaluateFanoutJoinPolicy as evaluateSharedFanoutJoinPolicy,
} from '../../shared/fanout-join-policy.js';
import type { BranchOutcome, FanoutJoinPolicy } from './types.js';

export interface FanoutJoinOutcomeRuntime extends Omit<FanoutJoinOutcome, 'child_outcome'> {
  readonly child_outcome: BranchOutcome['child_outcome'];
}

export interface FanoutJoinInputRuntime extends Omit<FanoutJoinInput, 'policy' | 'outcomes'> {
  readonly policy: FanoutJoinPolicy;
  readonly outcomes: readonly FanoutJoinOutcomeRuntime[];
}

export type FanoutJoinResultRuntime = FanoutJoinResult;

export function evaluateFanoutJoinPolicy(input: FanoutJoinInputRuntime): FanoutJoinResultRuntime {
  return evaluateSharedFanoutJoinPolicy(input);
}
