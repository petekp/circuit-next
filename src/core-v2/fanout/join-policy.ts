import type { BranchOutcomeV2, FanoutJoinPolicyV2 } from './types.js';

export interface FanoutJoinOutcomeV2 {
  readonly branch_id: string;
  readonly child_outcome: BranchOutcomeV2['child_outcome'];
  readonly verdict: string;
  readonly admitted: boolean;
  readonly result_body?: unknown;
  readonly failure_reason?: string;
}

export interface FanoutJoinInputV2 {
  readonly policy: FanoutJoinPolicyV2;
  readonly stepId: string;
  readonly admitOrder: readonly string[];
  readonly outcomes: readonly FanoutJoinOutcomeV2[];
  readonly branchFiles?: ReadonlyMap<string, readonly string[]>;
  readonly branchFilesError?: string;
}

export interface FanoutJoinResultV2 {
  readonly joinedSuccessfully: boolean;
  readonly winnerBranchId?: string;
  readonly failureReason?: string;
}

export function evaluateFanoutJoinPolicyV2(input: FanoutJoinInputV2): FanoutJoinResultV2 {
  const { policy, stepId, admitOrder, outcomes } = input;

  if (policy === 'pick-winner') {
    for (const admittedVerdict of admitOrder) {
      const found = outcomes.find(
        (outcome) => outcome.child_outcome === 'complete' && outcome.verdict === admittedVerdict,
      );
      if (found !== undefined) {
        return { joinedSuccessfully: true, winnerBranchId: found.branch_id };
      }
    }
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' pick-winner: no branch closed 'complete' with an admitted verdict (admit order [${admitOrder.join(', ')}])`,
    };
  }

  if (policy === 'disjoint-merge') {
    if (!outcomes.every((outcome) => outcome.admitted)) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: not all branches closed 'complete' with an admitted verdict`,
      };
    }
    if (input.branchFilesError !== undefined) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: file-disjoint validation failed (${input.branchFilesError})`,
      };
    }
    const branchFiles = input.branchFiles;
    if (branchFiles === undefined) {
      throw new Error(
        'evaluateFanoutJoinPolicyV2: disjoint-merge requires branchFiles or branchFilesError',
      );
    }
    const seenFile = new Map<string, string>();
    for (const outcome of outcomes) {
      const files = branchFiles.get(outcome.branch_id) ?? [];
      for (const file of files) {
        const prior = seenFile.get(file);
        if (prior !== undefined && prior !== outcome.branch_id) {
          return {
            joinedSuccessfully: false,
            failureReason: `fanout step '${stepId}' disjoint-merge: file '${file}' modified by branches '${prior}' and '${outcome.branch_id}'`,
          };
        }
        seenFile.set(file, outcome.branch_id);
      }
    }
    return { joinedSuccessfully: true };
  }

  const allClosed = outcomes.every((outcome) =>
    ['complete', 'aborted', 'handoff', 'stopped', 'escalated'].includes(outcome.child_outcome),
  );
  const allParseable = outcomes.every(
    (outcome) => outcome.child_outcome === 'complete' && outcome.result_body !== undefined,
  );
  if (!allClosed) {
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not close cleanly`,
    };
  }
  if (!allParseable) {
    const failed = outcomes.find((outcome) => outcome.failure_reason !== undefined);
    return {
      joinedSuccessfully: false,
      failureReason:
        failed?.failure_reason === undefined
          ? `fanout step '${stepId}' aggregate-only: at least one branch did not produce a parseable result body`
          : `fanout step '${stepId}' aggregate-only: ${failed.failure_reason}`,
    };
  }
  return { joinedSuccessfully: true };
}
