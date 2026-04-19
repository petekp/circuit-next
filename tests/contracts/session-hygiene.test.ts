import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const CLAUDE_MD = resolve(REPO_ROOT, 'CLAUDE.md');
const PROJECT_STATE_MD = resolve(REPO_ROOT, 'PROJECT_STATE.md');
const README_MD = resolve(REPO_ROOT, 'README.md');
const ADR_0002 = resolve(REPO_ROOT, 'specs/adrs/ADR-0002-bootstrap-discipline.md');

// The one allowlisted `.circuit/` prefix preserved per ADR-0002 as historical
// audit trail of the first Phase 1 slice.
const ALLOWLISTED_CIRCUIT_PREFIX = '.circuit/circuit-runs/phase-1-step-contract-authorship/';

// Phase-mention regexes mirror the five patterns used by
// scripts/audit.mjs::extractPhaseMention. Kept local so the test gives fast
// feedback without importing the audit module (which pulls in a git walk).
const PHASE_PATTERNS: RegExp[] = [
  /\*\*Phase[:*]+\*\*\s*([0-9]+(?:\.[0-9]+)?)/i,
  /\*\*Phase\s+([0-9]+(?:\.[0-9]+)?)/i,
  /Current phase\s*[:\-—]\s*Phase\s*([0-9]+(?:\.[0-9]+)?)/i,
  /^##\s+Phase\s+([0-9]+(?:\.[0-9]+)?)\s*[—\-]/im,
  /^\s*Phase\s+([0-9]+(?:\.[0-9]+)?)\s*[—\-]/im,
];

function extractPhase(text: string): string | null {
  for (const re of PHASE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

// SESSION-I1 — CLAUDE.md stays ≤ 300 lines. Every line enters the primary
// instruction budget of every session. Past 300 lines, later revisions
// accumulate contradictions because nobody holds the whole file in head at
// once. The CLAUDE.md itself carries this as Hard Invariant #10.
describe('session-hygiene — SESSION-I1 CLAUDE.md line budget', () => {
  it('CLAUDE.md exists', () => {
    expect(existsSync(CLAUDE_MD)).toBe(true);
  });

  it('CLAUDE.md is ≤ 300 lines', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    const lineCount = text.split('\n').length;
    expect(
      lineCount,
      `CLAUDE.md is ${lineCount} lines; hard invariant #10 caps it at 300. Move detail to specs/ with a pointer.`,
    ).toBeLessThanOrEqual(300);
  });

  it('CLAUDE.md names its own 300-line hard invariant', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    expect(
      /CLAUDE\.md.*(?:≤|<=|less than or equal to)\s*300\s*lines/i.test(text),
      'CLAUDE.md must name its own ≤300-line invariant so the rule is visible inline.',
    ).toBe(true);
  });
});

// SESSION-I2 — PROJECT_STATE.md is the session-to-session live snapshot, and
// README.md summarizes the current phase. The audit (scripts/audit.mjs,
// dimensions `PROJECT_STATE.md current` + `Phase consistency`) is the
// RUNTIME enforcement surface for freshness + cross-file drift. This
// describe block is a STATIC-DOCUMENTATION ANCHOR per arc-review MED #9:
// it asserts what can be read from the tree today (both files exist; both
// carry a Phase string; the strings agree) without claiming the audit's
// git-walk coverage. Renamed from "PROJECT_STATE liveness & README
// agreement" to stop the prior title's implied guarantee.
describe('session-hygiene — SESSION-I2 static-documentation anchor (README ↔ PROJECT_STATE phase string agreement)', () => {
  it('PROJECT_STATE.md exists', () => {
    expect(existsSync(PROJECT_STATE_MD)).toBe(true);
  });

  it('README.md exists', () => {
    expect(existsSync(README_MD)).toBe(true);
  });

  it('PROJECT_STATE.md contains a Phase declaration', () => {
    const text = readFileSync(PROJECT_STATE_MD, 'utf-8');
    expect(
      extractPhase(text),
      'PROJECT_STATE.md does not match any of the five recognized Phase patterns.',
    ).not.toBeNull();
  });

  it('README.md contains a Phase declaration', () => {
    const text = readFileSync(README_MD, 'utf-8');
    expect(
      extractPhase(text),
      'README.md does not match any of the five recognized Phase patterns.',
    ).not.toBeNull();
  });

  it('README and PROJECT_STATE declare the same Phase', () => {
    const readmePhase = extractPhase(readFileSync(README_MD, 'utf-8'));
    const psPhase = extractPhase(readFileSync(PROJECT_STATE_MD, 'utf-8'));
    expect(
      readmePhase,
      `README Phase=${readmePhase}; PROJECT_STATE Phase=${psPhase}. Both files must agree; update whichever was forgotten in the last slice.`,
    ).toBe(psPhase);
  });
});

