import { describe, expect, it } from 'vitest';
import { ControlPchange_kindFileStem, RunRelativePath } from '../../src/schemas/scalars.js';

describe('ControlPchange_kindFileStem', () => {
  describe('rejects', () => {
    const invalid: Array<[string, string]> = [
      ['empty string', ''],
      ['current-directory segment', '.'],
      ['parent-directory segment', '..'],
      ['leading parent traversal', '../x'],
      ['deep parent traversal', '../../etc/passwd'],
      ['forward slash', 'a/b'],
      ['backslash', 'a\\b'],
      ['url-encoded parent traversal', '%2e%2e'],
      ['subpath with slash', 'abc/def'],
      ['consecutive dots', 'abc..def'],
      ['leading hyphen', '-leadingdash'],
      ['leading underscore', '_leadingunderscore'],
      ['leading dot', '.hidden'],
      ['uppercase letter', 'ABC'],
      ['whitespace', 'abc def'],
      ['unicode outside ascii', 'résumé'],
      ['null byte', 'abc\u0000def'],
      ['overly long (129 chars)', 'a'.repeat(129)],
    ];

    for (const [label, value] of invalid) {
      it(`rejects ${label}`, () => {
        const result = ControlPchange_kindFileStem.safeParse(value);
        expect(result.success).toBe(false);
      });
    }
  });

  describe('accepts', () => {
    const valid: Array<[string, string]> = [
      ['single letter', 'a'],
      ['single digit', '7'],
      ['run-slug style', 'run-2026-04-19-a'],
      ['underscore middle', 'abc_123'],
      ['dot middle (extension-like)', 'abc.def'],
      ['uuid-suffixed continuity record', 'continuity-6701b5de-c46a-4832-8133-12bf9176311a'],
      ['max length (128 chars)', 'a'.repeat(128)],
    ];

    for (const [label, value] of valid) {
      it(`accepts ${label}`, () => {
        const result = ControlPchange_kindFileStem.safeParse(value);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(value);
        }
      });
    }
  });

  it('produces a helpful error for parent-directory traversal', () => {
    const result = ControlPchange_kindFileStem.safeParse('../etc');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' | ');
      expect(messages.toLowerCase()).toMatch(/parent|traversal|separator|match/);
    }
  });

  it('produces a helpful error for path separators', () => {
    const result = ControlPchange_kindFileStem.safeParse('abc/def');
    expect(result.success).toBe(false);
  });
});

describe('RunRelativePath', () => {
  const invalid: Array<[string, string]> = [
    ['empty string', ''],
    ['parent traversal', '../escaped.json'],
    ['normalizes above root', 'reports/../../escaped.json'],
    ['absolute path', '/tmp/escaped.json'],
    ['drive-letter colon form', 'C:\\escaped.json'],
    ['backslash separator', 'reports\\escaped.json'],
    ['empty segment', 'reports//x.json'],
    ['current-directory segment at root', './x.json'],
    ['current-directory segment below root', 'reports/./x.json'],
  ];

  for (const [label, value] of invalid) {
    it(`rejects ${label}`, () => {
      const result = RunRelativePath.safeParse(value);
      expect(result.success).toBe(false);
    });
  }

  const valid: Array<[string, string]> = [
    ['single file', 'result.json'],
    ['nested report', 'reports/result.json'],
    ['dash underscore dot characters', 'reports/relay/request-1_ok.json'],
  ];

  for (const [label, value] of valid) {
    it(`accepts ${label}`, () => {
      const result = RunRelativePath.safeParse(value);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(value);
    });
  }
});
