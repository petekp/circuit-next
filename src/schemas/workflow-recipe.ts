import { z } from 'zod';
import { StepId, WorkflowId } from './ids.js';
import { SelectionOverride } from './selection-policy.js';
import {
  WorkflowPrimitiveCatalog,
  type WorkflowPrimitiveCatalog as WorkflowPrimitiveCatalogValue,
  WorkflowPrimitiveContractRef,
  type WorkflowPrimitiveContractRef as WorkflowPrimitiveContractRefValue,
  WorkflowPrimitiveId,
  type WorkflowPrimitiveId as WorkflowPrimitiveIdValue,
  WorkflowPrimitiveRoute,
  type WorkflowPrimitiveRoute as WorkflowPrimitiveRouteValue,
} from './workflow-primitives.js';

export const WorkflowRecipeStatus = z.enum(['candidate', 'active', 'deprecated']);
export type WorkflowRecipeStatus = z.infer<typeof WorkflowRecipeStatus>;

export const WorkflowRecipeTerminalTarget = z.enum(['@complete', '@stop', '@handoff', '@escalate']);
export type WorkflowRecipeTerminalTarget = z.infer<typeof WorkflowRecipeTerminalTarget>;

export const WorkflowRecipeRouteTarget = z.union([StepId, WorkflowRecipeTerminalTarget]);
export type WorkflowRecipeRouteTarget = z.infer<typeof WorkflowRecipeRouteTarget>;

export const WorkflowRecipeContractAlias = z
  .object({
    generic: WorkflowPrimitiveContractRef,
    actual: WorkflowPrimitiveContractRef,
  })
  .strict();
export type WorkflowRecipeContractAlias = z.infer<typeof WorkflowRecipeContractAlias>;

export const WorkflowRecipeItem = z
  .object({
    id: StepId,
    uses: WorkflowPrimitiveId,
    title: z.string().min(1),
    input: z
      .record(z.string().regex(/^[a-z][a-z0-9_]*$/), WorkflowPrimitiveContractRef)
      .default({}),
    output: WorkflowPrimitiveContractRef,
    selection: SelectionOverride.optional(),
    routes: z.record(z.string(), WorkflowRecipeRouteTarget).refine((routes) => {
      return Object.keys(routes).length > 0;
    }, 'recipe item must declare at least one route'),
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
  const availableContracts = new Set<WorkflowPrimitiveContractRefValue>(recipe.initial_contracts);

  for (const item of recipe.items) {
    const primitive = primitiveById.get(item.uses as WorkflowPrimitiveIdValue);
    if (primitive === undefined) {
      issues.push({
        item_id: item.id,
        message: `unknown primitive id: ${item.uses}`,
      });
      continue;
    }

    for (const route of Object.keys(item.routes) as WorkflowPrimitiveRouteValue[]) {
      if (!primitive.allowed_routes.includes(route)) {
        issues.push({
          item_id: item.id,
          message: `route "${route}" is not allowed by primitive "${item.uses}"`,
        });
      }
    }

    if (!contractIsCompatible(primitive.output_contract, item.output, recipe.contract_aliases)) {
      issues.push({
        item_id: item.id,
        message: `output "${item.output}" is not compatible with primitive output "${primitive.output_contract}"`,
      });
    }

    for (const [name, contract] of Object.entries(item.input)) {
      if (!availableContracts.has(contract)) {
        issues.push({
          item_id: item.id,
          message: `input "${name}" references unavailable contract "${contract}"`,
        });
      }
    }

    availableContracts.add(item.output);
  }

  return issues;
}
