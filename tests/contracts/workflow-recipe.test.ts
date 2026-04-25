import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { WorkflowPrimitiveCatalog } from '../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  validateWorkflowRecipeCatalogCompatibility,
} from '../../src/schemas/workflow-recipe.js';

const primitiveCatalogPath = 'specs/workflow-primitive-catalog.json';
const repairRecipePath = 'specs/workflow-recipes/repair-candidate.recipe.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function parsePrimitiveCatalog() {
  return WorkflowPrimitiveCatalog.parse(readJson(primitiveCatalogPath));
}

function parseRepairRecipe() {
  return WorkflowRecipe.parse(readJson(repairRecipePath));
}

describe('workflow recipe schema', () => {
  it('parses the Repair candidate recipe', () => {
    const recipe = parseRepairRecipe();
    expect(recipe.schema_version).toBe('1');
    expect(recipe.status).toBe('candidate');
    expect(recipe.starts_at).toBe('repair-intake');
  });

  it('keeps the Repair candidate recipe compatible with the primitive catalog', () => {
    const issues = validateWorkflowRecipeCatalogCompatibility(
      parseRepairRecipe(),
      parsePrimitiveCatalog(),
    );
    expect(issues).toEqual([]);
  });

  it('uses the expected Repair primitive sequence', () => {
    const recipe = parseRepairRecipe();
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

  it('rejects an unknown route target at parse time', () => {
    const raw = readJson(repairRecipePath) as Record<string, unknown>;
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
    const recipe = parseRepairRecipe();
    const first = recipe.items[0];
    if (first === undefined) throw new Error('fixture missing first item');
    first.routes = { ...first.routes, complete: '@complete' };
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'repair-intake',
        message: 'route "complete" is not allowed by primitive "intake"',
      },
    ]);
  });

  it('reports unavailable input contracts in recipe order', () => {
    const recipe = parseRepairRecipe();
    const diagnose = recipe.items.find((item) => item.id === 'repair-diagnose');
    if (diagnose === undefined) throw new Error('repair-diagnose missing');
    diagnose.input.context = 'missing.context@v1';
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'repair-diagnose',
        message: 'input "context" references unavailable contract "missing.context@v1"',
      },
    ]);
  });

  it('reports outputs that are not primitive outputs or declared aliases', () => {
    const recipe = parseRepairRecipe();
    const close = recipe.items.find((item) => item.id === 'repair-close');
    if (close === undefined) throw new Error('repair-close missing');
    close.output = 'wrong.result@v1';
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'repair-close',
        message:
          'output "wrong.result@v1" is not compatible with primitive output "workflow.result@v1"',
      },
    ]);
  });
});
