import { z } from 'zod';
import { InvocationId, RunId } from './ids.js';

export const GitState = z.object({
  cwd: z.string().min(1),
  branch: z.string().optional(),
  head: z.string().optional(),
  base_commit: z.string().optional(),
});
export type GitState = z.infer<typeof GitState>;

export const ContinuityNarrative = z.object({
  goal: z.string().min(1),
  next: z.string().min(1),
  state_markdown: z.string().min(1),
  debt_markdown: z.string().min(1),
});
export type ContinuityNarrative = z.infer<typeof ContinuityNarrative>;

const ContinuityBase = z.object({
  schema_version: z.literal(1),
  record_id: z.string().min(1),
  project_root: z.string().min(1),
  created_at: z.string().datetime(),
  git: GitState,
  narrative: ContinuityNarrative,
});

export const StandaloneContinuity = ContinuityBase.extend({
  continuity_kind: z.literal('standalone'),
  resume_contract: z.object({
    mode: z.literal('resume_standalone'),
    auto_resume: z.boolean().default(false),
    requires_explicit_resume: z.boolean().default(true),
  }),
});
export type StandaloneContinuity = z.infer<typeof StandaloneContinuity>;

export const RunBackedContinuity = ContinuityBase.extend({
  continuity_kind: z.literal('run-backed'),
  run_ref: z.object({
    run_id: RunId,
    invocation_id: InvocationId.optional(),
  }),
  resume_contract: z.object({
    mode: z.literal('resume_run'),
    auto_resume: z.boolean().default(false),
    requires_explicit_resume: z.boolean().default(true),
  }),
});
export type RunBackedContinuity = z.infer<typeof RunBackedContinuity>;

export const ContinuityRecord = z.discriminatedUnion('continuity_kind', [
  StandaloneContinuity,
  RunBackedContinuity,
]);
export type ContinuityRecord = z.infer<typeof ContinuityRecord>;
