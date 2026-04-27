// Proof that the dispatch shape-hint registry is workflow-agnostic.
//
// Mirrors tests/runner/synthesis-builder-registry.test.ts but for the
// dispatch shape-hint path. Verifies every registered schema returns
// its hint, unknown schemas miss the schema lookup, and the structural
// reviewer-role match fires when no schema match is available.
//
// Expected sets are DERIVED from src/workflows/catalog.ts so adding a
// new workflow's hint doesn't require this test to know about it. The
// invariant being checked is the round-trip: every hint declared in
// the catalog ends up in the registry, and vice versa.

import { describe, expect, it } from 'vitest';

import {
  findDispatchShapeHint,
  listRegisteredSchemaHints,
  listRegisteredStructuralHints,
} from '../../src/runtime/shape-hints/registry.js';
import type { DispatchStep } from '../../src/runtime/shape-hints/types.js';
import { workflowPackages } from '../../src/workflows/catalog.js';

const EXPECTED_SCHEMA_HINTS: readonly string[] = workflowPackages.flatMap((pkg) =>
  pkg.dispatchArtifacts.filter((a) => a.dispatchHint !== undefined).map((a) => a.schemaName),
);

const EXPECTED_STRUCTURAL_HINT_IDS: readonly string[] = workflowPackages.flatMap(
  (pkg) => pkg.structuralHints?.map((hint) => hint.id) ?? [],
);

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
  it('round-trips every catalog-declared schema hint through the registry', () => {
    // Floor: at least the seven hints landed before this refactor must
    // still be present. Prevents the derived-set test from passing
    // vacuously if some future catalog change were to drop every
    // dispatchHint.
    expect(EXPECTED_SCHEMA_HINTS.length).toBeGreaterThanOrEqual(7);

    const registered = listRegisteredSchemaHints().map((hint) => hint.schema);
    expect(
      [...registered].sort(),
      'registered schema hints must match the catalog set exactly (drift = a workflow added a hint without registering, or vice versa)',
    ).toEqual([...EXPECTED_SCHEMA_HINTS].sort());

    for (const schema of EXPECTED_SCHEMA_HINTS) {
      const instruction = findDispatchShapeHint(dispatchStepWithSchema(schema));
      expect(instruction, `expected hint for ${schema}`).toBeDefined();
      expect(instruction).toContain('Respond with a single raw JSON object');
      expect(instruction).toContain(schema);
    }
  });

  it('Sweep hints describe each Sweep dispatch artifact shape', () => {
    function requireHint(schema: string): string {
      const hint = findDispatchShapeHint(dispatchStepWithSchema(schema));
      if (hint === undefined) throw new Error(`expected dispatch shape hint for ${schema}`);
      return hint;
    }

    const analysis = requireHint('sweep.analysis@v1');
    expect(analysis).toContain('"candidates"');
    expect(analysis).toContain('"confidence"');
    expect(analysis).toContain('"risk"');

    const batch = requireHint('sweep.batch@v1');
    expect(batch).toContain('"items"');
    expect(batch).toContain('"candidate_id"');
    expect(batch).toContain('to_execute');

    const review = requireHint('sweep.review@v1');
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

  it('round-trips every catalog-declared structural hint id through the registry', () => {
    // Floor: at least one structural hint exists today (review's
    // standalone audit step). Prevents vacuous pass if all structural
    // hints were dropped from the catalog.
    expect(EXPECTED_STRUCTURAL_HINT_IDS.length).toBeGreaterThanOrEqual(1);

    const registered = listRegisteredStructuralHints().map((hint) => hint.id);
    expect(
      [...registered].sort(),
      'registered structural hints must match the catalog set exactly',
    ).toEqual([...EXPECTED_STRUCTURAL_HINT_IDS].sort());
  });
});
