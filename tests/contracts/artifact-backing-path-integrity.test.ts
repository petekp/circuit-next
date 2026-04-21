import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_BACKING_PATH_CONTAINER_PATHS,
  ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS,
  ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS,
  PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE,
  checkArcCloseCompositionReviewPresence,
  checkArtifactBackingPathIntegrity,
  normalizeArtifactBackingPath,
} from '../../scripts/audit.mjs';

// These tests exercise checkArtifactBackingPathIntegrity (scripts/audit.mjs
// Check 25, introduced by Slice 35) against temp-dir fixtures. They encode
// the minimum-viable mechanism that would have caught HIGH 4 in
// specs/reviews/p2-foundation-composition-review.md at slice-34 authorship
// time: two distinct artifacts registered at normalized-equal backing_paths.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-backing-path-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

type ArtifactShape = {
  id: string;
  backing_paths: string[];
};

function artifactsFile(artifacts: ArtifactShape[]) {
  return JSON.stringify({ version: 2, artifacts });
}

describe('normalizeArtifactBackingPath', () => {
  it('returns the raw path unchanged when no synonym prefix matches', () => {
    expect(normalizeArtifactBackingPath('<run-root>/artifacts/result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('collapses <circuit-next-run-root> to the canonical <run-root> token', () => {
    expect(normalizeArtifactBackingPath('<circuit-next-run-root>/artifacts/result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('collapses <circuit-run-root> to the canonical <run-root> token', () => {
    expect(normalizeArtifactBackingPath('<circuit-run-root>/artifacts/result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('strips trailing parenthetical comments before comparison', () => {
    expect(
      normalizeArtifactBackingPath(
        '<plugin>/skills/<workflow-id>/circuit.yaml (as Workflow.steps[])',
      ),
    ).toBe('<plugin>/skills/<workflow-id>/circuit.yaml');
  });

  it('only strips trailing parentheticals (preserves inner parentheticals)', () => {
    expect(normalizeArtifactBackingPath('<run-root>/foo (bar)/baz.json')).toBe(
      '<run-root>/foo (bar)/baz.json',
    );
  });

  it('collapses /./ path segments (fold-in Codex MED 1)', () => {
    expect(normalizeArtifactBackingPath('<run-root>/artifacts/./result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('collapses consecutive slashes (fold-in Codex MED 1)', () => {
    expect(normalizeArtifactBackingPath('<run-root>//artifacts///result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('treats the template-prefix synonym + /./ combination as fully equivalent', () => {
    expect(normalizeArtifactBackingPath('<circuit-next-run-root>/artifacts/./result.json')).toBe(
      '<run-root>/artifacts/result.json',
    );
  });

  it('returns null on non-string input', () => {
    expect(normalizeArtifactBackingPath(42)).toBe(null);
    expect(normalizeArtifactBackingPath(null)).toBe(null);
    expect(normalizeArtifactBackingPath(undefined)).toBe(null);
  });

  it('returns null on empty / whitespace-only input', () => {
    expect(normalizeArtifactBackingPath('')).toBe(null);
    expect(normalizeArtifactBackingPath('   ')).toBe(null);
  });

  it('returns null when only a parenthetical remains after stripping', () => {
    expect(normalizeArtifactBackingPath('(stray)')).toBe(null);
  });
});

describe('checkArtifactBackingPathIntegrity', () => {
  it('returns green when specs/artifacts.json is absent', () => {
    withTempRepo((root) => {
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/not applicable/);
    });
  });

  it('returns green on an artifact graph with no collisions', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'alpha.result', backing_paths: ['<run-root>/artifacts/alpha.json'] },
          { id: 'beta.result', backing_paths: ['<run-root>/artifacts/beta.json'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/no collisions/);
    });
  });

  it('returns green when a single artifact declares multiple distinct backing_paths', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          {
            id: 'config.root',
            backing_paths: ['~/.config/circuit-next/config.yaml', '<project>/.circuit/config.yaml'],
          },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('green');
    });
  });

  it('returns red when two distinct artifacts share an exact backing_path and no allowlist entry matches', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'alpha.result', backing_paths: ['<run-root>/artifacts/shared.json'] },
          { id: 'beta.result', backing_paths: ['<run-root>/artifacts/shared.json'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/backing_path collision\(s\) untracked/);
      expect(result.detail).toMatch(/alpha\.result.*beta\.result|beta\.result.*alpha\.result/);
    });
  });

  it('returns red when two distinct artifacts collide across template-prefix synonyms (HIGH 4 class)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          // First uses <circuit-next-run-root>, second uses <run-root>.
          // Both normalize to <run-root>/artifacts/result.json.
          {
            id: 'fake.run-result',
            backing_paths: ['<circuit-next-run-root>/artifacts/result.json'],
          },
          {
            id: 'fake.workflow-result',
            backing_paths: ['<run-root>/artifacts/result.json'],
          },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/<run-root>\/artifacts\/result\.json/);
      expect(result.detail).toMatch(/fake\.run-result/);
      expect(result.detail).toMatch(/fake\.workflow-result/);
    });
  });

  it('returns green when colliding artifacts are all in the container path allowed-ids set', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'run.log', backing_paths: ['<run-root>/events.ndjson'] },
          { id: 'adapter.resolved', backing_paths: ['<run-root>/events.ndjson'] },
          { id: 'selection.resolution', backing_paths: ['<run-root>/events.ndjson'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/container-path share\(s\) \(legitimate\)/);
    });
  });

  it('returns red when an unauthorized artifact id shares a container path (fold-in Codex HIGH 3)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'run.log', backing_paths: ['<run-root>/events.ndjson'] },
          { id: 'adapter.resolved', backing_paths: ['<run-root>/events.ndjson'] },
          // Not in the events.ndjson allowed-ids set:
          { id: 'rogue.writer', backing_paths: ['<run-root>/events.ndjson'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/unauthorized sharer/);
      expect(result.detail).toMatch(/rogue\.writer/);
    });
  });

  // Slice 39 HIGH 4 fold-in: the founding allowlist entry for
  // {explore.result, run.result} at <run-root>/artifacts/result.json was
  // deleted when the path-split resolved the collision. The check now
  // accepts `opts.knownCollisions` so tests can inject synthetic tracked
  // entries to exercise the tracked / stale paths independently of the
  // (now empty) module-level allowlist.
  const syntheticTrackedEntry = Object.freeze({
    normalized: '<run-root>/artifacts/result.json',
    artifact_ids: Object.freeze(['alpha.result', 'beta.result']),
    closing_slice: 999,
    reason:
      'synthetic tracked-collision entry used by the Slice 39 test suite — exercises the tracked / stale paths after the founding entry was deleted',
  });

  it('returns yellow when a collision matches a known tracked entry', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'alpha.result', backing_paths: ['<circuit-next-run-root>/artifacts/result.json'] },
          { id: 'beta.result', backing_paths: ['<run-root>/artifacts/result.json'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root, {
        knownCollisions: [syntheticTrackedEntry],
      });
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/tracked collision/);
      expect(result.detail).toMatch(/closing slice 999/);
    });
  });

  it('returns red when artifact-id set differs from the tracked-collision entry (catches re-introduction of the class)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'alpha.result', backing_paths: ['<circuit-next-run-root>/artifacts/result.json'] },
          { id: 'beta.result', backing_paths: ['<run-root>/artifacts/result.json'] },
          // Third artifact re-introduces the collision class with a new id
          // that isn't in the tracked-collision allowlist; should go red.
          { id: 'gamma.result', backing_paths: ['<run-root>/artifacts/result.json'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root, {
        knownCollisions: [syntheticTrackedEntry],
      });
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/gamma\.result/);
    });
  });

  it('returns red when a known-collision allowlist entry has no matching live collision in strict mode (fold-in Codex HIGH 2)', () => {
    // An artifact graph with NO collision at the tracked path but the
    // allowlist still carries an entry pointing at it. The allowlist was
    // forgotten when the collision was resolved. Check 25 must surface
    // this as red so the closing slice is forced to delete the entry.
    // Tests must opt into strict mode to exercise this (the default for
    // test fixtures is non-strict, so unrelated fixtures don't spuriously
    // trip on the global allowlist).
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        artifactsFile([
          { id: 'delta.result', backing_paths: ['<run-root>/artifacts/delta.json'] },
          { id: 'epsilon.result', backing_paths: ['<run-root>/artifacts/epsilon.json'] },
        ]),
      );
      const result = checkArtifactBackingPathIntegrity(root, {
        strictAllowlist: true,
        knownCollisions: [syntheticTrackedEntry],
      });
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/stale tracked-collision allowlist entries/);
      expect(result.detail).toMatch(/closing slice 999/);
    });
  });

  it('Slice 39 HIGH 4 fold-in — live module-level allowlist is empty after the founding entry was deleted', () => {
    // The only tracked entry (Slice 35→39 {explore.result, run.result} at
    // <run-root>/artifacts/result.json) was deleted when Slice 39 split
    // explore.result off to <run-root>/artifacts/explore-result.json.
    // New entries require a Codex challenger pass per CLAUDE.md §Hard
    // invariants #6 and a closing_slice reference.
    expect(ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS.length).toBe(0);
  });

  it('Slice 39 HIGH 4 fold-in — live repo has no backing_path collisions (Check 25 green)', () => {
    // Regression guard on the live repo. After Slice 39 the allowlist is
    // empty, so any red or yellow finding means a new collision was
    // introduced — the slice-gate. This complements the lower-level
    // regression guard below by asserting the terminal green state.
    const result = checkArtifactBackingPathIntegrity();
    expect(result.level).toBe('green');
  });

  it('returns red when specs/artifacts.json is present but malformed JSON', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/artifacts.json', '{ not json');
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/failed to parse/);
    });
  });

  it('returns red on malformed artifact rows (fold-in Codex MED 3: fail closed, not silently skip)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'specs/artifacts.json',
        JSON.stringify({
          version: 2,
          artifacts: [
            { id: 'good.one', backing_paths: ['<run-root>/artifacts/a.json'] },
            // Missing id:
            { backing_paths: ['<run-root>/artifacts/b.json'] },
            // backing_paths not an array:
            { id: 'bad.two', backing_paths: '<run-root>/artifacts/c.json' },
            // Missing backing_paths:
            { id: 'bad.three' },
          ],
        }),
      );
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/malformed row/);
    });
  });

  it('returns red when top-level artifacts field is missing or not an array', () => {
    withTempRepo((root) => {
      writeRel(root, 'specs/artifacts.json', JSON.stringify({ version: 2, artifacts: null }));
      const result = checkArtifactBackingPathIntegrity(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/`artifacts` field missing or not an array/);
    });
  });

  it('passes on the live repo artifact graph (tracked collisions only)', () => {
    // Regression guard: running the check against the live specs/artifacts.json
    // should never return red. If it does, either (a) a new collision was
    // introduced without an allowlist entry, or (b) a known tracked entry
    // was removed while the collision still exists.
    const result = checkArtifactBackingPathIntegrity();
    expect(result.level).not.toBe('red');
  });
});

