import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExecutableFlowV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { fromCompiledFlowV1 } from '../../src/core-v2/manifest/from-compiled-flow-v1.js';
import { validateExecutableFlowV2 } from '../../src/core-v2/manifest/validate-executable-flow.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

function loadCompiledFlow(path: string): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stepById(flow: ExecutableFlowV2, id: string) {
  const step = flow.steps.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`missing step ${id}`);
  return step;
}

describe('fromCompiledFlowV1', () => {
  const representativeFlows = [
    'generated/flows/review/circuit.json',
    'generated/flows/fix/circuit.json',
    'generated/flows/build/circuit.json',
    'generated/flows/migrate/circuit.json',
    'generated/flows/sweep/circuit.json',
    'generated/flows/explore/tournament.json',
  ] as const;

  it('converts representative generated flows into valid executable manifests', () => {
    const converted = representativeFlows.map((path) => ({
      path,
      manifest: fromCompiledFlowV1(loadCompiledFlow(path)),
    }));

    for (const { manifest } of converted) {
      expect(validateExecutableFlowV2(manifest)).toEqual({ ok: true, issues: [] });
      expect(manifest.entryModes?.length).toBeGreaterThan(0);
      expect(manifest.stages.length).toBeGreaterThan(0);
      expect(manifest.steps.length).toBeGreaterThan(0);
      expect(manifest.metadata).toMatchObject({
        source: 'compiled-flow-v1',
        schema_version: '2',
      });
    }

    const allKinds = new Set(
      converted.flatMap(({ manifest }) => manifest.steps.map((step) => step.kind)),
    );
    expect(allKinds).toEqual(
      new Set(['compose', 'verification', 'checkpoint', 'relay', 'sub-run', 'fanout']),
    );
  });

  it('preserves entry modes, stages, routes, reads, writes, and report refs', () => {
    const manifest = fromCompiledFlowV1(loadCompiledFlow('generated/flows/build/circuit.json'));

    expect(manifest.entry).toBe('frame-step');
    expect(manifest.entryModes?.map((mode) => mode.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
    expect(manifest.stages.map((stage) => stage.id)).toEqual([
      'frame-stage',
      'plan-stage',
      'act-stage',
      'verify-stage',
      'review-stage',
      'close-stage',
    ]);

    const closeStep = stepById(manifest, 'close-step');
    expect(closeStep.routes.pass).toEqual({ kind: 'terminal', target: '@complete' });
    expect(closeStep.writes?.report).toEqual({
      path: 'reports/build-result.json',
      schema: 'build.result@v1',
    });

    const actStep = stepById(manifest, 'act-step');
    expect(actStep.reads).toEqual([
      { path: 'reports/build/brief.json' },
      { path: 'reports/build/plan.json' },
    ]);
    expect(actStep.writes).toMatchObject({
      request: { path: 'reports/relay/build-act.request.json' },
      receipt: { path: 'reports/relay/build-act.receipt.txt' },
      result: { path: 'reports/relay/build-act.result.json' },
      report: { path: 'reports/build/implementation.json', schema: 'build.implementation@v1' },
    });
  });

  it('uses the first v1 entry mode as the default executable entry', () => {
    const raw = loadJson('generated/flows/review/circuit.json') as {
      entry_modes: Array<{
        name: string;
        start_at: string;
        depth: string;
        description: string;
      }>;
    };
    raw.entry_modes = [
      {
        name: 'relay-first',
        start_at: 'audit-step',
        depth: 'standard',
        description: 'Synthetic first entry mode.',
      },
      ...raw.entry_modes,
    ];

    const manifest = fromCompiledFlowV1(CompiledFlow.parse(raw));

    expect(manifest.entry).toBe('audit-step');
  });

  it('preserves v1 selection field names at the adapter boundary', () => {
    const raw = loadJson('generated/flows/review/circuit.json') as {
      default_selection?: unknown;
    };
    raw.default_selection = {
      invocation_options: { temperature: 0.2 },
    };

    const manifest = fromCompiledFlowV1(CompiledFlow.parse(raw));

    expect(manifest.defaultSelection).toMatchObject({
      invocation_options: { temperature: 0.2 },
    });
    expect(manifest.defaultSelection).not.toHaveProperty('invocationOptions');
  });

  it('accepts overlapping stage membership from v1 compiled flows', () => {
    const raw = loadJson('generated/flows/review/circuit.json') as {
      stages: Array<{ id: string; title: string; steps: string[]; selection?: unknown }>;
    };
    raw.stages.push({
      id: 'overlap-stage',
      title: 'Overlap Selection',
      steps: ['intake-step'],
      selection: { effort: 'high' },
    });

    const parsed = CompiledFlow.parse(raw);
    const manifest = fromCompiledFlowV1(parsed);

    expect(validateExecutableFlowV2(manifest)).toEqual({ ok: true, issues: [] });
    expect(
      manifest.stages
        .filter((stage) => stage.stepIds.includes('intake-step'))
        .map((stage) => stage.id),
    ).toEqual(expect.arrayContaining(['overlap-stage']));
    expect(stepById(manifest, 'intake-step')).not.toHaveProperty('stageId');
  });

  it('preserves checkpoint policy and choice routes without implying execution parity', () => {
    const manifest = fromCompiledFlowV1(loadCompiledFlow('generated/flows/fix/circuit.json'));
    const checkpoint = stepById(manifest, 'fix-no-repro-decision');

    expect(checkpoint.kind).toBe('checkpoint');
    if (checkpoint.kind !== 'checkpoint') throw new Error('expected checkpoint');
    expect(checkpoint.choices).toEqual(['continue']);
    expect(checkpoint.routes.pass).toEqual({ kind: 'step', stepId: 'fix-act' });
    expect(checkpoint.routes).toMatchObject({
      revise: { kind: 'step', stepId: 'fix-diagnose' },
      handoff: { kind: 'step', stepId: 'fix-handoff' },
      escalate: { kind: 'terminal', target: '@escalate' },
      stop: { kind: 'terminal', target: '@stop' },
    });
    expect(checkpoint.policy).toMatchObject({
      prompt: expect.any(String),
    });
  });

  it('preserves sub-run configuration and run-file paths', () => {
    const manifest = fromCompiledFlowV1(loadCompiledFlow('generated/flows/migrate/circuit.json'));
    const subRun = stepById(manifest, 'batch-step');

    expect(subRun.kind).toBe('sub-run');
    if (subRun.kind !== 'sub-run') throw new Error('expected sub-run');
    expect(subRun.flowRef).toBe('build');
    expect(subRun.entryMode).toBe('default');
    expect(subRun.depth).toBe('standard');
    expect(subRun.writes).toMatchObject({
      result: { path: 'reports/migrate/batch-result.json' },
      report: { path: 'reports/migrate/batch-result.json', schema: 'migrate.batch@v1' },
    });
  });

  it('preserves fanout configuration and aggregate report refs', () => {
    const manifest = fromCompiledFlowV1(
      loadCompiledFlow('generated/flows/explore/tournament.json'),
    );
    const fanout = stepById(manifest, 'proposal-fanout-step');

    expect(fanout.kind).toBe('fanout');
    if (fanout.kind !== 'fanout') throw new Error('expected fanout');
    expect(fanout.branches).toMatchObject({
      kind: 'dynamic',
      source_report: 'reports/decision-options.json',
    });
    expect(fanout.join).toMatchObject({
      aggregate: {
        path: 'reports/tournament-aggregate.json',
        schema: 'explore.tournament-aggregate@v1',
      },
      on_child_failure: 'abort-all',
    });
  });

  it('fails validation when an adapted route target is unknown', () => {
    const bad = loadCompiledFlow('generated/flows/review/circuit.json') as CompiledFlow & {
      steps: Array<{ routes: Record<string, string> }>;
    };
    const firstStep = bad.steps[0];
    if (firstStep === undefined) throw new Error('missing first step');
    firstStep.routes.pass = 'missing-step';

    expect(() => fromCompiledFlowV1(bad)).toThrow(
      "step 'intake-step' route 'pass' targets unknown step 'missing-step'",
    );
  });

  it('fails validation when an adapted non-checkpoint step lacks pass route', () => {
    const bad = loadCompiledFlow('generated/flows/review/circuit.json') as CompiledFlow & {
      steps: Array<{ routes: Record<string, string> }>;
    };
    const firstStep = bad.steps[0];
    if (firstStep === undefined) throw new Error('missing first step');
    firstStep.routes = Object.fromEntries(
      Object.entries(firstStep.routes).filter(([routeName]) => routeName !== 'pass'),
    );

    expect(() => fromCompiledFlowV1(bad)).toThrow(
      "step 'intake-step' is missing required route 'pass'",
    );
  });

  it('validates stage membership, checkpoint choice uniqueness, and entry modes', () => {
    const manifest = fromCompiledFlowV1(loadCompiledFlow('generated/flows/build/circuit.json'));
    const missingMembership: ExecutableFlowV2 = {
      ...manifest,
      stages: manifest.stages.map((stage) =>
        stage.id === 'plan-stage'
          ? { ...stage, stepIds: stage.stepIds.filter((stepId) => stepId !== 'plan-step') }
          : stage,
      ),
    };
    expect(validateExecutableFlowV2(missingMembership).issues).toContain(
      "step 'plan-step' is not listed in any stage",
    );

    const duplicateStageStep: ExecutableFlowV2 = {
      ...manifest,
      stages: manifest.stages.map((stage) =>
        stage.id === 'plan-stage' ? { ...stage, stepIds: [...stage.stepIds, 'plan-step'] } : stage,
      ),
    };
    expect(validateExecutableFlowV2(duplicateStageStep).issues).toContain(
      "stage 'plan-stage' lists step 'plan-step' more than once",
    );

    const checkpoint = stepById(manifest, 'frame-step');
    if (checkpoint.kind !== 'checkpoint') throw new Error('expected checkpoint');
    const duplicateChoice: ExecutableFlowV2 = {
      ...manifest,
      steps: manifest.steps.map((step) =>
        step.id === checkpoint.id && step.kind === 'checkpoint'
          ? { ...step, choices: ['continue', 'continue'] }
          : step,
      ),
    };
    expect(validateExecutableFlowV2(duplicateChoice).issues).toContain(
      "checkpoint step 'frame-step' has duplicate choice 'continue'",
    );

    const duplicateEntryMode: ExecutableFlowV2 = {
      ...manifest,
      entryModes: [
        ...(manifest.entryModes ?? []),
        {
          name: 'default',
          startAt: 'missing-step',
          depth: 'standard',
          description: 'Duplicate default mode',
        },
      ],
    };
    expect(validateExecutableFlowV2(duplicateEntryMode).issues).toEqual(
      expect.arrayContaining([
        'duplicate entry mode name: default',
        "entry mode 'default' startAt references unknown step 'missing-step'",
      ]),
    );
  });
});
