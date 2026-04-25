import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ADR_0007_FORBIDDEN_PROGRESS_PATTERNS,
  FORBIDDEN_PROGRESS_CONTENT_EXEMPT_FILES,
  FORBIDDEN_PROGRESS_SCAN_FILES,
  checkForbiddenScalarProgressPhrases,
} from '../../scripts/audit.mjs';

// Slice 47c (Codex Slice 47a comprehensive review HIGH 6 fold-in) —
// Check 34 ADR-0007 §3 forbidden scalar-progress firewall. Pre-Slice-47c
// the ADR forbade close-progress wording at lines 638-648 ("N-of-8
// complete", "8/8", "substantially complete", etc.) but no audit gate
// enforced — multiple slices normalized them on the most operator-
// visible surfaces. This contract suite pins the check's behavior:
// detects forbidden patterns; respects citation guards (lines that
// quote the patterns to forbid them); scopes PROJECT_STATE.md to the
// current entry only.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-47c-firewall-'));
  try {
    execSync('git init -q', { cwd: root, stdio: 'ignore' });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFile(root: string, rel: string, content: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

describe('Check 34 — ADR-0007 §3 forbidden scalar-progress firewall (Slice 47c)', () => {
  it('green when no forbidden phrases appear in any scoped file', () => {
    withTempRepo((root) => {
      writeFile(root, 'PROJECT_STATE.md', '# state\nCC#P2-1 active — satisfied.\n');
      writeFile(root, 'README.md', '# circuit-next\n');
      writeFile(
        root,
        'specs/ratchet-floor.json',
        JSON.stringify({ floors: { contract_test_count: 1 }, notes: 'clean' }),
      );
      writeFile(root, 'specs/plans/phase-2-implementation.md', 'Per-criterion close status only.');
      writeFile(root, 'specs/plans/phase-1-close-revised.md', 'No forbidden phrases.');
      writeFile(root, 'specs/plans/slice-47-hardening-foldins.md', 'Plan body.');
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('green');
    });
  });

  it("red when 'N/8' progress fraction appears in a non-citation context", () => {
    withTempRepo((root) => {
      writeFile(
        root,
        'specs/plans/phase-2-implementation.md',
        '# plan\nPhase 2 close count advances 2/8 to 3/8 at this landing.\n',
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/N\/8 progress fraction/);
    });
  });

  it('red when "substantially complete" appears in a non-citation context', () => {
    withTempRepo((root) => {
      writeFile(
        root,
        'specs/plans/phase-1-close-revised.md',
        '# plan\nPhase 2 is substantially complete.\n',
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/substantially complete/);
    });
  });

  it('green when forbidden phrases appear inside a rejection-verb citation context (line mentions "rejects" / "forbids" / "prohibits" / "disallows" / "banned" / "do not use")', () => {
    // Slice 47c Codex challenger HIGH 2 fold-in: citation guards were
    // tightened to require an explicit rejection verb. See the new
    // guard-abuse tests later in this file for the counter-examples
    // (lines citing only "ADR-0007" or "Slice 47c" without a
    // rejection verb no longer bypass the firewall).
    withTempRepo((root) => {
      writeFile(
        root,
        'specs/plans/phase-2-implementation.md',
        '# plan\nADR-0007 §3 rejects "green-by-redeferral", "7/8 complete", "mostly done".\n',
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('green');
    });
  });

  it("PROJECT_STATE.md scope is bounded to the current entry (above the first '*(Previous slice' marker)", () => {
    withTempRepo((root) => {
      writeFile(
        root,
        'PROJECT_STATE.md',
        [
          '# state',
          'CC#P2-1 active — satisfied (current entry, clean).',
          '',
          '*(Previous slice — Slice 99 — below; preserved for audit trail.)*',
          '',
          'Phase 2 close count was 7/8 at this historical landing.',
          'mostly done was the disposition.',
        ].join('\n'),
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('green');
    });
  });

  it('PROJECT_STATE.md current entry IS scanned (forbidden phrases in current entry land red)', () => {
    withTempRepo((root) => {
      writeFile(
        root,
        'PROJECT_STATE.md',
        [
          '# state',
          'Phase 2 close count is 5/8 at this landing.',
          '',
          '*(Previous slice — Slice 99 — below; preserved for audit trail.)*',
        ].join('\n'),
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/PROJECT_STATE\.md/);
    });
  });

  it('detects all enumerated forbidden patterns (not just N/8 + substantially complete)', () => {
    const phrasesToTest: { content: string; label: string }[] = [
      { content: 'composite status of Phase 2 is...', label: 'composite status' },
      { content: 'aggregate green across criteria.', label: 'aggregate green' },
      { content: 'CC#P2-7 was trivially green.', label: 'trivially green' },
      { content: 'green-by-redeferral acceptance.', label: 'green-by-redeferral' },
      { content: 'all but one criterion satisfied.', label: 'all but one' },
      { content: 'only 1 remaining before close.', label: 'only N remaining' },
      { content: 'complete except for CC#P2-7.', label: 'complete except for' },
      { content: 'nearly done with Phase 2.', label: 'nearly done' },
      { content: 'mostly done with the close.', label: 'mostly done' },
      { content: 'Phase 2 is close to done.', label: 'close to done' },
      { content: 'we are at near close.', label: 'near close' },
    ];
    for (const { content, label } of phrasesToTest) {
      withTempRepo((root) => {
        writeFile(root, 'README.md', `# circuit-next\n${content}\n`);
        const result = checkForbiddenScalarProgressPhrases(root);
        expect(result.level, `Expected '${label}' to be detected: ${content}`).toBe('red');
        expect(result.detail).toMatch(
          new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        );
      });
    }
  });

  // Slice 47c Codex challenger HIGH 1 fold-in — pattern enumeration
  // expanded to cover every ADR-0007 §3 phrase family Codex named.
  // Pre-fold-in, these phrasings could reintroduce forbidden wording
  // while Check 34 stayed green (ADR-0007 explicitly names each of
  // them at specs/adrs/ADR-0007-phase-2-close-criteria.md:877 +
  // :882 + :1049 + :1053 but the Check 34 pattern set was narrower).
  it('detects expanded pattern families added in the Slice 47c Codex HIGH 1 fold-in', () => {
    const expandedPhrases: { content: string; label: string }[] = [
      { content: '5 out of 8 criteria done.', label: 'N out of 8' },
      { content: '75% complete with Phase 2.', label: 'N% complete/done/progress' },
      { content: '50% done across the board.', label: 'N% complete/done/progress' },
      { content: '30% progress toward close.', label: 'N% complete/done/progress' },
      { content: 'progress percentage across criteria.', label: 'progress percentage' },
      { content: 'close criteria completion at 62.5.', label: 'close criteria completion' },
      { content: 'all except CC#P2-7 are green.', label: 'all except' },
      { content: 'status is 5 / 8 at landing.', label: 'N / 8 spaced-slash' },
    ];
    for (const { content, label } of expandedPhrases) {
      withTempRepo((root) => {
        writeFile(root, 'README.md', `# circuit-next\n${content}\n`);
        const result = checkForbiddenScalarProgressPhrases(root);
        expect(result.level, `Expected '${label}' to be detected: ${content}`).toBe('red');
        expect(result.detail).toMatch(
          new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        );
      });
    }
  });

  // Slice 47c Codex challenger HIGH 2 fold-in — guard-abuse tests.
  // Pre-fold-in, the citation guard list included soft tokens
  // ("ADR-0007", "Slice 47c", "firewall", "No-aggregate-scoring") that
  // individually bypassed the firewall. Codex named "Slice 47c status:
  // 7/8 complete" as a bypass example. Post-fold-in, a line qualifies
  // as a citation context only if it carries an explicit rejection
  // verb ("forbid", "reject", "prohibit", "disallow", "do not use",
  // "don't use", "banned") — soft tokens alone are not sufficient.
  it('a line citing "ADR-0007" or "Slice 47c" without an explicit rejection verb does NOT bypass the firewall', () => {
    const bypassAttempts: string[] = [
      // Status line using a slice name as a soft guard
      'Slice 47c status: 7/8 complete.',
      // Status line citing the ADR doc name
      'ADR-0007 progress: mostly done.',
      // Soft-token citation without rejection
      'Per the firewall section, we are at 5/8.',
      // No-aggregate-scoring mentioned but not as rejection
      'No-aggregate-scoring note: aggregate green is achieved.',
    ];
    for (const content of bypassAttempts) {
      withTempRepo((root) => {
        writeFile(root, 'README.md', `# circuit-next\n${content}\n`);
        const result = checkForbiddenScalarProgressPhrases(root);
        expect(result.level, `Expected tightened guards to detect bypass attempt: ${content}`).toBe(
          'red',
        );
      });
    }
  });

  it('a line carrying an explicit rejection verb DOES bypass the firewall (citation context)', () => {
    const legitimateCitations: string[] = [
      'ADR-0007 §3 rejects "7/8 complete" and "N-of-8" phrasings.',
      'The firewall forbids "mostly done" as a close-progress phrase.',
      'Do not use "aggregate green" — the ADR prohibits it.',
      "Don't use '5/8' as a status — it is banned.",
      'This prose disallows "nearly done" on any live surface.',
      'Banned phrases include "composite status" and "75% complete".',
    ];
    for (const content of legitimateCitations) {
      withTempRepo((root) => {
        writeFile(root, 'README.md', `# circuit-next\n${content}\n`);
        const result = checkForbiddenScalarProgressPhrases(root);
        expect(
          result.level,
          `Expected explicit rejection verb to qualify as citation context: ${content}`,
        ).toBe('green');
      });
    }
  });

  // Slice 47c Codex challenger LOW 1 fold-in — the prior "full
  // enumeration" test only asserted the pattern count was >= 15 and
  // spot-checked five labels, so a future edit could drop several
  // patterns while keeping the test green. This assertion pins the
  // EXACT label set (in order) so any addition/removal/rename of a
  // pattern trips the test and forces an intentional update.
  it('pins the EXACT forbidden pattern label set (LOW 1 fold-in — exact-set pin)', () => {
    const labels = ADR_0007_FORBIDDEN_PROGRESS_PATTERNS.map((p) => p.label);
    expect(labels).toEqual([
      'N/8 progress fraction',
      'literal N/8',
      'N / 8 spaced-slash',
      'N-of-8 progress',
      'literal N-of-8',
      'N of 8 phrasing',
      'N out of 8',
      'N% complete/done/progress',
      'progress percentage',
      'close criteria completion',
      'substantially complete',
      'mostly done',
      'nearly done',
      'close to done',
      'near close',
      'all but one',
      'all except',
      'only N remaining',
      'complete except for',
      'green-by-redeferral',
      'trivially green',
      'aggregate green',
      'composite status',
    ]);
  });

  it('scans the live curated file list (Slice 47c HIGH 6 surface)', () => {
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('PROJECT_STATE.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('README.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/ratchet-floor.json');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/plans/phase-2-implementation.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/plans/phase-1-close-revised.md');
  });

  // Slice 67a (Codex MED-1 fold-in) — the chronicle file is enumerated
  // in the scan inventory but its content is scoped out by design. These
  // tests pin (a) the content-exempt set membership, (b) the honest
  // "enumerated vs content-scanned" split in the green status detail,
  // and (c) that forbidden phrases living inside the chronicle's
  // historical narrative do NOT trip the firewall (the whole point of
  // relocating `*(Previous slice` history into PROJECT_STATE-chronicle.md).
  it('PROJECT_STATE-chronicle.md is in FORBIDDEN_PROGRESS_SCAN_FILES and in the content-exempt set', () => {
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('PROJECT_STATE-chronicle.md');
    expect(FORBIDDEN_PROGRESS_CONTENT_EXEMPT_FILES.has('PROJECT_STATE-chronicle.md')).toBe(true);
  });

  it("green status detail distinguishes 'enumerated', 'content-scanned', and 'content-exempt'", () => {
    withTempRepo((root) => {
      writeFile(root, 'PROJECT_STATE.md', '# state\nCC#P2-1 active — satisfied.\n');
      writeFile(root, 'README.md', '# circuit-next\n');
      writeFile(
        root,
        'specs/ratchet-floor.json',
        JSON.stringify({ floors: { contract_test_count: 1 }, notes: 'clean' }),
      );
      writeFile(root, 'specs/plans/phase-2-implementation.md', 'Per-criterion close status only.');
      writeFile(root, 'specs/plans/phase-1-close-revised.md', 'No forbidden phrases.');
      writeFile(root, 'specs/plans/slice-47-hardening-foldins.md', 'Plan body.');
      writeFile(root, 'AGENTS.md', 'Active methodology authority.\n');
      writeFile(root, 'CLAUDE.md', 'Methodology authority.\n');
      writeFile(root, 'TIER.md', 'Claim matrix.\n');
      writeFile(
        root,
        'PROJECT_STATE-chronicle.md',
        'Non-authoritative history. substantially complete appears here but is exempt.\n',
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/\benumerated\b/);
      expect(result.detail).toMatch(/\bcontent-scanned\b/);
      expect(result.detail).toMatch(/\bcontent-exempt\b/);
    });
  });

  it('forbidden phrases inside PROJECT_STATE-chronicle.md content do NOT trip the firewall (content-exempt by design)', () => {
    withTempRepo((root) => {
      writeFile(root, 'PROJECT_STATE.md', '# state\nCC#P2-1 active — satisfied.\n');
      writeFile(root, 'README.md', '# circuit-next\n');
      writeFile(
        root,
        'specs/ratchet-floor.json',
        JSON.stringify({ floors: { contract_test_count: 1 }, notes: 'clean' }),
      );
      writeFile(root, 'specs/plans/phase-2-implementation.md', 'Per-criterion.');
      writeFile(root, 'specs/plans/phase-1-close-revised.md', 'Clean.');
      writeFile(root, 'specs/plans/slice-47-hardening-foldins.md', 'Body.');
      writeFile(root, 'AGENTS.md', 'Active authority.\n');
      writeFile(root, 'CLAUDE.md', 'Authority.\n');
      writeFile(root, 'TIER.md', 'Matrix.\n');
      // Forbidden phrases in the chronicle's body — they would fire red
      // if the chronicle were content-scanned. The content-exempt treatment
      // skips them.
      writeFile(
        root,
        'PROJECT_STATE-chronicle.md',
        [
          '# PROJECT_STATE chronicle',
          '',
          'Non-authoritative history.',
          '',
          'Phase 2 is 7/8 complete — substantially complete; aggregate green.',
          'Close to done on the 3/8 remaining.',
        ].join('\n'),
      );
      const result = checkForbiddenScalarProgressPhrases(root);
      expect(result.level).toBe('green');
    });
  });
});
