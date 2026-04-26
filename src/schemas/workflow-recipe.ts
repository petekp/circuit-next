import { z } from 'zod';
import { PhaseId, ProtocolId, StepId, WorkflowId } from './ids.js';
import { Lane } from './lane.js';
import {
  CANONICAL_PHASES,
  CanonicalPhase,
  type CanonicalPhase as CanonicalPhaseValue,
  SpinePolicy,
} from './phase.js';
import { RunRelativePath } from './primitives.js';
import { Rigor } from './rigor.js';
import { SelectionOverride } from './selection-policy.js';
import { CheckpointPolicy, DispatchRole } from './step.js';
import {
  WorkflowPrimitiveCatalog,
  type WorkflowPrimitiveCatalog as WorkflowPrimitiveCatalogValue,
  WorkflowPrimitiveContractRef,
  type WorkflowPrimitiveContractRef as WorkflowPrimitiveContractRefValue,
  WorkflowPrimitiveId,
  type WorkflowPrimitiveId as WorkflowPrimitiveIdValue,
  WorkflowPrimitiveRoute,
  type WorkflowPrimitiveRoute as WorkflowPrimitiveRouteValue,
  type WorkflowPrimitive as WorkflowPrimitiveValue,
} from './workflow-primitives.js';

export const WorkflowRecipeStatus = z.enum(['candidate', 'active', 'deprecated']);
export type WorkflowRecipeStatus = z.infer<typeof WorkflowRecipeStatus>;

export const WorkflowRecipeTerminalTarget = z.enum(['@complete', '@stop', '@handoff', '@escalate']);
export type WorkflowRecipeTerminalTarget = z.infer<typeof WorkflowRecipeTerminalTarget>;

export const WorkflowRecipeRouteTarget = z.union([StepId, WorkflowRecipeTerminalTarget]);
export type WorkflowRecipeRouteTarget = z.infer<typeof WorkflowRecipeRouteTarget>;

export const WorkflowRecipeRouteModeOverrides = z
  .record(Rigor, WorkflowRecipeRouteTarget)
  .refine((overrides) => Object.keys(overrides).length > 0, {
    message: 'route override must declare at least one rigor',
  });
export type WorkflowRecipeRouteModeOverrides = z.infer<typeof WorkflowRecipeRouteModeOverrides>;

export const WorkflowRecipeContractAlias = z
  .object({
    generic: WorkflowPrimitiveContractRef,
    actual: WorkflowPrimitiveContractRef,
  })
  .strict();
export type WorkflowRecipeContractAlias = z.infer<typeof WorkflowRecipeContractAlias>;

export const WorkflowRecipeEvidenceRequirement = z.string().min(1);
export type WorkflowRecipeEvidenceRequirement = z.infer<typeof WorkflowRecipeEvidenceRequirement>;

export const WorkflowRecipeEvidenceRequirements = z
  .array(WorkflowRecipeEvidenceRequirement)
  .min(1)
  .superRefine((requirements, ctx) => {
    const seen = new Set<string>();
    for (const [index, requirement] of requirements.entries()) {
      if (seen.has(requirement)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `duplicate evidence requirement: ${requirement}`,
        });
      }
      seen.add(requirement);
    }
  });
export type WorkflowRecipeEvidenceRequirements = z.infer<typeof WorkflowRecipeEvidenceRequirements>;

export const WorkflowRecipeExecutionKind = z.enum([
  'synthesis',
  'dispatch',
  'verification',
  'checkpoint',
]);
export type WorkflowRecipeExecutionKind = z.infer<typeof WorkflowRecipeExecutionKind>;

export const WorkflowRecipeExecution = z
  .object({
    kind: WorkflowRecipeExecutionKind,
    role: DispatchRole.optional(),
  })
  .strict()
  .superRefine((execution, ctx) => {
    if (execution.kind === 'dispatch') {
      if (execution.role === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['role'],
          message: 'dispatch execution requires a dispatch role',
        });
      }
      return;
    }
    if (execution.role !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'dispatch role is only allowed for dispatch execution',
      });
    }
  });