// SESSION-I3 — Compaction disabled. Prose-documented rather than runtime-
// testable, because "compaction" is a harness-level setting that does not
// leave a filesystem trace. The test asserts the discipline is named inline
// in CLAUDE.md so a reader sees it as part of session hygiene rather than
// discovering it after a compaction has already eaten a decision.
describe('session-hygiene — SESSION-I3 compaction disabled (prose-documented)', () => {
  it('CLAUDE.md §Session hygiene says compaction is disabled', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    expect(
      /compaction is\s*\*{0,2}\s*disabled/i.test(text),
      'CLAUDE.md must document that compaction is disabled on this repo.',
    ).toBe(true);
  });
});

// SESSION-I4 — Slices ≤ 30 min wall-clock. Like I3, this is prose-documented
// rather than runtime-testable. The audit's framing-triplet check is the
// closest runtime proxy; this test asserts the rule is named inline.
describe('session-hygiene — SESSION-I4 30-minute slice bound (prose-documented)', () => {
  it('CLAUDE.md §Session hygiene names the ≤30-minute slice bound', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    expect(
      /Slices?\s*≤\s*30\s*min/i.test(text) || /Slices?\s*<=\s*30\s*min/i.test(text),
      'CLAUDE.md must document the ≤30-minute slice wall-clock bound.',
    ).toBe(true);
  });
});

// SESSION-I5 — Commits cite specs/, CLAUDE.md, bootstrap/, or an ADR. This
// is RUNTIME-enforced across git history by scripts/audit.mjs (Citation
// rule dimension); this describe block is a STATIC-DOCUMENTATION ANCHOR
// per arc-review MED #9: it asserts the rule is visible inline in CLAUDE.md
// and authoritative in ADR-0002, without claiming commit-coverage. Title
// clarified from "prose-documented + ADR-anchored" to make the static-anchor
// nature explicit and stop the prior title's implied commit-walk coverage.
describe('session-hygiene — SESSION-I5 static-documentation anchor (citation rule named inline + ADR-anchored)', () => {
  it('CLAUDE.md names the citation rule or points at ADR-0002', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    const citesRuleInline =
      /specs\//.test(text) && /(citation rule|cite.*specs|cites specs|commit.*cite)/i.test(text);
    const citesAdr0002 = /ADR-0002/.test(text);
    expect(
      citesRuleInline || citesAdr0002,
      'CLAUDE.md must either describe the citation rule inline or point at ADR-0002.',
    ).toBe(true);
  });

  it('ADR-0002 exists and carries the citation rule', () => {
    expect(existsSync(ADR_0002)).toBe(true);
    const text = readFileSync(ADR_0002, 'utf-8');
    expect(
      /citation rule/i.test(text),
      'ADR-0002 must describe the citation rule (the canonical source for SESSION-I5).',
    ).toBe(true);
  });
});

// SESSION-I6 — `.circuit/` is gitignored except the explicit historical
// allowlist. The gitignore pattern is defensive; the real test is that no
// path outside the allowlist is actually tracked. Uses `git ls-files` so the
// check is independent of whether the file happens to exist on disk right
// now.
describe('session-hygiene — SESSION-I6 .circuit/ gitignore discipline', () => {
  it('.gitignore carries the .circuit/ rule + the allowlist negation', () => {
    const text = readFileSync(resolve(REPO_ROOT, '.gitignore'), 'utf-8');
    const hasIgnore = /^\.circuit\/\s*$/m.test(text);
    const hasAllowlist = new RegExp(
      `^!${ALLOWLISTED_CIRCUIT_PREFIX.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`,
      'm',
    ).test(text);
    expect(hasIgnore, '.gitignore must ignore .circuit/').toBe(true);
    expect(
      hasAllowlist,
      `.gitignore must negate-ignore the historical allowlist ${ALLOWLISTED_CIRCUIT_PREFIX}`,
    ).toBe(true);
  });

  it('every git-tracked path under .circuit/ is inside the allowlisted prefix', () => {
    // git ls-files is fast and stable; it reports only paths actually in the index.
    const stdout = execSync('git ls-files .circuit/', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    const paths = stdout.split('\n').filter((line) => line.trim().length > 0);
    const violations = paths.filter((p) => !p.startsWith(ALLOWLISTED_CIRCUIT_PREFIX));
    expect(
      violations,
      `The following .circuit/ paths are tracked outside the allowlist:\n${violations.join('\n')}\n\nOnly the ADR-0002 historical allowlist (${ALLOWLISTED_CIRCUIT_PREFIX}) is permitted.`,
    ).toEqual([]);
  });
});
