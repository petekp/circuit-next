import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, type DispatchInput, runWorkflow } from '../../src/runtime/runner.js';
import { resolveSelectionForDispatch } from '../../src/runtime/selection-resolver.js';
import { LayeredConfig } from '../../src/schemas/config.js';
import { RunId, SkillId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import { SelectionOverride } from '../../src/schemas/selection-policy.js';
import { Workflow } from '../../src/schemas/workflow.js';

const FIXTURE_PATH = resolve('.claude-plugin/skills/explore/circuit.json');

type MutableWorkflowFixture = Record<string, unknown> & {
  default_selection?: unknown;
  phases: Array<Record<string, unknown> & { id?: string; selection?: unknown }>;
  steps: Array<Record<string, unknown> & { id?: string; selection?: unknown }>;
};

function loadRawFixture(): { raw: MutableWorkflowFixture; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  return { raw: JSON.parse(bytes.toString('utf8')) as MutableWorkflowFixture, bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'per-step model and effort declarations parse but do not reach dispatch evidence',
    acceptance_evidence:
      'dispatch.started carries model, effort, skills, rigor, and invocation_options from the full selection precedence chain',
    alternate_framing:
      'only keep workflow plus step right-biased selection; rejected because config and phase layers are already schema-authorized selection sources',
  };
}

function layeredConfigs(): LayeredConfig[] {
  return [
    LayeredConfig.parse({
      layer: 'default',
      config: {
        schema_version: 1,
        defaults: {
          selection: {
            model: { provider: 'anthropic', model: 'claude-opus-4-7' },
            effort: 'low',
            skills: { mode: 'replace', skills: ['tdd'] },
            rigor: 'lite',
            invocation_options: { shared: 'default', defaultOnly: true },
          },
        },
        circuits: {
          explore: {
            selection: {
              model: { provider: 'openai', model: 'gpt-5.4' },
              invocation_options: { shared: 'circuit', circuitOnly: true },
            },
          },
        },
      },
    }),
    LayeredConfig.parse({
      layer: 'user-global',
      config: {
        schema_version: 1,
        defaults: {
          selection: {
            effort: 'medium',
            skills: { mode: 'append', skills: ['react-doctor'] },
            invocation_options: { shared: 'user', userOnly: true },
          },
        },
      },
    }),
    LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        circuits: {
          explore: {
            selection: {
              model: { provider: 'gemini', model: 'gemini-pro-refactor' },
              invocation_options: { shared: 'project', projectOnly: true },
            },
          },
        },
      },
    }),
    LayeredConfig.parse({
      layer: 'invocation',
      config: {
        schema_version: 1,
        defaults: {
          selection: {
            model: { provider: 'custom', model: 'overnight-specialist' },
            effort: 'xhigh',
            invocation_options: { shared: 'invocation', invocationOnly: true },
          },
        },
      },
    }),
  ];
}

function workflowWithModelEffortSelections(): { workflow: Workflow; bytes: Buffer } {
  const { raw, bytes } = loadRawFixture();
  raw.default_selection = {
    skills: { mode: 'remove', skills: ['tdd'] },
    invocation_options: { shared: 'workflow', workflowOnly: true },
  };
  for (const phase of raw.phases) {
    if (phase.id === 'synthesize-phase') {
      phase.selection = {
        skills: { mode: 'append', skills: ['typography'] },
        rigor: 'deep',
        invocation_options: { shared: 'phase', phaseOnly: true },
      };
    }
  }
  for (const step of raw.steps) {
    if (step.id === 'synthesize-step') {
      step.selection = {
        effort: 'high',
        skills: { mode: 'remove', skills: ['react-doctor'] },
        invocation_options: { shared: 'step', stepOnly: true },
      };
    }
  }
  return { workflow: Workflow.parse(raw), bytes };
}

