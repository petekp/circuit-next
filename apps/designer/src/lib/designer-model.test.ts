import { describe, expect, it } from 'vitest';
import { deriveDesignerModel } from './designer-model';
import type { Block, BlockCatalog, Schematic, SchematicStep } from './types';

const CATALOG: BlockCatalog = {
  schema_version: '1',
  blocks: [
    blockOf('frame', 'Frame', 'Frame the work.', 'orchestrator', 'optional'),
    blockOf('plan', 'Plan', 'Plan the work.', 'orchestrator', 'optional'),
    blockOf('act', 'Act', 'Implementation relay.', 'worker', 'optional'),
    blockOf('run-verification', 'Verify', 'Run verification.', 'orchestrator', 'optional'),
    blockOf('review', 'Review', 'Independent review relay.', 'worker', 'optional'),
    blockOf('close-with-evidence', 'Close', 'Close with evidence.', 'orchestrator', 'optional'),
  ],
};

function blockOf(
  id: string,
  title: string,
  purpose: string,
  surface: string,
  human: string,
): Block {
  return {
    id,
    title,
    purpose,
    allowed_routes: ['continue', 'retry', 'revise', 'stop'],
    human_interaction: human,
    action_surface: surface,
    input_contracts: [],
    output_contract: 'flow.evidence@v1',
    produces_evidence: [],
  };
}

function step(partial: Partial<SchematicStep> & Pick<SchematicStep, 'id' | 'block' | 'stage'>) {
  return {
    title: partial.title ?? `${partial.id}-title`,
    input: {},
    output: 'flow.evidence@v1',
    evidence_requirements: ['something'],
    execution: { kind: 'compose' as const },
    routes: { continue: '@stop' },
    ...partial,
  } as unknown as SchematicStep;
}

function schematic(
  partial: Partial<Schematic> & Pick<Schematic, 'items' | 'starts_at'>,
): Schematic {
  return {
    schema_version: '1',
    id: 'test',
    title: 'Test Circuit',
    purpose: 'Purpose.',
    status: 'active',
    initial_contracts: [],
    contract_aliases: [],
    ...partial,
  } as Schematic;
}

describe('deriveDesignerModel — happy path summaries', () => {
  it('summarizes a relay step as routed by an AI worker', () => {
    const sch = schematic({
      starts_at: 'act',
      items: [
        step({
          id: 'act',
          block: 'act',
          stage: 'act',
          title: 'Act — implementation relay',
          execution: { kind: 'relay', role: 'implementer' },
          routes: { continue: '@complete' },
        }),
      ],
      entry_modes: [{ name: 'default', depth: 'standard', description: 'Default.' }],
    } as unknown as Schematic);
    const model = deriveDesignerModel({ schematic: sch, catalog: CATALOG });
    const designerStep = model.steps[0];
    if (!designerStep) throw new Error('expected one step');
    expect(designerStep.runner).toBe('ai-implementer');
    expect(designerStep.runnerSummary).toBe('An AI writes the change.');
    expect(designerStep.asksOperator).toBe(false);
    expect(designerStep.nextStepSummary).toBe('On success, finishes here.');
    expect(designerStep.prompt.label).toBe('AI instructions');
    expect(designerStep.prompt.responseShape).toContain('flow.evidence@v1');
  });

  it('summarizes compose/verification as circuit-handled with no external prompt', () => {
    const sch = schematic({
      starts_at: 'plan',
      items: [step({ id: 'plan', block: 'plan', stage: 'plan', execution: { kind: 'compose' } })],
      entry_modes: [{ name: 'default', depth: 'standard', description: 'd' }],
    } as unknown as Schematic);
    const model = deriveDesignerModel({ schematic: sch, catalog: CATALOG });
    const planStep = model.steps[0];
    if (!planStep) throw new Error('expected one step');
    expect(planStep.runner).toBe('circuit');
    expect(planStep.prompt.kind).toBe('compose-or-verify');
    expect(planStep.prompt.oneLine).toBe('Circuit takes care of this for you.');
    expect(planStep.prompt.responseShape).toBeNull();
  });
});

