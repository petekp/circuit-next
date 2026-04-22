import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ADR_0007_FORBIDDEN_PROGRESS_PATTERNS,
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

  it('green when forbidden phrases appear inside a citation context (line mentions "forbidden" / "rejects" / "ADR-0007" / "Slice 47c" / "firewall")', () => {
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

  it('exposes the full forbidden pattern enumeration', () => {
    expect(ADR_0007_FORBIDDEN_PROGRESS_PATTERNS.length).toBeGreaterThanOrEqual(15);
    // Pin the labels so a future trim of the pattern list trips this test.
    const labels = ADR_0007_FORBIDDEN_PROGRESS_PATTERNS.map((p) => p.label);
    expect(labels).toContain('N/8 progress fraction');
    expect(labels).toContain('substantially complete');
    expect(labels).toContain('aggregate green');
    expect(labels).toContain('composite status');
    expect(labels).toContain('green-by-redeferral');
  });

  it('scans the live curated file list (Slice 47c HIGH 6 surface)', () => {
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('PROJECT_STATE.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('README.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/ratchet-floor.json');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/plans/phase-2-implementation.md');
    expect(FORBIDDEN_PROGRESS_SCAN_FILES).toContain('specs/plans/phase-1-close-revised.md');
  });
});
