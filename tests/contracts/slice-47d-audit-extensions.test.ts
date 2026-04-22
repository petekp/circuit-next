import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS,
  FORBIDDEN_PROGRESS_SCAN_FILES,
  FORBIDDEN_PROGRESS_SCAN_GLOBS,
  SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE,
  checkArcCloseCompositionReviewPresence,
  checkCodexChallengerRequiredDeclaration,
  checkForbiddenScalarProgressPhrases,
  compareSliceId,
} from '../../scripts/audit.mjs';

// Slice 47d — audit-extensions tests covering the three new surfaces the
// arc-close ceremony commit lands:
//
//   1. compareSliceId canonical slice-id comparator (Codex HIGH 5 fold-in).
//   2. The new slice-47 ARC_CLOSE_GATES entry with string ceremony_slice
//      and the extended Check 26 branch that uses compareSliceId.
//   3. Check 35 checkCodexChallengerRequiredDeclaration with the retroactive
//      grandfather list (Codex HIGH 2 + Claude HIGH 2 fold-in of Slice 47c-2
//      MED 2 deferred binding).
//   4. The extended FORBIDDEN_PROGRESS_SCAN_FILES + FORBIDDEN_PROGRESS_SCAN_GLOBS
//      scope (Codex HIGH 3 fold-in of Slice 47c MED 1 deferred scan-scope
//      expansion).

function writeRel(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function withTempRepo(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'slice-47d-audit-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'root'], { cwd: root });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('Slice 47d — compareSliceId (Codex HIGH 5 fold-in)', () => {
  it('orders bare numeric before any letter-suffixed variant at the same number', () => {
    expect(compareSliceId('47', '47a')).toBeLessThan(0);
    expect(compareSliceId('47a', '47')).toBeGreaterThan(0);
  });

  it('orders letter suffixes lexicographically at the same number', () => {
    expect(compareSliceId('47a', '47b')).toBeLessThan(0);
    expect(compareSliceId('47c', '47d')).toBeLessThan(0);
    expect(compareSliceId('47d', '47c')).toBeGreaterThan(0);
  });

  it('orders numeric prefixes before letter suffixes', () => {
    expect(compareSliceId('47d', '48')).toBeLessThan(0);
    expect(compareSliceId('48', '47d')).toBeGreaterThan(0);
    expect(compareSliceId('47z', '48')).toBeLessThan(0);
  });

  it('returns zero for identical slice ids', () => {
    expect(compareSliceId('47', '47')).toBe(0);
    expect(compareSliceId('47d', '47d')).toBe(0);
  });

  it('throws on inputs that do not match SLICE_ID_PATTERN', () => {
    expect(() => compareSliceId('47-2', '47d')).toThrow(/SLICE_ID_PATTERN/);
    expect(() => compareSliceId('47d', 'foo')).toThrow(/SLICE_ID_PATTERN/);
    expect(() => compareSliceId('', '47')).toThrow(/SLICE_ID_PATTERN/);
  });
});

