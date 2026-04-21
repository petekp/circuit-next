import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_ADAPTER_SDK_DEPS,
  checkAdapterInvocationDiscipline,
} from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// These tests exercise checkAdapterInvocationDiscipline (scripts/audit.mjs
// Check 28, introduced by Slice 41 per ADR-0009 §4). The check enforces the
// ADR-0009 §1 decision — subprocess-per-adapter for v0 — by rejecting any
// package.json that declares a forbidden-SDK dep in dependencies,
// devDependencies, optionalDependencies, or peerDependencies.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-adapter-invocation-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

describe('Check 28 — adapter invocation discipline (Slice 41 / ADR-0009)', () => {
  it('passes green on the live repo package.json (regression guard)', () => {
    const result = checkAdapterInvocationDiscipline(REPO_ROOT);
    expect(result.level).toBe('green');
    // Detail string must confirm 0 forbidden deps and list the dep-field count.
    expect(result.detail).toMatch(/package\.json clean/);
    expect(result.detail).toMatch(/0 forbidden dep/);
  });

  it('fires red when @anthropic-ai/sdk appears in dependencies', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'package.json',
        JSON.stringify({
          name: 'tmp',
          dependencies: { zod: '^3.23.8', '@anthropic-ai/sdk': '^0.30.0' },
        }),
      );
      const result = checkAdapterInvocationDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/dependencies\.@anthropic-ai\/sdk/);
      // The error message must cite ADR-0009 so the failure is actionable.
      expect(result.detail).toMatch(/ADR-0009/);
    });
  });

  it('fires red when `openai` appears in devDependencies', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'package.json',
        JSON.stringify({
          name: 'tmp',
          devDependencies: { vitest: '^2.1.4', openai: '^4.0.0' },
        }),
      );
      const result = checkAdapterInvocationDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/devDependencies\.openai/);
    });
  });

  it('fires red when @google/genai appears in optionalDependencies', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'package.json',
        JSON.stringify({
          name: 'tmp',
          optionalDependencies: { '@google/genai': '^1.0.0' },
        }),
      );
      const result = checkAdapterInvocationDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/optionalDependencies\.@google\/genai/);
    });
  });

  it('fires red when a forbidden id appears in peerDependencies (Codex Slice 41 MED 2 fold-in)', () => {
    // peerDependencies is a fourth dep-field Check 28 scans; the pre-fold-in
    // test coverage missed it. A future slice could declare a forbidden
    // wrapper SDK as a peer-dep (e.g., a plugin extension) and bypass the
    // check without this regression guard.
    withTempRepo((root) => {
      writeRel(
        root,
        'package.json',
        JSON.stringify({
          name: 'tmp',
          peerDependencies: { '@langchain/anthropic': '^0.3.0' },
        }),
      );
      const result = checkAdapterInvocationDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/peerDependencies\.@langchain\/anthropic/);
      expect(result.detail).toMatch(/ADR-0009/);
    });
  });

  it('fires red when an `ai` (Vercel AI SDK wrapper) dep appears — HIGH 2 bypass guard', () => {
    // Codex Slice 41 HIGH 2 fold-in: the Vercel AI SDK `ai` package plus
    // `@ai-sdk/*` provider bindings route dispatches in-process against
    // vendor APIs without a direct-vendor-SDK appearing in deps. Check 28
    // must treat `ai` as forbidden to close this bypass.
    withTempRepo((root) => {
      writeRel(
        root,
        'package.json',
        JSON.stringify({
          name: 'tmp',
          dependencies: { zod: '^3.23.8', ai: '^5.0.0' },
        }),
      );
      const result = checkAdapterInvocationDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/dependencies\.ai/);
    });
  });

  it('FORBIDDEN_ADAPTER_SDK_DEPS pins the ADR-0009 §4 list by set-equality (Codex Slice 41 MED 2 fold-in)', () => {
    // The prior "non-empty" test would pass green even if a future slice
    // silently removed five entries. Set-equality pins the exact list so
    // any change must come through ADR-0009 reopen + list amendment.
    // Authoritative list per specs/adrs/ADR-0009-adapter-invocation-pattern.md
    // §4 (Part A + Part B after Slice 41 HIGH 2 fold-in).
    const EXPECTED_FORBIDDEN_SET = new Set([
      // Part A — direct vendor SDKs
      '@anthropic-ai/sdk',
      '@anthropic-ai/tokenizer',
      '@anthropic-ai/bedrock-sdk',
      '@anthropic-ai/vertex-sdk',
      'openai',
      '@openai/realtime-api-beta',
      '@google/genai',
      '@google/generative-ai',
      // Part B — wrapper/provider SDKs (Slice 41 HIGH 2 bypass guard)
      'ai',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai',
      '@ai-sdk/google',
      '@langchain/anthropic',
      '@langchain/openai',
      '@langchain/google-genai',
    ]);
    const actual = new Set(FORBIDDEN_ADAPTER_SDK_DEPS);
    expect(actual.size).toBe(EXPECTED_FORBIDDEN_SET.size);
    for (const id of EXPECTED_FORBIDDEN_SET) {
      expect(actual.has(id), `expected ${id} in FORBIDDEN_ADAPTER_SDK_DEPS`).toBe(true);
    }
    for (const id of actual) {
      expect(
        EXPECTED_FORBIDDEN_SET.has(id),
        `unexpected id ${id} in FORBIDDEN_ADAPTER_SDK_DEPS (must reopen ADR-0009 to add/remove)`,
      ).toBe(true);
    }
  });

  it('FORBIDDEN_ADAPTER_SDK_DEPS is a non-empty readonly array of npm identifiers', () => {
    expect(Array.isArray(FORBIDDEN_ADAPTER_SDK_DEPS)).toBe(true);
    expect(FORBIDDEN_ADAPTER_SDK_DEPS.length).toBeGreaterThanOrEqual(1);
    // npm identifiers: either scoped (@scope/name) or unscoped (name). Each
    // segment is non-empty alphanumerics, hyphens, underscores, or dots.
    const NPM_ID = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
    for (const id of FORBIDDEN_ADAPTER_SDK_DEPS) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(NPM_ID.test(id), `${id} must match npm identifier pattern`).toBe(true);
    }
  });

  it('returns red if the forbiddenDeps override list is empty (vacuity guard)', () => {
    // The forbiddenDeps opts override exists so test fixtures can vary the
    // list; an empty override must NOT silently pass green because that
    // would let a future slice neuter Check 28 without tripping the audit.
    const result = checkAdapterInvocationDiscipline(REPO_ROOT, { forbiddenDeps: [] });
    expect(result.level).toBe('red');
    expect(result.detail).toMatch(/empty/);
  });
});
