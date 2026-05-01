import type { FanoutStep } from '../../../schemas/step.js';
import type { BranchOutcome } from './types.js';

// Pure-function inputs for the join policy decision. Every field
// listed here is either a literal from the flow (policy,
// admitOrder, stepId), a per-branch summary derived from
// already-completed child runs (outcomes), or a precomputed pair of
// changed-file lists / file-discovery-error string for the
// disjoint-merge branch.
export interface FanoutJoinOutcome {
  readonly branch_id: string;
  readonly child_outcome: BranchOutcome['child_outcome'];
  readonly verdict: string;
  readonly admitted: boolean;
  // Present iff `child_outcome === 'complete'` and the child's
  // `result.json` parsed to an object. aggregate-only treats
  // `undefined` as "non-parseable".
  readonly result_body?: unknown;
  readonly failure_reason?: string;
}

export interface FanoutJoinInput {
  readonly policy: FanoutStep['check']['join']['policy'];
  readonly stepId: string;
  readonly admitOrder: readonly string[];
  readonly outcomes: readonly FanoutJoinOutcome[];
  // disjoint-merge only: changed files per branch_id. Either
  // `branchFiles` is provided (the usual path) or `branchFilesError`
  // is set when the worktree-runner threw during discovery.
  readonly branchFiles?: ReadonlyMap<string, readonly string[]>;
  readonly branchFilesError?: string;
}

export interface FanoutJoinResult {
  readonly joinedSuccessfully: boolean;
  readonly winnerBranchId?: string;
  readonly failureReason?: string;
}

export function evaluateFanoutJoinPolicy(input: FanoutJoinInput): FanoutJoinResult {
  const { policy, stepId, admitOrder, outcomes } = input;

  if (policy === 'pick-winner') {
    for (const admittedVerdict of admitOrder) {
      const found = outcomes.find(
        (o) => o.child_outcome === 'complete' && o.verdict === admittedVerdict,
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
    const allAdmitted = outcomes.every((o) => o.admitted);
    if (!allAdmitted) {
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
        'evaluateFanoutJoinPolicy: disjoint-merge requires branchFiles or branchFilesError',
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

  // aggregate-only.
  const allClosed = outcomes.every(
    (o) =>
      o.child_outcome === 'complete' ||
      o.child_outcome === 'aborted' ||
      o.child_outcome === 'handoff' ||
      o.child_outcome === 'stopped' ||
      o.child_outcome === 'escalated',
  );
  const allParseable = outcomes.every(
    (o) => o.child_outcome === 'complete' && o.result_body !== undefined,
  );
  if (!allClosed) {
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not close cleanly`,
    };
  }
  if (!allParseable) {
    const failedOutcome = outcomes.find((o) => o.failure_reason !== undefined);
    if (failedOutcome?.failure_reason !== undefined) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' aggregate-only: ${failedOutcome.failure_reason}`,
      };
    }
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not produce a parseable result body`,
    };
  }
  return { joinedSuccessfully: true };
}
