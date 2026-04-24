import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, type DispatchInput, runDogfood } from '../../src/runtime/runner.js';
import {
  ExploreAnalysis,
  ExploreBrief,
  ExploreSynthesis,
} from '../../src/schemas/artifacts/explore.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const FIXTURE_PATH = resolve('.claude-plugin/skills/explore/circuit.json');

function loadFixture(mutator?: (raw: { steps: Array<{ id: string; reads: string[] }> }) => void): {
  workflow: Workflow;
  bytes: Buffer;
} {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: { steps: Array<{ id: string; reads: string[] }> } = JSON.parse(bytes.toString('utf8'));
  mutator?.(raw);
  const mutated = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes: mutated };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'explore frame/analyze artifacts have authority rows but no typed runtime output',
    acceptance_evidence:
      'default runDogfood explore path writes explore.brief@v1 and explore.analysis@v1 artifacts that parse through their schemas',
    alternate_framing:
      'jump straight to all five explore artifact schemas — rejected because dispatch-produced synthesis/review and close aggregation need separate payload design',
  };
}

function stubDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
      if (input.prompt.includes('Step: synthesize-step')) {
        expect(input.prompt).toContain('"recommendation"');
        expect(input.prompt).toContain('success_condition_alignment');
        expect(input.prompt).toContain('supporting_aspects');
        expect(input.prompt).toContain('Do not include extra top-level keys');
        expect(input.prompt).toContain(
          'explore.synthesis@v1 before writing artifacts/synthesis.json',
        );
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-synthesis',
          result_body: JSON.stringify({
            verdict: 'accept',
            subject: 'Map the next typed explore artifact slice',
            recommendation: 'Continue with the next typed artifact boundary',
            success_condition_alignment: 'The synthesis names the next useful action',
            supporting_aspects: [
              {
                aspect: 'task-framing',
                contribution: 'The brief and analysis identify the artifact boundary',
              },
            ],
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      const verdict = input.prompt.includes('Step: review-step')
        ? 'accept-with-fold-ins'
        : 'accept';
      return {
        request_payload: input.prompt,
        receipt_id: `stub-${verdict}`,
        result_body: JSON.stringify({ verdict }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function extraKeySynthesisDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-extra',
      result_body: JSON.stringify({
        verdict: 'accept',
        subject: 'Reject extra synthesis fields',
        recommendation: 'Keep the synthesis artifact strict',
        success_condition_alignment: 'The artifact shape remains auditable',
        supporting_aspects: [
          {
            aspect: 'strictness',
            contribution: 'Unknown fields must not pass through to downstream readers',
          },
        ],
        smuggled: true,
      }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function incompleteSynthesisDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-incomplete',
      result_body: JSON.stringify({ verdict: 'accept' }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-explore-artifacts-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('P2.10a — default explore artifact writer', () => {
  it('writes schema-valid explore.brief and explore.analysis artifacts', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'typed-explore-artifacts');
    const goal = 'Map the next typed explore artifact slice';

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('89000000-0000-0000-0000-000000000000'),
      goal,
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 16, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('complete');

    const brief = ExploreBrief.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'brief.json'), 'utf8')),
    );
    expect(brief.subject).toBe(goal);
    expect(brief.task).toBe(goal);
    expect(brief.success_condition).toContain(goal);

    const analysis = ExploreAnalysis.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'analysis.json'), 'utf8')),
    );
    expect(analysis.subject).toBe(goal);
    expect(analysis.aspects).toHaveLength(1);
    expect(analysis.aspects[0]?.evidence[0]?.source).toBe('artifacts/brief.json');

    const synthesis = ExploreSynthesis.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'synthesis.json'), 'utf8')),
    );
    expect(synthesis.verdict).toBe('accept');
    expect(synthesis.recommendation).toContain('artifact');
  });

  it('locates the explore.brief dependency by path rather than read position', async () => {
    const { workflow, bytes } = loadFixture((raw) => {
      const analyze = raw.steps.find((step) => step.id === 'analyze-step');
      if (analyze === undefined) throw new Error('analyze-step not found');
      analyze.reads = ['artifacts/extra-context.json', ...analyze.reads];
    });
    const runRoot = join(runRootBase, 'reordered-analysis-reads');
    const goal = 'Keep analysis coupled to the brief dependency';

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('89000000-0000-0000-0000-000000000001'),
      goal,
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 16, 5, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('complete');

    const analysis = ExploreAnalysis.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'analysis.json'), 'utf8')),
    );
    expect(analysis.subject).toBe(goal);
    expect(analysis.aspects[0]?.evidence[0]?.source).toBe('artifacts/brief.json');
  });

  it('rejects an incomplete explore.synthesis dispatch result before writing the artifact', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'incomplete-synthesis');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('90000000-0000-0000-0000-000000000000'),
      goal: 'Reject incomplete synthesis payloads',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 17, 0, 0)),
      dispatcher: incompleteSynthesisDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.events.find((event) => event.kind === 'step.aborted')?.step_id).toBe(
      'synthesize-step',
    );
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'synthesize-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected synthesize gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.synthesis@v1/);
    expect(gate.reason).toMatch(/recommendation/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'synthesis.json'), 'utf8')).toThrow();
  });

  it('rejects an otherwise-valid explore.synthesis dispatch result with an extra key', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'extra-key-synthesis');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('90000000-0000-0000-0000-000000000001'),
      goal: 'Reject extra synthesis fields',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 17, 5, 0)),
      dispatcher: extraKeySynthesisDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'synthesize-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected synthesize gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.synthesis@v1/);
    expect(gate.reason).toMatch(/smuggled|Unrecognized key/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'synthesis.json'), 'utf8')).toThrow();
  });
});
