import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Slice 26b — Status epoch alignment + pinned ratchet floor.
//
// Closes three TIER.md `planned → 26b` rows: status_docs_current,
// pinned_ratchet_floor, current_slice_status_epoch. The agreement-only
// checkPhaseDrift cannot detect the case where README / PROJECT_STATE /
// TIER consistently tell the same stale story. Slice 26b adds:
//   (1) a structured `<!-- current_slice: <id> -->` marker on all three
//       docs, checked by checkStatusEpochAlignment;
//   (2) a freshness check that compares the aligned marker against the
//       most recent `^slice-<id>:` git log subject — checkStatusDocsCurrent;
//   (3) a pinned ratchet floor in specs/ratchet-floor.json so close gates
//       no longer depend purely on the HEAD~1 moving window —
//       checkPinnedRatchetFloor.
//
// Each check is exercised against (a) the live repo, (b) constructed
// temp-dir fixtures that simulate green and red states without touching
// the project's git history. For checkStatusDocsCurrent we spin up a real
// ephemeral git repo per-test so the helper's `git log` calls see actual
// commit subjects, closing the "both stale is red is not pinned by tests"
// gap that Codex MED-1 flagged on the draft. Fold-in set: HIGH-1 HIGH-2
// MED-1..MED-5 LOW-1 LOW-2 per specs/reviews/arc-slice-26b-codex.md.

import {
  CURRENT_SLICE_MARKER_PATTERN,
  SLICE_COMMIT_SUBJECT_PATTERN,
  SLICE_ID_PATTERN,
  checkPinnedRatchetFloor,
  checkStatusDocsCurrent,
  checkStatusEpochAlignment,
  extractCurrentSliceMarker,
  extractSliceIdFromCommitSubject,
  isValidSliceId,
  readPinnedRatchetFloor,
  validatePinnedRatchetFloorData,
} from '../../scripts/audit.mjs';

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'circuit-next-slice-26b-'));
}

function writeThreeDocs(
  root: string,
  markers: { readme: string | null; projectState: string | null; tier: string | null },
) {
  const readme =
    markers.readme === null ? '# repo\n' : `<!-- current_slice: ${markers.readme} -->\n\n# repo\n`;
  const projectState =
    markers.projectState === null
      ? '# PROJECT_STATE\n'
      : `<!-- current_slice: ${markers.projectState} -->\n\n# PROJECT_STATE\n`;
  const tier =
    markers.tier === null
      ? '---\nname: tier\n---\n\n# TIER\n'
      : `---\nname: tier\n---\n\n<!-- current_slice: ${markers.tier} -->\n\n# TIER\n`;
  writeFileSync(join(root, 'README.md'), readme);
  writeFileSync(join(root, 'PROJECT_STATE.md'), projectState);
  writeFileSync(join(root, 'TIER.md'), tier);
}

function writeFloor(
  root: string,
  floor: number | 'missing' | 'invalid',
  metadataOverrides: Partial<{
    schema_version: unknown;
    last_advanced_at: unknown;
    last_advanced_in_slice: unknown;
  }> = {},
) {
  const specsDir = join(root, 'specs');
  mkdirSync(specsDir, { recursive: true });
  const floorPath = join(specsDir, 'ratchet-floor.json');
  if (floor === 'missing') return;
  if (floor === 'invalid') {
    writeFileSync(floorPath, '{"not":"valid","floors":"nope"}');
    return;
  }
  const payload = {
    schema_version: 1,
    floors: { contract_test_count: floor },
    last_advanced_at: '2026-04-20',
    last_advanced_in_slice: '26b',
    ...metadataOverrides,
  };
  writeFileSync(floorPath, JSON.stringify(payload, null, 2));
}

function initGitRepo(root: string) {
  execSync('git init -q -b main', { cwd: root });
  execSync('git config user.email test@example.com', { cwd: root });
  execSync('git config user.name test', { cwd: root });
}

function commitWithSubject(root: string, subject: string, fileSuffix = '') {
  // Write a small marker file so the commit has a diff.
  writeFileSync(join(root, `commit${fileSuffix || Date.now()}.txt`), `${subject}\n`);
  execSync('git add -A', { cwd: root });
  execSync(`git commit -q --allow-empty -m ${JSON.stringify(subject)}`, {
    cwd: root,
    env: { ...process.env, GIT_COMMITTER_DATE: '2026-04-20T00:00:00Z' },
  });
}

