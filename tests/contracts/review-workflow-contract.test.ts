import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkWorkflowKindCanonicalPolicy } from '../../scripts/policy/workflow-kind-policy.mjs';
import { Workflow } from '../../src/schemas/workflow.js';

const REVIEW_FIXTURE_PATH = join('.claude-plugin', 'skills', 'review', 'circuit.json');
const ARTIFACTS_PATH = join('specs', 'artifacts.json');

function loadReviewFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(REVIEW_FIXTURE_PATH, 'utf-8')) as Record<string, unknown>;
}

describe('review workflow contract fixture', () => {
  it('parses the live review fixture under the base Workflow schema', () => {
    const parsed = Workflow.safeParse(loadReviewFixture());
    expect(parsed.success).toBe(true);
  });

  it('satisfies the review canonical phase policy and REVIEW-I1 ordering check', () => {
    const result = checkWorkflowKindCanonicalPolicy(loadReviewFixture());
    expect(result.kind).toBe('green');
    expect(result.detail).toMatch(/review: canonical set/);
    expect(result.detail).toMatch(/frame, analyze, close/);
  });

  it('binds the analyze dispatch shape pinned for P2.9 review', () => {
    const fixture = loadReviewFixture();
    const steps = fixture.steps as Array<Record<string, unknown>>;
    const auditStep = steps.find((step) => step.id === 'audit-step');
    expect(auditStep?.kind).toBe('dispatch');
    expect(auditStep?.executor).toBe('worker');
    expect(auditStep?.role).toBe('reviewer');

    const writes = auditStep?.writes as Record<string, unknown> | undefined;
    expect(writes?.result).toBe('phases/analyze/review-raw-findings.json');
    const gate = auditStep?.gate as
      | { source?: { kind?: unknown; ref?: unknown }; pass?: unknown }
      | undefined;
    expect(gate?.source?.kind).toBe('dispatch_result');
    expect(gate?.source?.ref).toBe('result');
    expect(gate?.pass).toEqual(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
  });

  it('binds the close step to the registered review.result artifact', () => {
    const fixture = loadReviewFixture();
    const steps = fixture.steps as Array<Record<string, unknown>>;
    const verdictStep = steps.find((step) => step.id === 'verdict-step');
    expect(verdictStep?.kind).toBe('synthesis');
    expect(verdictStep?.executor).toBe('orchestrator');

    const writes = verdictStep?.writes as
      | { artifact?: { path?: unknown; schema?: unknown } }
      | undefined;
    expect(writes?.artifact?.path).toBe('artifacts/review-result.json');
    expect(writes?.artifact?.schema).toBe('review.result@v1');
  });

  it('homes review.result on src/workflows/review/contract.md in the authority graph', () => {
    const graph = JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf-8')) as {
      artifacts: Array<{ id: string; contract?: string; pending_rehome?: unknown }>;
    };
    const row = graph.artifacts.find((artifact) => artifact.id === 'review.result');
    expect(row, 'review.result artifact row must exist').toBeDefined();
    expect(row?.contract).toBe('src/workflows/review/contract.md');
    expect(row?.pending_rehome).toBeUndefined();
  });
});