export type WorkflowRecipeExecution = z.infer<typeof WorkflowRecipeExecution>;

// Per-item write paths. Conditional on execution.kind:
//   synthesis | verification           → artifact_path required (single-artifact write)
//   dispatch                           → request_path, receipt_path, result_path required;
//                                        artifact_path optional (worker-emitted typed artifact)
//   checkpoint                         → checkpoint_request_path, checkpoint_response_path required;
//                                        artifact_path optional (only for build_brief checkpoints)
// Cross-field shape is enforced at the WorkflowRecipeItem superRefine where
// execution.kind is in scope.
export const WorkflowRecipeWrites = z
  .object({
    artifact_path: RunRelativePath.optional(),
    request_path: RunRelativePath.optional(),
    receipt_path: RunRelativePath.optional(),
    result_path: RunRelativePath.optional(),
    checkpoint_request_path: RunRelativePath.optional(),
    checkpoint_response_path: RunRelativePath.optional(),
  })
  .strict();
export type WorkflowRecipeWrites = z.infer<typeof WorkflowRecipeWrites>;

// Per-item gate metadata. Conditional on execution.kind:
//   synthesis | verification           → required: SchemaSectionsGate.required
//   checkpoint                         → allow: CheckpointSelectionGate.allow
//   dispatch                           → pass: ResultVerdictGate.pass
// Cross-field shape is enforced at the WorkflowRecipeItem superRefine.
export const WorkflowRecipeGate = z
  .object({
    required: z.array(z.string().min(1)).min(1).optional(),
    allow: z.array(z.string().min(1)).min(1).optional(),
    pass: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type WorkflowRecipeGate = z.infer<typeof WorkflowRecipeGate>;

export const WorkflowRecipeItem = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    title: z.string().min(1),
    phase: CanonicalPhase,
    input: z
      .record(z.string().regex(/^[a-z][a-z0-9_]*$/), WorkflowPrimitiveContractRef)
      .default({}),
    output: WorkflowPrimitiveContractRef,
    evidence_requirements: WorkflowRecipeEvidenceRequirements,
    execution: WorkflowRecipeExecution,
    selection: SelectionOverride.optional(),
    routes: z.record(z.string(), WorkflowRecipeRouteTarget).refine((routes) => {
      return Object.keys(routes).length > 0;
    }, 'recipe item must declare at least one route'),
    route_overrides: z.record(z.string(), WorkflowRecipeRouteModeOverrides).default({}),
    // The fields below are required by the recipe → Workflow compiler. They
    // are optional at parse time so existing candidate recipes remain
    // parseable while the active recipes (build/explore/review) are
    // populated incrementally. The compiler enforces presence and
    // (kind, gate, writes) shape.
    protocol: ProtocolId.optional(),
    writes: WorkflowRecipeWrites.optional(),
    gate: WorkflowRecipeGate.optional(),
    checkpoint_policy: CheckpointPolicy.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const seenRoutes = new Set<string>();
    for (const route of Object.keys(item.routes)) {
      if (!WorkflowPrimitiveRoute.safeParse(route).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['routes', route],
          message: `unknown recipe route outcome: ${route}`,
        });
      }
      if (seenRoutes.has(route)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['routes', route],
          message: `duplicate route outcome: ${route}`,
        });
      }
      seenRoutes.add(route);
    }
    for (const route of Object.keys(item.route_overrides)) {
      if (!WorkflowPrimitiveRoute.safeParse(route).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['route_overrides', route],
          message: `unknown recipe route outcome: ${route}`,
        });
      }
      if (!Object.hasOwn(item.routes, route)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['route_overrides', route],
          message: `route override must target a declared route outcome: ${route}`,
        });
      }
    }
    validateExecutionShape(item, ctx);
  });
export type WorkflowRecipeItem = z.infer<typeof WorkflowRecipeItem>;

