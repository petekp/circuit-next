export interface FanoutAggregateBranch<ChildOutcome extends string = string> {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly child_outcome: ChildOutcome;
  readonly verdict: string;
  readonly admitted: boolean;
  readonly result_path: string;
  readonly duration_ms: number;
  readonly result_body?: unknown;
}

export interface FanoutAggregateBody<
  JoinPolicy extends string = string,
  ChildOutcome extends string = string,
> {
  readonly schema_version: 1;
  readonly join_policy: JoinPolicy;
  readonly branch_count: number;
  readonly winner_branch_id?: string;
  readonly branches: ReadonlyArray<FanoutAggregateBranch<ChildOutcome>>;
}

export interface FanoutAggregateOutcome<ChildOutcome extends string = string> {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly child_outcome: ChildOutcome;
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body?: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
}

export function buildFanoutAggregate<
  JoinPolicy extends string,
  Outcome extends FanoutAggregateOutcome,
>(
  policy: JoinPolicy,
  outcomes: readonly Outcome[],
  winnerBranchId: string | undefined,
): FanoutAggregateBody<JoinPolicy, Outcome['child_outcome']> {
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
