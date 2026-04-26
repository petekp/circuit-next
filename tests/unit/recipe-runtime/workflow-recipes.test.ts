import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
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

const primitiveCatalogPath = 'specs/workflow-primitive-catalog.json';
const buildRecipePath = 'specs/workflow-recipes/build.recipe.json';
const exploreRecipePath = 'specs/workflow-recipes/explore.recipe.json';
const reviewRecipePath = 'specs/workflow-recipes/review.recipe.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadCatalog() {
  return WorkflowPrimitiveCatalog.parse(readJson(primitiveCatalogPath));
}

function loadRecipe(path: string) {
  return WorkflowRecipe.parse(readJson(path));
}

function defaultHandlers() {
  return mergeHandlerRegistries(defaultOrchestratorHandlers(), defaultWorkerHandlers());
}

function frameInitialEvidence(
  goal: string,
  workflow: string,
): Map<WorkflowPrimitiveContractRef, unknown> {
  return new Map<WorkflowPrimitiveContractRef, unknown>([
    [
      'task.intake@v1' as WorkflowPrimitiveContractRef,
      {
        schema_version: 1,
        normalized_goal: goal,
        requested_workflow: workflow,
        operator_constraints: [],
      },
    ],
    [
      'route.decision@v1' as WorkflowPrimitiveContractRef,
      {
        schema_version: 1,
        selected_workflow: workflow,
        selection_reason: `Operator requested ${workflow}`,
        fallback_reason: null,
      },
    ],
  ]);
}

describe('workflow recipes — build, explore, review fixtures', () => {
  describe('build recipe', () => {
    it('parses and stays catalog-compatible', () => {
      const recipe = loadRecipe(buildRecipePath);
      expect(recipe.id).toBe('build');
      expect(recipe.starts_at).toBe('build-frame');
      const issues = validateWorkflowRecipeCatalogCompatibility(recipe, loadCatalog());
      expect(issues).toEqual([]);
    });

    it('uses the canonical Build primitive sequence', () => {
      const recipe = loadRecipe(buildRecipePath);
      expect(recipe.items.map((item) => item.uses)).toEqual([
        'frame',
        'plan',
        'act',
        'run-verification',
        'review',
        'close-with-evidence',
      ]);
    });

    it('runs end-to-end through six primitives across frame/plan/act/verify/review/close', async () => {
      const recipe = loadRecipe(buildRecipePath);
      const projection = projectWorkflowRecipeForCompiler(recipe);
      const draft = compileWorkflowRecipeDraft(projection, 'standard');
      const initial = frameInitialEvidence('Add structured logging to checkout', 'build');
      initial.set('verification.plan@v1' as WorkflowPrimitiveContractRef, {
        commands: ['npm run check', 'npm run test -- checkout'],
      });

      const result = await runRecipe({
        recipe,
        draft,
        handlers: defaultHandlers(),
        initialEvidence: initial,
      });

      expect(result.outcome).toBe('complete');
      expect(result.trace.map((entry) => entry.uses)).toEqual([
        'frame',
        'plan',
        'act',
        'run-verification',
        'review',
        'close-with-evidence',
      ]);
      expect(result.trace.at(-1)?.nextTarget).toBe('@complete');

      const finalResult = result.evidence.get(
        'workflow.result@v1' as WorkflowPrimitiveContractRef,
      ) as
        | { outcome: string; evidence_pointers: readonly string[]; review_verdict: string | null }
        | undefined;
      expect(finalResult?.outcome).toBe('completed');
      expect(finalResult?.evidence_pointers).toEqual(['brief', 'verification', 'review']);
      expect(finalResult?.review_verdict).toBe('accept');
    });
  });

  describe('explore recipe', () => {
    it('parses and stays catalog-compatible', () => {
      const recipe = loadRecipe(exploreRecipePath);
      expect(recipe.id).toBe('explore');
      expect(recipe.starts_at).toBe('explore-frame');
      const issues = validateWorkflowRecipeCatalogCompatibility(recipe, loadCatalog());
      expect(issues).toEqual([]);
    });

    it('uses the canonical Explore primitive sequence', () => {
      const recipe = loadRecipe(exploreRecipePath);
      expect(recipe.items.map((item) => item.uses)).toEqual([
        'frame',
        'diagnose',
        'act',
        'review',
        'close-with-evidence',
      ]);
    });

    it('runs end-to-end without a verification phase', async () => {
      const recipe = loadRecipe(exploreRecipePath);
      const projection = projectWorkflowRecipeForCompiler(recipe);
      const draft = compileWorkflowRecipeDraft(projection, 'standard');
      const initial = frameInitialEvidence('Investigate flaky checkout test signal', 'explore');
      initial.set('context.packet@v1' as WorkflowPrimitiveContractRef, {
        schema_version: 1,
        source_list: ['tests/payments/checkout.test.ts', 'src/payments/index.ts'],
        observations: ['Flake reproduces on CI but not locally', 'Race in retry logic'],
        confidence_notes: 'Seeded for explore recipe smoke',
      });

      const result = await runRecipe({
        recipe,
        draft,
        handlers: defaultHandlers(),
        initialEvidence: initial,
      });

      expect(result.outcome).toBe('complete');
      expect(result.trace.map((entry) => entry.uses)).toEqual([
        'frame',
        'diagnose',
        'act',
        'review',
        'close-with-evidence',
      ]);

      const finalResult = result.evidence.get(
        'workflow.result@v1' as WorkflowPrimitiveContractRef,
      ) as { outcome: string; evidence_pointers: readonly string[] } | undefined;
      expect(finalResult?.outcome).toBe('completed');
      expect(finalResult?.evidence_pointers).toEqual(['brief', 'review']);
    });
  });

  describe('review recipe', () => {
    it('parses and stays catalog-compatible', () => {
      const recipe = loadRecipe(reviewRecipePath);
      expect(recipe.id).toBe('review');
      expect(recipe.starts_at).toBe('review-frame');
      const issues = validateWorkflowRecipeCatalogCompatibility(recipe, loadCatalog());
      expect(issues).toEqual([]);
    });

    it('uses the audit-only Review primitive sequence', () => {
      const recipe = loadRecipe(reviewRecipePath);
      expect(recipe.items.map((item) => item.uses)).toEqual([
        'frame',
        'review',
        'close-with-evidence',
      ]);
    });

    it('runs end-to-end frame -> review -> close', async () => {
      const recipe = loadRecipe(reviewRecipePath);
      const projection = projectWorkflowRecipeForCompiler(recipe);
      const draft = compileWorkflowRecipeDraft(projection, 'standard');
      const initial = frameInitialEvidence('Audit recipe substrate cutover plan', 'review');

      const result = await runRecipe({
        recipe,
        draft,
        handlers: defaultHandlers(),
        initialEvidence: initial,
      });

      expect(result.outcome).toBe('complete');
      expect(result.trace.map((entry) => entry.uses)).toEqual([
        'frame',
        'review',
        'close-with-evidence',
      ]);

      const verdict = result.evidence.get('review.verdict@v1' as WorkflowPrimitiveContractRef) as
        | { verdict: string }
        | undefined;
      expect(verdict?.verdict).toBe('accept');

      const finalResult = result.evidence.get(
        'workflow.result@v1' as WorkflowPrimitiveContractRef,
      ) as { outcome: string; evidence_pointers: readonly string[] } | undefined;
      expect(finalResult?.outcome).toBe('completed');
      expect(finalResult?.evidence_pointers).toEqual(['brief', 'review']);
    });
  });
});
