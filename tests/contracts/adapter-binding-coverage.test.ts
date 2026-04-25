import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkAdapterBindingCoverage } from '../../scripts/audit.mjs';
import { Workflow } from '../../src/schemas/workflow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// These tests exercise checkAdapterBindingCoverage (scripts/audit.mjs
// Check 27, introduced by Slice 38 per ADR-0008 §Decision.4). The check
// gates workflow fixtures whose `id` is registered in
// WORKFLOW_KIND_CANONICAL_SETS: each such fixture MUST exercise at least
// one step with `kind: "dispatch"` so the P2.5 golden-parity path has a
// real adapter-binding path to verify. Exempt and unknown kinds pass
// through.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-adapter-binding-'));
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

// Loose fixture shape — tests intentionally construct JSON-like objects and
// mutate individual fields; the helper returns an `unknown`-keyed object so
// in-test edits don't trip tsc's discriminated-union narrowing on
// Workflow step variants.
type LooseFixture = Record<string, unknown> & { steps: Array<Record<string, unknown>> };

// Fixture with Synthesize + Review as dispatch steps (ADR-0008 option (a)).
// Matches the live .claude-plugin/skills/explore/circuit.json post-Slice-38.
function exploreFixtureWithDispatch(overrides: Record<string, unknown> = {}): LooseFixture {
  return {
    schema_version: '2',
    id: 'explore',
    version: '0.1.0',
    purpose: 'test fixture — ADR-0008 dispatch model',
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
      rationale: 'test rationale',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'explore-frame@v1',
        reads: [],
        routes: { pass: 'analyze-step' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/brief.json', schema: 'explore.brief@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['subject'],
        },
      },
      {
        id: 'analyze-step',
        title: 'Analyze',
        protocol: 'explore-analyze@v1',
        reads: ['artifacts/brief.json'],
        routes: { pass: 'synthesize-step' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/analysis.json', schema: 'explore.analysis@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['aspects'],
        },
      },
      {
        id: 'synthesize-step',
        title: 'Synthesize',
        protocol: 'explore-synthesize@v1',
        reads: ['artifacts/brief.json', 'artifacts/analysis.json'],
        routes: { pass: 'review-step' },
        executor: 'worker',
        kind: 'dispatch',
        role: 'implementer',
        writes: {
          artifact: { path: 'artifacts/synthesis.json', schema: 'explore.synthesis@v1' },
          request: 'artifacts/dispatch/synthesize.request.json',
          receipt: 'artifacts/dispatch/synthesize.receipt.txt',
          result: 'artifacts/dispatch/synthesize.result.json',
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: ['accept'],
        },
      },
      {
        id: 'review-step',
        title: 'Review',
        protocol: 'explore-review@v1',
        reads: ['artifacts/brief.json', 'artifacts/analysis.json', 'artifacts/synthesis.json'],
        routes: { pass: 'close-step' },
        executor: 'worker',
        kind: 'dispatch',
        role: 'reviewer',
        writes: {
          artifact: {
            path: 'artifacts/review-verdict.json',
            schema: 'explore.review-verdict@v1',
          },
          request: 'artifacts/dispatch/review.request.json',
          receipt: 'artifacts/dispatch/review.receipt.txt',
          result: 'artifacts/dispatch/review.result.json',
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: ['accept', 'accept-with-fold-ins'],
        },
      },
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'explore-close@v1',
        reads: ['artifacts/synthesis.json', 'artifacts/review-verdict.json'],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/explore-result.json', schema: 'explore.result@v1' },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary', 'verdict_snapshot'],
        },
      },
    ],
    ...overrides,
  };
}

// Legacy-shaped explore fixture — all five steps are orchestrator-synthesis.
// This is what explore looked like at P2.3 v0.1 landing, before ADR-0008.
// The check MUST reject this shape for a P2.5+ enforcement target.
function exploreFixtureAllSynthesis(): LooseFixture {
  const base = exploreFixtureWithDispatch();
  const steps = base.steps.map((s) => {
    const writes = s.writes as { artifact: unknown };
    return {
      ...s,
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: { artifact: writes.artifact },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['placeholder'],
      },
    };
  });
  return { ...base, steps };
}

