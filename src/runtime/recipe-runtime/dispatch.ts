import type { DispatchRole } from '../../schemas/step.js';
import type {
  WorkflowPrimitiveId,
  WorkflowPrimitiveRoute,
} from '../../schemas/workflow-primitives.js';
import type { WorkflowRecipeItem } from '../../schemas/workflow-recipe.js';
import type {
  PrimitiveDispatchContext,
  PrimitiveDispatchInputs,
  PrimitiveDispatchResult,
  PrimitiveHandler,
  PrimitiveHandlerRegistry,
} from './index.js';

export interface RecipeDispatcherInput {
  readonly item: WorkflowRecipeItem;
  readonly inputs: PrimitiveDispatchInputs;
  readonly role: DispatchRole;
}

export interface RecipeDispatcherResult {
  readonly output: unknown;
  readonly outcome: WorkflowPrimitiveRoute;
  readonly summary?: string;
}

export type RecipeDispatcher = (
  input: RecipeDispatcherInput,
) => Promise<RecipeDispatcherResult> | RecipeDispatcherResult;

const DISPATCH_PRIMITIVES = new Set<WorkflowPrimitiveId>([
  'gather-context',
  'diagnose',
  'plan',
  'act',
  'review',
]);

function dispatchRoleForItem(item: WorkflowRecipeItem): DispatchRole {
  if (item.execution.kind !== 'dispatch' || item.execution.role === undefined) {
    throw new Error(
      `dispatchHandler: item '${item.id}' is not a dispatch-execution item (kind='${item.execution.kind}')`,
    );
  }
  return item.execution.role;
}

export function dispatchHandler(dispatcher: RecipeDispatcher): PrimitiveHandler {
  return async (ctx: PrimitiveDispatchContext): Promise<PrimitiveDispatchResult> => {
    const role = dispatchRoleForItem(ctx.recipeItem);
    const result = await dispatcher({ item: ctx.recipeItem, inputs: ctx.inputs, role });
    return {
      output: result.output,
      outcome: result.outcome,
      ...(result.summary === undefined ? {} : { summary: result.summary }),
    };
  };
}

export function dispatchedWorkerHandlers(dispatcher: RecipeDispatcher): PrimitiveHandlerRegistry {
  const handler = dispatchHandler(dispatcher);
  const registry = new Map<WorkflowPrimitiveId, PrimitiveHandler>();
  for (const id of DISPATCH_PRIMITIVES) registry.set(id, handler);
  return registry;
}
