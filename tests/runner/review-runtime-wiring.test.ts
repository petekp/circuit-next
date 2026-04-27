import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ReviewDispatchResult,
  type ReviewFinding,
  ReviewResult,
  type ReviewResultVerdict,
  computeReviewVerdict,
} from '../../src/schemas/artifacts/review.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'review', 'circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function loadFixtureWithRenamedAnalyzeResultPath(resultPath: string): {
  workflow: Workflow;
  bytes: Buffer;
} {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    steps: Array<{
      id: string;
      writes?: { result?: string };
      reads?: string[];
    }>;
  };
  for (const step of raw.steps) {
    if (step.id === 'audit-step' && step.writes !== undefined) {
      step.writes.result = resultPath;
    }
    if (step.id === 'verdict-step' && step.reads !== undefined) {
      step.reads = step.reads.map((path) =>
        path === 'phases/analyze/review-raw-findings.json' ? resultPath : path,
      );
    }
  }
  const bytes = Buffer.from(`${JSON.stringify(raw, null, 2)}\n`);
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'the review fixture could parse statically but fail to run through dispatch, verdict gating, and close artifact materialization',
    acceptance_evidence:
      'review-runtime-wiring test runs the live review fixture with a stub dispatcher and the default registered review synthesis writer, then parses review.result@v1',
    alternate_framing:
      'keep the injected writer as the only schema-valid path — rejected because P2.9 closed with per-workflow synthesis-writer registration as the named follow-on',
  };
}

function dispatcherWith(result: ReviewDispatchResult): DispatchFn {
  return dispatcherWithBody(JSON.stringify(result));
}

function dispatcherWithBody(body: string): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      expect(input.prompt).toContain('Accepted verdicts: NO_ISSUES_FOUND, ISSUES_FOUND');
      expect(input.prompt).toContain('"findings"');
      expect(input.prompt).toContain('"findings": []');
      expect(input.prompt).toContain('"severity": "<critical|high|low>"');
      expect(input.prompt).not.toContain('medium');
      expect(input.prompt).not.toContain('info');
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-receipt-review',
        result_body: body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function eventLabel(event: { kind: string; step_id?: unknown }): string {
  return typeof event.step_id === 'string' ? `${event.kind}:${event.step_id}` : event.kind;
}

let runRootBase: string;

