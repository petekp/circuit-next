import { describe, expect, it } from 'vitest';

import { ReviewDispatchResult } from '../../src/workflows/review/artifacts.js';
import { DispatchStep } from '../../src/schemas/step.js';

const REVIEW_ANALYZE_DISPATCH_STEP = {
  id: 'audit-step',
  title: 'Independent Audit',
  protocol: 'review-audit@v1',
  reads: ['artifacts/review-intake.json'],
  routes: { pass: 'verdict-step' },
  executor: 'worker',
  kind: 'dispatch',
  role: 'reviewer',
  writes: {
    request: 'artifacts/dispatch/review.request.json',
    receipt: 'artifacts/dispatch/review.receipt.txt',
    result: 'phases/analyze/review-raw-findings.json',
  },
  gate: {
    kind: 'result_verdict',
    source: { kind: 'dispatch_result', ref: 'result' },
    pass: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'],
  },
} as const;

function assertReviewAnalyzeDispatchShape(step: typeof REVIEW_ANALYZE_DISPATCH_STEP) {
  expect(typeof step.writes.result).toBe('string');
  expect(step.writes.result.length).toBeGreaterThan(0);
  expect(step.writes.result).toBe('phases/analyze/review-raw-findings.json');
  expect(step.reads).toEqual(['artifacts/review-intake.json']);
  expect(step.gate.source.kind).toBe('dispatch_result');
  expect(step.gate.source.ref).toBe('result');
  expect(step.gate.pass).toEqual(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
}

describe('P2.9 review analyze dispatch shape', () => {
  it('pins writes.result, gate source literals, gate pass vocabulary, and adapter JSON response shape', () => {
    assertReviewAnalyzeDispatchShape(REVIEW_ANALYZE_DISPATCH_STEP);
    const parsedStep = DispatchStep.parse(REVIEW_ANALYZE_DISPATCH_STEP);

    expect(parsedStep.writes.result).toBe('phases/analyze/review-raw-findings.json');
    expect(parsedStep.gate.source.kind).toBe('dispatch_result');
    expect(parsedStep.gate.source.ref).toBe('result');
    expect(parsedStep.gate.pass).toEqual(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);

    const parsedResult = ReviewDispatchResult.parse({
      verdict: 'ISSUES_FOUND',
      findings: [
        {
          severity: 'high',
          id: 'finding-1',
          text: 'A concrete issue found during independent audit.',
          file_refs: ['src/example.ts'],
        },
      ],
    });
    expect(typeof parsedResult.verdict).toBe('string');
    expect(parsedResult.verdict).toBe('ISSUES_FOUND');
    expect(Array.isArray(parsedResult.findings)).toBe(true);
    expect(parsedResult.findings[0]?.severity).toBe('high');
    expect(ReviewDispatchResult.safeParse({ verdict: 'CLEAN', findings: [] }).success).toBe(false);
    expect(
      ReviewDispatchResult.safeParse({
        verdict: 'NO_ISSUES_FOUND',
        findings: parsedResult.findings,
      }).success,
    ).toBe(false);
    expect(ReviewDispatchResult.parse({ verdict: 'NO_ISSUES_FOUND', findings: [] })).toEqual({
      verdict: 'NO_ISSUES_FOUND',
      findings: [],
    });
  });

  it('literal checks reject source/gate/pass drift even if the base DispatchStep schema later widens', () => {
    expect(() =>
      assertReviewAnalyzeDispatchShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        writes: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.writes,
          artifact: { path: 'artifacts/review-result.json', schema: 'review.result@v1' },
        },
        gate: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.gate,
          source: { kind: 'artifact', ref: 'artifact' },
        },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();

    expect(() =>
      assertReviewAnalyzeDispatchShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        writes: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.writes,
          artifact: { path: 'artifacts/review-result.json', schema: 'review.result@v1' },
        },
        gate: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.gate,
          source: { kind: 'dispatch_result', ref: 'artifact' },
        },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();

    expect(() =>
      assertReviewAnalyzeDispatchShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        gate: { ...REVIEW_ANALYZE_DISPATCH_STEP.gate, pass: ['CLEAN'] },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();
  });
});
