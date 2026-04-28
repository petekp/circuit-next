import { z } from 'zod';
import { InvocationId, RunId, StageId, StepId } from './ids.js';
import { ControlPchange_kindFileStem } from './scalars.js';
import { SnapshotStatus } from './snapshot.js';

/**
 * Continuity surfaces — docs/contracts/continuity.md v0.1.
 *
 * Authority: report_ids [`continuity.record`, `continuity.index`] in
 * `specs/reports.json`, both classified `successor-to-live` /
 * `compatibility_policy: clean-break` / `legacy_parse_policy: reject`.
 * `record_id` is a `path_derived_field`; the path-safe scalar is
 * `ControlPchange_kindFileStem` (see `src/schemas/scalars.ts`).
 *
 * Live reference surface characterization:
 * `specs/reference/legacy-circuit/continuity-characterization.md`.
 */

/**
 * CONT-I8 — transitive `.strict()`. Every object in the continuity surface
 * rejects surplus keys at parse time. Applied at each ZodObject, including
 * the continuity variants, `resume_contract`, `run_ref` provenance, and
 * the index pointers.
 */

export const GitState = z
  .object({
    cwd: z.string().min(1),
    branch: z.string().optional(),
    head: z.string().optional(),
    base_commit: z.string().optional(),
  })
  .strict();
export type GitState = z.infer<typeof GitState>;

export const ContinuityNarrative = z
  .object({
    goal: z.string().min(1),
    next: z.string().min(1),
    state_markdown: z.string().min(1),
    debt_markdown: z.string().min(1),
  })
  .strict();
export type ContinuityNarrative = z.infer<typeof ContinuityNarrative>;

/**
 * CONT-I7 — run-attached resume provenance. When a continuity record is
 * saved against a live run, the record MUST capture enough state at save
 * time to make resume adjudication auditable. `run_id` alone is
 * insufficient: resume needs to compare "what was true at save time" vs
 * "what is true now". This closes the pre-authoring carryover #8.
 */
export const RunAttachedProvenance = z
  .object({
    run_id: RunId,
    invocation_id: InvocationId.optional(),
    current_stage: StageId,
    current_step: StepId,
    runtime_status: SnapshotStatus,
    runtime_updated_at: z.string().datetime(),
  })
  .strict();
export type RunAttachedProvenance = z.infer<typeof RunAttachedProvenance>;

/**
 * CONT-I6 — non-contradiction between `auto_resume` and
 * `requires_explicit_resume`. These are defense-in-depth booleans; exactly
 * one must be true. Both-true means "auto-resume AND require explicit
 * resume" — incoherent. Both-false means neither resume path is armed —
 * also incoherent, and leaves the record in a silent-dead state. This
 * closes the pre-authoring carryover #7.
 */
const resumeContractRefine = <
  T extends { auto_resume: boolean; requires_explicit_resume: boolean },
>(
  v: T,
) => v.auto_resume !== v.requires_explicit_resume;

const resumeContractRefineMessage = {
  message: 'auto_resume and requires_explicit_resume are contradictory: exactly one must be true',
} as const;

const StandaloneResumeContract = z
  .object({
    mode: z.literal('resume_standalone'),
    auto_resume: z.boolean(),
    requires_explicit_resume: z.boolean(),
  })
  .strict()
  .refine(resumeContractRefine, resumeContractRefineMessage);

const RunBackedResumeContract = z
  .object({
    mode: z.literal('resume_run'),
    auto_resume: z.boolean(),
    requires_explicit_resume: z.boolean(),
  })
  .strict()
  .refine(resumeContractRefine, resumeContractRefineMessage);

const ContinuityBase = z.object({
  schema_version: z.literal(1),
  record_id: ControlPchange_kindFileStem,
  project_root: z.string().min(1),
  created_at: z.string().datetime(),
  git: GitState,
  narrative: ContinuityNarrative,
});

export const StandaloneContinuity = ContinuityBase.extend({
  continuity_kind: z.literal('standalone'),
  resume_contract: StandaloneResumeContract,
}).strict();
export type StandaloneContinuity = z.infer<typeof StandaloneContinuity>;

