import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type ReviewFinding,
  ReviewRelayResult,
  ReviewResult,
  type ReviewResultVerdict,
  computeReviewVerdict,
} from '../../src/flows/review/reports.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';

import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'review', 'circuit.json');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function loadFixtureWithRenamedAnalyzeResultPath(resultPath: string): {
  flow: CompiledFlow;
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
        path === 'stages/analyze/review-raw-findings.json' ? resultPath : path,
      );
    }
  }
  const bytes = Buffer.from(`${JSON.stringify(raw, null, 2)}\n`);
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'the review fixture could parse statically but fail to run through relay, verdict gating, and close report materialization',
    acceptance_evidence:
      'review-runtime-wiring test runs the live review fixture with a stub relayer and the default registered review compose writer, then parses review.result@v1',
    alternate_framing:
      'keep the injected writer as the only schema-valid path — rejected because P2.9 closed with per-flow compose-writer registration as the named follow-on',
  };
}

function relayerWith(result: ReviewRelayResult): RelayFn {
  return relayerWithBody(JSON.stringify(result));
}

function relayerWithBody(body: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
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

function trace_entryLabel(trace_entry: { kind: string; step_id?: unknown }): string {
  return typeof trace_entry.step_id === 'string'
    ? `${trace_entry.kind}:${trace_entry.step_id}`
    : trace_entry.kind;
}

let runFolderBase: string;

const CASES: Array<{
  name: string;
  runId: string;
  relay: ReviewRelayResult;
  expectedVerdict: ReviewResultVerdict;
}> = [
  {
    name: 'clean review',
    runId: '79000000-0000-0000-0000-000000000001',
    relay: { verdict: 'NO_ISSUES_FOUND', findings: [] },
    expectedVerdict: 'CLEAN',
  },
  {
    name: 'review with high finding',
    runId: '79000000-0000-0000-0000-000000000002',
    relay: {
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
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-review-runtime-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('P2.9 follow-on - registered review compose writer', () => {
  it('writes schema-valid review.result with the default compose writer', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'default-registered-review-writer');
    const goal = 'Review scope with the default registered compose writer';

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000000'),
      goal,
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      relayer: relayerWith({ verdict: 'NO_ISSUES_FOUND', findings: [] }),
    });

    expect(outcome.result.outcome).toBe('complete');

    const reportPath = join(runFolder, 'reports', 'review-result.json');
    expect(existsSync(reportPath)).toBe(true);
    const report = ReviewResult.parse(JSON.parse(readFileSync(reportPath, 'utf8')));
    expect(report).toEqual({
      scope: goal,
      findings: [],
      verdict: 'CLEAN',
    });
  });

  it('derives the analyze result path from the live flow graph', async () => {
    const renamedResultPath = 'stages/analyze/review-findings-renamed.json';
    const { flow, bytes } = loadFixtureWithRenamedAnalyzeResultPath(renamedResultPath);
    const runFolder = join(runFolderBase, 'renamed-analyze-result-path');
    const goal = 'Review scope with renamed analyze result path';
    const relay = {
      verdict: 'ISSUES_FOUND',
      findings: [
        {
          severity: 'low',
          id: 'LOW-1',
          text: 'Low severity issue found by the reviewer.',
          file_refs: ['src/example.ts:22'],
        },
      ],
    } satisfies ReviewRelayResult;

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000003'),
      goal,
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      relayer: relayerWith(relay),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runFolder, renamedResultPath))).toBe(true);
    expect(existsSync(join(runFolder, 'stages', 'analyze', 'review-raw-findings.json'))).toBe(
      false,
    );

    const report = ReviewResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'review-result.json'), 'utf8')),
    );
    expect(report.scope).toBe(goal);
    expect(report.findings).toEqual(relay.findings);
    expect(report.verdict).toBe('CLEAN');
  });

  it('aborts instead of throwing when the admitted relay result is not review-shaped', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'bad-review-relay-shape');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('79000000-0000-0000-0000-000000000004'),
      goal: 'Review scope with malformed admitted relay body',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
      relayer: relayerWithBody('{"verdict":"NO_ISSUES_FOUND","findings":"not-an-array"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain("compose step 'verdict-step': report writer failed");
    expect(existsSync(join(runFolder, 'reports', 'review-result.json'))).toBe(false);

    const verdictCheck = outcome.trace_entrys.find(
      (trace_entry) =>
        trace_entry.kind === 'check.evaluated' && trace_entry.step_id === 'verdict-step',
    );
    if (verdictCheck?.kind !== 'check.evaluated')
      throw new Error('expected verdict check trace_entry');
    expect(verdictCheck.check_kind).toBe('schema_sections');
    expect(verdictCheck.outcome).toBe('fail');

    expect(outcome.trace_entrys.map(trace_entryLabel)).toEqual([
      'run.bootstrapped',
      'step.entered:intake-step',
      'step.report_written:intake-step',
      'check.evaluated:intake-step',
      'step.completed:intake-step',
      'step.entered:audit-step',
      'relay.started:audit-step',
      'relay.request:audit-step',
      'relay.receipt:audit-step',
      'relay.result:audit-step',
      'relay.completed:audit-step',
      'check.evaluated:audit-step',
      'step.completed:audit-step',
      'step.entered:verdict-step',
      'check.evaluated:verdict-step',
      'step.aborted:verdict-step',
      'run.closed',
    ]);
  });

  it.each(CASES)(
    'runs the live review fixture end-to-end for $name',
    async ({ name, runId, relay, expectedVerdict }) => {
      const { flow, bytes } = loadFixture();
      const runFolder = join(runFolderBase, name.replaceAll(' ', '-'));
      const goal = `Review scope for ${name}`;

      const outcome = await runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse(runId),
        goal,
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 14, 0, 0)),
        relayer: relayerWith(relay),
      });

      expect(outcome.result.outcome).toBe('complete');

      const rawRelayPath = join(runFolder, 'stages', 'analyze', 'review-raw-findings.json');
      expect(existsSync(rawRelayPath)).toBe(true);
      expect(ReviewRelayResult.parse(JSON.parse(readFileSync(rawRelayPath, 'utf8')))).toEqual(
        relay,
      );

      const reportPath = join(runFolder, 'reports', 'review-result.json');
      expect(existsSync(reportPath)).toBe(true);
      const report = ReviewResult.parse(JSON.parse(readFileSync(reportPath, 'utf8')));
      expect(report.scope).toBe(goal);
      expect(report.findings).toEqual(relay.findings);
      expect(report.verdict).toBe(expectedVerdict);
      expect(report.verdict).toBe(computeReviewVerdict(report.findings));

      const relayCompleted = outcome.trace_entrys.find(
        (trace_entry) => trace_entry.kind === 'relay.completed',
      );
      if (relayCompleted?.kind !== 'relay.completed') {
        throw new Error('expected relay.completed');
      }
      expect(relayCompleted.verdict).toBe(relay.verdict);

      const reviewCheck = outcome.trace_entrys.find(
        (trace_entry) =>
          trace_entry.kind === 'check.evaluated' && trace_entry.step_id === 'audit-step',
      );
      if (reviewCheck?.kind !== 'check.evaluated') {
        throw new Error('expected review check.evaluated trace_entry');
      }
      expect(reviewCheck.check_kind).toBe('result_verdict');
      expect(reviewCheck.outcome).toBe('pass');

      // The analyze stage is a relay stage, so its durable report
      // evidence is relay.result rather than step.report_written.
      // The sequence below proves frame -> analyze -> close execution
      // and the expected trace_entry ordering for each stage.
      expect(outcome.trace_entrys.map(trace_entryLabel)).toEqual([
        'run.bootstrapped',
        'step.entered:intake-step',
        'step.report_written:intake-step',
        'check.evaluated:intake-step',
        'step.completed:intake-step',
        'step.entered:audit-step',
        'relay.started:audit-step',
        'relay.request:audit-step',
        'relay.receipt:audit-step',
        'relay.result:audit-step',
        'relay.completed:audit-step',
        'check.evaluated:audit-step',
        'step.completed:audit-step',
        'step.entered:verdict-step',
        'step.report_written:verdict-step',
        'check.evaluated:verdict-step',
        'step.completed:verdict-step',
        'run.closed',
      ]);
    },
  );
});
