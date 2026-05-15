// Self-test the helper that real contract tests use. Keep this small so test
// infrastructure does not become a second product surface.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { expectSchemaRejects } from './failure-message.js';

const RULE = 'TEST-I1: helper module behaves as documented';

function captureFailure(fn: () => void): { readonly message: string } {
  try {
    fn();
  } catch (err) {
    if (err instanceof Error) return { message: err.message };
    return { message: String(err) };
  }
  throw new Error('expected the captured function to throw');
}

describe('expectSchemaRejects', () => {
  const schema = z.object({ name: z.string() }).strict();

  it('passes silently when the schema rejects', () => {
    expectSchemaRejects(schema, { name: 42 }, RULE);
  });

  it('fails with a rule-tagged message when the schema accepts', () => {
    const { message } = captureFailure(() => {
      expectSchemaRejects(schema, { name: 'ok' }, RULE);
    });
    expect(message).toContain(RULE);
    expect(message).toContain('expected schema parse to fail');
  });
});