describe('SLICE_ID_PATTERN + isValidSliceId (Slice 26b, Codex MED-5 fold-in)', () => {
  it('accepts canonical slice ids', () => {
    for (const ok of ['25', '25a', '25b', '26', '26a', '26b', '27c', '100z']) {
      expect(isValidSliceId(ok)).toBe(true);
    }
  });

  it('rejects draft / provisional / WIP subjects', () => {
    for (const bad of ['26b-wip', '26ba', 'phase-1', '26-', '-26b', 'a26', '', '  ', '26b ']) {
      expect(isValidSliceId(bad)).toBe(false);
    }
  });

  it('rejects non-strings', () => {
    expect(isValidSliceId(26 as unknown as string)).toBe(false);
    expect(isValidSliceId(null as unknown as string)).toBe(false);
    expect(isValidSliceId(undefined as unknown as string)).toBe(false);
  });

  it('exposes the pattern regex', () => {
    expect(SLICE_ID_PATTERN).toBeInstanceOf(RegExp);
  });
});

describe('extractCurrentSliceMarker (Slice 26b pure helper)', () => {
  it('extracts the slice id from a well-formed marker', () => {
    expect(extractCurrentSliceMarker('<!-- current_slice: 26b -->\n# body')).toBe('26b');
  });

  it('is tolerant of interior whitespace', () => {
    expect(extractCurrentSliceMarker('<!--   current_slice:   26b   -->\n# body')).toBe('26b');
  });

  it('is case-insensitive on the keyword', () => {
    expect(extractCurrentSliceMarker('<!-- Current_Slice: 26b -->\n# body')).toBe('26b');
  });

  it('rejects slice-ids that do not match SLICE_ID_PATTERN (Codex MED-5)', () => {
    expect(extractCurrentSliceMarker('<!-- current_slice: 27c-2 -->\n# body')).toBe(null);
    expect(extractCurrentSliceMarker('<!-- current_slice: 26b-wip -->\n# body')).toBe(null);
    expect(extractCurrentSliceMarker('<!-- current_slice: 26ba -->\n# body')).toBe(null);
  });

  it('returns null for missing markers', () => {
    expect(extractCurrentSliceMarker('# no marker here')).toBe(null);
  });

  it('returns null for malformed inputs', () => {
    expect(extractCurrentSliceMarker('<!-- current_slice -->\n# body')).toBe(null);
    expect(extractCurrentSliceMarker(42 as unknown as string)).toBe(null);
    expect(extractCurrentSliceMarker(null as unknown as string)).toBe(null);
  });

  it('rejects markers that appear AFTER the first markdown heading (Codex MED-3 zone anchor)', () => {
    const body = '# heading first\n\n<!-- current_slice: 26b -->\nbody';
    expect(extractCurrentSliceMarker(body)).toBe(null);
  });

  it('rejects DUPLICATED markers in the header zone (Codex MED-3)', () => {
    const body = '<!-- current_slice: 26a -->\n<!-- current_slice: 26b -->\n# body';
    expect(extractCurrentSliceMarker(body)).toBe(null);
  });

  it('ignores markers embedded in quoted code/diff below the first heading', () => {
    // Only the first-heading-zone is scanned; historical quoted content is ignored.
    const body =
      '<!-- current_slice: 26b -->\n\n# heading\n\n```\n<!-- current_slice: 99z -->\n```\n';
    expect(extractCurrentSliceMarker(body)).toBe('26b');
  });

  it('exposes the underlying regex pattern', () => {
    expect(CURRENT_SLICE_MARKER_PATTERN).toBeInstanceOf(RegExp);
    expect(CURRENT_SLICE_MARKER_PATTERN.flags).toContain('i');
  });
});

