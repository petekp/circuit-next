import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, type DispatchInput, runWorkflow } from '../../src/runtime/runner.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';
import {
  ExploreAnalysis,
  ExploreBrief,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreSynthesis,
} from '../../src/workflows/explore/artifacts.js';

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
      'default runWorkflow explore path writes explore.brief@v1 and explore.analysis@v1 artifacts that parse through their schemas',
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
      if (input.prompt.includes('Step: review-step')) {
        expect(input.prompt).toContain('"overall_assessment"');
        expect(input.prompt).toContain('objections');
        expect(input.prompt).toContain('missed_angles');
        expect(input.prompt).toContain('Do not include extra top-level keys');
        expect(input.prompt).toContain(
          'explore.review-verdict@v1 before writing artifacts/review-verdict.json',
        );
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-review-verdict',
          result_body: JSON.stringify({
            verdict: 'accept-with-fold-ins',
            overall_assessment: 'The synthesis is usable with one follow-up note',
            objections: ['Clarify the next artifact boundary'],
            missed_angles: [],
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

function incompleteReviewDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
      if (input.prompt.includes('Step: synthesize-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-synthesis',
          result_body: JSON.stringify({
            verdict: 'accept',
            subject: 'Reject incomplete review payloads',
            recommendation: 'Keep review verdicts typed',
            success_condition_alignment: 'The synthesis lets review run',
            supporting_aspects: [
              {
                aspect: 'review-boundary',
                contribution: 'The review step receives a valid synthesis artifact',
              },
            ],
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-incomplete-review',
        result_body: JSON.stringify({ verdict: 'accept' }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function extraKeyReviewDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
      if (input.prompt.includes('Step: synthesize-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-synthesis',
          result_body: JSON.stringify({
            verdict: 'accept',
            subject: 'Reject extra review verdict fields',
            recommendation: 'Keep review verdicts strict',
            success_condition_alignment: 'The synthesis lets review run',
            supporting_aspects: [
              {
                aspect: 'review-strictness',
                contribution: 'The review step receives a valid synthesis artifact',
              },
            ],
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-extra-review',
        result_body: JSON.stringify({
          verdict: 'accept',
          overall_assessment: 'The synthesis is acceptable',
          objections: [],
          missed_angles: [],
          smuggled: true,
        }),
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

    const outcome = await runWorkflow({
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

    const reviewVerdict = ExploreReviewVerdict.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'review-verdict.json'), 'utf8')),
    );
    expect(reviewVerdict.verdict).toBe('accept-with-fold-ins');
    expect(reviewVerdict.objections).toHaveLength(1);

    const exploreResult = ExploreResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'explore-result.json'), 'utf8')),
    );
    expect(exploreResult.summary).toContain('Continue with the next typed artifact boundary');
    expect(exploreResult.verdict_snapshot).toEqual({
      synthesis_verdict: 'accept',
      review_verdict: 'accept-with-fold-ins',
      objection_count: 1,
      missed_angle_count: 0,
    });
    expect(exploreResult.artifact_pointers.map((pointer) => pointer.path)).toEqual([
      'artifacts/brief.json',
      'artifacts/analysis.json',
      'artifacts/synthesis.json',
      'artifacts/review-verdict.json',
    ]);
  });

  it('locates the explore.brief dependency by path rather than read position', async () => {
    const { workflow, bytes } = loadFixture((raw) => {
      const analyze = raw.steps.find((step) => step.id === 'analyze-step');
      if (analyze === undefined) throw new Error('analyze-step not found');
      analyze.reads = ['artifacts/extra-context.json', ...analyze.reads];
    });
    const runRoot = join(runRootBase, 'reordered-analysis-reads');
    const goal = 'Keep analysis coupled to the brief dependency';

    const outcome = await runWorkflow({
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

    const outcome = await runWorkflow({
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

    const outcome = await runWorkflow({
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

  it('rejects an incomplete explore.review-verdict dispatch result before writing the artifact', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'incomplete-review-verdict');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('91000000-0000-0000-0000-000000000000'),
      goal: 'Reject incomplete review verdict payloads',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 18, 0, 0)),
      dispatcher: incompleteReviewDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'review-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected review gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.review-verdict@v1/);
    expect(gate.reason).toMatch(/overall_assessment/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'review-verdict.json'), 'utf8')).toThrow();
  });

  it('rejects an otherwise-valid explore.review-verdict dispatch result with an extra key', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'extra-key-review-verdict');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('91000000-0000-0000-0000-000000000001'),
      goal: 'Reject extra review verdict fields',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 18, 5, 0)),
      dispatcher: extraKeyReviewDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'review-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected review gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.review-verdict@v1/);
    expect(gate.reason).toMatch(/smuggled|Unrecognized key/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'review-verdict.json'), 'utf8')).toThrow();
  });

  it('rejects close-step result aggregation when review-verdict is not an explicit read', async () => {
    const { workflow, bytes } = loadFixture((raw) => {
      const close = raw.steps.find((step) => step.id === 'close-step');
      if (close === undefined) throw new Error('close-step not found');
      close.reads = ['artifacts/brief.json', 'artifacts/synthesis.json'];
    });
    const runRoot = join(runRootBase, 'missing-close-read');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('93000000-0000-0000-0000-000000000000'),
      goal: 'Require close-step to read the review verdict',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'close-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected close gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.result@v1/);
    expect(gate.reason).toMatch(/artifacts\/review-verdict\.json/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'explore-result.json'), 'utf8')).toThrow();
  });

  it('rejects close-step result aggregation when synthesis is not an explicit read', async () => {
    const { workflow, bytes } = loadFixture((raw) => {
      const close = raw.steps.find((step) => step.id === 'close-step');
      if (close === undefined) throw new Error('close-step not found');
      close.reads = ['artifacts/brief.json', 'artifacts/review-verdict.json'];
    });
    const runRoot = join(runRootBase, 'missing-synthesis-close-read');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('93000000-0000-0000-0000-000000000002'),
      goal: 'Require close-step to read the synthesis',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 5, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'close-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected close gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.result@v1/);
    expect(gate.reason).toMatch(/artifacts\/synthesis\.json/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'explore-result.json'), 'utf8')).toThrow();
  });

  it('rejects close-step result aggregation when brief is not an explicit read', async () => {
    const { workflow, bytes } = loadFixture((raw) => {
      const close = raw.steps.find((step) => step.id === 'close-step');
      if (close === undefined) throw new Error('close-step not found');
      close.reads = ['artifacts/synthesis.json', 'artifacts/review-verdict.json'];
    });
    const runRoot = join(runRootBase, 'missing-brief-close-read');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('93000000-0000-0000-0000-000000000004'),
      goal: 'Require close-step to read the brief',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 10, 0)),
      dispatcher: stubDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const gate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'close-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected close gate event');
    expect(gate.outcome).toBe('fail');
    expect(gate.reason).toMatch(/explore\.result@v1/);
    expect(gate.reason).toMatch(/artifacts\/brief\.json/);
    expect(() => readFileSync(join(runRoot, 'artifacts', 'explore-result.json'), 'utf8')).toThrow();
  });
});
