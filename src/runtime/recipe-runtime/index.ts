import type {
  WorkflowPrimitiveContractRef,
  WorkflowPrimitiveId,
  WorkflowPrimitiveRoute,
} from '../../schemas/workflow-primitives.js';
import {
  type WorkflowRecipe,
  type WorkflowRecipeDraft,
  type WorkflowRecipeDraftItem,
  type WorkflowRecipeItem,
  type WorkflowRecipeRouteTarget,
  WorkflowRecipeTerminalTarget,
  type WorkflowRecipeTerminalTarget as WorkflowRecipeTerminalTargetValue,
} from '../../schemas/workflow-recipe.js';

export type EvidenceLedger = ReadonlyMap<WorkflowPrimitiveContractRef, unknown>;

export interface PrimitiveDispatchInputs {
  readonly byBinding: ReadonlyMap<string, unknown>;
  readonly byContract: EvidenceLedger;
}

export interface PrimitiveDispatchContext {
  readonly recipeItem: WorkflowRecipeItem;
  readonly draftItem: WorkflowRecipeDraftItem;
  readonly inputs: PrimitiveDispatchInputs;
}

export interface PrimitiveDispatchResult {
  readonly output: unknown;
  readonly outcome: WorkflowPrimitiveRoute;
  readonly summary?: string;
}

export type PrimitiveHandler = (
  ctx: PrimitiveDispatchContext,
) => Promise<PrimitiveDispatchResult> | PrimitiveDispatchResult;

export type PrimitiveHandlerRegistry = ReadonlyMap<WorkflowPrimitiveId, PrimitiveHandler>;

export type RecipeRunOutcome = 'complete' | 'stop' | 'handoff' | 'escalate';

export interface RecipeRunTraceEntry {
  readonly itemId: string;
  readonly uses: WorkflowPrimitiveId;
  readonly outcome: WorkflowPrimitiveRoute;
  readonly nextTarget: WorkflowRecipeRouteTarget;
  readonly outputContract: WorkflowPrimitiveContractRef;
  readonly summary?: string;
}

export interface RecipeRunResult {
  readonly outcome: RecipeRunOutcome;
  readonly evidence: EvidenceLedger;
  readonly trace: readonly RecipeRunTraceEntry[];
}

export interface RunRecipeInput {
  readonly recipe: WorkflowRecipe;
  readonly draft: WorkflowRecipeDraft;
  readonly handlers: PrimitiveHandlerRegistry;
  readonly initialEvidence?: ReadonlyMap<WorkflowPrimitiveContractRef, unknown>;
  readonly maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 64;

const TERMINAL_OUTCOMES: Record<WorkflowRecipeTerminalTargetValue, RecipeRunOutcome> = {
  '@complete': 'complete',
  '@stop': 'stop',
  '@handoff': 'handoff',
  '@escalate': 'escalate',
};

function isTerminalTarget(target: string): target is WorkflowRecipeTerminalTargetValue {
  return WorkflowRecipeTerminalTarget.safeParse(target).success;
}

function indexById<T extends { id: { toString(): string } }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id as unknown as string, item);
  }
  return map;
}

function buildBindings(
  recipeItem: WorkflowRecipeItem,
  evidence: EvidenceLedger,
): Map<string, unknown> {
  const byBinding = new Map<string, unknown>();
  for (const [bindingName, contract] of Object.entries(recipeItem.input)) {
    if (!evidence.has(contract)) {
      throw new Error(
        `runRecipe: item '${recipeItem.id}' input '${bindingName}' requires contract '${contract}' which is not in the evidence ledger`,
      );
    }
    byBinding.set(bindingName, evidence.get(contract));
  }
  return byBinding;
}

function findEdgeTarget(
  draftItem: WorkflowRecipeDraftItem,
  outcome: WorkflowPrimitiveRoute,
): WorkflowRecipeRouteTarget {
  const edge = draftItem.edges.find((candidate) => candidate.outcome === outcome);
  if (edge === undefined) {
    throw new Error(
      `runRecipe: item '${draftItem.id}' returned outcome '${outcome}' but draft has no matching edge (declared: ${draftItem.edges
        .map((e) => e.outcome)
        .join(', ')})`,
    );
  }
  return edge.target;
}

export async function runRecipe(input: RunRecipeInput): Promise<RecipeRunResult> {
  if (input.recipe.id !== input.draft.recipe_id) {
    throw new Error(
      `runRecipe: recipe id '${input.recipe.id}' does not match draft.recipe_id '${input.draft.recipe_id}'`,
    );
  }
  if (input.recipe.starts_at !== input.draft.starts_at) {
    throw new Error(
      `runRecipe: recipe starts_at '${input.recipe.starts_at}' does not match draft.starts_at '${input.draft.starts_at}'`,
    );
  }

  const draftItemsById = indexById(input.draft.items);
  const recipeItemsById = indexById(input.recipe.items);
  const evidence = new Map<WorkflowPrimitiveContractRef, unknown>(input.initialEvidence ?? []);
  const trace: RecipeRunTraceEntry[] = [];
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;

  let currentTarget: WorkflowRecipeRouteTarget = input.draft
    .starts_at as unknown as WorkflowRecipeRouteTarget;
  let stepsTaken = 0;

  while (true) {
    const target = currentTarget as unknown as string;
    if (isTerminalTarget(target)) {
      return { outcome: TERMINAL_OUTCOMES[target], evidence, trace };
    }
    if (stepsTaken >= maxSteps) {
      throw new Error(
        `runRecipe: exceeded maxSteps=${maxSteps} (likely infinite loop in '${input.recipe.id}')`,
      );
    }
    const draftItem = draftItemsById.get(target);
    const recipeItem = recipeItemsById.get(target);
    if (draftItem === undefined || recipeItem === undefined) {
      throw new Error(`runRecipe: route target '${target}' is not a known recipe item`);
    }
    const handler = input.handlers.get(recipeItem.uses);
    if (handler === undefined) {
      throw new Error(
        `runRecipe: no handler registered for primitive '${recipeItem.uses}' (item '${target}')`,
      );
    }

    const byBinding = buildBindings(recipeItem, evidence);
    const result = await handler({
      recipeItem,
      draftItem,
      inputs: { byBinding, byContract: evidence },
    });

    evidence.set(recipeItem.output, result.output);
    const nextTarget = findEdgeTarget(draftItem, result.outcome);
    trace.push({
      itemId: target,
      uses: recipeItem.uses,
      outcome: result.outcome,
      nextTarget,
      outputContract: recipeItem.output,
      ...(result.summary === undefined ? {} : { summary: result.summary }),
    });

    stepsTaken += 1;
    currentTarget = nextTarget;
  }
}

export { defaultOrchestratorHandlers } from './orchestrator-handlers.js';
export { defaultWorkerHandlers } from './worker-handlers.js';
export {
  dispatchHandler,
  dispatchedWorkerHandlers,
  type RecipeDispatcher,
  type RecipeDispatcherInput,
  type RecipeDispatcherResult,
} from './dispatch.js';
export {
  persistRecipeRun,
  recipeRunArtifact,
  type PersistedRecipeRunArtifact,
  type PersistedTraceEntry,
} from './persistence.js';

export function mergeHandlerRegistries(
  ...registries: readonly PrimitiveHandlerRegistry[]
): PrimitiveHandlerRegistry {
  const merged = new Map<WorkflowPrimitiveId, PrimitiveHandler>();
  for (const registry of registries) {
    for (const [id, handler] of registry) merged.set(id, handler);
  }
  return merged;
}
