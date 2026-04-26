import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { WorkflowPrimitiveContractRef } from '../../schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  compileWorkflowRecipeDraft,
  projectWorkflowRecipeForCompiler,
} from '../../schemas/workflow-recipe.js';
import type { RecipeDispatcher } from './dispatch.js';
import { dispatchedWorkerHandlers } from './dispatch.js';
import {
  type RecipeRunResult,
  defaultOrchestratorHandlers,
  defaultWorkerHandlers,
  mergeHandlerRegistries,
  runRecipe,
} from './index.js';
import { persistRecipeRun } from './persistence.js';

const KNOWN_RECIPE_PATHS = {
  build: 'specs/workflow-recipes/build.recipe.json',
  explore: 'specs/workflow-recipes/explore.recipe.json',
  review: 'specs/workflow-recipes/review.recipe.json',
} as const;

export type KnownRecipeWorkflowId = keyof typeof KNOWN_RECIPE_PATHS;

export function isKnownRecipeWorkflowId(id: string): id is KnownRecipeWorkflowId {
  return Object.hasOwn(KNOWN_RECIPE_PATHS, id);
}

export function loadWorkflowRecipe(
  workflowId: KnownRecipeWorkflowId,
  projectRoot?: string,
): WorkflowRecipe {
  const relPath = KNOWN_RECIPE_PATHS[workflowId];
  const fullPath = projectRoot === undefined ? relPath : join(projectRoot, relPath);
  return WorkflowRecipe.parse(JSON.parse(readFileSync(fullPath, 'utf8')));
}

export interface RunWorkflowRecipeInvocation {
  readonly workflowId: KnownRecipeWorkflowId;
  readonly runRoot: string;
  readonly goal: string;
  readonly rigor?: 'lite' | 'standard' | 'deep' | 'autonomous';
  readonly projectRoot?: string;
  readonly dispatcher?: RecipeDispatcher;
  readonly verificationCommands?: readonly string[];
  readonly contextPacket?: {
    readonly source_list: readonly string[];
    readonly observations: readonly string[];
    readonly confidence_notes: string;
  };
}

export interface RunWorkflowRecipeResult {
  readonly runRoot: string;
  readonly artifactPath: string;
  readonly result: RecipeRunResult;
}

export async function runWorkflowAsRecipe(
  invocation: RunWorkflowRecipeInvocation,
): Promise<RunWorkflowRecipeResult> {
  const recipe = loadWorkflowRecipe(invocation.workflowId, invocation.projectRoot);
  const projection = projectWorkflowRecipeForCompiler(recipe);
  const draft = compileWorkflowRecipeDraft(projection, invocation.rigor ?? 'standard');

  const initialEvidence = buildInitialEvidence(invocation);
  const handlers =
    invocation.dispatcher === undefined
      ? mergeHandlerRegistries(defaultOrchestratorHandlers(), defaultWorkerHandlers())
      : mergeHandlerRegistries(
          defaultOrchestratorHandlers(),
          defaultWorkerHandlers(),
          dispatchedWorkerHandlers(invocation.dispatcher),
        );

  const result = await runRecipe({ recipe, draft, handlers, initialEvidence });
  const persisted = persistRecipeRun(invocation.runRoot, recipe.id, result);
  return { runRoot: invocation.runRoot, artifactPath: persisted.artifactPath, result };
}

function buildInitialEvidence(
  invocation: RunWorkflowRecipeInvocation,
): Map<WorkflowPrimitiveContractRef, unknown> {
  const evidence = new Map<WorkflowPrimitiveContractRef, unknown>();
  evidence.set('task.intake@v1' as WorkflowPrimitiveContractRef, {
    schema_version: 1,
    normalized_goal: invocation.goal,
    requested_workflow: invocation.workflowId,
    operator_constraints: [],
  });
  evidence.set('route.decision@v1' as WorkflowPrimitiveContractRef, {
    schema_version: 1,
    selected_workflow: invocation.workflowId,
    selection_reason: `Operator selected ${invocation.workflowId}`,
    fallback_reason: null,
  });
  if (invocation.workflowId === 'build') {
    evidence.set('verification.plan@v1' as WorkflowPrimitiveContractRef, {
      commands: invocation.verificationCommands ?? ['npm run check'],
    });
  }
  if (invocation.workflowId === 'explore') {
    evidence.set(
      'context.packet@v1' as WorkflowPrimitiveContractRef,
      invocation.contextPacket ?? {
        schema_version: 1,
        source_list: [],
        observations: [`Default context for explore goal: ${invocation.goal}`],
        confidence_notes: 'Seeded by runWorkflowAsRecipe; replace with real context packet.',
      },
    );
  }
  return evidence;
}