export const RunBackedContinuity = ContinuityBase.extend({
  continuity_kind: z.literal('run-backed'),
  run_ref: RunAttachedProvenance,
  resume_contract: RunBackedResumeContract,
}).strict();
export type RunBackedContinuity = z.infer<typeof RunBackedContinuity>;

/**
 * CONT-I12 — raw-input own-property guard. `.strict()` rejects surplus own
 * keys but does NOT defend against prototype-chain smuggle: Zod reads
 * inherited properties during parse, so `Object.create({record_id: 'evil'})`
 * would satisfy a `record_id` requirement through the prototype. The
 * guards run on the raw input BEFORE Zod's property access, so required
 * identity fields MUST be own. Mirrors the run.ts RunTrace defense (RUN MED
 * #3).
 */
const recordOwnPropertyGuard = z.custom<unknown>((raw) => {
  if (raw === null || typeof raw !== 'object') return true;
  const guarded = ['schema_version', 'record_id', 'continuity_kind', 'resume_contract'] as const;
  for (const f of guarded) if (!Object.hasOwn(raw, f)) return false;
  return true;
}, 'continuity record has inherited (not own) identity/discriminator field; prototype-chain smuggle rejected');

/**
 * CONT-I3/I4/I5 — ContinuityRecord is a discriminated union on
 * `continuity_kind`. Standalone records reject `run_ref` (CONT-I4
 * enforced by `.strict()`); run-backed records require it.
 * `resume_contract.mode` is bound to `continuity_kind` via the per-variant
 * literal (CONT-I5). The outer pipeline prepends an own-property guard
 * (CONT-I12) before the discriminated union.
 */
export const ContinuityRecord = recordOwnPropertyGuard.pipe(
  z.discriminatedUnion('continuity_kind', [StandaloneContinuity, RunBackedContinuity]),
);
export type ContinuityRecord = z.infer<typeof ContinuityRecord>;

/**
 * CONT-I9/I10/I11 — ContinuityIndex aggrecheck. The index is the resolver
 * that determines which continuity record is authoritative for resume.
 * Two orthogonal pointers:
 *   - `pending_record`: by `record_id` (a `ControlPchange_kindFileStem`); null
 *     when no record is pending.
 *   - `current_run`: by `run_id` plus the at-attach stage/step snapshot;
 *     null when no run is attached.
 *
 * Both pointers MAY be simultaneously populated, simultaneously null, or
 * mixed — observed in legacy Circuit. Resume semantics (which pointer
 * wins when both are set) is a resolver-level concern, not a schema
 * invariant.
 */
export const PendingRecordPointer = z
  .object({
    record_id: ControlPchange_kindFileStem,
    continuity_kind: z.union([z.literal('standalone'), z.literal('run-backed')]),
    created_at: z.string().datetime(),
  })
  .strict();
export type PendingRecordPointer = z.infer<typeof PendingRecordPointer>;

export const AttachedRunPointer = z
  .object({
    run_id: RunId,
    current_stage: StageId,
    current_step: StepId,
    runtime_status: SnapshotStatus,
    attached_at: z.string().datetime(),
    last_validated_at: z.string().datetime(),
  })
  .strict();
export type AttachedRunPointer = z.infer<typeof AttachedRunPointer>;

const ContinuityIndexBody = z
  .object({
    schema_version: z.literal(1),
    project_root: z.string().min(1),
    pending_record: PendingRecordPointer.nullable(),
    current_run: AttachedRunPointer.nullable(),
  })
  .strict();

/**
 * CONT-I12 (continued) — same own-property guard applied to the index
 * aggrecheck. Required fields MUST be own-properties on the raw input.
 * Nullable fields still require the KEY to be own (value may be null).
 */
const indexOwnPropertyGuard = z.custom<unknown>((raw) => {
  if (raw === null || typeof raw !== 'object') return true;
  const guarded = ['schema_version', 'project_root', 'pending_record', 'current_run'] as const;
  for (const f of guarded) if (!Object.hasOwn(raw, f)) return false;
  return true;
}, 'continuity index has inherited (not own) required field; prototype-chain smuggle rejected');

export const ContinuityIndex = indexOwnPropertyGuard.pipe(ContinuityIndexBody);
export type ContinuityIndex = z.infer<typeof ContinuityIndex>;
