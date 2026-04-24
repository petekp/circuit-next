import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
import { resolveRunRelative } from '../../src/runtime/run-relative-path.js';
import { type DispatchFn, type SynthesisWriterFn, runDogfood } from '../../src/runtime/runner.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'review', 'circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
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
      'review-runtime-wiring test runs the live review fixture with a stub dispatcher and an injected synthesis writer, then parses review.result@v1',
    alternate_framing:
      'widen the generic synthesis writer now — rejected because the signed P2.9 plan only budgets a test seam for this slice and leaves workflow-specific synthesis registration as follow-on work',
  };
}

function dispatcherWith(result: ReviewDispatchResult): DispatchFn {
  const body = JSON.stringify(result);
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      expect(input.prompt).toContain('Accepted verdicts: NO_ISSUES_FOUND, ISSUES_FOUND');
      return {
        request_payload: input.prompt,
        receipt_id: `stub-receipt-review-${result.verdict}`,
        result_body: body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function writeJson(runRoot: string, path: string, body: unknown): void {
  const abs = resolveRunRelative(runRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function injectedReviewSynthesisWriter(): SynthesisWriterFn {
  // Test seam only: this proves the review workflow is wireable once a
  // workflow-specific synthesis writer exists. It does not change the
  // production default placeholder writer in src/runtime/runner.ts.
  return ({ runRoot, step, goal }) => {
    if (step.id === 'intake-step') {
      writeJson(runRoot, step.writes.artifact.path, { scope: goal });
      return;
    }

    if (step.id !== 'verdict-step') {
      const body = Object.fromEntries(
        step.gate.required.map((section) => [section, `<${step.id}-placeholder-${section}>`]),
      );
      writeJson(runRoot, step.writes.artifact.path, body);
      return;
    }

    const dispatchRaw = readFileSync(
      resolveRunRelative(runRoot, 'phases/analyze/review-raw-findings.json'),
      'utf8',
    );
    const dispatchResult = ReviewDispatchResult.parse(JSON.parse(dispatchRaw));
    const artifact = ReviewResult.parse({
      scope: goal,
      findings: dispatchResult.findings,
      verdict: computeReviewVerdict(dispatchResult.findings),
    });
    writeJson(runRoot, step.writes.artifact.path, artifact);
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

describe('P2.9 review runtime wiring - injected synthesis writer boundary', () => {
  it('leaves the default synthesis writer placeholder-only when no injected writer is provided', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'default-placeholder');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000000'),
      goal: 'Review scope without the injected synthesis writer',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      dispatcher: dispatcherWith({ verdict: 'NO_ISSUES_FOUND', findings: [] }),
    });

    expect(outcome.result.outcome).toBe('complete');

    const artifactPath = join(runRoot, 'artifacts', 'review-result.json');
    expect(existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    expect(artifact).toEqual({
      scope: '<verdict-step-placeholder-scope>',
      findings: '<verdict-step-placeholder-findings>',
      verdict: '<verdict-step-placeholder-verdict>',
    });
    expect(ReviewResult.safeParse(artifact).success).toBe(false);
  });

  it.each(CASES)(
    'runs the live review fixture end-to-end for $name',
    async ({ name, runId, dispatch, expectedVerdict }) => {
      const { workflow, bytes } = loadFixture();
      const runRoot = join(runRootBase, name.replaceAll(' ', '-'));
      const goal = `Review scope for ${name}`;

      const outcome = await runDogfood({
        runRoot,
        workflow,
        workflowBytes: bytes,
        runId: RunId.parse(runId),
        goal,
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
        dispatcher: dispatcherWith(dispatch),
        synthesisWriter: injectedReviewSynthesisWriter(),
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
