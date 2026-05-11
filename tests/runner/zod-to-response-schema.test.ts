import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { responseJsonSchemaFromZod } from '../../src/shared/zod-to-response-schema.js';

describe('responseJsonSchemaFromZod', () => {
  it('emits draft-07 JSON Schema for a simple object', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });
    const out = responseJsonSchemaFromZod(schema);
    expect(out.type).toBe('object');
    const properties = out.properties as Record<string, { type: string }>;
    expect(properties.name).toEqual({ type: 'string' });
    expect(properties.count).toEqual({ type: 'number' });
  });

  it('encodes enum values', () => {
    const schema = z.object({
      severity: z.enum(['low', 'medium', 'high']),
    });
    const out = responseJsonSchemaFromZod(schema);
    const properties = out.properties as Record<string, { type?: string; enum?: string[] }>;
    const severity = properties.severity;
    expect(severity).toBeDefined();
    expect(severity?.enum).toEqual(['low', 'medium', 'high']);
  });

  it('encodes literal values via const', () => {
    const schema = z.object({
      verdict: z.literal('accept'),
    });
    const out = responseJsonSchemaFromZod(schema);
    const properties = out.properties as Record<
      string,
      { const?: string; type?: string; enum?: string[] } | undefined
    >;
    const verdict = properties.verdict;
    expect(verdict).toBeDefined();
    // zod-to-json-schema emits either `const` or `enum: [value]` depending on
    // version. Accept either as long as the value is 'accept'.
    if (verdict?.const !== undefined) {
      expect(verdict.const).toBe('accept');
    } else {
      expect(verdict?.enum).toEqual(['accept']);
    }
  });

  it('inlines nested schemas with $refStrategy "none"', () => {
    const Inner = z.object({ id: z.string() });
    const Outer = z.object({
      first: Inner,
      second: Inner,
    });
    const out = responseJsonSchemaFromZod(Outer);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('$ref');
    expect(serialized).not.toContain('definitions');
  });

  it('returns a JSON-serializable object', () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string(), at: z.number() })),
    });
    const out = responseJsonSchemaFromZod(schema);
    // Round-trip through JSON.stringify/parse to confirm there are no
    // non-serializable values (functions, symbols, undefined) that would
    // break CLI invocation.
    const round = JSON.parse(JSON.stringify(out));
    expect(round).toEqual(out);
  });
});
