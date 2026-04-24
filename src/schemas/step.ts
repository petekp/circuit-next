import { z } from 'zod';
import { CheckpointSelectionGate, ResultVerdictGate, SchemaSectionsGate } from './gate.js';
import { ProtocolId, StepId } from './ids.js';
import { RunRelativePath } from './primitives.js';
import { SelectionOverride } from './selection-policy.js';

export const DispatchRole = z.enum(['researcher', 'implementer', 'reviewer']);
export type DispatchRole = z.infer<typeof DispatchRole>;

export const ArtifactRef = z.object({
  path: RunRelativePath,
  schema: z.string().min(1),
});
export type ArtifactRef = z.infer<typeof ArtifactRef>;

const StepBase = z.object({
  id: StepId,
  title: z.string().min(1),
  protocol: ProtocolId,
  reads: z.array(RunRelativePath).default([]),
  routes: z.record(z.string(), z.string()).refine((m) => Object.keys(m).length > 0, {
    message: 'Step must declare at least one route (including `@complete`).',
  }),
  selection: SelectionOverride.optional(),
  budgets: z
    .object({
      max_attempts: z.number().int().positive().max(10),
      wall_clock_ms: z.number().int().positive().optional(),
    })
    .optional(),
});

// `.strict()` rejects surplus keys (no `role` on synthesis/checkpoint, no
// stray fields on writes); this backs STEP-I6 and LOW #7 tightening.
export const SynthesisStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('synthesis'),
  writes: z
    .object({
      artifact: ArtifactRef,
    })
    .strict(),
  gate: SchemaSectionsGate,
}).strict();
export type SynthesisStep = z.infer<typeof SynthesisStep>;

export const CheckpointStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('checkpoint'),
  writes: z
    .object({
      request: RunRelativePath,
      response: RunRelativePath,
      artifact: ArtifactRef.optional(),
    })
    .strict(),
  gate: CheckpointSelectionGate,
}).strict();
export type CheckpointStep = z.infer<typeof CheckpointStep>;

export const DispatchStep = StepBase.extend({
  executor: z.literal('worker'),
  kind: z.literal('dispatch'),
  role: DispatchRole,
  writes: z
    .object({
      artifact: ArtifactRef.optional(),
      request: RunRelativePath,
      receipt: RunRelativePath,
      result: RunRelativePath,
    })
    .strict(),
  gate: ResultVerdictGate,
}).strict();
export type DispatchStep = z.infer<typeof DispatchStep>;

// Step variants must be `ZodObject`-shaped for `discriminatedUnion`; the
// cross-field `gate.source.ref` closure check lives at the union level so
// the variant schemas stay ZodObject. See CHARTER.md Seam B and
// `specs/contracts/step.md` STEP-I3.
//
// `Object.hasOwn` closes Codex review HIGH #1 (prototype-chain `in` attack).
// The `!== undefined` guard closes HIGH #3 (optional slot present-but-
// undefined). Note: HIGH #1/#2/#3 are already structurally prevented by
// gate.ts's literal `ref` per source kind; this refinement is defense-in-
// depth for any future source kind that relaxes the `ref` literal.
export const Step = z
  .discriminatedUnion('kind', [SynthesisStep, CheckpointStep, DispatchStep])
  .superRefine((step, ctx) => {
    const slot = step.gate.source.ref;
    const writes = step.writes as Record<string, unknown>;
    if (!Object.hasOwn(writes, slot) || writes[slot] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gate', 'source', 'ref'],
        message: `gate.source.ref "${slot}" does not resolve to a usable slot in step.writes (available: ${Object.keys(writes).join(', ')})`,
      });
    }
  });
export type Step = z.infer<typeof Step>;

export const RouteMap = StepBase.shape.routes;
export type RouteMap = z.infer<typeof RouteMap>;