// Cross-field check for the optional executor metadata. When `writes` or
// `gate` is supplied, its shape must match `execution.kind`. When
// `checkpoint_policy` is supplied, `execution.kind` must be 'checkpoint'.
// Absence is allowed (these fields are populated per-recipe over time and
// the compiler raises a separate "missing" diagnostic).
function validateExecutionShape(
  item: {
    execution: WorkflowRecipeExecution;
    writes?: WorkflowRecipeWrites | undefined;
    gate?: WorkflowRecipeGate | undefined;
    checkpoint_policy?: CheckpointPolicy | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const kind = item.execution.kind;

  if (item.writes !== undefined) {
    const w = item.writes;
    const has = (key: keyof WorkflowRecipeWrites) => w[key] !== undefined;
    const expectArtifact = () => {
      if (!has('artifact_path')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', 'artifact_path'],
          message: `${kind} execution requires writes.artifact_path`,
        });
      }
    };
    const expectDispatchSlots = () => {
      for (const key of ['request_path', 'receipt_path', 'result_path'] as const) {
        if (!has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', key],
            message: `dispatch execution requires writes.${key}`,
          });
        }
      }
    };
    const expectCheckpointSlots = () => {
      for (const key of ['checkpoint_request_path', 'checkpoint_response_path'] as const) {
        if (!has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', key],
            message: `checkpoint execution requires writes.${key}`,
          });
        }
      }
    };
    const forbid = (key: keyof WorkflowRecipeWrites, allowedKinds: string) => {
      if (has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', key],
          message: `writes.${key} is only allowed for ${allowedKinds} execution`,
        });
      }
    };
    switch (kind) {
      case 'synthesis':
      case 'verification':
        expectArtifact();
        forbid('request_path', 'dispatch');
        forbid('receipt_path', 'dispatch');
        forbid('result_path', 'dispatch');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
      case 'dispatch':
        expectDispatchSlots();
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
      case 'checkpoint':
        expectCheckpointSlots();
        forbid('request_path', 'dispatch');
        forbid('receipt_path', 'dispatch');
        forbid('result_path', 'dispatch');
        break;
    }
  }

  if (item.gate !== undefined) {
    const g = item.gate;
    const expectField = (field: 'required' | 'allow' | 'pass', forKinds: string) => {
      if (g[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', field],
          message: `${forKinds} execution requires gate.${field}`,
        });
      }
    };
    const forbidField = (field: 'required' | 'allow' | 'pass', allowedKinds: string) => {
      if (g[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', field],
          message: `gate.${field} is only allowed for ${allowedKinds} execution`,
        });
      }
    };
    switch (kind) {
      case 'synthesis':
      case 'verification':
        expectField('required', `${kind}`);
        forbidField('allow', 'checkpoint');
        forbidField('pass', 'dispatch');
        break;
      case 'checkpoint':
        expectField('allow', 'checkpoint');
        forbidField('required', 'synthesis|verification');
        forbidField('pass', 'dispatch');
        break;
      case 'dispatch':
        expectField('pass', 'dispatch');
        forbidField('required', 'synthesis|verification');
        forbidField('allow', 'checkpoint');
        break;
    }
  }

  if (item.checkpoint_policy !== undefined && kind !== 'checkpoint') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkpoint_policy'],
      message: 'checkpoint_policy is only allowed for checkpoint execution',
    });
  }
}

// Recipe-level entry mode. Each emitted Workflow inherits these as
// Workflow.entry_modes[i] with start_at = recipe.starts_at.
export const WorkflowRecipeEntryMode = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    rigor: Rigor,
    description: z.string().min(1),
    default_lane: Lane.optional(),
  })
  .strict();
export type WorkflowRecipeEntryMode = z.infer<typeof WorkflowRecipeEntryMode>;

// Per-canonical-phase metadata. Lets a recipe map its canonical phases
// to author-friendly phase ids and titles ("Synthesize" for explore's
// canonical=act phase, "Independent Audit" for review's canonical=analyze).
export const WorkflowRecipePhase = z
  .object({
    canonical: CanonicalPhase,
    id: PhaseId,
    title: z.string().min(1),
  })
  .strict();
export type WorkflowRecipePhase = z.infer<typeof WorkflowRecipePhase>;

