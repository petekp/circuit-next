import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { StepId } from '../../src/schemas/ids.js';
import { WorkflowPrimitiveCatalog } from '../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  validateWorkflowRecipeCatalogCompatibility,
} from '../../src/schemas/workflow-recipe.js';

const primitiveCatalogPath = 'specs/workflow-primitive-catalog.json';
const fixRecipePath = 'specs/workflow-recipes/fix-candidate.recipe.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function parsePrimitiveCatalog() {
  return WorkflowPrimitiveCatalog.parse(readJson(primitiveCatalogPath));
}

function parseFixRecipe() {
  return WorkflowRecipe.parse(readJson(fixRecipePath));
}

describe('workflow recipe schema', () => {
  it('parses the Fix candidate recipe', () => {
    const recipe = parseFixRecipe();
    expect(recipe.schema_version).toBe('1');
    expect(recipe.status).toBe('candidate');
    expect(recipe.starts_at).toBe('fix-intake');
  });

  it('keeps the Fix candidate recipe compatible with the primitive catalog', () => {
    const issues = validateWorkflowRecipeCatalogCompatibility(
      parseFixRecipe(),
      parsePrimitiveCatalog(),
    );
    expect(issues).toEqual([]);
  });

  it('uses the expected Fix primitive sequence', () => {
    const recipe = parseFixRecipe();
    expect(recipe.items.map((item) => item.uses)).toEqual([
      'intake',
      'route',
      'frame',
      'gather-context',
      'diagnose',
      'human-decision',
      'act',
      'run-verification',
      'review',
      'close-with-evidence',
      'handoff',
    ]);
  });

  it('keeps Fix act and close inputs aligned with the evidence path', () => {
    const recipe = parseFixRecipe();
    const act = recipe.items.find((item) => item.id === 'fix-act');
    const close = recipe.items.find((item) => item.id === 'fix-close');
    if (act === undefined) throw new Error('fix-act missing');
    if (close === undefined) throw new Error('fix-close missing');

    expect(act.input).not.toHaveProperty('decision');
    expect(close.input).toMatchObject({
      brief: 'fix.brief@v1',
      context: 'fix.context@v1',
      diagnosis: 'fix.diagnosis@v1',
      change: 'fix.change@v1',
      verification: 'fix.verification@v1',
      review: 'fix.review@v1',
    });
  });

  it('rejects an unknown route target at parse time', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const first = items[0];
    if (first === undefined) throw new Error('fixture missing first item');
    first.routes = { continue: 'missing-item' };
    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/unknown recipe item id/);
    }
  });

  it('reports route outcomes that the selected primitive does not allow', () => {
    const recipe = parseFixRecipe();
    const first = recipe.items[0];
    if (first === undefined) throw new Error('fixture missing first item');
    first.routes = { ...first.routes, complete: '@complete' };
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'fix-intake',
        message: 'route "complete" is not allowed by primitive "intake"',
      },
    ]);
  });

  it('reports unavailable input contracts in recipe order', () => {
    const recipe = parseFixRecipe();
    const diagnose = recipe.items.find((item) => item.id === 'fix-diagnose');
    if (diagnose === undefined) throw new Error('fix-diagnose missing');
    diagnose.input.context = 'missing.context@v1';
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'fix-diagnose',
        message:
          'input "context" references unavailable contract "missing.context@v1" on at least one reachable route',
      },
    ]);
  });

  it('reports inputs that are skipped by a reachable route', () => {
    const recipe = parseFixRecipe();
    const verify = recipe.items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');
    verify.routes.continue = StepId.parse('fix-close');

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-close',
      message:
        'input "review" references unavailable contract "fix.review@v1" on at least one reachable route',
    });
  });

  it('reports recipe items that cannot be reached from starts_at', () => {
    const recipe = parseFixRecipe();
    const intake = recipe.items.find((item) => item.id === 'fix-intake');
    if (intake === undefined) throw new Error('fix-intake missing');
    intake.routes = { stop: '@stop' };

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-route',
      message: 'recipe item is unreachable from starts_at',
    });
  });

  it('reports outputs that are not primitive outputs or declared aliases', () => {
    const recipe = parseFixRecipe();
    const close = recipe.items.find((item) => item.id === 'fix-close');
    if (close === undefined) throw new Error('fix-close missing');
    close.output = 'wrong.result@v1';
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'fix-close',
        message:
          'output "wrong.result@v1" is not compatible with primitive output "workflow.result@v1"',
      },
    ]);
  });
});
