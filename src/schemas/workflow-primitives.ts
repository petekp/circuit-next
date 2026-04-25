import { z } from 'zod';

export const WORKFLOW_PRIMITIVE_IDS = [
  'intake',
  'route',
  'frame',
  'human-decision',
  'gather-context',
  'diagnose',
  'plan',
  'act',
  'run-verification',
  'review',
  'queue',
  'batch',
  'risk-rollback-check',
  'close-with-evidence',
  'handoff',
] as const;

export const WorkflowPrimitiveId = z.enum(WORKFLOW_PRIMITIVE_IDS);
export type WorkflowPrimitiveId = z.infer<typeof WorkflowPrimitiveId>;

export const WorkflowPrimitiveRoute = z.enum([
  'continue',
  'retry',
  'revise',
  'ask',
  'split',
  'stop',
  'handoff',
  'escalate',
  'complete',
]);
export type WorkflowPrimitiveRoute = z.infer<typeof WorkflowPrimitiveRoute>;

export const WorkflowPrimitiveActionSurface = z.enum(['orchestrator', 'worker', 'host', 'mixed']);
export type WorkflowPrimitiveActionSurface = z.infer<typeof WorkflowPrimitiveActionSurface>;

export const WorkflowPrimitiveGateKind = z.enum([
  'schema',
  'decision',
  'command',
  'review',
  'risk',
  'queue',
]);
export type WorkflowPrimitiveGateKind = z.infer<typeof WorkflowPrimitiveGateKind>;

export const WorkflowPrimitiveHumanInteraction = z.enum([
  'never',
  'optional',
  'required',
  'mode-dependent',
]);
export type WorkflowPrimitiveHumanInteraction = z.infer<typeof WorkflowPrimitiveHumanInteraction>;

export const WorkflowPrimitiveContractRef = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+@v[0-9]+$/);
export type WorkflowPrimitiveContractRef = z.infer<typeof WorkflowPrimitiveContractRef>;

export const WorkflowPrimitiveInputContractSet = z
  .array(WorkflowPrimitiveContractRef)
  .min(1)
  .superRefine((contracts, ctx) => {
    const seen = new Set<string>();
    for (const [index, contract] of contracts.entries()) {
      if (seen.has(contract)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `duplicate input contract: ${contract}`,
        });
      }
      seen.add(contract);
    }
  });
export type WorkflowPrimitiveInputContractSet = z.infer<typeof WorkflowPrimitiveInputContractSet>;

const nonEmptyUniqueStrings = z
  .array(z.string().min(1))
  .min(1)
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    for (const [index, value] of values.entries()) {
      if (seen.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `duplicate value: ${value}`,
        });
      }
      seen.add(value);
    }
  });

const HostCapabilities = z
  .object({
    claude: z.array(z.string().min(1)).default([]),
    codex: z.array(z.string().min(1)).default([]),
    non_interactive: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type HostCapabilities = z.infer<typeof HostCapabilities>;

export const WorkflowPrimitive = z
  .object({
    id: WorkflowPrimitiveId,
    title: z.string().min(1),
    purpose: z.string().min(1),
    input_contracts: WorkflowPrimitiveInputContractSet,
    alternative_input_contracts: z.array(WorkflowPrimitiveInputContractSet).default([]),
    output_contract: WorkflowPrimitiveContractRef,
    action_surface: WorkflowPrimitiveActionSurface,
    produces_evidence: nonEmptyUniqueStrings,
    gate: z
      .object({
        kind: WorkflowPrimitiveGateKind,
        description: z.string().min(1),
      })
      .strict(),
    allowed_routes: z.array(WorkflowPrimitiveRoute).min(1),
    human_interaction: WorkflowPrimitiveHumanInteraction,
    host_capabilities: HostCapabilities,
    notes: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((primitive, ctx) => {
    const routeSet = new Set<WorkflowPrimitiveRoute>();
    for (const [index, route] of primitive.allowed_routes.entries()) {
      if (routeSet.has(route)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allowed_routes', index],
          message: `duplicate route: ${route}`,
        });
      }
      routeSet.add(route);
    }

    if (primitive.id === 'human-decision') {
      if (primitive.human_interaction !== 'mode-dependent') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['human_interaction'],
          message: 'human-decision must be mode-dependent',
        });
      }
      if (primitive.host_capabilities.claude.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['host_capabilities', 'claude'],
          message: 'human-decision must name a Claude host strategy',
        });
      }
      if (primitive.host_capabilities.codex.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['host_capabilities', 'codex'],
          message: 'human-decision must name a Codex host strategy',
        });
      }
      if (primitive.host_capabilities.non_interactive.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['host_capabilities', 'non_interactive'],
          message: 'human-decision must name a non-interactive host strategy',
        });
      }
    }

    if (primitive.id === 'close-with-evidence' && !routeSet.has('complete')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowed_routes'],
        message: 'close-with-evidence must allow complete',
      });
    }
  });
export type WorkflowPrimitive = z.infer<typeof WorkflowPrimitive>;

export const WorkflowPrimitiveCatalog = z
  .object({
    schema_version: z.literal('1'),
    primitives: z.array(WorkflowPrimitive).min(WORKFLOW_PRIMITIVE_IDS.length),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const seen = new Map<WorkflowPrimitiveId, number>();
    for (const [index, primitive] of catalog.primitives.entries()) {
      const prior = seen.get(primitive.id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['primitives', index, 'id'],
          message: `duplicate primitive id: ${primitive.id} also appears at index ${prior}`,
        });
      }
      seen.set(primitive.id, index);
    }

    for (const requiredId of WORKFLOW_PRIMITIVE_IDS) {
      if (!seen.has(requiredId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['primitives'],
          message: `missing primitive id: ${requiredId}`,
        });
      }
    }
  });
export type WorkflowPrimitiveCatalog = z.infer<typeof WorkflowPrimitiveCatalog>;