describe('Slice 47d — slice-47 ARC_CLOSE_GATES entry (Codex HIGH 5 + Claude HIGH 3 fold-in)', () => {
  function writeProjectStateWithSlice(root: string, slice: string): void {
    writeRel(root, 'PROJECT_STATE.md', `<!-- current_slice: ${slice} -->\n\n# State\n`);
  }

  function writePlanFiles(root: string, plans: readonly string[]): void {
    for (const rel of plans) {
      writeRel(root, rel, `---\nname: ${rel}\n---\n\n# Plan\n`);
    }
  }

  it('exports the ceremony slice as the canonical letter-suffixed string "47d"', () => {
    expect(typeof SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE).toBe('string');
    expect(SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE).toBe('47d');
  });

  it('returns "in progress" for the slice-47 arc at current_slice=47c', () => {
    withTempRepo((root) => {
      writePlanFiles(root, ['specs/plans/slice-47-hardening-foldins.md']);
      writeProjectStateWithSlice(root, '47c');
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('slice-47-hardening-foldins');
      expect(result.detail).toContain('still in progress');
    });
  });

  it('requires the two-prong arc-close review at current_slice=47d (missing = red)', () => {
    withTempRepo((root) => {
      writePlanFiles(root, ['specs/plans/slice-47-hardening-foldins.md']);
      writeProjectStateWithSlice(root, '47d');
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('slice-47-hardening-foldins');
      expect(result.detail).toContain('47d');
    });
  });

  it('returns green when both prong files exist with ACCEPT closing verdicts at current_slice=47d', () => {
    withTempRepo((root) => {
      writePlanFiles(root, ['specs/plans/slice-47-hardening-foldins.md']);
      writeProjectStateWithSlice(root, '47d');
      writeRel(
        root,
        'specs/reviews/arc-slice-47-composition-review-claude.md',
        '---\nname: arc-slice-47-composition-review-claude\nclosing_verdict: ACCEPT-WITH-FOLD-INS\namnesty_scope: [43a, 43b, 43c, 45a, 46b]\n---\n\n# body\n',
      );
      writeRel(
        root,
        'specs/reviews/arc-slice-47-composition-review-codex.md',
        '---\nname: arc-slice-47-composition-review-codex\nclosing_verdict: ACCEPT-WITH-FOLD-INS\namnesty_scope: [43a, 43b, 43c, 45a, 46b]\n---\n\n# body\n',
      );
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('slice-47-hardening-foldins');
      expect(result.detail).toContain('two-prong gate satisfied');
    });
  });

  it('still requires the two-prong review at current_slice=48 (post-arc future slice)', () => {
    withTempRepo((root) => {
      writePlanFiles(root, ['specs/plans/slice-47-hardening-foldins.md']);
      writeProjectStateWithSlice(root, '48');
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('slice-47-hardening-foldins');
    });
  });
});

