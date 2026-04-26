import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  WorkflowRecipeCompileError,
  compileRecipeToWorkflow,
} from '../../src/runtime/compile-recipe-to-workflow.js';
import { WorkflowRecipe } from '../../src/schemas/workflow-recipe.js';
import { Workflow } from '../../src/schemas/workflow.js';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadRecipe(path: string) {
  return WorkflowRecipe.parse(readJson(path));
}

function loadWorkflow(path: string) {
  return Workflow.parse(readJson(path));
}

describe('compileRecipeToWorkflow — byte-equivalence with committed fixtures', () => {
  const cases = [
    {
      label: 'build',
      recipePath: 'specs/workflow-recipes/build.recipe.json',
      committedPath: '.claude-plugin/skills/build/circuit.json',
    },
    {
      label: 'explore',
      recipePath: 'specs/workflow-recipes/explore.recipe.json',
      committedPath: '.claude-plugin/skills/explore/circuit.json',
    },
    {
      label: 'review',
      recipePath: 'specs/workflow-recipes/review.recipe.json',
      committedPath: '.claude-plugin/skills/review/circuit.json',
    },
  ] as const;

  for (const c of cases) {
    it(`compiles ${c.label} recipe to a single Workflow that matches the committed fixture`, () => {
      const recipe = loadRecipe(c.recipePath);
      const compiled = compileRecipeToWorkflow(recipe);
      expect(compiled.kind).toBe('single');
      if (compiled.kind !== 'single') return;
      const committed = loadWorkflow(c.committedPath);
      // toEqual on parsed objects ignores key order. The drift check
      // compares canonical-stringified bytes; for unit assertions,
      // structural equality is the right shape check.
      expect(compiled.workflow).toEqual(committed);
    });
  }
});

describe('compileRecipeToWorkflow — failure modes', () => {
  function loadBuildRecipe() {
    return WorkflowRecipe.parse(readJson('specs/workflow-recipes/build.recipe.json'));
  }

  it('throws if a required recipe-level field is missing', () => {
    const recipe = loadBuildRecipe();
    // Force-clear via type assertion since WorkflowRecipe normally enforces presence
    // through the compiler, not through the parse layer (it is optional in zod).
    const broken = { ...recipe, version: undefined } as unknown as typeof recipe;
    expect(() => compileRecipeToWorkflow(broken)).toThrow(WorkflowRecipeCompileError);
    expect(() => compileRecipeToWorkflow(broken)).toThrow(/missing required.*version/);
  });

  it('throws if an item is missing protocol', () => {
    const recipe = loadBuildRecipe();
    const itemsCopy = recipe.items.map((item, i) =>
      i === 0 ? ({ ...item, protocol: undefined } as unknown as typeof item) : item,
    );
    const broken = { ...recipe, items: itemsCopy } as unknown as typeof recipe;
    expect(() => compileRecipeToWorkflow(broken)).toThrow(/missing.*protocol/);
  });

  it('throws if a verification step writes a schema other than build.verification@v1', () => {
    const recipe = loadBuildRecipe();
    const itemsCopy = recipe.items.map((item) =>
      item.id === ('verify-step' as unknown as typeof item.id)
        ? ({ ...item, output: 'foo.bar@v1' } as unknown as typeof item)
        : item,
    );
    const broken = { ...recipe, items: itemsCopy } as unknown as typeof recipe;
    expect(() => compileRecipeToWorkflow(broken)).toThrow(
      /runner only supports verification writing build\.verification@v1/,
    );
  });

  it('throws if a checkpoint step writes a non-build.brief artifact', () => {
    const recipe = loadBuildRecipe();
    const itemsCopy = recipe.items.map((item) =>
      item.id === ('frame-step' as unknown as typeof item.id)
        ? ({ ...item, output: 'foo.bar@v1' } as unknown as typeof item)
        : item,
    );
    const broken = { ...recipe, items: itemsCopy } as unknown as typeof recipe;
    expect(() => compileRecipeToWorkflow(broken)).toThrow(
      /runner only supports checkpoint artifact writing for build\.brief@v1/,
    );
  });

  it('throws if an item has no continue/complete route mapping to pass', () => {
    const recipe = loadBuildRecipe();
    const itemsCopy = recipe.items.map((item) =>
      item.id === ('frame-step' as unknown as typeof item.id)
        ? ({ ...item, routes: { stop: '@stop' } } as unknown as typeof item)
        : item,
    );
    const broken = { ...recipe, items: itemsCopy } as unknown as typeof recipe;
    expect(() => compileRecipeToWorkflow(broken)).toThrow(/no outcome that maps to 'pass'/);
  });
});
