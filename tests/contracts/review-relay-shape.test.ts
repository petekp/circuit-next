import { describe, expect, it } from 'vitest';

import { ReviewRelayResult } from '../../src/flows/review/reports.js';
import { RelayStep } from '../../src/schemas/step.js';

const REVIEW_ANALYZE_DISPATCH_STEP = {
  id: 'audit-step',
  title: 'Independent Audit',
  protocol: 'review-audit@v1',
  reads: ['reports/review-intake.json'],
  routes: { pass: 'verdict-step' },
  executor: 'worker',
  kind: 'relay',
  role: 'reviewer',
  writes: {
    request: 'reports/relay/review.request.json',
    receipt: 'reports/relay/review.receipt.txt',
    result: 'stages/analyze/review-raw-findings.json',
  },
  check: {
    kind: 'result_verdict',
    source: { kind: 'relay_result', ref: 'result' },
    pass: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'],
  },
} as const;

function assertReviewAnalyzeRelayShape(step: typeof REVIEW_ANALYZE_DISPATCH_STEP) {
  expect(typeof step.writes.result).toBe('string');
  expect(step.writes.result.length).toBeGreaterThan(0);
  expect(step.writes.result).toBe('stages/analyze/review-raw-findings.json');
  expect(step.reads).toEqual(['reports/review-intake.json']);
  expect(step.check.source.kind).toBe('relay_result');
  expect(step.check.source.ref).toBe('result');
  expect(step.check.pass).toEqual(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
}

describe('review analyze relay shape', () => {
  it('pins writes.result, check source literals, check pass vocabulary, and connector JSON response shape', () => {
    assertReviewAnalyzeRelayShape(REVIEW_ANALYZE_DISPATCH_STEP);
    const parsedStep = RelayStep.parse(REVIEW_ANALYZE_DISPATCH_STEP);

    expect(parsedStep.writes.result).toBe('stages/analyze/review-raw-findings.json');
    expect(parsedStep.check.source.kind).toBe('relay_result');
    expect(parsedStep.check.source.ref).toBe('result');
    expect(parsedStep.check.pass).toEqual(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);

    const parsedResult = ReviewRelayResult.parse({
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
    expect(ReviewRelayResult.safeParse({ verdict: 'CLEAN', findings: [] }).success).toBe(false);
    expect(
      ReviewRelayResult.safeParse({
        verdict: 'NO_ISSUES_FOUND',
        findings: parsedResult.findings,
      }).success,
    ).toBe(false);
    expect(ReviewRelayResult.parse({ verdict: 'NO_ISSUES_FOUND', findings: [] })).toEqual({
      verdict: 'NO_ISSUES_FOUND',
      findings: [],
    });
  });

  it('literal checks reject source/check/pass drift even if the base RelayStep schema later widens', () => {
    expect(() =>
      assertReviewAnalyzeRelayShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        writes: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.writes,
          report: { path: 'reports/review-result.json', schema: 'review.result@v1' },
        },
        check: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.check,
          source: { kind: 'report', ref: 'report' },
        },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();

    expect(() =>
      assertReviewAnalyzeRelayShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        writes: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.writes,
          report: { path: 'reports/review-result.json', schema: 'review.result@v1' },
        },
        check: {
          ...REVIEW_ANALYZE_DISPATCH_STEP.check,
          source: { kind: 'relay_result', ref: 'report' },
        },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();

    expect(() =>
      assertReviewAnalyzeRelayShape({
        ...REVIEW_ANALYZE_DISPATCH_STEP,
        check: { ...REVIEW_ANALYZE_DISPATCH_STEP.check, pass: ['CLEAN'] },
      } as unknown as typeof REVIEW_ANALYZE_DISPATCH_STEP),
    ).toThrow();
  });
});
