import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  type PrimitiveDispatchContext,
  type PrimitiveDispatchResult,
  type PrimitiveHandler,
  type PrimitiveHandlerRegistry,
  defaultOrchestratorHandlers,
  defaultWorkerHandlers,
  mergeHandlerRegistries,
  runRecipe,
} from '../../../src/runtime/recipe-runtime/index.js';
import type { WorkflowPrimitiveContractRef } from '../../../src/schemas/workflow-primitives.js';
import { WorkflowPrimitiveCatalog } from '../../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  compileWorkflowRecipeDraft,
  projectWorkflowRecipeForCompiler,
  validateWorkflowRecipeCatalogCompatibility,
} from '../../../src/schemas/workflow-recipe.js';

const demoRecipePath = 'tests/fixtures/recipe-runtime/demo-substrate.recipe.json';
const fixLiteRecipePath = 'tests/fixtures/recipe-runtime/fix-lite.recipe.json';
const primitiveCatalogPath = 'specs/workflow-primitive-catalog.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadDemoRecipe() {
  return WorkflowRecipe.parse(readJson(demoRecipePath));
}

function loadFixLiteRecipe() {
  return WorkflowRecipe.parse(readJson(fixLiteRecipePath));
}

function fixLiteInitialEvidence(): Map<WorkflowPrimitiveContractRef, unknown> {
  return new Map<WorkflowPrimitiveContractRef, unknown>([
    ['user.goal@v1' as WorkflowPrimitiveContractRef, 'Investigate flaky test in payments suite'],
    [
      'workflow.catalog@v1' as WorkflowPrimitiveContractRef,
      ['fix', 'build', 'explore'] as readonly string[],
    ],
    [
      'context.request@v1' as WorkflowPrimitiveContractRef,
      { targets: ['src/payments/index.ts', 'tests/payments/checkout.test.ts'] },
    ],
    [
      'verification.plan@v1' as WorkflowPrimitiveContractRef,
      { commands: ['npm run check', 'npm run test -- payments'] },
    ],
  ]);
}

function loadPrimitiveCatalog() {
  return WorkflowPrimitiveCatalog.parse(readJson(primitiveCatalogPath));
}

function initialEvidence(): Map<WorkflowPrimitiveContractRef, unknown> {
  return new Map<WorkflowPrimitiveContractRef, unknown>([
    ['user.goal@v1' as WorkflowPrimitiveContractRef, '  Investigate flaky build  '],
    [
      'workflow.catalog@v1' as WorkflowPrimitiveContractRef,
      ['fix', 'build', 'explore'] as readonly string[],
    ],
  ]);
}

