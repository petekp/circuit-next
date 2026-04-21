import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { FRAMING_LITERALS, LANES } from '../../scripts/audit.mjs';
import { suggestNextSliceId } from '../../scripts/doctor.mjs';

// Slice 30 (DOG+2) — `slice:doctor` contract assertions.
//
// Anchored in `specs/plans/phase-1-close-revised.md` §Slice DOG+2. The
// deliverable enumerated there is: `npm run slice:doctor` prints current
// HEAD, next slice from PROJECT_STATE, required lane/framing literals
// including exact `Alternate framing:` form, files likely involved,
// required verification commands, product ratchets currently passing /
// failing, and a suggested commit-message skeleton.
//
// This test pins each section against drift. Critically, it asserts the
// lane and framing literals printed by doctor match the values audit.mjs
// imports — the briefing must not diverge from the gate.

function runDoctor(): { exitCode: number; stdout: string } {
  try {
    const stdout = execFileSync('node', ['scripts/doctor.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string | Buffer };
    const stdout =
      typeof e.stdout === 'string' ? e.stdout : Buffer.from(e.stdout ?? '').toString('utf8');
    return { exitCode: typeof e.status === 'number' ? e.status : 1, stdout };
  }
}

describe('Slice 30 — slice:doctor briefing script', () => {
  const { exitCode, stdout } = runDoctor();

  it('exits 0 (briefing, not a gate)', () => {
    expect(exitCode, `stdout tail:\n${stdout.slice(-400)}`).toBe(0);
  });

  it('prints the header line', () => {
    expect(stdout).toContain('circuit-next — slice:doctor');
  });

  it('section 1 — prints HEAD, branch, current_slice', () => {
    expect(stdout).toMatch(/━━━ 1\. Where you are ━━━/);
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    expect(stdout).toContain(head.slice(0, 7));
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    expect(stdout).toContain(`branch:         ${branch}`);
    const readme = readFileSync('README.md', 'utf8');
    const markerMatch = readme.match(/<!--\s*current_slice:\s*([0-9a-z-]+)\s*-->/i);
    if (markerMatch) {
      expect(stdout).toContain(`current_slice:  ${markerMatch[1]}`);
    }
  });

  it('section 2 — points at the authoritative plan', () => {
    expect(stdout).toMatch(/━━━ 2\. Next slice ━━━/);
    expect(stdout).toContain('specs/plans/phase-1-close-revised.md');
    expect(stdout).toContain('SLICE_ID_PATTERN = ^[0-9]+[a-z]?$');
  });

  it('section 3 — prints all six LANES verbatim, sourced from audit.mjs', () => {
    expect(stdout).toMatch(/━━━ 3\. Required lane \(pick one\) ━━━/);
    for (const lane of LANES) {
      expect(stdout, `expected "Lane: ${lane}" in doctor stdout`).toContain(`Lane: ${lane}`);
    }
    expect(LANES).toEqual([
      'Ratchet-Advance',
      'Equivalence Refactor',
      'Migration Escrow',
      'Discovery',
      'Disposable',
      'Break-Glass',
    ]);
  });

  it('section 4 — prints all three framing literals verbatim', () => {
    expect(stdout).toMatch(/━━━ 4\. Framing triplet/);
    expect(stdout).toContain(FRAMING_LITERALS.failureMode);
    expect(stdout).toContain(FRAMING_LITERALS.acceptanceEvidence);
    expect(stdout).toContain(FRAMING_LITERALS.alternateFraming);
    expect(FRAMING_LITERALS.failureMode).toBe('Failure mode:');
    expect(FRAMING_LITERALS.acceptanceEvidence).toBe('Acceptance evidence:');
    expect(FRAMING_LITERALS.alternateFraming).toBe('Alternate framing:');
  });

  it('section 5 — lists each gate command', () => {
    expect(stdout).toMatch(/━━━ 5\. Verification commands/);
    expect(stdout).toContain('npm run check');
    expect(stdout).toContain('npm run lint');
    expect(stdout).toContain('npm run test');
    expect(stdout).toContain('npm run verify');
    expect(stdout).toContain('npm run audit');
  });

  it('section 6 — reports inventory surfaces + audit ratchets', () => {
    expect(stdout).toMatch(/━━━ 6\. Product ratchets ━━━/);
    expect(stdout).toContain('Inventory surfaces');
    expect(stdout).toContain('Audit-based ratchets');
    expect(stdout).toContain('status-epoch alignment');
    expect(stdout).toContain('status docs current');
    expect(stdout).toContain('pinned ratchet floor');
    expect(stdout).toContain('adversarial yield ledger');
    expect(stdout).toContain('TIER orphan-claim');
    expect(stdout).toContain('product reality gate');
    expect(stdout).toContain('phase authority semantics');
  });

  it('section 7 — shows files touched by HEAD', () => {
    expect(stdout).toMatch(/━━━ 7\. Files touched by HEAD ━━━/);
  });

  it('section 8 — commit skeleton carries lane + framing + authority shape', () => {
    expect(stdout).toMatch(/━━━ 8\. Commit-message skeleton ━━━/);
    expect(stdout).toContain('slice-');
    expect(stdout).toMatch(/Lane: </);
    expect(stdout).toContain('Trajectory:');
    expect(stdout).toContain('Authority:');
    expect(stdout).toContain(FRAMING_LITERALS.failureMode);
    expect(stdout).toContain(FRAMING_LITERALS.acceptanceEvidence);
    expect(stdout).toContain(FRAMING_LITERALS.alternateFraming);
  });

  it('closes with a read-only-hint disclaimer', () => {
    expect(stdout).toContain('slice:doctor is a read-only hint');
    expect(stdout).toContain('npm run audit');
  });
});

describe('suggestNextSliceId', () => {
  it('numeric marker → numeric bump primary + letter variant', () => {
    const result = suggestNextSliceId('29');
    expect(result).toContain('30');
    expect(result).toContain('29a');
  });

  it('letter marker → letter bump primary + numeric bump', () => {
    const result = suggestNextSliceId('27a');
    expect(result).toContain('27b');
    expect(result).toContain('28');
  });

  it('returns null for malformed marker', () => {
    expect(suggestNextSliceId('foo')).toBeNull();
    expect(suggestNextSliceId(null as unknown as string)).toBeNull();
  });
});