const EXPECTED_SYNTHESIZE_SELECTION: ResolvedSelection = {
  model: { provider: 'custom', model: 'overnight-specialist' },
  effort: 'xhigh',
  skills: [SkillId.parse('typography')],
  rigor: 'deep',
  invocation_options: {
    shared: 'invocation',
    defaultOnly: true,
    circuitOnly: true,
    userOnly: true,
    projectOnly: true,
    workflowOnly: true,
    phaseOnly: true,
    stepOnly: true,
    invocationOnly: true,
  },
};

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-model-effort-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('P2-MODEL-EFFORT — provider-scoped model shape', () => {
  it('keeps model ids open-ended while rejecting unknown providers', () => {
    const arbitraryModel = SelectionOverride.safeParse({
      model: { provider: 'openai', model: 'future-model-id-without-schema-release' },
      effort: 'minimal',
    });
    expect(arbitraryModel.success).toBe(true);

    const unknownProvider = SelectionOverride.safeParse({
      model: { provider: 'ollama', model: 'llama-local' },
    });
    expect(unknownProvider.success).toBe(false);
  });
});

describe('P2-MODEL-EFFORT — full selection precedence resolver', () => {
  it('resolves default → user-global → project → workflow → phase → step → invocation for a dispatch step', () => {
    const { workflow } = workflowWithModelEffortSelections();
    const step = workflow.steps.find((s) => s.id === 'synthesize-step');
    if (step === undefined) throw new Error('fixture missing synthesize-step');

    const resolution = resolveSelectionForDispatch({
      workflow,
      step,
      configLayers: layeredConfigs(),
    });

    expect(resolution.applied.map((entry) => entry.source)).toEqual([
      'default',
      'user-global',
      'project',
      'workflow',
      'phase',
      'step',
      'invocation',
    ]);
    expect(resolution.applied.find((entry) => entry.source === 'phase')).toMatchObject({
      source: 'phase',
      phase_id: 'synthesize-phase',
    });
    expect(resolution.applied.find((entry) => entry.source === 'step')).toMatchObject({
      source: 'step',
      step_id: 'synthesize-step',
    });
    expect(resolution.resolved).toEqual(EXPECTED_SYNTHESIZE_SELECTION);
  });

  it('pre-composes config defaults and per-workflow skill overrides inside one layer', () => {
    const { raw } = loadRawFixture();
    const workflow = Workflow.parse(raw);
    const step = workflow.steps.find((s) => s.id === 'frame-step');
    if (step === undefined) throw new Error('fixture missing frame-step');

    const resolution = resolveSelectionForDispatch({
      workflow,
      step,
      configLayers: [
        LayeredConfig.parse({
          layer: 'project',
          config: {
            schema_version: 1,
            defaults: {
              selection: {
                skills: { mode: 'replace', skills: ['tdd'] },
              },
            },
            circuits: {
              explore: {
                selection: {
                  skills: { mode: 'append', skills: ['react-doctor'] },
                },
              },
            },
          },
        }),
      ],
    });

    expect(resolution.resolved.skills).toEqual([
      SkillId.parse('tdd'),
      SkillId.parse('react-doctor'),
    ]);
    expect(resolution.applied).toHaveLength(1);
    expect(resolution.applied[0]).toMatchObject({
      source: 'project',
      override: {
        skills: {
          mode: 'replace',
          skills: [SkillId.parse('tdd'), SkillId.parse('react-doctor')],
        },
      },
    });
  });

  it('emits the resolved model and effort on dispatch.started and passes it to injected dispatchers', async () => {
    const { workflow, bytes } = workflowWithModelEffortSelections();
    const dispatchInputs: DispatchInput[] = [];
    const dispatcher: DispatchFn = {
      adapterName: 'agent',
      dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
        dispatchInputs.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'model-effort-receipt',
          result_body: '{"verdict":"ok"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      },
    };

    const outcome = await runWorkflow({
      runRoot: join(runRootBase, 'runtime-evidence'),
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('85858585-8585-4585-8585-858585858585'),
      goal: 'prove model effort selection reaches dispatch evidence',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 9, 0, 0)),
      dispatcher,
      selectionConfigLayers: layeredConfigs(),
    });

    const started = outcome.events.find(
      (event) => event.kind === 'dispatch.started' && event.step_id === 'synthesize-step',
    );
    if (started === undefined || started.kind !== 'dispatch.started') {
      throw new Error('expected synthesize-step dispatch.started event');
    }
    expect(started.resolved_selection).toEqual(EXPECTED_SYNTHESIZE_SELECTION);
    expect(dispatchInputs[0]?.resolvedSelection).toEqual(EXPECTED_SYNTHESIZE_SELECTION);
  });
});
