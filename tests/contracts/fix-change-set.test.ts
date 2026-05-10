// Schema-level tests for fix.change-set@v1 — focuses on the verdict rules
// (status ↔ overall_status, derived sets, fail-vs-pass invariants). Writer-
// level behavior (subtracting pre-fix dirt, HEAD-diverged failure mode) is
// covered in tests/runtime/fix-change-set-writer.test.ts.

import { describe, expect, it } from 'vitest';
import { FixBaselineSnapshot, FixChangeSet } from '../../src/flows/fix/reports.js';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const ONE_SHA = '1111111111111111111111111111111111111111';

describe('FixBaselineSnapshot schema', () => {
  it('accepts an empty working tree', () => {
    const snapshot = FixBaselineSnapshot.parse({
      overall_status: 'passed',
      head_sha: ZERO_SHA,
      working_tree_porcelain: [],
    });
    expect(snapshot.head_sha).toBe(ZERO_SHA);
    expect(snapshot.working_tree_porcelain).toEqual([]);
  });

  it('accepts a dirty working tree with porcelain entries', () => {
    const snapshot = FixBaselineSnapshot.parse({
      overall_status: 'passed',
      head_sha: ZERO_SHA,
      working_tree_porcelain: [' M src/example.ts', '?? notes.txt'],
    });
    expect(snapshot.working_tree_porcelain).toHaveLength(2);
  });

  it('rejects a non-passed overall_status', () => {
    expect(
      FixBaselineSnapshot.safeParse({
        overall_status: 'failed',
        head_sha: ZERO_SHA,
        working_tree_porcelain: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty head_sha', () => {
    expect(
      FixBaselineSnapshot.safeParse({
        overall_status: 'passed',
        head_sha: '',
        working_tree_porcelain: [],
      }).success,
    ).toBe(false);
  });
});

describe('FixChangeSet schema', () => {
  it('accepts a clean pass when declared matches observed exactly', () => {
    const changeSet = FixChangeSet.parse({
      status: 'pass',
      overall_status: 'passed',
      baseline_head_sha: ZERO_SHA,
      head_sha: ZERO_SHA,
      declared: ['src/example.ts'],
      observed: ['src/example.ts'],
      undeclared_extras: [],
      missing_declared: [],
    });
    expect(changeSet.status).toBe('pass');
  });

  it('accepts a fail with undeclared extras and a reason', () => {
    const changeSet = FixChangeSet.parse({
      status: 'fail',
      overall_status: 'failed',
      reason: 'Touched files outside the declared scope.',
      baseline_head_sha: ZERO_SHA,
      head_sha: ZERO_SHA,
      declared: ['src/example.ts'],
      observed: ['src/example.ts', 'src/extra.ts'],
      undeclared_extras: ['src/extra.ts'],
      missing_declared: [],
    });
    expect(changeSet.undeclared_extras).toEqual(['src/extra.ts']);
  });

  it('rejects status pass when there are undeclared extras', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'pass',
        overall_status: 'passed',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/example.ts'],
        observed: ['src/example.ts', 'src/extra.ts'],
        undeclared_extras: ['src/extra.ts'],
        missing_declared: [],
      }).success,
    ).toBe(false);
  });

  it('rejects status pass when a declared file is missing from observed', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'pass',
        overall_status: 'passed',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/a.ts', 'src/b.ts'],
        observed: ['src/a.ts'],
        undeclared_extras: [],
        missing_declared: ['src/b.ts'],
      }).success,
    ).toBe(false);
  });

  it('rejects status fail when the sets are clean', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'fail',
        overall_status: 'failed',
        reason: 'should not happen',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/example.ts'],
        observed: ['src/example.ts'],
        undeclared_extras: [],
        missing_declared: [],
      }).success,
    ).toBe(false);
  });

  it('rejects overall_status that contradicts status', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'pass',
        overall_status: 'failed',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/example.ts'],
        observed: ['src/example.ts'],
        undeclared_extras: [],
        missing_declared: [],
      }).success,
    ).toBe(false);
    expect(
      FixChangeSet.safeParse({
        status: 'fail',
        overall_status: 'passed',
        reason: 'mismatch',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/a.ts'],
        observed: [],
        undeclared_extras: [],
        missing_declared: ['src/a.ts'],
      }).success,
    ).toBe(false);
  });

  it('requires undeclared_extras to equal observed minus declared', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'fail',
        overall_status: 'failed',
        reason: 'extras computed wrong',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/a.ts'],
        observed: ['src/a.ts', 'src/b.ts'],
        // src/b.ts is the undeclared extra; this test omits it incorrectly.
        undeclared_extras: [],
        missing_declared: [],
      }).success,
    ).toBe(false);
  });

  it('requires missing_declared to equal declared minus observed', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'fail',
        overall_status: 'failed',
        reason: 'missing computed wrong',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/a.ts', 'src/b.ts'],
        observed: ['src/a.ts'],
        undeclared_extras: [],
        // src/b.ts is missing; this test omits it incorrectly.
        missing_declared: [],
      }).success,
    ).toBe(false);
  });

  it('requires a reason when status is fail', () => {
    expect(
      FixChangeSet.safeParse({
        status: 'fail',
        overall_status: 'failed',
        baseline_head_sha: ZERO_SHA,
        head_sha: ZERO_SHA,
        declared: ['src/a.ts'],
        observed: [],
        undeclared_extras: [],
        missing_declared: ['src/a.ts'],
      }).success,
    ).toBe(false);
  });

  it('records HEAD divergence in the head_sha vs baseline_head_sha fields', () => {
    // HEAD divergence is a fail signal even when the sets happen to align —
    // the writer is responsible for setting status='fail' with a divergence
    // reason. The schema only enforces consistency between the verdict
    // (status/overall_status) and the set differences; it does not police
    // baseline_head_sha vs head_sha equality, since a "fail" verdict can be
    // legitimately driven by either set divergence or HEAD movement.
    const changeSet = FixChangeSet.parse({
      status: 'fail',
      overall_status: 'failed',
      reason: 'HEAD moved during the fix run.',
      baseline_head_sha: ZERO_SHA,
      head_sha: ONE_SHA,
      declared: ['src/a.ts'],
      observed: [],
      undeclared_extras: [],
      missing_declared: ['src/a.ts'],
    });
    expect(changeSet.baseline_head_sha).toBe(ZERO_SHA);
    expect(changeSet.head_sha).toBe(ONE_SHA);
  });
});