const CASES: Array<{
  name: string;
  runId: string;
  dispatch: ReviewDispatchResult;
  expectedVerdict: ReviewResultVerdict;
}> = [
  {
    name: 'clean review',
    runId: '79000000-0000-0000-0000-000000000001',
    dispatch: { verdict: 'NO_ISSUES_FOUND', findings: [] },
    expectedVerdict: 'CLEAN',
  },
  {
    name: 'review with high finding',
    runId: '79000000-0000-0000-0000-000000000002',
    dispatch: {
      verdict: 'ISSUES_FOUND',
      findings: [
        {
          severity: 'high',
          id: 'REVIEW-HIGH-1',
          text: 'High severity issue found by the reviewer.',
          file_refs: ['src/example.ts:12'],
        },
      ] satisfies ReviewFinding[],
    },
    expectedVerdict: 'ISSUES_FOUND',
  },
];

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-review-runtime-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('P2.9 follow-on - registered review synthesis writer', () => {
  it('writes schema-valid review.result with the default synthesis writer', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'default-registered-review-writer');
    const goal = 'Review scope with the default registered synthesis writer';

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000000'),
      goal,
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      dispatcher: dispatcherWith({ verdict: 'NO_ISSUES_FOUND', findings: [] }),
    });

    expect(outcome.result.outcome).toBe('complete');

    const artifactPath = join(runRoot, 'artifacts', 'review-result.json');
    expect(existsSync(artifactPath)).toBe(true);
    const artifact = ReviewResult.parse(JSON.parse(readFileSync(artifactPath, 'utf8')));
    expect(artifact).toEqual({
      scope: goal,
      findings: [],
      verdict: 'CLEAN',
    });
  });

  it('derives the analyze result path from the live workflow graph', async () => {
    const renamedResultPath = 'phases/analyze/review-findings-renamed.json';
    const { workflow, bytes } = loadFixtureWithRenamedAnalyzeResultPath(renamedResultPath);
    const runRoot = join(runRootBase, 'renamed-analyze-result-path');
    const goal = 'Review scope with renamed analyze result path';
    const dispatch = {
      verdict: 'ISSUES_FOUND',
      findings: [
        {
          severity: 'low',
          id: 'LOW-1',
          text: 'Low severity issue found by the reviewer.',
          file_refs: ['src/example.ts:22'],
        },
      ],
    } satisfies ReviewDispatchResult;

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000003'),
      goal,
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      dispatcher: dispatcherWith(dispatch),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runRoot, renamedResultPath))).toBe(true);
    expect(existsSync(join(runRoot, 'phases', 'analyze', 'review-raw-findings.json'))).toBe(false);

    const artifact = ReviewResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'review-result.json'), 'utf8')),
    );
    expect(artifact.scope).toBe(goal);
    expect(artifact.findings).toEqual(dispatch.findings);
    expect(artifact.verdict).toBe('CLEAN');
  });

  it('aborts instead of throwing when the admitted dispatch result is not review-shaped', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'bad-review-dispatch-shape');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000004'),
      goal: 'Review scope with malformed admitted dispatch body',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      dispatcher: dispatcherWithBody('{"verdict":"NO_ISSUES_FOUND","findings":"not-an-array"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain(
      "synthesis step 'verdict-step': artifact writer failed",
    );
    expect(existsSync(join(runRoot, 'artifacts', 'review-result.json'))).toBe(false);

    const verdictGate = outcome.events.find(
      (event) => event.kind === 'gate.evaluated' && event.step_id === 'verdict-step',
    );
    if (verdictGate?.kind !== 'gate.evaluated') throw new Error('expected verdict gate event');
    expect(verdictGate.gate_kind).toBe('schema_sections');
    expect(verdictGate.outcome).toBe('fail');

    expect(outcome.events.map(eventLabel)).toEqual([
      'run.bootstrapped',
      'step.entered:intake-step',
      'step.artifact_written:intake-step',
      'gate.evaluated:intake-step',
      'step.completed:intake-step',
      'step.entered:audit-step',
      'dispatch.started:audit-step',
      'dispatch.request:audit-step',
      'dispatch.receipt:audit-step',
      'dispatch.result:audit-step',
      'dispatch.completed:audit-step',
      'gate.evaluated:audit-step',
      'step.completed:audit-step',
      'step.entered:verdict-step',
      'gate.evaluated:verdict-step',
      'step.aborted:verdict-step',
      'run.closed',
    ]);
  });

  it.each(CASES)(
    'runs the live review fixture end-to-end for $name',
    async ({ name, runId, dispatch, expectedVerdict }) => {
      const { workflow, bytes } = loadFixture();
      const runRoot = join(runRootBase, name.replaceAll(' ', '-'));
      const goal = `Review scope for ${name}`;

      const outcome = await runWorkflow({
        runRoot,
        workflow,
        workflowBytes: bytes,
        runId: RunId.parse(runId),
        goal,
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
        dispatcher: dispatcherWith(dispatch),
      });

      expect(outcome.result.outcome).toBe('complete');

      const rawDispatchPath = join(runRoot, 'phases', 'analyze', 'review-raw-findings.json');
      expect(existsSync(rawDispatchPath)).toBe(true);
      expect(ReviewDispatchResult.parse(JSON.parse(readFileSync(rawDispatchPath, 'utf8')))).toEqual(
        dispatch,
      );

      const artifactPath = join(runRoot, 'artifacts', 'review-result.json');
      expect(existsSync(artifactPath)).toBe(true);
      const artifact = ReviewResult.parse(JSON.parse(readFileSync(artifactPath, 'utf8')));
      expect(artifact.scope).toBe(goal);
      expect(artifact.findings).toEqual(dispatch.findings);
      expect(artifact.verdict).toBe(expectedVerdict);
      expect(artifact.verdict).toBe(computeReviewVerdict(artifact.findings));

      const dispatchCompleted = outcome.events.find((event) => event.kind === 'dispatch.completed');
      if (dispatchCompleted?.kind !== 'dispatch.completed') {
        throw new Error('expected dispatch.completed');
      }
      expect(dispatchCompleted.verdict).toBe(dispatch.verdict);

      const reviewGate = outcome.events.find(
        (event) => event.kind === 'gate.evaluated' && event.step_id === 'audit-step',
      );
      if (reviewGate?.kind !== 'gate.evaluated') {
        throw new Error('expected review gate.evaluated event');
      }
      expect(reviewGate.gate_kind).toBe('result_verdict');
      expect(reviewGate.outcome).toBe('pass');

      // The analyze phase is a dispatch phase, so its durable artifact
      // evidence is dispatch.result rather than step.artifact_written.
      // The sequence below proves frame -> analyze -> close execution
      // and the expected event ordering for each phase.
      expect(outcome.events.map(eventLabel)).toEqual([
        'run.bootstrapped',
        'step.entered:intake-step',
        'step.artifact_written:intake-step',
        'gate.evaluated:intake-step',
        'step.completed:intake-step',
        'step.entered:audit-step',
        'dispatch.started:audit-step',
        'dispatch.request:audit-step',
        'dispatch.receipt:audit-step',
        'dispatch.result:audit-step',
        'dispatch.completed:audit-step',
        'gate.evaluated:audit-step',
        'step.completed:audit-step',
        'step.entered:verdict-step',
        'step.artifact_written:verdict-step',
        'gate.evaluated:verdict-step',
        'step.completed:verdict-step',
        'run.closed',
      ]);
    },
  );
});
