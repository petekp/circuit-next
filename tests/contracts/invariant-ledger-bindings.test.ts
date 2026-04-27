// Invariant ledger binding-reference completeness — every
// `binding_refs[].path` in `specs/invariants.json` must resolve to a
// real file on disk.
//
// Why this matters: the ledger is meant to be agent truth. When it
// claims an invariant is `test-enforced` and points at a test file,
// that test must actually exist. A binding ref pointing at a
// non-existent file is silent drift — the ledger lies about
// enforcement, and downstream agents (or operators) believe coverage
// exists where it does not.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const INVARIANTS_PATH = 'specs/invariants.json';

interface BindingRef {
  readonly path: string;
  readonly kind: string;
}

interface Invariant {
  readonly id: string;
  readonly binding_refs?: readonly BindingRef[];
}

interface InvariantLedger {
  readonly invariants: readonly Invariant[];
}

describe('invariant ledger binding-reference completeness', () => {
  it('every binding_refs[].path resolves to a file on disk', () => {
    const ledger = JSON.parse(readFileSync(INVARIANTS_PATH, 'utf8')) as InvariantLedger;

    const allRefs = ledger.invariants.flatMap((inv) =>
      (inv.binding_refs ?? []).map((ref) => ({
        invariantId: inv.id,
        path: ref.path,
        kind: ref.kind,
      })),
    );

    // Anti-vacuity floor — invariants.json has dozens of invariants
    // each with at least one binding_ref. If discovery silently
    // returns empty (file moved, parse change, missing field), the
    // path-existence loop would pass vacuously. Guard against that.
    expect(
      allRefs.length,
      'invariant ledger walked unexpectedly few binding_refs — discovery loop is likely broken',
    ).toBeGreaterThan(50);

    const offenders = allRefs.filter((ref) => !existsSync(ref.path));

    expect(
      offenders,
      'invariants.json contains binding_refs[].path values that do not resolve to a real file — the ledger is lying about enforcement',
    ).toEqual([]);
  });
});
