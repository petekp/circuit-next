import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ACCEPT_CLOSING_VERDICT_PATTERN,
  ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN,
  CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS,
  FORBIDDEN_PROGRESS_SCAN_FILES,
  FORBIDDEN_PROGRESS_SCAN_GLOBS,
  PER_SLICE_REVIEW_FILENAME_PATTERN,
  SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE,
  checkArcCloseCompositionReviewPresence,
  checkCodexChallengerRequiredDeclaration,
  checkForbiddenScalarProgressPhrases,
  compareSliceId,
  validateArcSubsumptionEvidence,
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

// Slice 68 ARC-CLOSE fold-in (Codex HIGH-1) — tightened Check 35
// arc-subsumption validator. Before this slice the branch accepted any
// existsSync(path); a commit that self-declared `Codex challenger: REQUIRED`
// could satisfy the gate with an arbitrary existing file. The tightened
// validator requires shape match + ACCEPT-class closing_verdict.
describe('Slice 68 ARC-CLOSE — validateArcSubsumptionEvidence (Codex HIGH-1 fold-in)', () => {
  it('ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN matches ceremony prong filenames', () => {
    expect(
      ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test(
        'arc-clean-clone-reality-composition-review-claude.md',
      ),
    ).toBe(true);
    expect(
      ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test(
        'arc-clean-clone-reality-composition-review-codex.md',
      ),
    ).toBe(true);
    expect(
      ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test(
        'arc-methodology-trim-composition-review-codex.md',
      ),
    ).toBe(true);
    expect(
      ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test(
        'arc-slice-47-composition-review-codex.md',
      ),
    ).toBe(true);
  });

  it('ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN rejects per-slice review filenames', () => {
    expect(ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test('arc-slice-67-codex.md')).toBe(false);
    expect(ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN.test('arc-slice-47c-codex.md')).toBe(
      false,
    );
  });

  it('PER_SLICE_REVIEW_FILENAME_PATTERN captures the slice id', () => {
    const match1 = 'arc-slice-67-codex.md'.match(PER_SLICE_REVIEW_FILENAME_PATTERN);
    expect(match1).not.toBeNull();
    expect(match1?.[1]).toBe('67');
    const match2 = 'arc-slice-47c-codex.md'.match(PER_SLICE_REVIEW_FILENAME_PATTERN);
    expect(match2).not.toBeNull();
    expect(match2?.[1]).toBe('47c');
  });

  it('ACCEPT_CLOSING_VERDICT_PATTERN matches bare and quoted ACCEPT verdicts', () => {
    expect(ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict: ACCEPT\n')).toBe(true);
    expect(ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict: ACCEPT-WITH-FOLD-INS\n')).toBe(
      true,
    );
    expect(
      ACCEPT_CLOSING_VERDICT_PATTERN.test(
        'closing_verdict: "ACCEPT-WITH-FOLD-INS (1 HIGH + 2 MED)"\n',
      ),
    ).toBe(true);
    expect(ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict: "ACCEPT"\n')).toBe(true);
  });

  it('ACCEPT_CLOSING_VERDICT_PATTERN rejects REJECT-class verdicts', () => {
    expect(ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict: REJECT-PENDING-FOLD-INS\n')).toBe(
      false,
    );
    expect(
      ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict: "REJECT-PENDING-FOLD-INS (...)"\n'),
    ).toBe(false);
    expect(ACCEPT_CLOSING_VERDICT_PATTERN.test('closing_verdict:\n')).toBe(false);
  });

  it('validateArcSubsumptionEvidence — shape (i) arc-close: accepts ceremony filename + ACCEPT verdict (arc-bound to subject slice id)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      // Subject slice id "68" maps to ARC_CLOSE_GATES methodology-trim-arc
      // entry (ceremony_slice: 68). The referenced filename matches its
      // review_file_regex. Accept.
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '68',
      );
      expect(result.ok).toBe(true);
      expect(result.shape).toBe('arc-close');
    });
  });

  it('validateArcSubsumptionEvidence — shape (i) arc-close: REJECTS when referenced file is a different arc (Codex re-dispatch HIGH-1)', () => {
    withTempRepo((root) => {
      // Simulate Codex's attack: a slice-68 commit tries to arc-subsume
      // clean-clone-reality-tranche's review file. Filename matches the
      // GENERIC arc-close composition-review shape but does NOT match
      // slice-68's arc-bound review_file_regex (methodology-trim-arc).
      writeRel(
        root,
        'specs/reviews/arc-clean-clone-reality-composition-review-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-clean-clone-reality-composition-review-codex.md',
        '68',
      );
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/arc-bound review_file_regex/);
      expect(result.detail).toMatch(/methodology-trim-arc/);
    });
  });

  it('validateArcSubsumptionEvidence — shape (i) REJECTS ceremony commit with no matching ARC_CLOSE_GATES entry', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-nonexistent-arc-composition-review-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      // Subject slice id "999" has no ARC_CLOSE_GATES entry.
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-nonexistent-arc-composition-review-codex.md',
        '999',
      );
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/does not correspond to any registered ARC_CLOSE_GATES entry/);
    });
  });

  it('validateArcSubsumptionEvidence — shape (ii) per-slice: accepts matching predecessor + ACCEPT verdict', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '67a',
      );
      expect(result.ok).toBe(true);
      expect(result.shape).toBe('per-slice');
    });
  });

  it('validateArcSubsumptionEvidence — shape (ii) rejects mismatched predecessor', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '64a',
      );
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/expects predecessor slice "64"/);
    });
  });

  it('validateArcSubsumptionEvidence — shape (ii) rejects ceremony subject (no letter suffix)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n',
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-slice-67-codex.md',
        '68',
      );
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/has no letter suffix/);
    });
  });

  it('validateArcSubsumptionEvidence — REJECT-class verdict rejected under any shape', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '---\nclosing_verdict: REJECT-PENDING-FOLD-INS\n---\n',
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '68',
      );
      expect(result.ok).toBe(false);
      expect(result.shape).toBe('arc-close');
      expect(result.detail).toMatch(/closing_verdict is "REJECT/);
    });
  });

  // Slice 68 re-dispatch HIGH (pass 3): frontmatter-only verdict parsing
  // in validateArcSubsumptionEvidence. Before this fold-in, the validator
  // used `ACCEPT_CLOSING_VERDICT_PATTERN.test(body)` with the `m` flag,
  // which matched any line-start. A review file whose frontmatter said
  // REJECT-PENDING-FOLD-INS but whose body contained a line
  // `closing_verdict: ACCEPT` would false-green. Fixed by switching to
  // `readFrontmatter()` + strict field match.
  it('validateArcSubsumptionEvidence — REJECTS REJECT-class frontmatter even when body prose mentions ACCEPT (re-dispatch HIGH pass 3)', () => {
    withTempRepo((root) => {
      const rejectWithAcceptProse = [
        '---',
        'closing_verdict: REJECT-PENDING-FOLD-INS',
        '---',
        '',
        '# Review',
        '',
        'Verdict vocabulary: closing_verdict: ACCEPT means all closed.',
        '',
        'closing_verdict: ACCEPT-WITH-FOLD-INS (this is a body mention, not the verdict)',
        '',
      ].join('\n');
      writeRel(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        rejectWithAcceptProse,
      );
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '68',
      );
      expect(result.ok).toBe(false);
      expect(result.shape).toBe('arc-close');
      expect(result.detail).toMatch(/closing_verdict is "REJECT-PENDING-FOLD-INS"/);
    });
  });

  it('checkCodexChallengerRequiredDeclaration integration — REJECT-class frontmatter with body-ACCEPT prose stays red (re-dispatch HIGH pass 3)', () => {
    const root = mkdtempSync(join(tmpdir(), 'slice-68-check35-pass3-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
      const commitBody = [
        'Lane: Equivalence Refactor',
        'Codex challenger: REQUIRED',
        'arc-subsumption: specs/reviews/arc-methodology-trim-composition-review-codex.md',
      ].join('\n');
      writeRel(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        [
          '---',
          'closing_verdict: REJECT-PENDING-FOLD-INS',
          '---',
          '',
          '# Review',
          'closing_verdict: ACCEPT (in body prose, not frontmatter)',
          '',
        ].join('\n'),
      );
      execFileSync('git', ['add', '.'], { cwd: root });
      execFileSync('git', ['commit', '-q', '-m', `slice-68: arc-close ceremony\n\n${commitBody}`], {
        cwd: root,
      });
      const origCwd = process.cwd();
      process.chdir(root);
      try {
        const result = checkCodexChallengerRequiredDeclaration(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/closing_verdict is "REJECT-PENDING-FOLD-INS"/);
      } finally {
        process.chdir(origCwd);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validateArcSubsumptionEvidence — arbitrary existing file with plausible name but wrong shape rejected', () => {
    withTempRepo((root) => {
      // Pre-Slice-68 false-green pattern: commit declares REQUIRED + arc-subsumption
      // pointing at some existing per-slice review whose filename does NOT match
      // either shape (e.g., a non-canonical name). The file-exists loophole would
      // have GREENed this; tightened validator REDs.
      writeRel(root, 'specs/reviews/arbitrary-evidence.md', '---\nclosing_verdict: ACCEPT\n---\n');
      const result = validateArcSubsumptionEvidence(
        root,
        'specs/reviews/arbitrary-evidence.md',
        '68',
      );
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/matches neither shape/);
    });
  });

  it('checkCodexChallengerRequiredDeclaration integration — tightened arc-subsumption REDs REJECT-class prong', () => {
    const root = mkdtempSync(join(tmpdir(), 'slice-68-check35-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
      const body = [
        'Lane: Equivalence Refactor',
        'Codex challenger: REQUIRED',
        'arc-subsumption: specs/reviews/arc-methodology-trim-composition-review-codex.md',
      ].join('\n');
      writeRel(
        root,
        'specs/reviews/arc-methodology-trim-composition-review-codex.md',
        '---\nclosing_verdict: REJECT-PENDING-FOLD-INS\n---\n',
      );
      execFileSync('git', ['add', '.'], { cwd: root });
      execFileSync('git', ['commit', '-q', '-m', `slice-68: arc-close ceremony\n\n${body}`], {
        cwd: root,
      });
      const origCwd = process.cwd();
      process.chdir(root);
      try {
        const result = checkCodexChallengerRequiredDeclaration(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/closing_verdict is "REJECT-PENDING-FOLD-INS"/);
      } finally {
        process.chdir(origCwd);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
