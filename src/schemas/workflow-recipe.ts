import { z } from 'zod';
import { StepId, WorkflowId } from './ids.js';
import { Rigor } from './rigor.js';
import { SelectionOverride } from './selection-policy.js';
import { DispatchRole } from './step.js';
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

export const WorkflowRecipeItem = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    title: z.string().min(1),
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
  });
export type WorkflowRecipeItem = z.infer<typeof WorkflowRecipeItem>;

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
  });
export type WorkflowRecipe = z.infer<typeof WorkflowRecipe>;

export type WorkflowRecipeCatalogCompatibilityIssue = {
  item_id?: string;
  message: string;
};

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

function acceptedExecutionKinds(
  primitive: WorkflowPrimitiveValue,
): readonly WorkflowRecipeExecutionKind[] {
  if (primitive.id === 'run-verification') return ['verification'];
  switch (primitive.action_surface) {
    case 'worker':
      return ['dispatch'];
    case 'host':
      return ['checkpoint'];
    case 'orchestrator':
      return ['synthesis'];
    case 'mixed':
      return ['synthesis', 'dispatch', 'verification', 'checkpoint'];
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