// Recipe-level entry classification — matches Workflow.entry shape so the
// compiler can pass it through directly.
export const WorkflowRecipeEntry = z
  .object({
    signals: z
      .object({
        include: z.array(z.string()).default([]),
        exclude: z.array(z.string()).default([]),
      })
      .strict(),
    intent_prefixes: z.array(z.string()).default([]),
  })
  .strict();
export type WorkflowRecipeEntry = z.infer<typeof WorkflowRecipeEntry>;

export const WorkflowRecipe = z
  .object({
    schema_version: z.literal('1'),
    id: WorkflowId,
    title: z.string().min(1),
    purpose: z.string().min(1),
    status: WorkflowRecipeStatus,
    starts_at: StepId,
    initial_contracts: z.array(WorkflowPrimitiveContractRef).default([]),
    contract_aliases: z.array(WorkflowRecipeContractAlias).default([]),
    items: z.array(WorkflowRecipeItem).min(1),
    // Compiler-required metadata. Optional at parse time so candidate recipes
    // (and recipes still being upgraded) keep parsing. The compiler enforces
    // presence and consistency at emit time.
    version: z.string().min(1).optional(),
    entry: WorkflowRecipeEntry.optional(),
    entry_modes: z.array(WorkflowRecipeEntryMode).min(1).optional(),
    spine_policy: SpinePolicy.optional(),
    phases: z.array(WorkflowRecipePhase).optional(),
    default_selection: SelectionOverride.optional(),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    const itemIds = new Map<string, number>();
    for (const [index, item] of recipe.items.entries()) {
      const prior = itemIds.get(item.id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: `duplicate recipe item id: ${item.id} also appears at index ${prior}`,
        });
      }
      itemIds.set(item.id, index);
    }

    if (!itemIds.has(recipe.starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['starts_at'],
        message: `starts_at references unknown item id: ${recipe.starts_at}`,
      });
    }

    for (const [index, item] of recipe.items.entries()) {
      for (const [route, target] of Object.entries(item.routes)) {
        if (WorkflowRecipeTerminalTarget.safeParse(target).success) continue;
        if (!itemIds.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'routes', route],
            message: `route target references unknown recipe item id: ${target}`,
          });
        }
      }
      for (const [route, overrides] of Object.entries(item.route_overrides)) {
        for (const [rigor, target] of Object.entries(overrides)) {
          if (WorkflowRecipeTerminalTarget.safeParse(target).success) continue;
          if (!itemIds.has(target)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', index, 'route_overrides', route, rigor],
              message: `route override target references unknown recipe item id: ${target}`,
            });
          }
        }
      }
    }

    const aliases = new Set<string>();
    for (const [index, alias] of recipe.contract_aliases.entries()) {
      const key = `${alias.generic}\0${alias.actual}`;
      if (aliases.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contract_aliases', index],
          message: `duplicate contract alias: ${alias.generic} -> ${alias.actual}`,
        });
      }
      aliases.add(key);
    }

    if (recipe.entry_modes !== undefined) {
      const seenNames = new Set<string>();
      for (const [index, mode] of recipe.entry_modes.entries()) {
        if (seenNames.has(mode.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['entry_modes', index, 'name'],
            message: `duplicate entry mode name: ${mode.name}`,
          });
        }
        seenNames.add(mode.name);
      }
    }

    if (recipe.phases !== undefined) {
      const seenCanonicals = new Set<CanonicalPhaseValue>();
      const seenIds = new Set<string>();
      for (const [index, phase] of recipe.phases.entries()) {
        if (seenCanonicals.has(phase.canonical)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['phases', index, 'canonical'],
            message: `duplicate canonical phase mapping: ${phase.canonical}`,
          });
        }
        seenCanonicals.add(phase.canonical);
        if (seenIds.has(phase.id as unknown as string)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['phases', index, 'id'],
            message: `duplicate phase id: ${phase.id}`,
          });
        }
        seenIds.add(phase.id as unknown as string);
      }
      // Every canonical phase touched by any item must have a phases entry.
      const itemCanonicals = new Set<CanonicalPhaseValue>(recipe.items.map((item) => item.phase));
      for (const canonical of itemCanonicals) {
        if (!seenCanonicals.has(canonical)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['phases'],
            message: `phases is missing an entry for canonical phase '${canonical}' which is used by at least one item`,
          });
        }
      }
      // The reverse — phases entries that no item references — is allowed
      // for now; the compiler may still want to declare empty phases for
      // spine completeness. spine_policy carries the omit story.
    }

    if (recipe.spine_policy !== undefined && recipe.spine_policy.mode === 'partial') {
      const seenOmits = new Set<CanonicalPhaseValue>();
      for (const [index, omitted] of recipe.spine_policy.omits.entries()) {
        if (seenOmits.has(omitted)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['spine_policy', 'omits', index],
            message: `duplicate omitted phase: ${omitted}`,
          });
        }
        seenOmits.add(omitted);
      }
      // omits must be disjoint from phases.canonical when both are present.
      if (recipe.phases !== undefined) {
        const declared = new Set(recipe.phases.map((phase) => phase.canonical));
        for (const omitted of seenOmits) {
          if (declared.has(omitted)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['spine_policy', 'omits'],
              message: `canonical phase '${omitted}' is both declared in phases and listed in spine_policy.omits`,
            });
          }
        }
      }
      // omits must not include a phase that any item uses.
      const itemCanonicals = new Set<CanonicalPhaseValue>(recipe.items.map((item) => item.phase));
      for (const omitted of seenOmits) {
        if (itemCanonicals.has(omitted)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['spine_policy', 'omits'],
            message: `canonical phase '${omitted}' is omitted but used by at least one item`,
          });
        }
      }
    }
  });
