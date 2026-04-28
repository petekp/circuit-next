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
import { CheckpointPolicy, DispatchRole, WorkflowRef } from './step.js';
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

export const FlowSchematicStatus = z.enum(['candidate', 'active', 'deprecated']);
export type FlowSchematicStatus = z.infer<typeof FlowSchematicStatus>;

export const StepRouteTerminalTarget = z.enum(['@complete', '@stop', '@handoff', '@escalate']);
export type StepRouteTerminalTarget = z.infer<typeof StepRouteTerminalTarget>;

export const StepRouteTarget = z.union([StepId, StepRouteTerminalTarget]);
export type StepRouteTarget = z.infer<typeof StepRouteTarget>;

export const SchematicRouteModeOverrides = z
  .record(Rigor, StepRouteTarget)
  .refine((overrides) => Object.keys(overrides).length > 0, {
    message: 'route override must declare at least one rigor',
  });
export type SchematicRouteModeOverrides = z.infer<typeof SchematicRouteModeOverrides>;

export const SchematicContractAlias = z
  .object({
    generic: WorkflowPrimitiveContractRef,
    actual: WorkflowPrimitiveContractRef,
  })
  .strict();
export type SchematicContractAlias = z.infer<typeof SchematicContractAlias>;

export const SchematicEvidenceRequirement = z.string().min(1);
export type SchematicEvidenceRequirement = z.infer<typeof SchematicEvidenceRequirement>;

export const SchematicEvidenceRequirements = z
  .array(SchematicEvidenceRequirement)
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
export type SchematicEvidenceRequirements = z.infer<typeof SchematicEvidenceRequirements>;

export const StepExecutionKind = z.enum([
  'synthesis',
  'dispatch',
  'verification',
  'checkpoint',
  'sub-run',
]);
export type StepExecutionKind = z.infer<typeof StepExecutionKind>;

// Schematic-level shape for a sub-run step's child workflow handoff. Mirrors
// the runtime SubRunStep fields (workflow_ref + goal + rigor) but kept as
// schematic-level optional fields so existing dispatch/synthesis/etc.
// executions stay parseable. The cross-field rule lives in the
// superRefine below.
export const StepExecution = z
  .object({
    kind: StepExecutionKind,
    role: DispatchRole.optional(),
    workflow_ref: WorkflowRef.optional(),
    goal: z.string().min(1).optional(),
    rigor: Rigor.optional(),
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
    } else if (execution.role !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'dispatch role is only allowed for dispatch execution',
      });
    }
    if (execution.kind === 'sub-run') {
      if (execution.workflow_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workflow_ref'],
          message: 'sub-run execution requires workflow_ref',
        });
      }
      if (execution.goal === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['goal'],
          message: 'sub-run execution requires goal',
        });
      }
      if (execution.rigor === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rigor'],
          message: 'sub-run execution requires rigor',
        });
      }
    } else {
      if (execution.workflow_ref !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workflow_ref'],
          message: 'workflow_ref is only allowed for sub-run execution',
        });
      }
      if (execution.goal !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['goal'],
          message: 'goal is only allowed for sub-run execution',
        });
      }
      if (execution.rigor !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rigor'],
          message: 'rigor is only allowed for sub-run execution',
        });
      }
    }
  });
export type StepExecution = z.infer<typeof StepExecution>;

// Per-item write paths. Conditional on execution.kind:
//   synthesis | verification           → artifact_path required (single-artifact write)
//   dispatch                           → request_path, receipt_path, result_path required;
//                                        artifact_path optional (worker-emitted typed artifact)
//   checkpoint                         → checkpoint_request_path, checkpoint_response_path required;
//                                        artifact_path optional (only for build_brief checkpoints)
//   sub-run                            → result_path required (child run's result.json copied
//                                        into parent's writes.result slot — RunResult shape)
// Cross-field shape is enforced at the SchematicStep superRefine where
// execution.kind is in scope.
export const StepWrites = z
  .object({
    artifact_path: RunRelativePath.optional(),
    request_path: RunRelativePath.optional(),
    receipt_path: RunRelativePath.optional(),
    result_path: RunRelativePath.optional(),
    checkpoint_request_path: RunRelativePath.optional(),
    checkpoint_response_path: RunRelativePath.optional(),
  })
  .strict();
export type StepWrites = z.infer<typeof StepWrites>;

