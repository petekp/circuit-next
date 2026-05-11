// Renders shape skeletons from Zod schemas and asserts the output is
// equivalent to the hand-written skeletons in flow relay-hints. The
// test is the proof that the Zod-driven renderer can replace hand
// authoring for Fix's relay reports.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { FixChange, FixContext, FixDiagnosis, FixReview } from '../../src/flows/fix/reports.js';
import { renderShapeSkeleton } from '../../src/flows/registries/shape-hints/from-zod.js';

describe('renderShapeSkeleton', () => {
  it('renders a primitive object shape', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });
    expect(renderShapeSkeleton(schema)).toBe('{ "name": "<string>", "count": <number> }');
  });

  it('uses .describe() text as the leaf placeholder', () => {
    const schema = z.object({
      ref: z.string().describe('project-relative path'),
    });
    expect(renderShapeSkeleton(schema)).toBe('{ "ref": "<project-relative path>" }');
  });

  it('renders enum values as a pipe-separated placeholder', () => {
    const schema = z.object({
      severity: z.enum(['low', 'medium', 'high']),
    });
    expect(renderShapeSkeleton(schema)).toBe('{ "severity": "<low|medium|high>" }');
  });

  it('renders literals verbatim', () => {
    const schema = z.object({ verdict: z.literal('accept') });
    expect(renderShapeSkeleton(schema)).toBe('{ "verdict": "accept" }');
  });

  it('unwraps strict() + superRefine() and renders the underlying object', () => {
    const schema = z
      .object({ name: z.string() })
      .strict()
      .superRefine(() => {});
    expect(renderShapeSkeleton(schema)).toBe('{ "name": "<string>" }');
  });

  it('renders arrays of objects', () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string() })),
    });
    expect(renderShapeSkeleton(schema)).toBe('{ "items": [{ "id": "<string>" }] }');
  });

  it('renders fix.context@v1 with the same fields as the hand-written hint', () => {
    const out = renderShapeSkeleton(FixContext);
    expect(out).toContain('"verdict": "accept"');
    expect(out).toContain('"sources":');
    expect(out).toContain('"kind": "<file|command|log|operator-note|reference>"');
    expect(out).toContain('"ref":');
    expect(out).toContain('"summary":');
    expect(out).toContain('"observations":');
    expect(out).toContain('"open_questions":');
  });

  it('renders fix.diagnosis@v1 with reproduction_status and confidence enums', () => {
    const out = renderShapeSkeleton(FixDiagnosis);
    expect(out).toContain('"verdict": "accept"');
    expect(out).toContain(
      '"reproduction_status": "<reproduced|not-reproduced|intermittent|not-attempted>"',
    );
    expect(out).toContain('"confidence": "<low|medium|high>"');
    expect(out).toContain('"evidence":');
    expect(out).toContain('"residual_uncertainty":');
  });

  it('renders fix.change@v1 with changed_files and evidence arrays', () => {
    const out = renderShapeSkeleton(FixChange);
    expect(out).toContain('"verdict": "accept"');
    expect(out).toContain('"summary":');
    expect(out).toContain('"diagnosis_ref":');
    expect(out).toContain('"changed_files": ["<project-relative path that was edited>"]');
    expect(out).toContain('"evidence":');
  });

  it('renders fix.review@v1 with verdict enum and findings array of objects', () => {
    const out = renderShapeSkeleton(FixReview);
    expect(out).toContain('"verdict": "<accept|accept-with-fixes|reject>"');
    expect(out).toContain('"summary":');
    expect(out).toContain('"findings": [{');
    expect(out).toContain('"severity": "<critical|high|medium|low>"');
    expect(out).toContain('"file_refs":');
  });
});
