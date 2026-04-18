import { z } from 'zod';
import { CheckpointSelectionGate, ResultVerdictGate, SchemaSectionsGate } from './gate.js';
import { ProtocolId, StepId } from './ids.js';
import { SelectionOverride } from './selection-policy.js';

export const DispatchRole = z.enum(['researcher', 'implementer', 'reviewer']);
export type DispatchRole = z.infer<typeof DispatchRole>;

export const ArtifactRef = z.object({
  path: z.string().min(1),
  schema: z.string().min(1),
});
export type ArtifactRef = z.infer<typeof ArtifactRef>;

const StepBase = z.object({
  id: StepId,
  title: z.string().min(1),
  protocol: ProtocolId,
  reads: z.array(z.string()).default([]),
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

export const SynthesisStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('synthesis'),
  writes: z.object({
    artifact: ArtifactRef,
  }),
  gate: SchemaSectionsGate,
});
export type SynthesisStep = z.infer<typeof SynthesisStep>;

export const CheckpointStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('checkpoint'),
  writes: z.object({
    request: z.string().min(1),
    response: z.string().min(1),
    artifact: ArtifactRef.optional(),
  }),
  gate: CheckpointSelectionGate,
});
export type CheckpointStep = z.infer<typeof CheckpointStep>;

export const DispatchStep = StepBase.extend({
  executor: z.literal('worker'),
  kind: z.literal('dispatch'),
  role: DispatchRole,
  writes: z.object({
    artifact: ArtifactRef.optional(),
    request: z.string().min(1),
    receipt: z.string().min(1),
    result: z.string().min(1),
  }),
  gate: ResultVerdictGate,
});
export type DispatchStep = z.infer<typeof DispatchStep>;

export const Step = z.discriminatedUnion('kind', [SynthesisStep, CheckpointStep, DispatchStep]);
export type Step = z.infer<typeof Step>;

export const RouteMap = StepBase.shape.routes;
export type RouteMap = z.infer<typeof RouteMap>;
