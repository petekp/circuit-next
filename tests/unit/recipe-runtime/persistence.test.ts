import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  defaultOrchestratorHandlers,
  defaultWorkerHandlers,
  mergeHandlerRegistries,
  persistRecipeRun,
  recipeRunArtifact,
  runRecipe,
} from '../../../src/runtime/recipe-runtime/index.js';
import type { WorkflowPrimitiveContractRef } from '../../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  compileWorkflowRecipeDraft,
  projectWorkflowRecipeForCompiler,
} from '../../../src/schemas/workflow-recipe.js';

const fixLiteRecipePath = 'tests/fixtures/recipe-runtime/fix-lite.recipe.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function fixLiteInitialEvidence(): Map<WorkflowPrimitiveContractRef, unknown> {
  return new Map<WorkflowPrimitiveContractRef, unknown>([
    ['user.goal@v1' as WorkflowPrimitiveContractRef, 'Persistence smoke goal'],
    ['workflow.catalog@v1' as WorkflowPrimitiveContractRef, ['fix'] as readonly string[]],
    ['context.request@v1' as WorkflowPrimitiveContractRef, { targets: ['demo/file.ts'] }],
    ['verification.plan@v1' as WorkflowPrimitiveContractRef, { commands: ['npm run check'] }],
  ]);
}

describe('recipe runtime persistence', () => {
  let runRoot: string;

  beforeEach(() => {
    runRoot = mkdtempSync(join(tmpdir(), 'recipe-runtime-persistence-'));
  });

  afterEach(() => {
    rmSync(runRoot, { recursive: true, force: true });
  });

  it('serializes a recipe run as a stable JSON artifact', async () => {
    const recipe = WorkflowRecipe.parse(readJson(fixLiteRecipePath));
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');
    const handlers = mergeHandlerRegistries(defaultOrchestratorHandlers(), defaultWorkerHandlers());

    const result = await runRecipe({
      recipe,
      draft,
      handlers,
      initialEvidence: fixLiteInitialEvidence(),
    });

    const artifact = recipeRunArtifact(recipe.id as unknown as string, result);
    expect(artifact.schema_version).toBe(1);
    expect(artifact.recipe_id).toBe('fix-lite-demo');
    expect(artifact.outcome).toBe('complete');
    expect(artifact.trace.map((entry) => entry.uses)).toEqual([
      'intake',
      'route',
      'frame',
      'gather-context',
      'diagnose',
      'act',
      'run-verification',
      'close-with-evidence',
    ]);
    expect(Object.keys(artifact.evidence)).toEqual(
      expect.arrayContaining([
        'user.goal@v1',
        'task.intake@v1',
        'workflow.brief@v1',
        'workflow.result@v1',
      ]),
    );
  });

  it('writes recipe-run.json to the run root and round-trips through JSON parse', async () => {
    const recipe = WorkflowRecipe.parse(readJson(fixLiteRecipePath));
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');
    const handlers = mergeHandlerRegistries(defaultOrchestratorHandlers(), defaultWorkerHandlers());

    const result = await runRecipe({
      recipe,
      draft,
      handlers,
      initialEvidence: fixLiteInitialEvidence(),
    });

    const { artifactPath } = persistRecipeRun(runRoot, recipe.id as unknown as string, result);
    expect(artifactPath).toBe(join(runRoot, 'recipe-run.json'));
    const onDisk = JSON.parse(readFileSync(artifactPath, 'utf8'));
    expect(onDisk.recipe_id).toBe('fix-lite-demo');
    expect(onDisk.outcome).toBe('complete');
    expect(onDisk.trace).toHaveLength(8);
  });
});