export type WorkflowRecipe = z.infer<typeof WorkflowRecipe>;

export type WorkflowRecipeCatalogCompatibilityIssue = {
  item_id?: string;
  message: string;
};

export const WorkflowRecipeProjectedRouteModeTargets = z.record(Rigor, WorkflowRecipeRouteTarget);
export type WorkflowRecipeProjectedRouteModeTargets = z.infer<
  typeof WorkflowRecipeProjectedRouteModeTargets
>;

export const WorkflowRecipeProjectedRoute = z
  .object({
    outcome: WorkflowPrimitiveRoute,
    default_target: WorkflowRecipeRouteTarget,
    mode_targets: WorkflowRecipeProjectedRouteModeTargets.default({}),
  })
  .strict();
export type WorkflowRecipeProjectedRoute = z.infer<typeof WorkflowRecipeProjectedRoute>;

export const WorkflowRecipeProjectedItem = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    phase: CanonicalPhase,
    execution: WorkflowRecipeExecution,
    output: WorkflowPrimitiveContractRef,
    routes: z.array(WorkflowRecipeProjectedRoute).min(1),
  })
  .strict();
export type WorkflowRecipeProjectedItem = z.infer<typeof WorkflowRecipeProjectedItem>;

export const WorkflowRecipeProjectedPhase = z
  .object({
    phase: CanonicalPhase,
    items: z.array(StepId).min(1),
  })
  .strict();
export type WorkflowRecipeProjectedPhase = z.infer<typeof WorkflowRecipeProjectedPhase>;

export const WorkflowRecipeCompilerProjection = z
  .object({
    recipe_id: WorkflowId,
    starts_at: StepId,
    phases: z.array(WorkflowRecipeProjectedPhase).min(1),
    omitted_phases: z.array(CanonicalPhase).default([]),
    items: z.array(WorkflowRecipeProjectedItem).min(1),
  })
  .strict();
export type WorkflowRecipeCompilerProjection = z.infer<typeof WorkflowRecipeCompilerProjection>;

export const WorkflowRecipeDraftEdge = z
  .object({
    outcome: WorkflowPrimitiveRoute,
    target: WorkflowRecipeRouteTarget,
  })
  .strict();
export type WorkflowRecipeDraftEdge = z.infer<typeof WorkflowRecipeDraftEdge>;

export const WorkflowRecipeDraftItem = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    phase: CanonicalPhase,
    execution: WorkflowRecipeExecution,
    output: WorkflowPrimitiveContractRef,
    edges: z.array(WorkflowRecipeDraftEdge).min(1),
  })
  .strict();
