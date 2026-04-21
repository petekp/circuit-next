import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkSpineCoverage } from '../../scripts/audit.mjs';
import { Workflow } from '../../src/schemas/workflow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// These tests exercise checkSpineCoverage (scripts/audit.mjs Check 24,
// introduced by slice P2.3) against temp-dir fixtures + the live
// `.claude-plugin/skills/explore/circuit.json` fixture. They encode
// ADR-0007 CC#P2-6 binding (canonical phase set for `explore`) and
// specs/contracts/explore.md EXPLORE-I1.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-spine-coverage-'));
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

// Minimal valid explore fixture body — the canonical phase set
// {frame, analyze, act, review, close} + omits {plan, verify}.
function validExploreFixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '2',
    id: 'explore',
    version: '0.1.0',
    purpose: 'test fixture',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        rigor: 'standard',
        description: 'test entry mode',
      },
    ],
    phases: [
      { id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { id: 'analyze-phase', title: 'Analyze', canonical: 'analyze', steps: ['analyze-step'] },
      { id: 'synthesize-phase', title: 'Synthesize', canonical: 'act', steps: ['synthesize-step'] },
      { id: 'review-phase', title: 'Review', canonical: 'review', steps: ['review-step'] },
      { id: 'close-phase', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan', 'verify'],
      rationale:
        'Test: explore is an investigation workflow — plan folded into frame, verify covered by review.',
    },
    steps: [],
    ...overrides,
  };
}

describe('checkSpineCoverage (ADR-0007 CC#P2-6 / EXPLORE-I1 / explore.prop.canonical_phase_set_is_correct enforcement)', () => {
  it('passes on a valid explore fixture', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/skills/explore/circuit.json',
        JSON.stringify(validExploreFixture()),
      );
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/explore: canonical set/);
    });
  });

  it('passes when `.claude-plugin/skills/` directory is absent', () => {
    withTempRepo((root) => {
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/skills\/ directory; spine-coverage check not applicable/);
    });
  });

  it('reds when explore fixture omits a required canonical phase', () => {
    withTempRepo((root) => {
      const fixture = validExploreFixture();
      // Remove the `review-phase` — review is required for explore.
      fixture.phases = fixture.phases.filter((p) => p.canonical !== 'review');
      writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing canonical\(s\): review/);
    });
  });

  it('reds when explore fixture declares an unexpected canonical phase', () => {
    withTempRepo((root) => {
      const fixture = validExploreFixture();
      // Add a `plan` canonical — plan is OMITTED for explore.
      fixture.phases.push({
        id: 'plan-phase',
        title: 'Plan',
        canonical: 'plan',
        steps: ['plan-step'],
      });
      writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/unexpected canonical\(s\): plan/);
    });
  });

  it('reds when explore fixture has mode=strict instead of partial', () => {
    withTempRepo((root) => {
      const fixture = validExploreFixture();
      fixture.spine_policy = { mode: 'strict' } as unknown as typeof fixture.spine_policy;
      writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/spine_policy\.mode must be 'partial'/);
    });
  });

  it('reds when explore fixture has wrong omits list', () => {
    withTempRepo((root) => {
      const fixture = validExploreFixture();
      fixture.spine_policy = {
        mode: 'partial',
        omits: ['plan'], // missing 'verify'
        rationale: 'Bad omit list - verify is missing.',
      };
      writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing omit\(s\): verify/);
    });
  });

  it('reds when fixture declares extra unexpected omit', () => {
    withTempRepo((root) => {
      const fixture = validExploreFixture();
      fixture.spine_policy = {
        mode: 'partial',
        omits: ['plan', 'verify', 'close'],
        rationale: 'Bad omit list - close should not be omitted.',
      };
      writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/unexpected omit\(s\): close/);
    });
  });

  it('exempts the dogfood-run-0 partial fixture', () => {
    withTempRepo((root) => {
      // dogfood-run-0 has its own Phase 1.5 spine policy
      // (plan+act only, omits 5 of 7); still passes because it is
      // EXEMPT from kind-canonical enforcement at this check.
      writeRel(
        root,
        '.claude-plugin/skills/dogfood-run-0/circuit.json',
        JSON.stringify({
          schema_version: '2',
          id: 'dogfood-run-0',
          version: '0.1.0',
          purpose: 'test',
          entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
          entry_modes: [
            {
              name: 'dogfood',
              start_at: 'x',
              rigor: 'standard',
              description: 'test',
            },
          ],
          phases: [
            { id: 'plan-phase', title: 'Plan', canonical: 'plan', steps: ['x'] },
            { id: 'act-phase', title: 'Act', canonical: 'act', steps: ['y'] },
          ],
          spine_policy: {
            mode: 'partial',
            omits: ['frame', 'analyze', 'verify', 'review', 'close'],
            rationale: 'dogfood-run-0 is a narrow Alpha Proof fixture.',
          },
          steps: [],
        }),
      );
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/dogfood-run-0.*exempt/);
    });
  });

  it('information-only on unknown workflow kinds (pass-through, not red)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/skills/future-kind/circuit.json',
        JSON.stringify({
          schema_version: '2',
          id: 'future-kind',
          version: '0.1.0',
          purpose: 'test',
          entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
          entry_modes: [
            {
              name: 'default',
              start_at: 'x',
              rigor: 'standard',
              description: 'test',
            },
          ],
          phases: [{ id: 'x-phase', title: 'X', canonical: 'frame', steps: ['x'] }],
          spine_policy: { mode: 'strict' },
          steps: [],
        }),
      );
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/no canonical-set entry.*pass-through/);
    });
  });

  it('reds on JSON parse failure', () => {
    withTempRepo((root) => {
      writeRel(root, '.claude-plugin/skills/broken/circuit.json', '{ not valid json');
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/failed to parse/);
    });
  });

  it('reds when circuit.json has no top-level `id` field', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/skills/noId/circuit.json',
        JSON.stringify({ schema_version: '2', no_id_here: true }),
      );
      const result = checkSpineCoverage(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing top-level `id`/);
    });
  });

  it('passes on the live repo (explore fixture + dogfood-run-0 exempt)', () => {
    const result = checkSpineCoverage();
    if (result.level !== 'green') {
      throw new Error(
        `Live repo spine-coverage check failed:\n${result.detail}\n\nThis indicates the committed .claude-plugin/skills/explore/circuit.json or .claude-plugin/skills/dogfood-run-0/circuit.json no longer matches expected canonical phase sets. Fix the fixture rather than the test.`,
      );
    }
    expect(result.level).toBe('green');
  });
});

describe('explore fixture parses under the base Workflow schema', () => {
  it('.claude-plugin/skills/explore/circuit.json parses as a Workflow', () => {
    const raw = JSON.parse(
      readFileSync(join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json'), 'utf-8'),
    );
    const result = Workflow.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Explore fixture failed Workflow.safeParse:\n${result.error.issues
          .map((i) => `  ${i.path.join('.')}: ${i.message}`)
          .join('\n')}`,
      );
    }
    expect(result.success).toBe(true);
  });
});