describe('extractSliceIdFromCommitSubject (Slice 26b pure helper)', () => {
  it('extracts the slice id from a conventional slice commit subject', () => {
    expect(
      extractSliceIdFromCommitSubject('slice-26a: Run snapshot artifact split (HIGH #1)'),
    ).toBe('26a');
  });

  it('rejects draft / WIP / hyphenated-suffix subjects (Codex MED-5)', () => {
    expect(extractSliceIdFromCommitSubject('slice-26b-wip: draft')).toBe(null);
    expect(extractSliceIdFromCommitSubject('slice-27c-b: hyphenated')).toBe(null);
    expect(extractSliceIdFromCommitSubject('slice-26ba: off-by-one-slice')).toBe(null);
  });

  it('returns null for non-slice subjects (docs, fix, chore)', () => {
    expect(extractSliceIdFromCommitSubject('docs: PROJECT_STATE update')).toBe(null);
    expect(extractSliceIdFromCommitSubject('fix: typo in ADR-0003')).toBe(null);
    expect(extractSliceIdFromCommitSubject('Merge branch main')).toBe(null);
  });

  it('returns null for malformed inputs', () => {
    expect(extractSliceIdFromCommitSubject('slice-: empty id')).toBe(null);
    expect(extractSliceIdFromCommitSubject('slice-26a no-colon')).toBe(null);
    expect(extractSliceIdFromCommitSubject(42 as unknown as string)).toBe(null);
  });

  it('exposes the underlying regex pattern', () => {
    expect(SLICE_COMMIT_SUBJECT_PATTERN).toBeInstanceOf(RegExp);
  });
});