describe('allowlist structure invariants', () => {
  it('ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS maps strings to strings', () => {
    for (const [from, to] of Object.entries(ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS)) {
      expect(typeof from).toBe('string');
      expect(typeof to).toBe('string');
    }
  });

  it('ARTIFACT_BACKING_PATH_CONTAINER_PATHS entries each carry a non-empty rationale and non-empty allowed_artifact_ids set', () => {
    for (const [path, entry] of ARTIFACT_BACKING_PATH_CONTAINER_PATHS) {
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
      expect(typeof entry.rationale).toBe('string');
      expect(entry.rationale.length).toBeGreaterThan(0);
      expect(entry.allowed_artifact_ids).toBeInstanceOf(Set);
      expect(entry.allowed_artifact_ids.size).toBeGreaterThan(0);
    }
  });

  it('ARTIFACT_BACKING_PATH_CONTAINER_PATHS entries are Object.frozen (fold-in Codex LOW 1)', () => {
    // Object.freeze on the entry object prevents property reassignment (e.g.
    // `entry.rationale = 'hacked'` throws in strict mode). Node's Set does
    // not honor Object.freeze at the .add() call level — true Set
    // immutability would require a Proxy wrapper — so the runtime guarantee
    // here is at the entry-property level only. ReadonlySet at the type
    // level prevents normal TS mutation.
    for (const [, entry] of ARTIFACT_BACKING_PATH_CONTAINER_PATHS) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it('ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS entries each carry closing_slice + reason (when any are present)', () => {
    // Post-Slice-39: live allowlist is empty. The shape invariant below is
    // vacuously satisfied on an empty array, but fires the moment a future
    // slice adds a new tracked-collision entry without the required shape.
    for (const entry of ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS) {
      expect(typeof entry.normalized).toBe('string');
      expect(Array.isArray(entry.artifact_ids)).toBe(true);
      expect(entry.artifact_ids.length).toBeGreaterThanOrEqual(2);
      expect(typeof entry.closing_slice).toBe('number');
      expect(entry.closing_slice).toBeGreaterThan(0);
      expect(typeof entry.reason).toBe('string');
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS is Object.frozen at both array and entry level (fold-in Codex LOW 1)', () => {
    expect(Object.isFrozen(ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS)).toBe(true);
    for (const entry of ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.artifact_ids)).toBe(true);
    }
  });

  it('ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS is Object.frozen (fold-in Codex LOW 1)', () => {
    expect(Object.isFrozen(ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS)).toBe(true);
  });
});

describe('checkArcCloseCompositionReviewPresence (fold-in Codex HIGH 4)', () => {
  function writeProjectStateWithSlice(root: string, slice: number) {
    writeRel(root, 'PROJECT_STATE.md', `<!-- current_slice: ${slice} -->\n\n# PROJECT_STATE\n`);
  }

  function writePlanFile(root: string) {
    writeRel(
      root,
      'specs/plans/phase-2-foundation-foldins.md',
      '---\nname: phase-2-foundation-foldins\n---\n\n# Plan\n',
    );
  }

  it('exports a positive arc-close slice number', () => {
    expect(typeof PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE).toBe('number');
    expect(PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE).toBeGreaterThan(0);
  });

  it('returns green when the plan file is absent', () => {
    withTempRepo((root) => {
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/not applicable/);
    });
  });

  it('returns green when arc is still in progress (current_slice < arc-close slice)', () => {
    withTempRepo((root) => {
      writePlanFile(root);
      writeProjectStateWithSlice(root, PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE - 3);
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/still in progress/);
    });
  });

  it('returns red when arc has closed but no review file exists', () => {
    withTempRepo((root) => {
      writePlanFile(root);
      writeProjectStateWithSlice(root, PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE);
      // specs/reviews/ dir exists but no matching file
      writeRel(root, 'specs/reviews/other-review.md', '---\n---\nother\n');
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/no arc-close composition review file matches/);
    });
  });

  it('returns red when review file exists but lacks ACCEPT closing verdict', () => {
    withTempRepo((root) => {
      writePlanFile(root);
      writeProjectStateWithSlice(root, PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE);
      writeRel(
        root,
        'specs/reviews/phase-2-foundation-foldins-arc-close.md',
        '---\nclosing_verdict: REJECT-PENDING-FOLD-INS\n---\n# review\n',
      );
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/do not carry ACCEPT/);
    });
  });

  it('returns green when review file is present with ACCEPT closing verdict', () => {
    withTempRepo((root) => {
      writePlanFile(root);
      writeProjectStateWithSlice(root, PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE);
      writeRel(
        root,
        'specs/reviews/phase-2-foundation-foldins-arc-close.md',
        '---\nclosing_verdict: ACCEPT-WITH-FOLD-INS\n---\n# review\n',
      );
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/arc-close composition review present/);
    });
  });

  it('accepts the arc-slices-35-to-40-* filename pattern equivalently', () => {
    withTempRepo((root) => {
      writePlanFile(root);
      writeProjectStateWithSlice(root, PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE);
      writeRel(
        root,
        'specs/reviews/arc-slices-35-to-40-composition.md',
        '---\nclosing_verdict: ACCEPT\n---\n# review\n',
      );
      const result = checkArcCloseCompositionReviewPresence(root);
      expect(result.level).toBe('green');
    });
  });

  it('passes on the live repo today (arc still in progress)', () => {
    const result = checkArcCloseCompositionReviewPresence();
    expect(result.level).not.toBe('red');
  });
});
