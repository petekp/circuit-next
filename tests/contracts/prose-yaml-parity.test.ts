import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const TRACK_MD = resolve(REPO_ROOT, 'specs/behavioral/prose-yaml-parity.md');
const DOMAIN_MD = resolve(REPO_ROOT, 'specs/domain.md');
const WORKFLOW_MD = resolve(REPO_ROOT, 'specs/contracts/workflow.md');
const SKILL_MD = resolve(REPO_ROOT, 'specs/contracts/skill.md');

// Required frontmatter keys on every behavioral-track spec. Kept
// literal so a later edit to the track pattern fails this test
// explicitly rather than silently accepting a degraded frontmatter.
const BEHAVIORAL_TRACK_FRONTMATTER_KEYS: string[] = [
  'track',
  'status',
  'version',
  'last_updated',
  'depends_on',
  'enforced_by',
  'planned_tests',
];

function parseFrontmatterKeys(markdown: string): string[] {
  if (!markdown.startsWith('---')) return [];
  const closeIdx = markdown.indexOf('\n---', 3);
  if (closeIdx < 0) return [];
  const fm = markdown.slice(3, closeIdx);
  const keys: string[] = [];
  for (const line of fm.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):/);
    if (m?.[1]) keys.push(m[1]);
  }
  return keys;
}