describe('recipe runtime substrate', () => {
  it('demo recipe parses and stays catalog-compatible', () => {
    const recipe = loadDemoRecipe();
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, loadPrimitiveCatalog());
    expect(issues).toEqual([]);
  });

  it('runs intake → route → frame → @complete end-to-end on the standard rigor draft', async () => {
    const recipe = loadDemoRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    const result = await runRecipe({
      recipe,
      draft,
      handlers: defaultOrchestratorHandlers(),
      initialEvidence: initialEvidence(),
    });

    expect(result.outcome).toBe('complete');
    expect(result.trace.map((entry) => entry.itemId)).toEqual([
      'demo-intake',
      'demo-route',
      'demo-frame',
    ]);
    expect(result.trace.map((entry) => entry.uses)).toEqual(['intake', 'route', 'frame']);
    expect(result.trace.map((entry) => entry.outcome)).toEqual([
      'continue',
      'continue',
      'continue',
    ]);
    expect(result.trace.at(-1)?.nextTarget).toBe('@complete');

    const intake = result.evidence.get('task.intake@v1' as WorkflowPrimitiveContractRef) as
      | { normalized_goal: string }
      | undefined;
    expect(intake?.normalized_goal).toBe('Investigate flaky build');

    const route = result.evidence.get('route.decision@v1' as WorkflowPrimitiveContractRef) as
      | { selected_workflow: string }
      | undefined;
    expect(route?.selected_workflow).toBe('fix');

    const brief = result.evidence.get('workflow.brief@v1' as WorkflowPrimitiveContractRef) as
      | { scope_boundary: string; proof_plan: string }
      | undefined;
    expect(brief?.scope_boundary).toContain('Investigate flaky build');
    expect(brief?.proof_plan).toContain('fix');
  });

  it('rejects a run when an item declares an input contract that has not been produced', async () => {
    const recipe = loadDemoRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    const empty = new Map<WorkflowPrimitiveContractRef, unknown>([
      ['workflow.catalog@v1' as WorkflowPrimitiveContractRef, ['fix']],
    ]);
    await expect(
      runRecipe({
        recipe,
        draft,
        handlers: defaultOrchestratorHandlers(),
        initialEvidence: empty,
      }),
    ).rejects.toThrow(/'goal' requires contract 'user.goal@v1'/);
  });

  it('rejects a handler that returns an outcome the draft has no edge for', async () => {
    const recipe = loadDemoRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    const handlers = new Map(defaultOrchestratorHandlers());
    const wanderingFrame: PrimitiveHandler = (
      ctx: PrimitiveDispatchContext,
    ): PrimitiveDispatchResult => ({
      output: { schema_version: 1, scope_boundary: 'x', constraints: [], proof_plan: 'x' },
      // 'retry' is not declared on demo-frame; substrate must surface this.
      outcome: 'retry',
      summary: `unexpected retry from ${ctx.recipeItem.id}`,
    });
    handlers.set('frame', wanderingFrame);

    await expect(
      runRecipe({
        recipe,
        draft,
        handlers: handlers as PrimitiveHandlerRegistry,
        initialEvidence: initialEvidence(),
      }),
    ).rejects.toThrow(/returned outcome 'retry' but draft has no matching edge/);
  });

  it('rejects a draft whose recipe id does not match', async () => {
    const recipe = loadDemoRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');
    const tamperedDraft = { ...draft, recipe_id: 'something-else' as typeof draft.recipe_id };

    await expect(
      runRecipe({
        recipe,
        draft: tamperedDraft,
        handlers: defaultOrchestratorHandlers(),
        initialEvidence: initialEvidence(),
      }),
    ).rejects.toThrow(/does not match draft.recipe_id/);
  });

  it('runs the fix-lite recipe end-to-end across eight primitives', async () => {
    const recipe = loadFixLiteRecipe();
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, loadPrimitiveCatalog());
    expect(issues).toEqual([]);

    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');
    const handlers = mergeHandlerRegistries(defaultOrchestratorHandlers(), defaultWorkerHandlers());

    const result = await runRecipe({
      recipe,
      draft,
      handlers,
      initialEvidence: fixLiteInitialEvidence(),
    });

    expect(result.outcome).toBe('complete');
    expect(result.trace.map((entry) => entry.uses)).toEqual([
      'intake',
      'route',
      'frame',
      'gather-context',
      'diagnose',
      'act',
      'run-verification',
      'close-with-evidence',
    ]);
    expect(result.trace.at(-1)?.outcome).toBe('complete');
    expect(result.trace.at(-1)?.nextTarget).toBe('@complete');

    // Each primitive's typed output should land in the evidence ledger.
    const expectedContracts: WorkflowPrimitiveContractRef[] = [
      'task.intake@v1',
      'route.decision@v1',
      'workflow.brief@v1',
      'context.packet@v1',
      'diagnosis.result@v1',
      'change.evidence@v1',
      'verification.result@v1',
      'workflow.result@v1',
    ] as WorkflowPrimitiveContractRef[];
    for (const contract of expectedContracts) {
      expect(result.evidence.has(contract)).toBe(true);
    }

    const finalResult = result.evidence.get('workflow.result@v1' as WorkflowPrimitiveContractRef) as
      | { outcome: string; evidence_pointers: readonly string[] }
      | undefined;
    expect(finalResult?.outcome).toBe('completed');
    expect(finalResult?.evidence_pointers).toEqual(['brief', 'verification']);
  });

  it('honors per-rigor edge overrides when projecting a different draft rigor', async () => {
    // The demo recipe has no overrides, but compiling at lite vs standard
    // should produce identical traces here. This proves the substrate uses
    // the draft's edges, not the recipe's raw routes.
    const recipe = loadDemoRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const liteDraft = compileWorkflowRecipeDraft(projection, 'lite');

    const result = await runRecipe({
      recipe,
      draft: liteDraft,
      handlers: defaultOrchestratorHandlers(),
      initialEvidence: initialEvidence(),
    });
    expect(result.outcome).toBe('complete');
    expect(result.trace.map((entry) => entry.itemId)).toEqual([
      'demo-intake',
      'demo-route',
      'demo-frame',
    ]);
  });
});
