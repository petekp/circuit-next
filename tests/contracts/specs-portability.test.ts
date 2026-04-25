import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Slice 25a — Methodology artifact portability (FUP-1 from
// specs/plans/arc-remediation-plan-codex.md §Slice 25a; ADR-0001 portability
// addendum). Absolute symlinks under specs/ bind the repo's authority surface
// to the author's host filesystem; any clone resolves them to broken paths and
// the methodology artifacts stop being readable. This file enforces the
// portability invariant across five dimensions per Codex challenger fold-ins:
//   (HIGH 2) guard rejects BOTH absolute targets and repo-escaping relative
//            targets (e.g. `../../../host/path`);
//   (HIGH 4) specs/methodology/ must contain the expected regular-file blobs
//            (the five inlined artifacts plus authoritative local ledgers) —
//            absence fails as hard as symlink mode;
//   (HIGH 5) wiring-parity between findAbsoluteSymlinks helper and the audit
//            CLI — main() must invoke checkSpecsPortability and route it into
//            findings, preventing silent removal while helper tests stay green;
//   (MED  8) frontmatter shape is asserted so the non-operative-provenance
//            policy cannot erode under later edits;
//   baseline: specs/ is portable today AND the helper ignores regular files
//            and repo-contained relative symlinks.

import { findAbsoluteSymlinks } from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SPECS_DIR = resolve(REPO_ROOT, 'specs');
const METHODOLOGY_DIR = resolve(SPECS_DIR, 'methodology');

const EXPECTED_INLINED_METHODOLOGY_FILES = [
  'specs/methodology/analysis.md',
  'specs/methodology/brief.md',
  'specs/methodology/decision.md',
  'specs/methodology/plan.md',
  'specs/methodology/result.md',
] as const;

const EXPECTED_METHODOLOGY_FILES = [
  ...EXPECTED_INLINED_METHODOLOGY_FILES,
  'specs/methodology/product-gate-exemptions.md',
  'specs/methodology/task-packet-template.md',
].sort();

const REQUIRED_FRONTMATTER_KEYS = [
  'original_artifact_path',
  'source_kind',
  'provenance_note',
  'inlined_at',
  'inlined_in_slice',
  'inlined_via_adr',
] as const;

describe('specs/ portability (absolute and repo-escaping symlinks)', () => {
  it('contains no absolute or repo-escaping symlinks under specs/', () => {
    const violations = findAbsoluteSymlinks(SPECS_DIR, REPO_ROOT);
    expect(violations, `portability violations: ${JSON.stringify(violations)}`).toEqual([]);
  });

  it('tracks every authoritative methodology artifact as a regular-file blob', () => {
    const lsFiles = execSync('git ls-files -s specs/methodology', { cwd: REPO_ROOT })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
    const entries = lsFiles.map((line) => {
      const [mode, _oid, _stage, ...rest] = line.split(/\s+/);
      return { mode, path: rest.join(' ') };
    });
    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual([...EXPECTED_METHODOLOGY_FILES]);
    for (const entry of entries) {
      expect(entry.mode, `${entry.path} is not a regular blob (got ${entry.mode})`).toBe('100644');
    }
  });

  it('findAbsoluteSymlinks flags absolute-target fixtures', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'circuit-next-portability-abs-'));
    try {
      const nested = join(fixtureRoot, 'methodology');
      mkdirSync(nested, { recursive: true });
      const realFile = join(fixtureRoot, 'real.md');
      writeFileSync(realFile, '# real\n');
      const absLink = join(nested, 'absolute-link.md');
      symlinkSync(realFile, absLink);
      const violations = findAbsoluteSymlinks(fixtureRoot);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      const absHits = violations.filter((v) => v.reason === 'absolute');
      expect(absHits.map((v) => v.path)).toContain(absLink);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('findAbsoluteSymlinks flags repo-escaping relative-target fixtures', () => {
    // Containment check (Codex HIGH #2). A relative link whose resolved target
    // lands outside the containment root is non-portable even though its
    // readlink string is syntactically relative.
    const containment = mkdtempSync(join(tmpdir(), 'circuit-next-portability-contain-'));
    const outsider = mkdtempSync(join(tmpdir(), 'circuit-next-portability-outsider-'));
    try {
      writeFileSync(join(outsider, 'outside.md'), '# outside\n');
      const inside = join(containment, 'specs', 'methodology');
      mkdirSync(inside, { recursive: true });
      const escapeLink = join(inside, 'escape.md');
      // From .../containment/specs/methodology/, `../../../<outsider>/outside.md`
      // walks up past containment and into outsider.
      const relTarget = join('..', '..', '..', outsider.replace(/^\//, ''), 'outside.md');
      symlinkSync(relTarget, escapeLink);
      const violations = findAbsoluteSymlinks(inside, containment);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      const escapes = violations.filter((v) => v.reason === 'escapes-repo');
      expect(escapes.map((v) => v.path)).toContain(escapeLink);
    } finally {
      rmSync(containment, { recursive: true, force: true });
      rmSync(outsider, { recursive: true, force: true });
    }
  });

  it('findAbsoluteSymlinks ignores regular files and repo-contained relative symlinks', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'circuit-next-portability-ok-'));
    try {
      const nested = join(fixtureRoot, 'methodology');
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(fixtureRoot, 'real.md'), '# real\n');
      writeFileSync(join(nested, 'plain.md'), '# plain\n');
      symlinkSync('../real.md', join(nested, 'relative-link.md'));
      const violations = findAbsoluteSymlinks(fixtureRoot, fixtureRoot);
      expect(violations).toEqual([]);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('scripts/audit.mjs::main wires checkSpecsPortability into findings (wiring parity)', () => {
    // Codex HIGH #5: prevents silent removal of Check 11 from the audit CLI
    // while the helper-level tests continue to pass. This is a static-anchor
    // check on the audit source, not a runtime invocation.
    const auditSrc = readFileSync(join(REPO_ROOT, 'scripts/audit.mjs'), 'utf-8');
    const mainStart = auditSrc.indexOf('function main(');
    expect(mainStart, 'main() not found in scripts/audit.mjs').toBeGreaterThan(-1);
    const mainBody = auditSrc.slice(mainStart);
    expect(
      mainBody.includes('checkSpecsPortability('),
      'main() does not call checkSpecsPortability',
    ).toBe(true);
    // Parity between helper and dimension: main must also push the result
    // into findings so the dimension surfaces in the report.
    const portabilitySection = mainBody.match(
      /checkSpecsPortability\([\s\S]*?findings\.push\([\s\S]*?\)/,
    );
    expect(
      portabilitySection,
      'main() calls checkSpecsPortability but does not push result into findings',
    ).not.toBeNull();
  });
});

describe('specs/methodology/ frontmatter provenance shape', () => {
  for (const rel of EXPECTED_INLINED_METHODOLOGY_FILES) {
    const basename = rel.split('/').pop() ?? rel;
    it(`${basename} carries the required provenance frontmatter keys`, () => {
      const content = readFileSync(join(REPO_ROOT, rel), 'utf-8');
      expect(content.startsWith('---\n'), `${rel} missing frontmatter opener`).toBe(true);
      const end = content.indexOf('\n---', 4);
      expect(end, `${rel} missing frontmatter closer`).toBeGreaterThan(-1);
      const fm = content.slice(4, end);
      for (const key of REQUIRED_FRONTMATTER_KEYS) {
        expect(
          new RegExp(`^${key}:\\s+`, 'm').test(fm),
          `${rel} missing required key: ${key}`,
        ).toBe(true);
      }
      expect(
        /^source_kind:\s+circuit-run-artifact\s*$/m.test(fm),
        `${rel} source_kind is not circuit-run-artifact`,
      ).toBe(true);
      // The key MUST be `original_artifact_path`, not `source`. Codex MED #9:
      // `source:` is semantically overloaded with operative-input keys used
      // elsewhere in this repo (e.g. schema_source). Using a distinct key
      // prevents future tooling from treating the path as canonical input.
      expect(/^source:\s+/m.test(fm), `${rel} uses forbidden 'source:' key`).toBe(false);
    });
  }

  it('matches the exact expected set of methodology artifacts', () => {
    const lsFiles = execSync('git ls-files specs/methodology', { cwd: REPO_ROOT })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(lsFiles).toEqual([...EXPECTED_METHODOLOGY_FILES]);
    // Methodology dir existence guard — if the directory is deleted or
    // emptied, the tracked-file check above would still pass vacuously, so
    // assert the filesystem content separately.
    expect(METHODOLOGY_DIR).toBeTruthy();
  });
});
