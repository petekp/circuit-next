import { z } from 'zod';
import { BuildVerificationCommand } from './artifacts/build.js';
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

export const VerificationStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('verification'),
  writes: z
    .object({
      artifact: ArtifactRef,
    })
    .strict(),
  gate: SchemaSectionsGate,
}).strict();
export type VerificationStep = z.infer<typeof VerificationStep>;

export const CheckpointPolicy = z
  .object({
    prompt: z.string().min(1),
    choices: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1).optional(),
            description: z.string().min(1).optional(),
          })
          .strict(),
      )
      .min(1),
    safe_default_choice: z.string().min(1).optional(),
    safe_autonomous_choice: z.string().min(1).optional(),
    build_brief: z
      .object({
        scope: z.string().min(1),
        success_criteria: z.array(z.string().min(1)).min(1),
        verification_command_candidates: z.array(BuildVerificationCommand).min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    const choiceIds = new Set<string>();
    for (const [index, choice] of policy.choices.entries()) {
      if (choiceIds.has(choice.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['choices', index, 'id'],
          message: `duplicate checkpoint choice '${choice.id}'`,
        });
      }
      choiceIds.add(choice.id);
    }
    for (const [field, value] of [
      ['safe_default_choice', policy.safe_default_choice],
      ['safe_autonomous_choice', policy.safe_autonomous_choice],
    ] as const) {
      if (value !== undefined && !choiceIds.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must reference a declared checkpoint choice`,
        });
      }
    }
  });
export type CheckpointPolicy = z.infer<typeof CheckpointPolicy>;

export const CheckpointStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('checkpoint'),
  policy: CheckpointPolicy,
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
  .discriminatedUnion('kind', [SynthesisStep, VerificationStep, CheckpointStep, DispatchStep])
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
    if (step.kind === 'checkpoint') {
      const policyChoiceIds = step.policy.choices.map((choice) => choice.id).sort();
      const gateChoiceIds = [...step.gate.allow].sort();
      if (policyChoiceIds.join('\0') !== gateChoiceIds.join('\0')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', 'allow'],
          message: 'checkpoint gate.allow must exactly match policy.choices ids',
        });
      }
      if (step.writes.artifact !== undefined) {
        if (step.writes.artifact.schema !== 'build.brief@v1') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', 'artifact', 'schema'],
            message: 'checkpoint artifact writing currently supports only build.brief@v1',
          });
        }
        if (step.policy.build_brief === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['policy', 'build_brief'],
            message: 'checkpoint artifact writing build.brief@v1 requires policy.build_brief',
          });
        }
      }
    }
  });
export type Step = z.infer<typeof Step>;

export const RouteMap = StepBase.shape.routes;
export type RouteMap = z.infer<typeof RouteMap>;