describe('Slice 47d — Check 35 checkCodexChallengerRequiredDeclaration (Codex HIGH 2 + Claude HIGH 2 fold-in)', () => {
  function withFakeRepoHavingHeadBody(
    headBody: string,
    headSubject: string,
    fn: (root: string) => void,
  ): void {
    const root = mkdtempSync(join(tmpdir(), 'slice-47d-check35-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
      const message = `${headSubject}\n\n${headBody}`;
      execFileSync('git', ['commit', '--allow-empty', '-q', '-m', message], { cwd: root });
      // Run the check against this temp repo's HEAD by cd-ing there; the
      // implementation uses `git -C <rootDir>` indirectly via shSafe's CWD
      // (the audit's git calls run from the process CWD). Use process.chdir
      // within the test scope and restore.
      const origCwd = process.cwd();
      process.chdir(root);
      try {
        fn(root);
      } finally {
        process.chdir(origCwd);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('returns green when HEAD body does not declare "Codex challenger: REQUIRED" (check not applicable)', () => {
    withFakeRepoHavingHeadBody(
      'Lane: Equivalence Refactor\nCodex challenger: NOT required.',
      'slice-47: test',
      (root) => {
        const result = checkCodexChallengerRequiredDeclaration(root);
        expect(result.level).toBe('green');
        expect(result.detail).toContain('not applicable');
      },
    );
  });

  it('returns green when HEAD body declares REQUIRED and matching per-slice review file exists', () => {
    withFakeRepoHavingHeadBody(
      'Lane: Ratchet-Advance\nCodex challenger: REQUIRED.',
      'slice-48: some governance change',
      (root) => {
        writeRel(
          root,
          'specs/reviews/arc-slice-48-codex.md',
          '---\nname: arc-slice-48-codex\nclosing_verdict: ACCEPT\n---\n\n# body\n',
        );
        const result = checkCodexChallengerRequiredDeclaration(root);
        expect(result.level).toBe('green');
        expect(result.detail).toContain('per-slice');
      },
    );
  });

  it('returns green when HEAD body declares REQUIRED and arc-subsumption field points at existing file', () => {
    const body = [
      'Lane: Ratchet-Advance',
      'Codex challenger: REQUIRED (governance-surface movement + ratchet advance).',
      '',
      'arc-subsumption: specs/reviews/arc-slice-47-composition-review-codex.md',
    ].join('\n');
    withFakeRepoHavingHeadBody(body, 'slice-47d: ceremony', (root) => {
      writeRel(
        root,
        'specs/reviews/arc-slice-47-composition-review-codex.md',
        '---\nname: arc-slice-47-composition-review-codex\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n\n# body\n',
      );
      const result = checkCodexChallengerRequiredDeclaration(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('arc-subsumption');
    });
  });

  it('returns red when HEAD body declares REQUIRED but neither per-slice nor arc-subsumption evidence exists', () => {
    withFakeRepoHavingHeadBody(
      'Lane: Ratchet-Advance\nCodex challenger: REQUIRED.',
      'slice-49: some advance',
      (root) => {
        const result = checkCodexChallengerRequiredDeclaration(root);
        expect(result.level).toBe('red');
        expect(result.detail).toContain('none of the candidate per-slice review files exist');
      },
    );
  });

  it('returns red when HEAD body declares REQUIRED + arc-subsumption but the named file does not exist', () => {
    const body = [
      'Lane: Ratchet-Advance',
      'Codex challenger: REQUIRED.',
      'arc-subsumption: specs/reviews/arc-slice-99-composition-review-codex.md',
    ].join('\n');
    withFakeRepoHavingHeadBody(body, 'slice-99: bogus', (root) => {
      const result = checkCodexChallengerRequiredDeclaration(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('does not exist');
    });
  });

  it('exports the grandfather list with the two retroactive 47 fold-in commits', () => {
    const keys = Object.keys(CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS);
    expect(keys).toContain('1c4a5b1');
    expect(keys).toContain('73c729c');
    expect(CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS['1c4a5b1']).toContain(
      'arc-slice-47b-codex',
    );
    expect(CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS['73c729c']).toContain(
      'arc-slice-47c-codex',
    );
  });
});

describe('Slice 47d — forbidden-progress scan scope extension (Codex HIGH 3 fold-in)', () => {
  it('FORBIDDEN_PROGRESS_SCAN_FILES includes CLAUDE.md and TIER.md', () => {
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('CLAUDE.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('TIER.md');
  });

  it('FORBIDDEN_PROGRESS_SCAN_GLOBS matches arc-close composition review files', () => {
    const sample = 'specs/reviews/arc-slice-47-composition-review-codex.md';
    const matches = FORBIDDEN_PROGRESS_SCAN_GLOBS.some((re) => re.test(sample));
    expect(matches).toBe(true);
  });

  it('FORBIDDEN_PROGRESS_SCAN_GLOBS does NOT match per-slice review files', () => {
    const perSliceSamples = [
      'specs/reviews/arc-slice-47a-codex.md',
      'specs/reviews/arc-slice-47b-codex.md',
      'specs/reviews/arc-slice-47c-codex.md',
      'specs/reviews/arc-slice-47c-2-codex.md',
    ];
    for (const s of perSliceSamples) {
      const matches = FORBIDDEN_PROGRESS_SCAN_GLOBS.some((re) => re.test(s));
      expect(matches, `expected ${s} NOT to match composition-review glob`).toBe(false);
    }
  });

  it('red on forbidden "2/8 → 3/8" phrasing in TIER.md (extended scan scope)', () => {
    const root = mkdtempSync(join(tmpdir(), 'slice-47d-scope-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
      writeRel(root, 'TIER.md', '<!-- current_slice: 47d -->\n\nPhase 2 status: 3/8 complete.\n');
      execFileSync('git', ['add', '.'], { cwd: root });
      execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: root });
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('TIER.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
