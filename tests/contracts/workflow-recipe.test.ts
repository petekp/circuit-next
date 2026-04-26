import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { StepId } from '../../src/schemas/ids.js';
import { WorkflowPrimitiveCatalog } from '../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  compileWorkflowRecipeDraft,
  projectWorkflowRecipeForCompiler,
  validateWorkflowRecipeCatalogCompatibility,
} from '../../src/schemas/workflow-recipe.js';

const primitiveCatalogPath = 'specs/workflow-primitive-catalog.json';
const fixRecipePath = 'specs/workflow-recipes/fix-candidate.recipe.json';
const fixProjectionFixturePath = 'specs/workflow-recipes/fix-candidate.projection.json';
const updateProjectionFixture = process.env.UPDATE_PROJECTION_FIXTURE === '1';

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

  it('keeps Fix human-decision evidence bound through a generic evidence alias', () => {
    const recipe = parseFixRecipe();
    expect(recipe.contract_aliases).toContainEqual({
      generic: 'workflow.evidence@v1',
      actual: 'fix.diagnosis@v1',
    });
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
      'close-with-evidence',
      'handoff',
    ]);
  });

  it('keeps Fix phase bindings aligned with the intended workflow shape', () => {
    const recipe = parseFixRecipe();
    expect(recipe.items.map((item) => [item.id, item.phase])).toEqual([
      ['fix-intake', 'frame'],
      ['fix-route', 'frame'],
      ['fix-frame', 'frame'],
      ['fix-gather-context', 'analyze'],
      ['fix-diagnose', 'analyze'],
      ['fix-no-repro-decision', 'analyze'],
      ['fix-act', 'act'],
      ['fix-verify', 'verify'],
      ['fix-review', 'review'],
      ['fix-close-lite', 'close'],
      ['fix-close', 'close'],
      ['fix-handoff', 'close'],
    ]);
  });

  it('projects Fix into compiler-facing phase groups without using item names as phase hints', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    expect(projection.recipe_id).toBe('fix-candidate');
    expect(projection.starts_at).toBe('fix-intake');
    expect(projection.omitted_phases).toEqual(['plan']);
    expect(projection.phases).toEqual([
      {
        phase: 'frame',
        items: ['fix-intake', 'fix-route', 'fix-frame'],
      },
      {
        phase: 'analyze',
        items: ['fix-gather-context', 'fix-diagnose', 'fix-no-repro-decision'],
      },
      {
        phase: 'act',
        items: ['fix-act'],
      },
      {
        phase: 'verify',
        items: ['fix-verify'],
      },
      {
        phase: 'review',
        items: ['fix-review'],
      },
      {
        phase: 'close',
        items: ['fix-close-lite', 'fix-close', 'fix-handoff'],
      },
    ]);
  });

  it('projects item uses, phase, execution, and output through to projected items', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const verify = projection.items.find((item) => item.id === 'fix-verify');
    const act = projection.items.find((item) => item.id === 'fix-act');
    if (verify === undefined) throw new Error('fix-verify projection missing');
    if (act === undefined) throw new Error('fix-act projection missing');

    expect(act).toMatchObject({
      uses: 'act',
      phase: 'act',
      execution: { kind: 'dispatch', role: 'implementer' },
      output: 'fix.change@v1',
    });
    expect(verify).toMatchObject({
      uses: 'run-verification',
      phase: 'verify',
      execution: { kind: 'verification' },
      output: 'fix.verification@v1',
    });
  });

  it('projects per-outcome route targets including terminals and rigor overrides', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const verify = projection.items.find((item) => item.id === 'fix-verify');
    const intake = projection.items.find((item) => item.id === 'fix-intake');
    const closeLite = projection.items.find((item) => item.id === 'fix-close-lite');
    if (verify === undefined) throw new Error('fix-verify projection missing');
    if (intake === undefined) throw new Error('fix-intake projection missing');
    if (closeLite === undefined) throw new Error('fix-close-lite projection missing');

    expect(verify.routes).toEqual([
      {
        outcome: 'continue',
        default_target: 'fix-review',
        mode_targets: { lite: 'fix-close-lite' },
      },
      { outcome: 'retry', default_target: 'fix-act', mode_targets: {} },
      { outcome: 'ask', default_target: 'fix-no-repro-decision', mode_targets: {} },
      { outcome: 'stop', default_target: '@stop', mode_targets: {} },
    ]);

    expect(intake.routes).toEqual([
      { outcome: 'continue', default_target: 'fix-route', mode_targets: {} },
      { outcome: 'ask', default_target: '@stop', mode_targets: {} },
      { outcome: 'stop', default_target: '@stop', mode_targets: {} },
    ]);

    const closeLiteComplete = closeLite.routes.find((route) => route.outcome === 'complete');
    expect(closeLiteComplete).toEqual({
      outcome: 'complete',
      default_target: '@complete',
      mode_targets: {},
    });
  });

  it('preserves the recipe item route outcome set through projection', () => {
    const recipe = parseFixRecipe();
    const projection = projectWorkflowRecipeForCompiler(recipe);
    for (const item of projection.items) {
      const sourceItem = recipe.items.find((entry) => entry.id === item.id);
      if (sourceItem === undefined) throw new Error(`recipe item missing: ${item.id}`);
      const projectedOutcomes = item.routes.map((route) => route.outcome).sort();
      const recipeOutcomes = Object.keys(sourceItem.routes).sort();
      expect(projectedOutcomes).toEqual(recipeOutcomes);
    }
  });

  it('matches the canonical Fix projection snapshot fixture', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    if (updateProjectionFixture) {
      writeFileSync(fixProjectionFixturePath, `${JSON.stringify(projection, null, 2)}\n`);
      execFileSync('npx', ['biome', 'format', '--write', fixProjectionFixturePath], {
        stdio: 'inherit',
      });
    }
    const fixture = readJson(fixProjectionFixturePath);
    expect(projection).toEqual(fixture);
  });

  it('compiles a per-rigor draft that resolves rigor overrides on fix-verify continue', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const standardDraft = compileWorkflowRecipeDraft(projection, 'standard');
    const liteDraft = compileWorkflowRecipeDraft(projection, 'lite');

    const standardVerify = standardDraft.items.find((item) => item.id === 'fix-verify');
    const liteVerify = liteDraft.items.find((item) => item.id === 'fix-verify');
    if (standardVerify === undefined) throw new Error('standard fix-verify draft missing');
    if (liteVerify === undefined) throw new Error('lite fix-verify draft missing');

    const standardContinue = standardVerify.edges.find((edge) => edge.outcome === 'continue');
    const liteContinue = liteVerify.edges.find((edge) => edge.outcome === 'continue');
    expect(standardContinue).toEqual({ outcome: 'continue', target: 'fix-review' });
    expect(liteContinue).toEqual({ outcome: 'continue', target: 'fix-close-lite' });
  });

  it('preserves terminal targets after rigor resolution', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    const intake = draft.items.find((item) => item.id === 'fix-intake');
    const closeLite = draft.items.find((item) => item.id === 'fix-close-lite');
    if (intake === undefined) throw new Error('fix-intake draft missing');
    if (closeLite === undefined) throw new Error('fix-close-lite draft missing');

    expect(intake.edges).toContainEqual({ outcome: 'stop', target: '@stop' });
    expect(closeLite.edges).toContainEqual({ outcome: 'complete', target: '@complete' });
    expect(closeLite.edges).toContainEqual({ outcome: 'escalate', target: '@escalate' });
  });

  it('keeps rigors without overrides identical to the projection default targets', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const deepDraft = compileWorkflowRecipeDraft(projection, 'deep');

    for (const item of deepDraft.items) {
      const projectedItem = projection.items.find((entry) => entry.id === item.id);
      if (projectedItem === undefined) throw new Error(`projection item missing: ${item.id}`);
      const expectedEdges = projectedItem.routes.map((route) => ({
        outcome: route.outcome,
        target: route.default_target,
      }));
      expect(item.edges).toEqual(expectedEdges);
    }
  });

  it('keeps draft top-level shape consistent with the projection input', () => {
    const projection = projectWorkflowRecipeForCompiler(parseFixRecipe());
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    expect(draft.recipe_id).toBe(projection.recipe_id);
    expect(draft.starts_at).toBe(projection.starts_at);
    expect(draft.phases).toEqual(projection.phases);
    expect(draft.omitted_phases).toEqual(projection.omitted_phases);
    expect(draft.rigor).toBe('standard');
    expect(draft.items.map((item) => item.id)).toEqual(projection.items.map((item) => item.id));
  });

  it('keeps Fix items declaring the evidence required by their primitives', () => {
    const recipe = parseFixRecipe();
    const catalog = parsePrimitiveCatalog();
    const primitiveById = new Map(catalog.primitives.map((primitive) => [primitive.id, primitive]));

    for (const item of recipe.items) {
      const primitive = primitiveById.get(item.uses);
      if (primitive === undefined) throw new Error(`missing primitive ${item.uses}`);
      expect(item.evidence_requirements).toEqual(
        expect.arrayContaining(primitive.produces_evidence),
      );
    }
  });

  it('keeps Fix execution bindings aligned with the intended compiler shape', () => {
    const recipe = parseFixRecipe();
    expect(recipe.items.map((item) => [item.id, item.execution])).toEqual([
      ['fix-intake', { kind: 'synthesis' }],
      ['fix-route', { kind: 'synthesis' }],
      ['fix-frame', { kind: 'synthesis' }],
      ['fix-gather-context', { kind: 'dispatch', role: 'researcher' }],
      ['fix-diagnose', { kind: 'dispatch', role: 'researcher' }],
      ['fix-no-repro-decision', { kind: 'checkpoint' }],
      ['fix-act', { kind: 'dispatch', role: 'implementer' }],
      ['fix-verify', { kind: 'verification' }],
      ['fix-review', { kind: 'dispatch', role: 'reviewer' }],
      ['fix-close-lite', { kind: 'synthesis' }],
      ['fix-close', { kind: 'synthesis' }],
      ['fix-handoff', { kind: 'synthesis' }],
    ]);
  });

  it('keeps Fix act and close inputs aligned with the evidence path', () => {
    const recipe = parseFixRecipe();
    const act = recipe.items.find((item) => item.id === 'fix-act');
    const closeLite = recipe.items.find((item) => item.id === 'fix-close-lite');
    const close = recipe.items.find((item) => item.id === 'fix-close');
    if (act === undefined) throw new Error('fix-act missing');
    if (closeLite === undefined) throw new Error('fix-close-lite missing');
    if (close === undefined) throw new Error('fix-close missing');

    expect(act.input).not.toHaveProperty('decision');
    expect(closeLite.input).toMatchObject({
      brief: 'fix.brief@v1',
      context: 'fix.context@v1',
      diagnosis: 'fix.diagnosis@v1',
      change: 'fix.change@v1',
      verification: 'fix.verification@v1',
    });
    expect(closeLite.input).not.toHaveProperty('review');
    expect(close.input).toMatchObject({
      brief: 'fix.brief@v1',
      context: 'fix.context@v1',
      diagnosis: 'fix.diagnosis@v1',
      change: 'fix.change@v1',
      verification: 'fix.verification@v1',
      review: 'fix.review@v1',
    });
  });

  it('routes Lite verification directly to a no-review close item', () => {
    const recipe = parseFixRecipe();
    const verify = recipe.items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');

    expect(verify.routes.continue).toBe('fix-review');
    expect(verify.route_overrides).toEqual({
      continue: {
        lite: 'fix-close-lite',
      },
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

  it('rejects an unknown route override target at parse time', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const verify = items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fixture missing verify item');
    verify.route_overrides = { continue: { lite: 'missing-item' } };
    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/route override target references unknown recipe item/);
    }
  });

  it('rejects route overrides for undeclared route outcomes', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const verify = items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fixture missing verify item');
    verify.route_overrides = { split: { lite: 'fix-close-lite' } };
    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/route override must target a declared route outcome/);
    }
  });

  it('rejects duplicate evidence requirements at parse time', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const diagnose = items.find((item) => item.id === 'fix-diagnose');
    if (diagnose === undefined) throw new Error('fixture missing diagnose item');
    diagnose.evidence_requirements = ['confidence', 'confidence'];

    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate evidence requirement/);
    }
  });

  it('rejects dispatch execution without a role at parse time', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const act = items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fixture missing act item');
    act.execution = { kind: 'dispatch' };

    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch execution requires a dispatch role/);
    }
  });

  it('rejects dispatch roles on non-dispatch execution at parse time', () => {
    const raw = readJson(fixRecipePath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const frame = items.find((item) => item.id === 'fix-frame');
    if (frame === undefined) throw new Error('fixture missing frame item');
    frame.execution = { kind: 'synthesis', role: 'researcher' };

    const result = WorkflowRecipe.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch role is only allowed for dispatch execution/);
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

  it('reports recipe items that omit primitive evidence requirements', () => {
    const recipe = parseFixRecipe();
    const diagnose = recipe.items.find((item) => item.id === 'fix-diagnose');
    if (diagnose === undefined) throw new Error('fix-diagnose missing');
    diagnose.evidence_requirements = ['cause hypothesis'];

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'evidence requirement "confidence" from primitive "diagnose" is not declared by recipe item',
    });
  });

  it('reports execution kinds that do not match the selected primitive surface', () => {
    const recipe = parseFixRecipe();
    const act = recipe.items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    // worker primitives (act) accept dispatch or synthesis. Checkpoint is
    // still incompatible — host primitives are checkpoints, workers are not.
    act.execution = { kind: 'checkpoint' };

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message:
        'execution kind "checkpoint" is not compatible with primitive "act"; expected one of dispatch, synthesis',
    });
  });

  it('reports phase bindings that do not match the selected primitive', () => {
    const recipe = parseFixRecipe();
    const act = recipe.items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.phase = 'analyze';

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message: 'phase "analyze" is not compatible with primitive "act"; expected one of act',
    });
  });

  it('reports run-verification items that do not bind to verification execution', () => {
    const recipe = parseFixRecipe();
    const verify = recipe.items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');
    verify.execution = { kind: 'synthesis' };

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-verify',
      message:
        'execution kind "synthesis" is not compatible with primitive "run-verification"; expected one of verification',
    });
  });

  it('reports unavailable input contracts in recipe order', () => {
    const recipe = parseFixRecipe();
    const diagnose = recipe.items.find((item) => item.id === 'fix-diagnose');
    if (diagnose === undefined) throw new Error('fix-diagnose missing');
    diagnose.input.context = 'missing.context@v1';
    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'input "context" references unavailable contract "missing.context@v1" on at least one reachable route',
    });
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'inputs do not satisfy primitive "diagnose"; expected one of [workflow.brief@v1, context.packet@v1]',
    });
  });

  it('reports recipe items that omit every accepted primitive input set', () => {
    const recipe = parseFixRecipe();
    const act = recipe.items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.input = { brief: 'fix.brief@v1' };

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message:
        'inputs do not satisfy primitive "act"; expected one of [workflow.brief@v1, diagnosis.result@v1] or [workflow.brief@v1, plan.strategy@v1] or [workflow.brief@v1, plan.strategy@v1, diagnosis.result@v1]',
    });
  });

  it('allows Act to consume a plan instead of a diagnosis through an alternative input set', () => {
    const recipe = parseFixRecipe();
    recipe.initial_contracts.push('plan.strategy@v1');
    const act = recipe.items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.input = {
      brief: 'fix.brief@v1',
      plan: 'plan.strategy@v1',
    };

    const issues = validateWorkflowRecipeCatalogCompatibility(recipe, parsePrimitiveCatalog());
    expect(issues).toEqual([]);
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

// Compiler-required metadata. These fields are optional at parse time to
// avoid breaking candidate recipes mid-upgrade, but their cross-field
// shape (kind ↔ writes, kind ↔ gate, checkpoint_policy ↔ checkpoint kind)
// is enforced when present so authors get clear feedback.
describe('workflow recipe compiler-required metadata', () => {
  function frameItemWithExtras(extras: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'a-frame',
      uses: 'frame',
      title: 'Frame',
      phase: 'frame',
      input: {},
      output: 'workflow.brief@v1',
      evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
      execution: { kind: 'synthesis' },
      routes: { continue: '@complete' },
      ...extras,
    };
  }

  function actItemWithExtras(extras: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'a-act',
      uses: 'act',
      title: 'Act',
      phase: 'act',
      input: { brief: 'workflow.brief@v1', plan: 'plan.strategy@v1' },
      output: 'change.evidence@v1',
      evidence_requirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: { kind: 'dispatch', role: 'implementer' },
      routes: { continue: '@complete' },
      ...extras,
    };
  }

  function baseRecipe(items: Array<Record<string, unknown>>): Record<string, unknown> {
    return {
      schema_version: '1',
      id: 'demo',
      title: 'Demo',
      purpose: 'demo',
      status: 'candidate',
      starts_at: items[0]?.id,
      initial_contracts: [],
      contract_aliases: [],
      items,
    };
  }

  it('accepts a synthesis item with required gate, schema-sections writes, and protocol', () => {
    const recipe = baseRecipe([
      frameItemWithExtras({
        protocol: 'demo-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope', 'constraints'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('rejects synthesis item missing writes.artifact_path', () => {
    const recipe = baseRecipe([
      frameItemWithExtras({
        writes: {},
        gate: { required: ['scope'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/synthesis execution requires writes\.artifact_path/);
    }
  });

  it('rejects synthesis item with gate.allow (checkpoint-only field)', () => {
    const recipe = baseRecipe([
      frameItemWithExtras({
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'], allow: ['continue'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/gate\.allow is only allowed for checkpoint execution/);
    }
  });

  it('accepts a dispatch item with full path slots and gate.pass', () => {
    const recipe = baseRecipe([
      actItemWithExtras({
        protocol: 'demo-act@v1',
        writes: {
          artifact_path: 'artifacts/change.json',
          request_path: 'artifacts/dispatch/act.request.json',
          receipt_path: 'artifacts/dispatch/act.receipt.txt',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('rejects dispatch item missing receipt_path', () => {
    const recipe = baseRecipe([
      actItemWithExtras({
        writes: {
          request_path: 'artifacts/dispatch/act.request.json',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch execution requires writes\.receipt_path/);
    }
  });

  it('rejects dispatch item with gate.required (synthesis-only field)', () => {
    const recipe = baseRecipe([
      actItemWithExtras({
        writes: {
          request_path: 'artifacts/dispatch/act.request.json',
          receipt_path: 'artifacts/dispatch/act.receipt.txt',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'], required: ['summary'] },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /gate\.required is only allowed for synthesis\|verification execution/,
      );
    }
  });

  it('rejects checkpoint_policy on non-checkpoint execution', () => {
    const recipe = baseRecipe([
      frameItemWithExtras({
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        checkpoint_policy: {
          prompt: 'go?',
          choices: [{ id: 'continue' }],
        },
      }),
    ]);
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /checkpoint_policy is only allowed for checkpoint execution/,
      );
    }
  });

  it('accepts recipe-level entry, entry_modes, spine_policy, phases', () => {
    const recipe = {
      ...baseRecipe([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      version: '0.1.0',
      entry: { signals: { include: ['demo'], exclude: [] }, intent_prefixes: ['demo'] },
      entry_modes: [{ name: 'default', rigor: 'standard', description: 'default mode' }],
      spine_policy: {
        mode: 'partial',
        omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
        rationale: 'demo recipe with only a frame phase for testing',
      },
      phases: [{ canonical: 'frame', id: 'frame-phase', title: 'Frame' }],
    };
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('rejects duplicate entry mode names', () => {
    const recipe = {
      ...baseRecipe([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      entry_modes: [
        { name: 'default', rigor: 'standard', description: 'a' },
        { name: 'default', rigor: 'lite', description: 'b' },
      ],
    };
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate entry mode name: default/);
    }
  });

  it('rejects phases entry mismatch with item phase usage', () => {
    const recipe = {
      ...baseRecipe([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      phases: [{ canonical: 'analyze', id: 'analyze-phase', title: 'Analyze' }],
    };
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /phases is missing an entry for canonical phase 'frame'/,
      );
    }
  });

  it('rejects spine_policy.omits that includes a used canonical phase', () => {
    const recipe = {
      ...baseRecipe([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      spine_policy: {
        mode: 'partial',
        omits: ['frame'],
        rationale: 'invalid omit because frame is used by an item',
      },
    };
    const result = WorkflowRecipe.safeParse(recipe);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /canonical phase 'frame' is omitted but used by at least one item/,
      );
    }
  });
});