function buildFixtureWithDispatch(): LooseFixture {
  const rawPath = join(REPO_ROOT, '.claude-plugin/skills/build/circuit.json');
  return JSON.parse(readFileSync(rawPath, 'utf-8')) as LooseFixture;
}

describe('checkAdapterBindingCoverage (Slice 38 — ADR-0008 §Decision.4)', () => {
  describe('green paths', () => {
    it('passes on explore fixture with Synthesize + Review as dispatch steps', () => {
      withTempRepo((root) => {
        writeRel(
          root,
          '.claude-plugin/skills/explore/circuit.json',
          JSON.stringify(exploreFixtureWithDispatch()),
        );
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('green');
        expect(result.detail).toMatch(/explore: 2 dispatch step\(s\) present/);
        expect(result.detail).toMatch(/synthesize-step/);
        expect(result.detail).toMatch(/review-step/);
      });
    });

    it('reds when review-step is flipped back to orchestrator/synthesis (explore policy requires BOTH synthesize-step AND review-step)', () => {
      withTempRepo((root) => {
        // Codex Slice 38 MED 2 fold-in — the explore policy requires both
        // Synthesize and Review to be dispatch-kind; flipping only one
        // satisfies the v0.1 any-dispatch rule but violates ADR-0008's
        // explore-specific binding.
        const fixture = exploreFixtureWithDispatch();
        const reviewStep = fixture.steps[3];
        if (!reviewStep) throw new Error('test-setup invariant: review-step present at index 3');
        const reviewWrites = reviewStep.writes as { artifact: unknown };
        fixture.steps[3] = {
          ...reviewStep,
          executor: 'orchestrator',
          kind: 'synthesis',
          writes: { artifact: reviewWrites.artifact },
          gate: {
            kind: 'schema_sections',
            source: { kind: 'artifact', ref: 'artifact' },
            required: ['verdict'],
          },
        };
        writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/wrong-kind step\(s\)/);
        expect(result.detail).toMatch(/review-step:synthesis/);
        expect(result.detail).toMatch(/ADR-0008 §Decision\.1/);
      });
    });

    it('exempts dogfood-run-0 even with zero dispatch steps', () => {
      withTempRepo((root) => {
        const fixture = exploreFixtureAllSynthesis();
        fixture.id = 'dogfood-run-0';
        writeRel(root, '.claude-plugin/skills/dogfood-run-0/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('green');
        expect(result.detail).toMatch(/dogfood-run-0: exempt/);
      });
    });

    it('yellow on unknown workflow kinds (not silent green pass-through)', () => {
      // Codex Slice 38 MED 2 fold-in — unknown kinds used to pass green
      // silently, which would let a future workflow fixture with zero
      // dispatch steps hide until someone remembered to register the kind.
      // Now they produce a yellow finding prompting either registration or
      // explicit exemption.
      withTempRepo((root) => {
        const fixture = exploreFixtureAllSynthesis();
        fixture.id = 'future-build';
        writeRel(root, '.claude-plugin/skills/future-build/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('yellow');
        expect(result.detail).toMatch(/future-build: unregistered workflow kind/);
        expect(result.detail).toMatch(/WORKFLOW_KIND_CANONICAL_SETS/);
        expect(result.detail).toMatch(/EXEMPT_WORKFLOW_IDS/);
      });
    });

    it('green when .claude-plugin/skills/ directory does not exist', () => {
      withTempRepo((root) => {
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('green');
        expect(result.detail).toMatch(/not applicable/);
      });
    });

    it('green when skills directory exists but contains no fixtures', () => {
      withTempRepo((root) => {
        mkdirSync(join(root, '.claude-plugin/skills/other'), { recursive: true });
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('green');
        expect(result.detail).toMatch(/No workflow fixtures scanned/);
      });
    });
  });

  describe('red paths', () => {
    it('reds on explore fixture with zero dispatch steps (pre-ADR-0008 shape)', () => {
      withTempRepo((root) => {
        writeRel(
          root,
          '.claude-plugin/skills/explore/circuit.json',
          JSON.stringify(exploreFixtureAllSynthesis()),
        );
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/explore: workflow targets an adapter/);
        expect(result.detail).toMatch(/zero `kind: "dispatch"` steps/);
        expect(result.detail).toMatch(/ADR-0008 §Decision\.4/);
      });
    });

    it('red detail enumerates the observed step kinds for diagnosability', () => {
      withTempRepo((root) => {
        writeRel(
          root,
          '.claude-plugin/skills/explore/circuit.json',
          JSON.stringify(exploreFixtureAllSynthesis()),
        );
        const result = checkAdapterBindingCoverage(root);
        expect(result.detail).toMatch(/Got steps: /);
        expect(result.detail).toMatch(/frame-step:synthesis/);
        expect(result.detail).toMatch(/synthesize-step:synthesis/);
        expect(result.detail).toMatch(/review-step:synthesis/);
      });
    });

    it('reds on fixture with empty steps array', () => {
      withTempRepo((root) => {
        const fixture = exploreFixtureWithDispatch();
        fixture.steps = [];
        writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/zero `kind: "dispatch"` steps/);
      });
    });

    it('reds when a required dispatch step id is missing from the fixture', () => {
      // Codex Slice 38 MED 2 fold-in — the explore policy requires both
      // synthesize-step and review-step. Removing review-step entirely
      // must produce a "missing step id" error even if synthesize-step
      // alone satisfies the any-dispatch rule.
      withTempRepo((root) => {
        const fixture = exploreFixtureWithDispatch();
        fixture.steps = fixture.steps.filter((s) => s.id !== 'review-step');
        // Retarget synthesize-step.routes.pass so the fixture still has
        // consistent routing (we only care about Check 27's step-id binding).
        const syn = fixture.steps.find((s) => s.id === 'synthesize-step');
        if (syn) syn.routes = { pass: 'close-step' };
        writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/missing step id\(s\): review-step/);
      });
    });

    it('reds when Build omits the required review dispatch step', () => {
      withTempRepo((root) => {
        const fixture = buildFixtureWithDispatch();
        fixture.steps = fixture.steps.filter((s) => s.id !== 'review-step');
        const verify = fixture.steps.find((s) => s.id === 'verify-step');
        if (verify) verify.routes = { pass: 'close-step' };
        writeRel(root, '.claude-plugin/skills/build/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/build:/);
        expect(result.detail).toMatch(/missing step id\(s\): review-step/);
      });
    });

    it('reds when Build act-step is not a dispatch step', () => {
      withTempRepo((root) => {
        const fixture = buildFixtureWithDispatch();
        const actStep = fixture.steps.find((s) => s.id === 'act-step');
        if (!actStep) throw new Error('test-setup invariant: act-step present');
        const writes = actStep.writes as { artifact: unknown };
        actStep.executor = 'orchestrator';
        actStep.kind = 'synthesis';
        actStep.writes = { artifact: writes.artifact };
        actStep.gate = {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        };
        writeRel(root, '.claude-plugin/skills/build/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/wrong-kind step\(s\)/);
        expect(result.detail).toMatch(/act-step:synthesis/);
      });
    });

    it('reds when a dispatch step omits writes.artifact (ADR-0008 §Decision.3a materialization rule)', () => {
      // Codex Slice 38 HIGH 2 fold-in — dispatch result-to-artifact
      // materialization requires every adapter-bound dispatch step in an
      // explore-policy fixture to declare writes.artifact alongside the
      // required writes.result. Stripping writes.artifact must red.
      withTempRepo((root) => {
        const fixture = exploreFixtureWithDispatch();
        const syn = fixture.steps.find((s) => s.id === 'synthesize-step');
        if (!syn) throw new Error('test-setup invariant: synthesize-step present');
        // Intentionally remove artifact; keep request/receipt/result.
        syn.writes = {
          request: 'artifacts/dispatch/synthesize.request.json',
          receipt: 'artifacts/dispatch/synthesize.receipt.txt',
          result: 'artifacts/dispatch/synthesize.result.json',
        };
        writeRel(root, '.claude-plugin/skills/explore/circuit.json', JSON.stringify(fixture));
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/missing `writes\.artifact`/);
        expect(result.detail).toMatch(/ADR-0008 §Decision\.3a/);
        expect(result.detail).toMatch(/synthesize-step/);
      });
    });

    it('reds on malformed circuit.json (parse failure is an error, not a silent pass)', () => {
      withTempRepo((root) => {
        writeRel(root, '.claude-plugin/skills/explore/circuit.json', '{ not valid json');
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/failed to parse/);
      });
    });

    it('reds on fixture missing top-level id field', () => {
      withTempRepo((root) => {
        const { id: _omitted, ...fixtureWithoutId } = exploreFixtureWithDispatch();
        writeRel(
          root,
          '.claude-plugin/skills/explore/circuit.json',
          JSON.stringify(fixtureWithoutId),
        );
        const result = checkAdapterBindingCoverage(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/missing top-level `id` string field/);
      });
    });
  });

  describe('live repo regression guard', () => {
    it('live explore fixture post-Slice-38 exercises at least one dispatch step', () => {
      const result = checkAdapterBindingCoverage(REPO_ROOT);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/explore:/);
      expect(result.detail).toMatch(/dispatch step\(s\) present/);
    });

    it('live explore fixture parses under base Workflow schema after ADR-0008 flip', () => {
      const rawPath = join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json');
      const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
      const parsed = Workflow.safeParse(raw);
      expect(parsed.success).toBe(true);
    });

    it('live explore fixture has Synthesize + Review flipped to dispatch (ADR-0008 binding)', () => {
      const rawPath = join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json');
      const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
      const synthesizeStep = raw.steps.find((s: { id: string }) => s.id === 'synthesize-step');
      const reviewStep = raw.steps.find((s: { id: string }) => s.id === 'review-step');
      expect(synthesizeStep?.kind).toBe('dispatch');
      expect(synthesizeStep?.executor).toBe('worker');
      expect(synthesizeStep?.role).toBe('implementer');
      expect(reviewStep?.kind).toBe('dispatch');
      expect(reviewStep?.executor).toBe('worker');
      expect(reviewStep?.role).toBe('reviewer');
    });

    it('Frame / Analyze / Close remain orchestrator-synthesis per ADR-0008 table', () => {
      const rawPath = join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json');
      const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
      for (const id of ['frame-step', 'analyze-step', 'close-step']) {
        const step = raw.steps.find((s: { id: string }) => s.id === id);
        expect(step?.kind, `${id}.kind`).toBe('synthesis');
        expect(step?.executor, `${id}.executor`).toBe('orchestrator');
      }
    });

    it('live explore dispatch steps declare writes.artifact (ADR-0008 §Decision.3a fixture-level precondition)', () => {
      // Codex Slice 38 HIGH 2 fold-in — the materialization rule at
      // §Decision.3a depends on every adapter-bound dispatch step
      // declaring writes.artifact alongside writes.result. This test
      // asserts the fixture-level precondition; runtime materialization
      // enforcement lands at P2.4.
      const rawPath = join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json');
      const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
      const dispatchSteps = raw.steps.filter((s: { kind: string }) => s.kind === 'dispatch');
      expect(dispatchSteps.length).toBeGreaterThan(0);
      for (const step of dispatchSteps) {
        expect(step.writes, `${step.id}.writes`).toBeDefined();
        expect(step.writes.artifact, `${step.id}.writes.artifact`).toBeDefined();
        expect(step.writes.result, `${step.id}.writes.result`).toBeDefined();
        // result and artifact.path are distinct on disk per the materialization
        // rule (transcript vs validated artifact).
        expect(step.writes.result).not.toBe(step.writes.artifact.path);
      }
    });

    it('live Build fixture parses and declares Act + Review as artifact-writing dispatch steps', () => {
      const rawPath = join(REPO_ROOT, '.claude-plugin/skills/build/circuit.json');
      const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
      const parsed = Workflow.safeParse(raw);
      expect(parsed.success).toBe(true);

      const actStep = raw.steps.find((s: { id: string }) => s.id === 'act-step');
      const reviewStep = raw.steps.find((s: { id: string }) => s.id === 'review-step');
      expect(actStep?.kind).toBe('dispatch');
      expect(actStep?.role).toBe('implementer');
      expect(actStep?.writes?.artifact?.schema).toBe('build.implementation@v1');
      expect(reviewStep?.kind).toBe('dispatch');
      expect(reviewStep?.role).toBe('reviewer');
      expect(reviewStep?.writes?.artifact?.schema).toBe('build.review@v1');
    });
  });
});