// Per-item gate metadata. Conditional on execution.kind:
//   synthesis | verification           → required: SchemaSectionsGate.required
//   checkpoint                         → allow: CheckpointSelectionGate.allow
//   dispatch | sub-run                 → pass: ResultVerdictGate.pass
// Cross-field shape is enforced at the SchematicStep superRefine.
export const StepCheck = z
  .object({
    required: z.array(z.string().min(1)).min(1).optional(),
    allow: z.array(z.string().min(1)).min(1).optional(),
    pass: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type StepCheck = z.infer<typeof StepCheck>;

export const SchematicStep = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    title: z.string().min(1),
    phase: CanonicalPhase,
    input: z
      .record(z.string().regex(/^[a-z][a-z0-9_]*$/), WorkflowPrimitiveContractRef)
      .default({}),
    output: WorkflowPrimitiveContractRef,
    evidence_requirements: SchematicEvidenceRequirements,
    execution: StepExecution,
    selection: SelectionOverride.optional(),
    routes: z.record(z.string(), StepRouteTarget).refine((routes) => {
      return Object.keys(routes).length > 0;
    }, 'schematic item must declare at least one route'),
    route_overrides: z.record(z.string(), SchematicRouteModeOverrides).default({}),
    // The fields below are required by the schematic → Workflow compiler. They
    // are optional at parse time so existing candidate schematics remain
    // parseable while the active schematics (build/explore/review) are
    // populated incrementally. The compiler enforces presence and
    // (kind, gate, writes) shape.
    protocol: ProtocolId.optional(),
    writes: StepWrites.optional(),
    gate: StepCheck.optional(),
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
          message: `unknown schematic route outcome: ${route}`,
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
          message: `unknown schematic route outcome: ${route}`,
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
export type SchematicStep = z.infer<typeof SchematicStep>;

// Cross-field check for the optional executor metadata. When `writes` or
// `gate` is supplied, its shape must match `execution.kind`. When
// `checkpoint_policy` is supplied, `execution.kind` must be 'checkpoint'.
// Absence is allowed (these fields are populated per-schematic over time and
// the compiler raises a separate "missing" diagnostic).
function validateExecutionShape(
  item: {
    execution: StepExecution;
    writes?: StepWrites | undefined;
    gate?: StepCheck | undefined;
    checkpoint_policy?: CheckpointPolicy | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const kind = item.execution.kind;

  if (item.writes !== undefined) {
    const w = item.writes;
    const has = (key: keyof StepWrites) => w[key] !== undefined;
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
    const expectSubRunSlots = () => {
      if (!has('result_path')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', 'result_path'],
          message: 'sub-run execution requires writes.result_path',
        });
      }
    };
    const forbid = (key: keyof StepWrites, allowedKinds: string) => {
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
        forbid('result_path', 'dispatch|sub-run');
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
        forbid('result_path', 'dispatch|sub-run');
        break;
      case 'sub-run':
        expectSubRunSlots();
        forbid('artifact_path', 'synthesis|verification');
        forbid('request_path', 'dispatch');
        forbid('receipt_path', 'dispatch');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
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
        forbidField('pass', 'dispatch|sub-run');
        break;
      case 'checkpoint':
        expectField('allow', 'checkpoint');
        forbidField('required', 'synthesis|verification');
        forbidField('pass', 'dispatch|sub-run');
        break;
      case 'dispatch':
      case 'sub-run':
        expectField('pass', `${kind}`);
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

// Schematic-level entry mode. Each emitted Workflow inherits these as
// Workflow.entry_modes[i] with start_at = schematic.starts_at.
export const FlowEntryMode = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    rigor: Rigor,
    description: z.string().min(1),
    default_lane: Lane.optional(),
  })
  .strict();
export type FlowEntryMode = z.infer<typeof FlowEntryMode>;

// Per-canonical-phase metadata. Lets a schematic map its canonical phases
// to author-friendly phase ids and titles ("Synthesize" for explore's
// canonical=act phase, "Independent Audit" for review's canonical=analyze).
export const SchematicPhase = z
  .object({
    canonical: CanonicalPhase,
    id: PhaseId,
    title: z.string().min(1),
  })
  .strict();
export type SchematicPhase = z.infer<typeof SchematicPhase>;

// Schematic-level entry classification — matches Workflow.entry shape so the
// compiler can pass it through directly.
export const FlowSchematicEntry = z
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
export type FlowSchematicEntry = z.infer<typeof FlowSchematicEntry>;

export const FlowSchematic = z
  .object({
    schema_version: z.literal('1'),
    id: WorkflowId,
    title: z.string().min(1),
    purpose: z.string().min(1),
    status: FlowSchematicStatus,
    starts_at: StepId,
    initial_contracts: z.array(WorkflowPrimitiveContractRef).default([]),
    contract_aliases: z.array(SchematicContractAlias).default([]),
    items: z.array(SchematicStep).min(1),
    // Compiler-required metadata. Optional at parse time so candidate schematics
    // (and schematics still being upgraded) keep parsing. The compiler enforces
    // presence and consistency at emit time.
    version: z.string().min(1).optional(),
    entry: FlowSchematicEntry.optional(),
    entry_modes: z.array(FlowEntryMode).min(1).optional(),
    spine_policy: SpinePolicy.optional(),
    phases: z.array(SchematicPhase).optional(),
    default_selection: SelectionOverride.optional(),
  })
  .strict()
  .superRefine((schematic, ctx) => {
    const itemIds = new Map<string, number>();
    for (const [index, item] of schematic.items.entries()) {
      const prior = itemIds.get(item.id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: `duplicate schematic item id: ${item.id} also appears at index ${prior}`,
        });
      }
      itemIds.set(item.id, index);
    }

    if (!itemIds.has(schematic.starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['starts_at'],
        message: `starts_at references unknown item id: ${schematic.starts_at}`,
      });
    }

    for (const [index, item] of schematic.items.entries()) {
      for (const [route, target] of Object.entries(item.routes)) {
        if (StepRouteTerminalTarget.safeParse(target).success) continue;
        if (!itemIds.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'routes', route],
            message: `route target references unknown schematic item id: ${target}`,
          });
        }
      }
      for (const [route, overrides] of Object.entries(item.route_overrides)) {
        for (const [rigor, target] of Object.entries(overrides)) {
          if (StepRouteTerminalTarget.safeParse(target).success) continue;
          if (!itemIds.has(target)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', index, 'route_overrides', route, rigor],
              message: `route override target references unknown schematic item id: ${target}`,
            });
          }
        }
      }
    }

    const aliases = new Set<string>();
    for (const [index, alias] of schematic.contract_aliases.entries()) {
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

    if (schematic.entry_modes !== undefined) {
      const seenNames = new Set<string>();
      for (const [index, mode] of schematic.entry_modes.entries()) {
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

    if (schematic.phases !== undefined) {
      const seenCanonicals = new Set<CanonicalPhaseValue>();
      const seenIds = new Set<string>();
      for (const [index, phase] of schematic.phases.entries()) {
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
      const itemCanonicals = new Set<CanonicalPhaseValue>(
        schematic.items.map((item) => item.phase),
      );
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

    if (schematic.spine_policy !== undefined && schematic.spine_policy.mode === 'partial') {
      const seenOmits = new Set<CanonicalPhaseValue>();
      for (const [index, omitted] of schematic.spine_policy.omits.entries()) {
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
      if (schematic.phases !== undefined) {
        const declared = new Set(schematic.phases.map((phase) => phase.canonical));
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
      const itemCanonicals = new Set<CanonicalPhaseValue>(
        schematic.items.map((item) => item.phase),
      );
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
export type FlowSchematic = z.infer<typeof FlowSchematic>;

export type FlowSchematicCatalogCompatibilityIssue = {
  item_id?: string;
  message: string;
};

function contractIsCompatible(
  expected: WorkflowPrimitiveContractRefValue,
  actual: WorkflowPrimitiveContractRefValue,
  aliases: readonly SchematicContractAlias[],
): boolean {
  if (expected === actual) return true;
  return aliases.some((alias) => alias.generic === expected && alias.actual === actual);
}

function primitiveAcceptedInputSets(
  primitive: WorkflowPrimitiveValue,
): readonly (readonly WorkflowPrimitiveContractRefValue[])[] {
  return [primitive.input_contracts, ...primitive.alternative_input_contracts];
}

function schematicStepSatisfiesInputSet(
  item: SchematicStep,
  expectedContracts: readonly WorkflowPrimitiveContractRefValue[],
  aliases: readonly SchematicContractAlias[],
): boolean {
  const actualContracts = Object.values(item.input);
  return expectedContracts.every((expected) =>
    actualContracts.some((actual) => contractIsCompatible(expected, actual, aliases)),
  );
}

function formatContractSet(contracts: readonly WorkflowPrimitiveContractRefValue[]): string {
  return `[${contracts.join(', ')}]`;
}

function isTerminalTarget(target: StepRouteTarget): target is StepRouteTerminalTarget {
  return StepRouteTerminalTarget.safeParse(target).success;
}

function schematicStepRouteTargets(item: SchematicStep): StepRouteTarget[] {
  return [
    ...Object.values(item.routes),
    ...Object.values(item.route_overrides).flatMap((overrides) => Object.values(overrides)),
  ];
}

function schematicStepRouteOutcomes(item: SchematicStep): string[] {
  return [...new Set([...Object.keys(item.routes), ...Object.keys(item.route_overrides)])];
}

// Schematic-author-selectable execution kinds for a primitive. The catalog's
// `action_surface` describes the primitive's *typical* role, but the actual
// committed Workflows show that primitives are flexibly used: Build's plan
// is inline synthesis though the catalog calls plan a "worker" primitive;
// Build's frame is a checkpoint though frame is "orchestrator". Treat
// action_surface as a recommendation: a worker primitive can be dispatched
// OR done inline as synthesis; an orchestrator primitive can write a brief
// (synthesis) OR pause for confirmation (checkpoint). The runtime decides
// based on rigor and architecture.
function acceptedExecutionKinds(primitive: WorkflowPrimitiveValue): readonly StepExecutionKind[] {
  if (primitive.id === 'run-verification') return ['verification'];
  // sub-run is an orchestration pattern (parent invokes a child workflow,
  // gate admits the child's terminal verdict). The 'batch' primitive is
  // its first consumer (Migrate's batch step delegates to a Build child),
  // so sub-run is allowed wherever 'batch'-shaped work fits — i.e., for
  // 'mixed' surfaces. 'orchestrator' surfaces also accept sub-run because
  // the parent step authoring the sub-run IS an orchestrator action.
  switch (primitive.action_surface) {
    case 'worker':
      return ['dispatch', 'synthesis'];
    case 'host':
      return ['checkpoint'];
    case 'orchestrator':
      return ['synthesis', 'checkpoint', 'sub-run'];
    case 'mixed':
      return ['synthesis', 'dispatch', 'verification', 'checkpoint', 'sub-run'];
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
  schematic: FlowSchematic,
): Map<string, Set<WorkflowPrimitiveContractRefValue>> {
  const itemById = new Map(schematic.items.map((item) => [item.id as unknown as string, item]));
  const availableAt = new Map<string, Set<WorkflowPrimitiveContractRefValue>>();
  const worklist: string[] = [schematic.starts_at];
  availableAt.set(schematic.starts_at, new Set(schematic.initial_contracts));

  while (worklist.length > 0) {
    const itemId = worklist.shift();
    if (itemId === undefined) continue;
    const item = itemById.get(itemId);
    const current = availableAt.get(itemId);
    if (item === undefined || current === undefined) continue;

    const afterItem = new Set(current);
    afterItem.add(item.output);

    for (const target of schematicStepRouteTargets(item)) {
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

export function validateFlowSchematicCatalogCompatibility(
  schematic: FlowSchematic,
  catalog: WorkflowPrimitiveCatalogValue,
): FlowSchematicCatalogCompatibilityIssue[] {
  const parsedCatalog = WorkflowPrimitiveCatalog.safeParse(catalog);
  if (!parsedCatalog.success) {
    return [{ message: `primitive catalog failed to parse: ${parsedCatalog.error.message}` }];
  }

  const primitiveById = new Map(parsedCatalog.data.primitives.map((p) => [p.id, p]));
  const issues: FlowSchematicCatalogCompatibilityIssue[] = [];

  for (const item of schematic.items) {
    const primitive = primitiveById.get(item.uses as WorkflowPrimitiveIdValue);
    if (primitive === undefined) {
      issues.push({
        item_id: item.id,
        message: `unknown primitive id: ${item.uses}`,
      });
      continue;
    }

    for (const route of schematicStepRouteOutcomes(item) as WorkflowPrimitiveRouteValue[]) {
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
        schematicStepSatisfiesInputSet(item, expectedContracts, schematic.contract_aliases),
      )
    ) {
      issues.push({
        item_id: item.id,
        message: `inputs do not satisfy primitive "${item.uses}"; expected one of ${acceptedInputSets
          .map(formatContractSet)
          .join(' or ')}`,
      });
    }

    if (!contractIsCompatible(primitive.output_contract, item.output, schematic.contract_aliases)) {
      issues.push({
        item_id: item.id,
        message: `output "${item.output}" is not compatible with primitive output "${primitive.output_contract}"`,
      });
    }

    for (const requirement of primitive.produces_evidence) {
      if (!item.evidence_requirements.includes(requirement)) {
        issues.push({
          item_id: item.id,
          message: `evidence requirement "${requirement}" from primitive "${item.uses}" is not declared by schematic item`,
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

  const availableAt = collectRouteAwareAvailability(schematic);
  for (const item of schematic.items) {
    const availableContracts = availableAt.get(item.id);
    if (availableContracts === undefined) {
      issues.push({
        item_id: item.id,
        message: 'schematic item is unreachable from starts_at',
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
