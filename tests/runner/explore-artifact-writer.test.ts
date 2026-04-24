import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, type DispatchInput, runDogfood } from '../../src/runtime/runner.js';
import { ExploreAnalysis, ExploreBrief } from '../../src/schemas/artifacts/explore.js';
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
});