export type WorkflowRecipeDraftItem = z.infer<typeof WorkflowRecipeDraftItem>;

export const WorkflowRecipeDraft = z
  .object({
    recipe_id: WorkflowId,
    rigor: Rigor,
    starts_at: StepId,
    phases: z.array(WorkflowRecipeProjectedPhase).min(1),
    omitted_phases: z.array(CanonicalPhase).default([]),
    items: z.array(WorkflowRecipeDraftItem).min(1),
  })
  .strict();
export type WorkflowRecipeDraft = z.infer<typeof WorkflowRecipeDraft>;

function contractIsCompatible(
  expected: WorkflowPrimitiveContractRefValue,
  actual: WorkflowPrimitiveContractRefValue,
  aliases: readonly WorkflowRecipeContractAlias[],
): boolean {
  if (expected === actual) return true;
  return aliases.some((alias) => alias.generic === expected && alias.actual === actual);
}

function primitiveAcceptedInputSets(
  primitive: WorkflowPrimitiveValue,
): readonly (readonly WorkflowPrimitiveContractRefValue[])[] {
  return [primitive.input_contracts, ...primitive.alternative_input_contracts];
}

function recipeItemSatisfiesInputSet(
  item: WorkflowRecipeItem,
  expectedContracts: readonly WorkflowPrimitiveContractRefValue[],
  aliases: readonly WorkflowRecipeContractAlias[],
): boolean {
  const actualContracts = Object.values(item.input);
  return expectedContracts.every((expected) =>
    actualContracts.some((actual) => contractIsCompatible(expected, actual, aliases)),
  );
}

function formatContractSet(contracts: readonly WorkflowPrimitiveContractRefValue[]): string {
  return `[${contracts.join(', ')}]`;
}

function isTerminalTarget(
  target: WorkflowRecipeRouteTarget,
): target is WorkflowRecipeTerminalTarget {
  return WorkflowRecipeTerminalTarget.safeParse(target).success;
}

function recipeItemRouteTargets(item: WorkflowRecipeItem): WorkflowRecipeRouteTarget[] {
  return [
    ...Object.values(item.routes),
    ...Object.values(item.route_overrides).flatMap((overrides) => Object.values(overrides)),
  ];
}

function recipeItemRouteOutcomes(item: WorkflowRecipeItem): string[] {
  return [...new Set([...Object.keys(item.routes), ...Object.keys(item.route_overrides)])];
}

// Recipe-author-selectable execution kinds for a primitive. The catalog's
// `action_surface` describes the primitive's *typical* role, but the actual
// committed Workflows show that primitives are flexibly used: Build's plan
// is inline synthesis though the catalog calls plan a "worker" primitive;
// Build's frame is a checkpoint though frame is "orchestrator". Treat
// action_surface as a recommendation: a worker primitive can be dispatched
// OR done inline as synthesis; an orchestrator primitive can write a brief
// (synthesis) OR pause for confirmation (checkpoint). The runtime decides
// based on rigor and architecture.
function acceptedExecutionKinds(
  primitive: WorkflowPrimitiveValue,
): readonly WorkflowRecipeExecutionKind[] {
  if (primitive.id === 'run-verification') return ['verification'];
  switch (primitive.action_surface) {
    case 'worker':
      return ['dispatch', 'synthesis'];
    case 'host':
      return ['checkpoint'];
    case 'orchestrator':
      return ['synthesis', 'checkpoint'];
    case 'mixed':
      return ['synthesis', 'dispatch', 'verification', 'checkpoint'];
  }
}

function acceptedPhases(primitive: WorkflowPrimitiveValue): readonly CanonicalPhaseValue[] {
  switch (primitive.id) {
    case 'intake':
    case 'route':
    case 'frame':
      return ['frame'];
    case 'gather-context':
    case 'diagnose':
      return ['analyze'];
    case 'plan':
    case 'queue':
      return ['plan'];
    case 'act':
    case 'batch':
      return ['act'];
    case 'run-verification':
      return ['verify'];
    case 'review':
      // Review primitive runs in the canonical 'review' phase by default,
      // but the audit-only Review workflow places its reviewer dispatch in
      // the canonical 'analyze' phase (the audit IS the analysis there;
      // there is no separate "act + review" structure to gate against).
      return ['review', 'analyze'];
    case 'risk-rollback-check':
      return ['verify', 'close'];
    case 'close-with-evidence':
    case 'handoff':
      return ['close'];
    case 'human-decision':
      return CANONICAL_PHASES;
  }
}

