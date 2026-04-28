import { z } from 'zod';

// Gate sources are typed refs, not opaque strings.
// Each gate variant is kind-bound to exactly one source schema so a
// SchemaSectionsGate cannot carry a dispatch_result source at the type layer
// or at parse time. The `ref` field is a Zod literal per source kind — NOT an
// arbitrary string — so the source kind + ref pair names exactly one write
// slot: artifact → 'artifact', checkpoint_response → 'response',
// dispatch_result → 'result'. This blocks prototype-chain `in` attacks and
// cross-slot drift at the type boundary.
// See `docs/contracts/step.md` STEP-I3 and STEP-I4.
//
// `.strict()` is applied on every variant so surplus keys are rejected, not
// stripped (STEP-I6 enforcement story).

export const ArtifactSource = z
  .object({
    kind: z.literal('artifact'),
    ref: z.literal('artifact'),
  })
  .strict();
export type ArtifactSource = z.infer<typeof ArtifactSource>;

export const CheckpointResponseSource = z
  .object({
    kind: z.literal('checkpoint_response'),
    ref: z.literal('response'),
  })
  .strict();
export type CheckpointResponseSource = z.infer<typeof CheckpointResponseSource>;

export const DispatchResultSource = z
  .object({
    kind: z.literal('dispatch_result'),
    ref: z.literal('result'),
  })
  .strict();
export type DispatchResultSource = z.infer<typeof DispatchResultSource>;

// Sub-run and dispatch both emit a result.json with a `.verdict` field, so
// the verdict-admission logic is identical. The source kind is distinct so
// audit events record which execution shape produced the result; both pin
// `ref: 'result'` because the writes slot name is the same.
export const SubRunResultSource = z
  .object({
    kind: z.literal('sub_run_result'),
    ref: z.literal('result'),
  })
  .strict();
export type SubRunResultSource = z.infer<typeof SubRunResultSource>;

// Fanout emits N child results plus an aggregate artifact built by the
// runtime at join time. The gate consults the aggregate slot, never the
// individual branch result.json files (those are read evidence, not the
// gated artifact).
export const FanoutResultsSource = z
  .object({
    kind: z.literal('fanout_results'),
    ref: z.literal('aggregate'),
  })
  .strict();
export type FanoutResultsSource = z.infer<typeof FanoutResultsSource>;

// Convenience alias for callers that want the full source space; individual
// gate variants below constrain to a single kind at the type boundary.
export const GateSource = z.discriminatedUnion('kind', [
  ArtifactSource,
  CheckpointResponseSource,
  DispatchResultSource,
  SubRunResultSource,
  FanoutResultsSource,
]);
export type GateSource = z.infer<typeof GateSource>;

export const SchemaSectionsGate = z
  .object({
    kind: z.literal('schema_sections'),
    source: ArtifactSource,
    required: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type SchemaSectionsGate = z.infer<typeof SchemaSectionsGate>;

export const CheckpointSelectionGate = z
  .object({
    kind: z.literal('checkpoint_selection'),
    source: CheckpointResponseSource,
    allow: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CheckpointSelectionGate = z.infer<typeof CheckpointSelectionGate>;

// `result_verdict` admits a result body produced by either a dispatch worker
// or a sub-run child workflow — both materialise a `.verdict` field with the
// same semantics. The source kind disambiguates the producer at audit time;
// the gate's admission logic is identical across both.
export const ResultVerdictGate = z
  .object({
    kind: z.literal('result_verdict'),
    source: z.discriminatedUnion('kind', [DispatchResultSource, SubRunResultSource]),
    pass: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ResultVerdictGate = z.infer<typeof ResultVerdictGate>;

// Fanout join policies — how N child results collapse to a single gate
// outcome. The policy is part of the gate (not a sibling field on the step)
// because the gate's pass/fail decision is meaningless without the policy
// that defines it.
//
// pick-winner: tournament shape. Children compete; the runtime selects the
//   first child whose closed outcome is 'complete' AND whose verdict appears
//   first in `verdicts.admit` (admit order = preference order). Winning
//   child's worktree merges into parent's tree; siblings are discarded.
// disjoint-merge: Migrate shape. ALL children must close 'complete' with an
//   admitted verdict. Runtime validates per-child worktree changes are
//   pairwise file-disjoint, then merges all into the parent tree.
// aggregate-only: Crucible shape. No worktree merge. Children's result
//   bodies are gathered into the parent's `aggregate` artifact for
//   downstream consumption. Gate passes iff every child reached a closed
//   outcome (any outcome) and produced a parseable result body.
export const PickWinnerJoin = z
  .object({
    policy: z.literal('pick-winner'),
  })
  .strict();
export type PickWinnerJoin = z.infer<typeof PickWinnerJoin>;

export const DisjointMergeJoin = z
  .object({
    policy: z.literal('disjoint-merge'),
  })
  .strict();
export type DisjointMergeJoin = z.infer<typeof DisjointMergeJoin>;

export const AggregateOnlyJoin = z
  .object({
    policy: z.literal('aggregate-only'),
  })
  .strict();
export type AggregateOnlyJoin = z.infer<typeof AggregateOnlyJoin>;

export const FanoutJoinPolicy = z.discriminatedUnion('policy', [
  PickWinnerJoin,
  DisjointMergeJoin,
  AggregateOnlyJoin,
]);
export type FanoutJoinPolicy = z.infer<typeof FanoutJoinPolicy>;

export const FanoutAggregateGate = z
  .object({
    kind: z.literal('fanout_aggregate'),
    source: FanoutResultsSource,
    join: FanoutJoinPolicy,
    // verdicts.admit is the per-child verdict allowlist consulted by
    // pick-winner (preference-ordered) and disjoint-merge (membership-only).
    // aggregate-only ignores the field but still requires it for surface
    // uniformity — recipe authors who later switch policies don't have to
    // reauthor the verdict surface.
    verdicts: z
      .object({
        admit: z.array(z.string().min(1)).min(1),
      })
      .strict(),
  })
  .strict();
export type FanoutAggregateGate = z.infer<typeof FanoutAggregateGate>;

export const Gate = z.discriminatedUnion('kind', [
  SchemaSectionsGate,
  CheckpointSelectionGate,
  ResultVerdictGate,
  FanoutAggregateGate,
]);
export type Gate = z.infer<typeof Gate>;
