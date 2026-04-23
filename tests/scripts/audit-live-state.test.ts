/**
 * readLiveStateSection helper coverage (Slice 67 methodology-trim-arc
 * LIVE-STATE-HELPER).
 *
 * Unit tests for the compat-shim helper introduced by Slice 67 per plan
 * §5.1 + §5.4. The helper parses the `## §0 Live state` section of
 * PROJECT_STATE.md (or any markdown file) and returns its content, with
 * explicit behavior on each failure mode the plan enumerates.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLiveStateSection } from '../../scripts/audit.mjs';

describe('readLiveStateSection — Slice 67 live-state helper', () => {
  let tmpDir: string;
  let fixturePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'slice-67-live-state-'));
    fixturePath = join(tmpDir, 'fixture.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('happy path — valid `## §0 Live state` section returns its trimmed content', () => {
    writeFileSync(
      fixturePath,
      `<!-- current_slice: 67 -->

# PROJECT_STATE — circuit-next

## §0 Live state

- **current_slice:** 67
- **current_arc:** methodology-trim-arc
- **current_phase:** Phase 2 — Implementation (continuing)

Chronicle at PROJECT_STATE-chronicle.md.

## §1 Something else

More content that should not be returned.
`,
    );
    const result = readLiveStateSection(fixturePath);
    expect(result).not.toBeNull();
    expect(result).toContain('current_slice:** 67');
    expect(result).toContain('current_arc:** methodology-trim-arc');
    expect(result).toContain('current_phase:** Phase 2');
    expect(result).toContain('Chronicle at PROJECT_STATE-chronicle.md.');
    expect(result).not.toContain('More content that should not be returned');
    expect(result).not.toContain('§1 Something else');
  });

  it('missing section — returns null when `## §0 Live state` heading is absent', () => {
    writeFileSync(
      fixturePath,
      `<!-- current_slice: 67 -->

# PROJECT_STATE — circuit-next

Some content but no live state section.

## §1 Other
Content here.
`,
    );
    const result = readLiveStateSection(fixturePath);
    expect(result).toBeNull();
  });

  it('empty section — returns empty string when section has no content', () => {
    writeFileSync(
      fixturePath,
      `<!-- current_slice: 67 -->

# PROJECT_STATE — circuit-next

## §0 Live state

## §1 Next section
`,
    );
    const result = readLiveStateSection(fixturePath);
    expect(result).toBe('');
  });

  it('multiple sections (authoring error) — returns content of the first section', () => {
    writeFileSync(
      fixturePath,
      `<!-- current_slice: 67 -->

# PROJECT_STATE — circuit-next

## §0 Live state

- **current_slice:** 67 (first)

## §1 Between

Intervening content.

## §0 Live state

- **current_slice:** 99 (second, should be ignored)
`,
    );
    const result = readLiveStateSection(fixturePath);
    expect(result).not.toBeNull();
    expect(result).toContain('current_slice:** 67 (first)');
    expect(result).not.toContain('99 (second');
  });

  it('malformed heading typo — returns null when heading does not match exactly', () => {
    // Common typos: wrong heading level, wrong § character, missing space,
    // extra words, different case on "Live state" (headings are case-
    // sensitive per the LIVE_STATE_HEADING_PATTERN).
    const typoVariants = [
      '# §0 Live state\n\nContent.\n', // single #
      '### §0 Live state\n\nContent.\n', // triple #
      '## §0 Live State\n\nContent.\n', // different case
      '## §0 livestate\n\nContent.\n', // concatenated
      '## §0  Live state\n\nContent.\n', // double space
      '## §0-Live state\n\nContent.\n', // hyphen instead of space
      '## S0 Live state\n\nContent.\n', // ASCII S instead of §
    ];
    for (const body of typoVariants) {
      writeFileSync(fixturePath, `<!-- current_slice: 67 -->\n\n${body}`);
      const result = readLiveStateSection(fixturePath);
      expect(result).toBeNull();
    }
  });

  it('nonexistent path — returns null rather than throwing', () => {
    const missingPath = join(tmpDir, 'does-not-exist.md');
    const result = readLiveStateSection(missingPath);
    expect(result).toBeNull();
  });

  it('section runs to end-of-file when no next `## ` heading follows', () => {
    writeFileSync(
      fixturePath,
      `<!-- current_slice: 67 -->

# PROJECT_STATE — circuit-next

## §0 Live state

- **current_slice:** 67

Final line at EOF.
`,
    );
    const result = readLiveStateSection(fixturePath);
    expect(result).not.toBeNull();
    expect(result).toContain('current_slice:** 67');
    expect(result).toContain('Final line at EOF.');
  });
});