function intersectContracts(
  left: ReadonlySet<WorkflowPrimitiveContractRefValue>,
  right: ReadonlySet<WorkflowPrimitiveContractRefValue>,
): Set<WorkflowPrimitiveContractRefValue> {
  const intersection = new Set<WorkflowPrimitiveContractRefValue>();
  for (const value of left) {
    if (right.has(value)) intersection.add(value);
  }
  return intersection;
}

function contractSetsEqual(
  left: ReadonlySet<WorkflowPrimitiveContractRefValue>,
  right: ReadonlySet<WorkflowPrimitiveContractRefValue>,
): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function collectRouteAwareAvailability(
  recipe: WorkflowRecipe,
): Map<string, Set<WorkflowPrimitiveContractRefValue>> {
  const itemById = new Map(recipe.items.map((item) => [item.id as unknown as string, item]));
  const availableAt = new Map<string, Set<WorkflowPrimitiveContractRefValue>>();
  const worklist: string[] = [recipe.starts_at];
  availableAt.set(recipe.starts_at, new Set(recipe.initial_contracts));

  while (worklist.length > 0) {
    const itemId = worklist.shift();
    if (itemId === undefined) continue;
    const item = itemById.get(itemId);
    const current = availableAt.get(itemId);
    if (item === undefined || current === undefined) continue;

    const afterItem = new Set(current);
    afterItem.add(item.output);

    for (const target of recipeItemRouteTargets(item)) {
      if (isTerminalTarget(target)) continue;
      const prior = availableAt.get(target);
      if (prior === undefined) {
        availableAt.set(target, new Set(afterItem));
        worklist.push(target);
        continue;
      }
      const narrowed = intersectContracts(prior, afterItem);
      if (!contractSetsEqual(prior, narrowed)) {
        availableAt.set(target, narrowed);
        worklist.push(target);
      }
    }
  }

  return availableAt;
}

export function validateWorkflowRecipeCatalogCompatibility(
  recipe: WorkflowRecipe,
  catalog: WorkflowPrimitiveCatalogValue,
): WorkflowRecipeCatalogCompatibilityIssue[] {
  const parsedCatalog = WorkflowPrimitiveCatalog.safeParse(catalog);
  if (!parsedCatalog.success) {
    return [{ message: `primitive catalog failed to parse: ${parsedCatalog.error.message}` }];
  }

  const primitiveById = new Map(parsedCatalog.data.primitives.map((p) => [p.id, p]));
  const issues: WorkflowRecipeCatalogCompatibilityIssue[] = [];

  for (const item of recipe.items) {
    const primitive = primitiveById.get(item.uses as WorkflowPrimitiveIdValue);
    if (primitive === undefined) {
      issues.push({
        item_id: item.id,
        message: `unknown primitive id: ${item.uses}`,
      });
      continue;
    }

    for (const route of recipeItemRouteOutcomes(item) as WorkflowPrimitiveRouteValue[]) {
      if (!primitive.allowed_routes.includes(route)) {
        issues.push({
          item_id: item.id,
          message: `route "${route}" is not allowed by primitive "${item.uses}"`,
        });
      }
    }

    const acceptedInputSets = primitiveAcceptedInputSets(primitive);
    if (
      !acceptedInputSets.some((expectedContracts) =>
        recipeItemSatisfiesInputSet(item, expectedContracts, recipe.contract_aliases),
      )
    ) {
      issues.push({
        item_id: item.id,
        message: `inputs do not satisfy primitive "${item.uses}"; expected one of ${acceptedInputSets
          .map(formatContractSet)
          .join(' or ')}`,
      });
    }

    if (!contractIsCompatible(primitive.output_contract, item.output, recipe.contract_aliases)) {
      issues.push({
        item_id: item.id,
        message: `output "${item.output}" is not compatible with primitive output "${primitive.output_contract}"`,
      });
    }

    for (const requirement of primitive.produces_evidence) {
      if (!item.evidence_requirements.includes(requirement)) {
        issues.push({
          item_id: item.id,
          message: `evidence requirement "${requirement}" from primitive "${item.uses}" is not declared by recipe item`,
        });
      }
    }

    const executionKinds = acceptedExecutionKinds(primitive);
    if (!executionKinds.includes(item.execution.kind)) {
      issues.push({
        item_id: item.id,
        message: `execution kind "${item.execution.kind}" is not compatible with primitive "${item.uses}"; expected one of ${executionKinds.join(', ')}`,
      });
    }

    const phases = acceptedPhases(primitive);
    if (!phases.includes(item.phase)) {
      issues.push({
        item_id: item.id,
        message: `phase "${item.phase}" is not compatible with primitive "${item.uses}"; expected one of ${phases.join(', ')}`,
      });
    }
  }

  const availableAt = collectRouteAwareAvailability(recipe);
  for (const item of recipe.items) {
    const availableContracts = availableAt.get(item.id);
    if (availableContracts === undefined) {
      issues.push({
        item_id: item.id,
        message: 'recipe item is unreachable from starts_at',
      });
      continue;
    }
    for (const [name, contract] of Object.entries(item.input)) {
      if (!availableContracts.has(contract)) {
        issues.push({
          item_id: item.id,
          message: `input "${name}" references unavailable contract "${contract}" on at least one reachable route`,
        });
      }
    }
  }

  return issues;
}

