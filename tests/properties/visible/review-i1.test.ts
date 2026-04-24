import { describe, expect, it } from 'vitest';

import {
  checkReviewIdentitySeparationPolicy,
  checkWorkflowKindCanonicalPolicy,
} from '../../../scripts/policy/workflow-kind-policy.mjs';

type StepStub = Record<string, unknown>;

function reviewPolicyPayload(steps: StepStub[]): Record<string, unknown> {
  return {
    schema_version: '2',
    id: 'review',
    phases: [
      { title: 'Intake', canonical: 'frame', steps: ['intake-step'] },
      { title: 'Independent Audit', canonical: 'analyze', steps: ['audit-step'] },
      { title: 'Verdict', canonical: 'close', steps: ['verdict-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan', 'act', 'verify', 'review'],
      rationale: 'property payload for review identity separation policy.',
    },
    steps,
  };
}

function fillerStep(index: number): StepStub {
  return { id: `filler-${index}`, kind: 'synthesis', writes: { artifact: {} } };
}

function reviewResultArtifact() {
  return { path: 'artifacts/review-result.json', schema: 'review.result@v1' };
}

function validSteps(prefixCount: number, middleCount: number, suffixCount: number): StepStub[] {
  return [
    ...Array.from({ length: prefixCount }, (_, i) => fillerStep(i)),
    { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
    { id: 'audit-step', kind: 'dispatch', role: 'reviewer' },
    ...Array.from({ length: middleCount }, (_, i) => fillerStep(prefixCount + i)),
    { id: 'verdict-step', kind: 'synthesis', writes: { artifact: reviewResultArtifact() } },
    ...Array.from({ length: suffixCount }, (_, i) => fillerStep(prefixCount + middleCount + i)),
  ];
}

describe('REVIEW-I1 structural ordering property', () => {
  it('accepts only review payloads whose close artifact writer is preceded by an analyze reviewer dispatch', () => {
    for (let prefix = 0; prefix < 4; prefix++) {
      for (let middle = 0; middle < 4; middle++) {
        for (let suffix = 0; suffix < 4; suffix++) {
          const payload = reviewPolicyPayload(validSteps(prefix, middle, suffix));
          expect(checkReviewIdentitySeparationPolicy(payload).ok).toBe(true);
          expect(checkWorkflowKindCanonicalPolicy(payload).kind).toBe('green');
        }
      }
    }

    const closeBeforeReviewer = reviewPolicyPayload([
      { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
      {
        id: 'verdict-step',
        kind: 'synthesis',
        writes: { artifact: reviewResultArtifact() },
      },
      { id: 'audit-step', kind: 'dispatch', role: 'reviewer' },
    ]);
    expect(checkReviewIdentitySeparationPolicy(closeBeforeReviewer).ok).toBe(false);
    expect(checkWorkflowKindCanonicalPolicy(closeBeforeReviewer).kind).toBe('red');

    const wrongRole = reviewPolicyPayload([
      { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
      { id: 'audit-step', kind: 'dispatch', role: 'implementer' },
      {
        id: 'verdict-step',
        kind: 'synthesis',
        writes: { artifact: reviewResultArtifact() },
      },
    ]);
    expect(checkReviewIdentitySeparationPolicy(wrongRole).ok).toBe(false);
    expect(checkWorkflowKindCanonicalPolicy(wrongRole).kind).toBe('red');

    const wrongArtifact = reviewPolicyPayload([
      { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
      { id: 'audit-step', kind: 'dispatch', role: 'reviewer' },
      {
        id: 'verdict-step',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/not-review-result.json', schema: 'wrong.result@v1' },
        },
      },
    ]);
    expect(checkReviewIdentitySeparationPolicy(wrongArtifact).ok).toBe(false);
    expect(checkWorkflowKindCanonicalPolicy(wrongArtifact).kind).toBe('red');
  });
});