describe('deriveDesignerModel — checkpoints', () => {
  it('renders human controls and choices for an existing checkpoint', () => {
    const sch = schematic({
      starts_at: 'frame',
      items: [
        step({
          id: 'frame',
          block: 'frame',
          stage: 'frame',
          title: 'Frame — confirm brief',
          execution: { kind: 'checkpoint' },
          routes: { continue: '@stop' },
          checkpoint_policy: {
            prompt: 'Confirm the brief before continuing.',
            choices: [
              { id: 'continue', label: 'Continue' },
              { id: 'revise', label: 'Revise' },
            ],
            safe_default_choice: 'continue',
            safe_autonomous_choice: 'continue',
          },
        } as unknown as Partial<SchematicStep> & Pick<SchematicStep, 'id' | 'block' | 'stage'>),
      ],
      entry_modes: [{ name: 'default', depth: 'standard', description: 'd' }],
    } as unknown as Schematic);
    const model = deriveDesignerModel({ schematic: sch, catalog: CATALOG });
    const frame = model.steps[0];
    if (!frame) throw new Error('expected one step');
    expect(frame.runner).toBe('human');
    expect(frame.asksOperator).toBe(true);
    expect(frame.checkpoint?.prompt).toBe('Confirm the brief before continuing.');
    expect(frame.checkpoint?.choices.map((c) => c.id)).toEqual(['continue', 'revise']);
    expect(frame.checkpoint?.safeDefaultChoice).toBe('continue');
    expect(frame.prompt.kind).toBe('checkpoint');
    expect(frame.prompt.label).toBe('Question for you');
    expect(frame.humanInteractionSummary).toContain('Continue');
    expect(frame.humanInteractionSummary).toContain('Revise');
    expect(frame.humanInteractionSummary).toMatch(/^Pauses to ask/);
  });
});

describe('deriveDesignerModel — mode-aware route summaries', () => {
  it('uses lite override when active mode depth is lite', () => {
    const sch = schematic({
      starts_at: 'verify',
      items: [
        step({
          id: 'verify',
          block: 'run-verification',
          stage: 'verify',
          title: 'Verify',
          execution: { kind: 'verification' },
          routes: { continue: 'review', retry: '@stop' },
          route_overrides: { continue: { lite: 'close' } },
        }),
        step({
          id: 'review',
          block: 'review',
          stage: 'review',
          title: 'Review',
          execution: { kind: 'relay', role: 'reviewer' },
          routes: { continue: 'close' },
        }),
        step({
          id: 'close',
          block: 'close-with-evidence',
          stage: 'close',
          title: 'Close',
          execution: { kind: 'compose' },
          routes: { continue: '@complete' },
        }),
      ],
      entry_modes: [
        { name: 'default', depth: 'standard', description: 'standard' },
        { name: 'lite', depth: 'lite', description: 'lite' },
      ],
    } as unknown as Schematic);

    const standard = deriveDesignerModel({ schematic: sch, catalog: CATALOG, modeName: 'default' });
    const verifyStandard = standard.steps.find((s) => s.id === 'verify');
    if (!verifyStandard) throw new Error('verify step missing in standard model');
    const continueRouteStandard = verifyStandard.routes.find((r) => r.name === 'continue');
    if (!continueRouteStandard) throw new Error('continue route missing in standard model');
    expect(continueRouteStandard.effectiveTarget).toBe('review');
    expect(continueRouteStandard.overriddenForMode).toBe(false);
    expect(continueRouteStandard.plainEnglish).toBe('On success, goes to "Review".');

    const lite = deriveDesignerModel({ schematic: sch, catalog: CATALOG, modeName: 'lite' });
    const verifyLite = lite.steps.find((s) => s.id === 'verify');
    if (!verifyLite) throw new Error('verify step missing in lite model');
    const continueRouteLite = verifyLite.routes.find((r) => r.name === 'continue');
    if (!continueRouteLite) throw new Error('continue route missing in lite model');
    expect(continueRouteLite.effectiveTarget).toBe('close');
    expect(continueRouteLite.overriddenForMode).toBe(true);
    expect(continueRouteLite.plainEnglish).toBe('On success, goes to "Close".');
    const firstOverride = verifyLite.routeOverrides[0];
    if (!firstOverride) throw new Error('expected at least one route override');
    expect(firstOverride.plainEnglish).toBe('In lite mode, on success goes to "Close".');
    expect(verifyLite.modeBehaviorSummary).toContain('Lite mode');
    expect(verifyLite.modeBehaviorSummary).toContain('goes to "Close"');
  });
});

describe('deriveDesignerModel — health', () => {
  it('flags a dangling route target as an error', () => {
    const sch = schematic({
      starts_at: 'plan',
      items: [
        step({
          id: 'plan',
          block: 'plan',
          stage: 'plan',
          execution: { kind: 'compose' },
          routes: { continue: 'missing-step' },
        }),
      ],
      entry_modes: [{ name: 'default', depth: 'standard', description: 'd' }],
    } as unknown as Schematic);
    const model = deriveDesignerModel({ schematic: sch, catalog: CATALOG });
    expect(model.health.status).toBe('error');
    expect(model.health.detail).toContain("don't point to a known step");
    expect(model.health.label).toBe('Problems found');
  });

  it('reports healthy when every target resolves', () => {
    const sch = schematic({
      starts_at: 'plan',
      items: [
        step({
          id: 'plan',
          block: 'plan',
          stage: 'plan',
          execution: { kind: 'compose' },
          routes: { continue: '@complete' },
        }),
      ],
      entry_modes: [{ name: 'default', depth: 'standard', description: 'd' }],
    } as unknown as Schematic);
    const model = deriveDesignerModel({ schematic: sch, catalog: CATALOG });
    expect(model.health.status).toBe('ok');
    expect(model.health.label).toBe('Looks good');
  });
});
