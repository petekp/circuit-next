// Check discriminated-union schema — schema_sections vs
// checkpoint_selection vs result_verdict.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { Check } from '../../src/index.js';

describe('Check', () => {
  it('discriminates on kind', () => {
    expect(
      Check.safeParse({
        kind: 'schema_sections',
        source: { kind: 'report', ref: 'report' },
        required: ['Objective'],
      }).success,
    ).toBe(true);
    expect(
      Check.safeParse({
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue', 'revise'],
      }).success,
    ).toBe(true);
    expect(
      Check.safeParse({
        kind: 'magical',
        source: { kind: 'report', ref: 'x' },
        allow: ['y'],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown source.kind', () => {
    const bad = Check.safeParse({
      kind: 'schema_sections',
      source: { kind: 'bogus', ref: 'report' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects cross-kind source on SchemaSectionsCheck (kind-bound source)', () => {
    // A schema_sections check must carry an ReportSource; a
    // relay_result source would be a type-layer mismatch, proven here
    // at runtime via safeParse.
    const bad = Check.safeParse({
      kind: 'schema_sections',
      source: { kind: 'relay_result', ref: 'result' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });
});