function listBehavioralSpecs(): string[] {
  const out = execSync('ls specs/behavioral', {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return out
    .split('\n')
    .filter((name) => name.endsWith('.md'))
    .map((name) => resolve(REPO_ROOT, 'specs/behavioral', name));
}

// PROSE-YAML-I1..I4 are all prose-documentation-only at v0.1: the catalog
// compiler has not landed, so there is no YAML → prose round-trip to test.
// This file pins what IS testable today:
//
// 1. The behavioral-track spec file itself carries the required
//    frontmatter — so a later edit that drops `planned_tests` or
//    `enforced_by` fires a named failure.
// 2. The anti-patterns the track cross-references are actually present
//    in the referenced files: specs/domain.md names "Prose/YAML drift"
//    and "Prose-as-hidden-policy"; specs/contracts/workflow.md names
//    the `carry-forward:prose-yaml-drift` failure-mode tag;
//    specs/contracts/skill.md carries the v0.2 upstream-SKILL.md
//    mapping-contract scope note for PROSE-YAML-I4.
// 3. SENTINEL — no markdown file in the repo carries a catalog-compiler
//    region marker yet. When the compiler lands, this sentinel fires
//    and signals that the v0.2 round-trip machinery described in the
//    track's §Planned test location needs to come in alongside. See
//    `specs/behavioral/prose-yaml-parity.md` §Evolution.

describe('prose-yaml-parity — track spec frontmatter is well-formed', () => {
  it('specs/behavioral/prose-yaml-parity.md is present', () => {
    const text = readFileSync(TRACK_MD, 'utf-8');
    expect(text.length).toBeGreaterThan(0);
  });

  it('carries the seven required frontmatter keys', () => {
    const keys = parseFrontmatterKeys(readFileSync(TRACK_MD, 'utf-8'));
    for (const key of BEHAVIORAL_TRACK_FRONTMATTER_KEYS) {
      expect(keys, `prose-yaml-parity.md frontmatter is missing "${key}"`).toContain(key);
    }
  });

  it('track field declares prose-yaml-parity', () => {
    const text = readFileSync(TRACK_MD, 'utf-8');
    expect(/^track:\s*prose-yaml-parity\s*$/m.test(text)).toBe(true);
  });

  // Arc-review MED #6 fold-in — prior test did not pin the invariant IDs
  // themselves. A future edit could delete the PROSE-YAML-I1..I4 prose
  // entirely while leaving the cross-reference strings intact, and the
  // Slice 15 test would still pass. This assertion locks the invariant IDs
  // visible in the spec body.
  it('names the four invariants PROSE-YAML-I1..I4', () => {
    const text = readFileSync(TRACK_MD, 'utf-8');
    for (let i = 1; i <= 4; i++) {
      expect(
        new RegExp(`PROSE-YAML-I${i}\\b`).test(text),
        `Track spec missing invariant PROSE-YAML-I${i}`,
      ).toBe(true);
    }
  });

  // Every behavioral-track spec in the repo carries the same required
  // frontmatter shape. Extending the guard to all three tracks lets a
  // future fourth track be rejected by the same test rather than an
  // ad-hoc follow-up.
  it('every specs/behavioral/*.md carries the required frontmatter keys', () => {
    for (const path of listBehavioralSpecs()) {
      const keys = parseFrontmatterKeys(readFileSync(path, 'utf-8'));
      for (const key of BEHAVIORAL_TRACK_FRONTMATTER_KEYS) {
        expect(keys, `${path} frontmatter is missing "${key}"`).toContain(key);
      }
    }
  });
});

describe('prose-yaml-parity — domain anti-pattern cross-references land', () => {
  it('specs/domain.md §Anti-patterns names "Prose/YAML drift"', () => {
    const text = readFileSync(DOMAIN_MD, 'utf-8');
    expect(
      /Prose\/YAML drift/.test(text),
      'specs/domain.md must define the "Prose/YAML drift" anti-pattern referenced by PROSE-YAML-I1.',
    ).toBe(true);
  });

  it('specs/domain.md §Anti-patterns names "Prose-as-hidden-policy"', () => {
    const text = readFileSync(DOMAIN_MD, 'utf-8');
    expect(
      /Prose-as-hidden-policy/.test(text),
      'specs/domain.md must define the "Prose-as-hidden-policy" anti-pattern referenced by the track.',
    ).toBe(true);
  });

  it('specs/contracts/workflow.md names the carry-forward:prose-yaml-drift failure-mode tag', () => {
    const text = readFileSync(WORKFLOW_MD, 'utf-8');
    expect(
      /carry-forward:prose-yaml-drift/.test(text),
      'workflow.md must carry the prose-yaml-drift failure-mode tag referenced by PROSE-YAML-I2.',
    ).toBe(true);
  });

  it('specs/contracts/skill.md documents the v0.2 upstream SKILL.md mapping contract', () => {
    const text = readFileSync(SKILL_MD, 'utf-8');
    expect(
      /Upstream SKILL\.md mapping contract/i.test(text),
      'skill.md must name the v0.2 Upstream SKILL.md mapping contract (PROSE-YAML-I4 landing point).',
    ).toBe(true);
    expect(
      /skill\.frontmatter/.test(text),
      'skill.md must reference the `skill.frontmatter` artifact that v0.2 will introduce.',
    ).toBe(true);
  });
});

// SENTINEL — scans every committed `.md` file for catalog-compiler region
// markers. The shape we would plausibly use (`<!-- CIRCUIT:BEGIN … -->`
// / `<!-- CIRCUIT:END … -->`, symmetric with other markdown-region tools)
// is pre-emptively banned at v0.1. If a compiler lands and introduces
// regions, this test fires with a specific path+marker name — the signal
// to author `tests/contracts/prose-yaml-parity.test.ts` v0.2 round-trip
// machinery per the track's Evolution section.
describe('prose-yaml-parity — no catalog-compiler region markers exist yet (sentinel)', () => {
  function listCommittedMarkdown(): string[] {
    const out = execSync('git ls-files "*.md"', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    return out
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((rel) => resolve(REPO_ROOT, rel))
      .filter((abs) => existsSync(abs));
  }

  const MARKER_PATTERNS: RegExp[] = [
    /<!--\s*CIRCUIT:BEGIN\b/i,
    /<!--\s*CIRCUIT:END\b/i,
    /<!--\s*SKILL:BEGIN\b/i,
    /<!--\s*SKILL:END\b/i,
  ];

  it('no committed .md file carries a CIRCUIT/SKILL region marker', () => {
    const violations: Array<{ path: string; match: string }> = [];
    for (const abs of listCommittedMarkdown()) {
      const text = readFileSync(abs, 'utf-8');
      for (const re of MARKER_PATTERNS) {
        const m = text.match(re);
        if (m) {
          violations.push({ path: abs, match: m[0] });
        }
      }
    }
    expect(
      violations,
      `Catalog-compiler region markers detected. When introducing compiler-owned regions, also land the v0.2 round-trip machinery per specs/behavioral/prose-yaml-parity.md §Evolution and update this sentinel.\nOccurrences:\n${violations
        .map((v) => `  ${v.path}: ${v.match}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