describe('checkStatusEpochAlignment (Slice 26b full-file check)', () => {
  it('returns green when all three docs carry matching markers', () => {
    const root = makeTempRoot();
    try {
      writeThreeDocs(root, { readme: '26b', projectState: '26b', tier: '26b' });
      const result = checkStatusEpochAlignment(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('26b');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when any doc is missing the marker', () => {
    const root = makeTempRoot();
    try {
      writeThreeDocs(root, { readme: '26b', projectState: null, tier: '26b' });
      const result = checkStatusEpochAlignment(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('PROJECT_STATE.md');
      expect(result.detail).toContain('missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when docs disagree on the marker', () => {
    const root = makeTempRoot();
    try {
      writeThreeDocs(root, { readme: '26b', projectState: '26a', tier: '26b' });
      const result = checkStatusEpochAlignment(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/disagree/i);
      expect(result.detail).toContain('README.md=26b');
      expect(result.detail).toContain('PROJECT_STATE.md=26a');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when any target file is missing', () => {
    const root = makeTempRoot();
    try {
      writeFileSync(join(root, 'README.md'), '<!-- current_slice: 26b -->\n');
      writeFileSync(join(root, 'TIER.md'), '<!-- current_slice: 26b -->\n');
      // No PROJECT_STATE.md.
      const result = checkStatusEpochAlignment(root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('PROJECT_STATE.md');
      expect(result.detail).toContain('missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes on the live repo (the three docs are aligned)', () => {
    const result = checkStatusEpochAlignment();
    expect(result.level).toBe('green');
  });
});

describe('checkStatusDocsCurrent (Slice 26b temp-git fixtures — Codex MED-1 fold-in)', () => {
  it('returns green when docs match the most recent slice commit', () => {
    const root = makeTempRoot();
    try {
      initGitRepo(root);
      writeThreeDocs(root, { readme: '26b', projectState: '26b', tier: '26b' });
      commitWithSubject(root, 'slice-26a: earlier landing');
      commitWithSubject(root, 'slice-26b: most recent slice');
      const result = checkStatusDocsCurrent(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('26b');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when docs all agree on a stale slice id (both stale is red)', () => {
    const root = makeTempRoot();
    try {
      initGitRepo(root);
      writeThreeDocs(root, { readme: '26a', projectState: '26a', tier: '26a' });
      commitWithSubject(root, 'slice-26a: earlier landing');
      commitWithSubject(root, 'slice-26b: most recent slice');
      const result = checkStatusDocsCurrent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/stale in unison/i);
      expect(result.detail).toContain('26a');
      expect(result.detail).toContain('26b');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when no slice-shaped commit exists in history (Codex MED-2)', () => {
    const root = makeTempRoot();
    try {
      initGitRepo(root);
      writeThreeDocs(root, { readme: '26b', projectState: '26b', tier: '26b' });
      commitWithSubject(root, 'docs: only non-slice commits here');
      commitWithSubject(root, 'fix: also non-slice', 'b');
      const result = checkStatusDocsCurrent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/no slice-shaped commit/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when alignment is broken (one doc missing marker)', () => {
    const root = makeTempRoot();
    try {
      initGitRepo(root);
      writeThreeDocs(root, { readme: '26b', projectState: null, tier: '26b' });
      commitWithSubject(root, 'slice-26b: any');
      const result = checkStatusDocsCurrent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/alignment not green/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('smoke-passes on the live repo (structural only; HEAD may or may not be a slice commit mid-stream)', () => {
    const result = checkStatusDocsCurrent();
    expect(['green', 'red']).toContain(result.level);
    expect(result.detail).toMatch(/current_slice|slice commit|alignment|stale in unison/i);
  });
});

describe('checkPinnedRatchetFloor (Slice 26b full-file check)', () => {
  it('returns green when HEAD count meets the floor', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 100);
      const result = checkPinnedRatchetFloor(root, 120);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('120');
      expect(result.detail).toContain('100');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns green when HEAD count equals the floor exactly', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 100);
      const result = checkPinnedRatchetFloor(root, 100);
      expect(result.level).toBe('green');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when HEAD count is below the floor', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 200);
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('150');
      expect(result.detail).toContain('200');
      expect(result.detail).toMatch(/close gate/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when specs/ratchet-floor.json is missing', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 'missing');
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('ratchet-floor.json');
      expect(result.detail).toMatch(/missing|unparseable/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when the floor field is not a positive integer (zero or negative rejected — Codex HIGH-2)', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 0);
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('positive integer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red for a non-integer floor (structurally invalid)', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 'invalid');
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when schema_version is not literal 1 (Codex MED-4)', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 100, { schema_version: 2 });
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/schema_version/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when last_advanced_at is not a YYYY-MM-DD string (Codex MED-4)', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 100, { last_advanced_at: 'yesterday' });
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/last_advanced_at/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns red when last_advanced_in_slice does not match SLICE_ID_PATTERN (Codex MED-4 + MED-5)', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 100, { last_advanced_in_slice: '26b-wip' });
      const result = checkPinnedRatchetFloor(root, 150);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/last_advanced_in_slice/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes on the live repo', () => {
    const result = checkPinnedRatchetFloor();
    expect(result.level).toBe('green');
  });

  it('readPinnedRatchetFloor returns a well-shaped object on the live repo', () => {
    const data = readPinnedRatchetFloor();
    expect(data).not.toBe(null);
    expect(data?.schema_version).toBe(1);
    expect(typeof data?.floors?.contract_test_count).toBe('number');
    // last_advanced_in_slice tracks the most recent floor advancement.
    // See specs/ratchet-floor.json `notes` for the full per-slice ledger.
    // Most recent: Slice 43a (P2.5 HIGH 5 retargeting —
    // validateWorkflowKindPolicy helper extraction per plan §Slice 40
    // Retargeting note / §P2.5 Additional deliverable) advanced the
    // floor 885 → 900 (+15 static declarations in new
    // tests/contracts/workflow-kind-policy.test.ts covering the
    // shared JS canonical-set check and the TS safeParse-first
    // wrapper exposed via src/runtime/policy/workflow-kind-policy.ts).
    // This assertion pins the CURRENT slice id so any future floor
    // advancement that forgets to update the marker fails the test
    // immediately — the slice id changes only when the floor changes.
    expect(data?.last_advanced_in_slice).toBe('43a');
  });

  it('readPinnedRatchetFloor returns null when the file is missing', () => {
    const root = makeTempRoot();
    try {
      writeFloor(root, 'missing');
      const data = readPinnedRatchetFloor(root);
      expect(data).toBe(null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validatePinnedRatchetFloorData accepts a well-shaped object', () => {
    expect(
      validatePinnedRatchetFloorData({
        schema_version: 1,
        floors: { contract_test_count: 100 },
        last_advanced_at: '2026-04-20',
        last_advanced_in_slice: '26b',
      }),
    ).toEqual([]);
  });

  it('validatePinnedRatchetFloorData returns errors for every violation combined', () => {
    const errors = validatePinnedRatchetFloorData({
      schema_version: 2,
      floors: { contract_test_count: 0 },
      last_advanced_at: 'nope',
      last_advanced_in_slice: '26b-wip',
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('validatePinnedRatchetFloorData rejects non-object input', () => {
    expect(validatePinnedRatchetFloorData(null).length).toBeGreaterThan(0);
    expect(validatePinnedRatchetFloorData('string').length).toBeGreaterThan(0);
  });
});
