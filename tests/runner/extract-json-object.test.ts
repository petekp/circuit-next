import { describe, expect, it } from 'vitest';

import { extractJsonObject } from '../../src/runtime/connectors/shared.js';

// Tolerant JSON extraction guard. Workers occasionally narrate status
// before or after their JSON response despite the shape-hint
// instruction telling them not to. The runtime check evaluator and the
// report schema parser both call JSON.parse on the connector
// result_body; without tolerance, a single prose sentence aborts a
// relay that otherwise produced valid output.
//
// Observed prose patterns from real runtime-proof runs:
//   "Type check passes.\n\n{...}"
//   "I have been unable to ...\n{...}"
// The helper extracts the first balanced JSON object so downstream
// JSON.parse sees clean input.

describe('extractJsonObject — tolerant connector result_body extraction', () => {
  it('returns clean JSON unchanged (idempotent)', () => {
    const input = '{"verdict":"ok"}';
    expect(extractJsonObject(input)).toBe(input);
  });

  it('strips prose preamble and returns the JSON object', () => {
    const json = '{"verdict":"ok","candidate_id":"c-1"}';
    const input = `Type check passes.\n\n${json}`;
    expect(extractJsonObject(input)).toBe(json);
  });

  it('strips prose postamble and returns the JSON object', () => {
    const json = '{"verdict":"ok"}';
    const input = `${json}\n\nDone.`;
    expect(extractJsonObject(input)).toBe(json);
  });

  it('strips both preamble and postamble', () => {
    const json = '{"verdict":"ok"}';
    const input = `Status: working.\n${json}\nDone.`;
    expect(extractJsonObject(input)).toBe(json);
  });

  it('extracts multi-line indented JSON', () => {
    const json = '{\n  "verdict": "ok",\n  "items": [\n    {"id": "a"}\n  ]\n}';
    const input = `Heads up:\n${json}\n`;
    expect(extractJsonObject(input)).toBe(json);
  });

  it('handles braces inside JSON string values', () => {
    const json = '{"verdict":"ok","note":"contains } and { braces"}';
    expect(extractJsonObject(json)).toBe(json);
  });

  it('handles escaped quotes inside JSON string values', () => {
    const json = '{"verdict":"ok","quoted":"he said \\"hi\\" to me"}';
    expect(extractJsonObject(json)).toBe(json);
  });

  it('skips a non-parseable {brace block} in prose and finds the real JSON', () => {
    const realJson = '{"verdict":"ok"}';
    const input = `I tried {something}. Then:\n${realJson}`;
    expect(extractJsonObject(input)).toBe(realJson);
  });

  it('returns the raw text when no JSON object is present', () => {
    const input = 'no JSON here at all';
    expect(extractJsonObject(input)).toBe(input);
  });

  it('returns the raw text when an unbalanced object is the only candidate', () => {
    const input = '{"verdict":"ok"';
    expect(extractJsonObject(input)).toBe(input);
  });

  it('returns the raw text on empty input', () => {
    expect(extractJsonObject('')).toBe('');
  });

  it('extracts the first balanced object when multiple appear', () => {
    const first = '{"verdict":"ok"}';
    const second = '{"verdict":"reject"}';
    const input = `${first}\n${second}`;
    expect(extractJsonObject(input)).toBe(first);
  });
});
