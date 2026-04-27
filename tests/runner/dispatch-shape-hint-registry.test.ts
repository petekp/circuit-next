// Proof that the dispatch shape-hint registry is workflow-agnostic.
//
// Mirrors tests/runner/synthesis-builder-registry.test.ts but for the
// dispatch shape-hint path. Verifies every registered schema returns
// its hint, unknown schemas miss the schema lookup, and the structural
// reviewer-role match fires when no schema match is available. If the
// runner ever regrows workflow-specific shape-hint knowledge, the
// registry asserts in this file are the safety net.

import { describe, expect, it } from 'vitest';

import {
  findDispatchShapeHint,
  listRegisteredSchemaHints,
  listRegisteredStructuralHints,
} from '../../src/runtime/shape-hints/registry.js';
import type { DispatchStep } from '../../src/runtime/shape-hints/types.js';

function dispatchStepWithSchema(schema: string): DispatchStep {
  return {
    id: 'test-step',
    title: 'test',
    protocol: 'test@v1',
    reads: [],
    routes: { pass: '@complete' },
    executor: 'orchestrator',
    kind: 'dispatch',
    role: 'implementer',
    writes: { artifact: { path: 'artifacts/test.json', schema } },
    gate: { pass: ['accept'] },
  } as unknown as DispatchStep;
}

function reviewerStructuralStep(): DispatchStep {
  return {
    id: 'audit-step',
    title: 'audit',
    protocol: 'review@v1',
    reads: [],
    routes: { pass: '@continue' },
    executor: 'orchestrator',
    kind: 'dispatch',
    role: 'reviewer',
    writes: {
      request_path: 'artifacts/dispatch/review.request.json',
      receipt_path: 'artifacts/dispatch/review.receipt.txt',
      result_path: 'artifacts/dispatch/review.result.json',
    },
    gate: { pass: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'] },
  } as unknown as DispatchStep;
}

describe('dispatch shape-hint registry', () => {
  it('exposes a hint for every schema named in the registry', () => {
    const expected = [
      'explore.synthesis@v1',
      'explore.review-verdict@v1',
      'build.implementation@v1',
      'build.review@v1',
      'sweep.analysis@v1',
      'sweep.batch@v1',
      'sweep.review@v1',
    ];
    const registered = listRegisteredSchemaHints().map((hint) => hint.schema);
    expect(registered.sort()).toEqual(expected.sort());
    for (const schema of expected) {
      const instruction = findDispatchShapeHint(dispatchStepWithSchema(schema));
      expect(instruction, `expected hint for ${schema}`).toBeDefined();
      expect(instruction).toContain('Respond with a single raw JSON object');
      expect(instruction).toContain(schema);
    }
  });

  it('Sweep hints describe each Sweep dispatch artifact shape', () => {
    const analysis = findDispatchShapeHint(dispatchStepWithSchema('sweep.analysis@v1'))!;
    expect(analysis).toContain('"candidates"');
    expect(analysis).toContain('"confidence"');
    expect(analysis).toContain('"risk"');

    const batch = findDispatchShapeHint(dispatchStepWithSchema('sweep.batch@v1'))!;
    expect(batch).toContain('"items"');
    expect(batch).toContain('"candidate_id"');
    expect(batch).toContain('to_execute');

    const review = findDispatchShapeHint(dispatchStepWithSchema('sweep.review@v1'))!;
    expect(review).toContain('"findings"');
    expect(review).toContain('clean');
    expect(review).toContain('critical-injections');
  });

  it('returns undefined when the schema is not registered and no structural hint matches', () => {
    expect(findDispatchShapeHint(dispatchStepWithSchema('unknown.schema@v1'))).toBeUndefined();
  });

  it('falls back to the structural reviewer-role hint for steps without a typed artifact', () => {
    const hint = findDispatchShapeHint(reviewerStructuralStep());
    expect(hint).toBeDefined();
    expect(hint).toContain('NO_ISSUES_FOUND');
    expect(hint).toContain('"findings"');
  });

  it('lists exactly one structural hint (the standalone review audit shape)', () => {
    const structural = listRegisteredStructuralHints();
    expect(structural).toHaveLength(1);
    expect(structural[0]?.id).toBe('review.dispatch-result@structural');
  });
});