export function projectWorkflowRecipeForCompiler(
  recipe: WorkflowRecipe,
): WorkflowRecipeCompilerProjection {
  const phaseItems = new Map<CanonicalPhaseValue, StepId[]>();
  const projectedItems: WorkflowRecipeProjectedItem[] = recipe.items.map((item) => {
    const items = phaseItems.get(item.phase) ?? [];
    items.push(item.id);
    phaseItems.set(item.phase, items);
    const projectedRoutes: WorkflowRecipeProjectedRoute[] = (
      Object.keys(item.routes) as WorkflowPrimitiveRouteValue[]
    ).map((outcome) => {
      const overrides = item.route_overrides[outcome];
      return {
        outcome,
        default_target: item.routes[outcome] as WorkflowRecipeRouteTarget,
        mode_targets: (overrides ?? {}) as WorkflowRecipeProjectedRouteModeTargets,
      };
    });
    return {
      id: item.id,
      uses: item.uses,
      phase: item.phase,
      execution: item.execution,
      output: item.output,
      routes: projectedRoutes,
    };
  });

  const phases: WorkflowRecipeProjectedPhase[] = [];
  const omitted_phases: CanonicalPhaseValue[] = [];
  for (const phase of CANONICAL_PHASES) {
    const items = phaseItems.get(phase);
    if (items === undefined) {
      omitted_phases.push(phase);
      continue;
    }
    phases.push({ phase, items });
  }

  return WorkflowRecipeCompilerProjection.parse({
    recipe_id: recipe.id,
    starts_at: recipe.starts_at,
    phases,
    omitted_phases,
    items: projectedItems,
  });
}

export function compileWorkflowRecipeDraft(
  projection: WorkflowRecipeCompilerProjection,
  rigor: Rigor,
): WorkflowRecipeDraft {
  const items: WorkflowRecipeDraftItem[] = projection.items.map((item) => {
    const edges: WorkflowRecipeDraftEdge[] = item.routes.map((route) => ({
      outcome: route.outcome,
      target: route.mode_targets[rigor] ?? route.default_target,
    }));
    return {
      id: item.id,
      uses: item.uses,
      phase: item.phase,
      execution: item.execution,
      output: item.output,
      edges,
    };
  });

  return WorkflowRecipeDraft.parse({
    recipe_id: projection.recipe_id,
    rigor,
    starts_at: projection.starts_at,
    phases: projection.phases,
    omitted_phases: projection.omitted_phases,
    items,
  });
}
