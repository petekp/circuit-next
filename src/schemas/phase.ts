import { z } from 'zod';
import { PhaseId, StepId } from './ids.js';
import { SelectionOverride } from './selection-policy.js';

export const CanonicalPhase = z.enum([
  'frame',
  'analyze',
  'plan',
  'act',
  'verify',
  'review',
  'close',
]);
export type CanonicalPhase = z.infer<typeof CanonicalPhase>;

// SEL-I9 closes phase.md v0.1 Codex MED #7: Phase carries an optional
// `selection: SelectionOverride`, symmetric with Step.selection and
// Workflow.default_selection. PHASE-I2 `.strict()` still governs surplus-
// key rejection at the Phase level.
export const Phase = z
  .object({
    id: PhaseId,
    title: z.string().min(1),
    canonical: CanonicalPhase.optional(),
    steps: z.array(StepId).min(1),
    selection: SelectionOverride.optional(),
  })
  .strict();
export type Phase = z.infer<typeof Phase>;

export const CANONICAL_PHASES = [
  'frame',
  'analyze',
  'plan',
  'act',
  'verify',
  'review',
  'close',
] as const satisfies readonly CanonicalPhase[];

// SpinePolicy is a plain discriminated union (no superRefine on the variants)
// so Zod's discriminated-union machinery can dispatch on the `mode` literal.
// Structural invariants that span the whole variant — notably, omits must be
// pairwise unique (Codex MED #6.b) and disjoint from declared canonicals
// (Codex MED #6.a) — are enforced in the Workflow superRefine where the
// surrounding wf.phases context is available.
export const SpinePolicy = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('strict'),
    })
    .strict(),
  z
    .object({
      mode: z.literal('partial'),
      omits: z.array(CanonicalPhase).min(1),
      rationale: z.string().min(20),
    })
    .strict(),
]);
export type SpinePolicy = z.infer<typeof SpinePolicy>;
