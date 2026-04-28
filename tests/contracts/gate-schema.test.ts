// Gate discriminated-union schema — schema_sections vs
// checkpoint_selection vs result_verdict.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { Gate } from '../../src/index.js';

describe('Gate', () => {
  it('discriminates on kind', () => {
    expect(
      Gate.safeParse({
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['Objective'],
      }).success,
    ).toBe(true);
    expect(
      Gate.safeParse({
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue', 'revise'],
      }).success,
    ).toBe(true);
    expect(
      Gate.safeParse({
        kind: 'magical',
        source: { kind: 'artifact', ref: 'x' },
        allow: ['y'],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown source.kind', () => {
    const bad = Gate.safeParse({
      kind: 'schema_sections',
      source: { kind: 'bogus', ref: 'artifact' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects cross-kind source on SchemaSectionsGate (kind-bound source)', () => {
    // A schema_sections gate must carry an ArtifactSource; a
    // dispatch_result source would be a type-layer mismatch, proven here
    // at runtime via safeParse.
    const bad = Gate.safeParse({
      kind: 'schema_sections',
      source: { kind: 'dispatch_result', ref: 'result' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });
});
