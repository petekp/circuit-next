import { describe, expect, it } from 'vitest';

import {
  EXEMPT_WORKFLOW_IDS,
  WORKFLOW_KIND_CANONICAL_SETS,
  type WorkflowKindPolicyCheckResult,
  checkWorkflowKindCanonicalPolicy,
} from '../../scripts/policy/workflow-kind-policy.mjs';
import {
  type ValidateWorkflowKindPolicyResult,
  validateWorkflowKindPolicy,
} from '../../src/runtime/policy/workflow-kind-policy.js';

// Slice 43a — validateWorkflowKindPolicy helper extraction (HIGH 5
// retargeting per Slice 40 → P2.5). Unit tests cover the shared JS
// canonical-set check AND the TS wrapper that adds Workflow.safeParse.

function validExploreSteps(): ReadonlyArray<Record<string, unknown>> {
  return [
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
        pass: ['accept'],
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
  ];
}

function validExploreFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
      {
        id: 'synthesize-phase',
        title: 'Synthesize',
        canonical: 'act',
        steps: ['synthesize-step'],
      },
      { id: 'review-phase', title: 'Review', canonical: 'review', steps: ['review-step'] },
      { id: 'close-phase', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan', 'verify'],
      rationale: 'test: explore — plan folded into frame; verify covered by review.',
    },
    steps: validExploreSteps(),
    ...overrides,
  };
}

function reviewPolicyOnlyPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: '2',
    id: 'review',
    // Deliberately policy/invariant-only: the real review fixture and
    // runtime synthesis behavior land in later P2.9 slices.
    phases: [
      { title: 'Intake', canonical: 'frame', steps: ['intake-step'] },
      { title: 'Independent Audit', canonical: 'analyze', steps: ['audit-step'] },
      { title: 'Verdict', canonical: 'close', steps: ['verdict-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan', 'act', 'verify', 'review'],
      rationale: 'policy-only review payload for the canonical phase table test.',
    },
    steps: [
      { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
      { id: 'audit-step', kind: 'dispatch', role: 'reviewer' },
      {
        id: 'verdict-step',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/review-result.json', schema: 'review.result@v1' },
        },
      },
    ],
    ...overrides,
  };
}

function buildPolicyOnlyPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: '2',
    id: 'build',
    // Deliberately policy-only: the real Build fixture waits for the
    // checkpoint and dispatch slices.
    phases: [
      { title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { title: 'Plan', canonical: 'plan', steps: ['plan-step'] },
      { title: 'Act', canonical: 'act', steps: ['act-step'] },
      { title: 'Verify', canonical: 'verify', steps: ['verify-step'] },
      { title: 'Review', canonical: 'review', steps: ['review-step'] },
      { title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze'],
      rationale:
        'policy-only build payload: Build omits analyze but keeps plan, act, verify, and review.',
    },
    steps: [
      { id: 'frame-step', kind: 'checkpoint', writes: { artifact: {} } },
      { id: 'plan-step', kind: 'synthesis', writes: { artifact: {} } },
      { id: 'act-step', kind: 'dispatch', role: 'implementer' },
      { id: 'verify-step', kind: 'verification', writes: { artifact: {} } },
      { id: 'review-step', kind: 'dispatch', role: 'reviewer' },
      { id: 'close-step', kind: 'synthesis', writes: { artifact: {} } },
    ],
    ...overrides,
  };
}

describe('checkWorkflowKindCanonicalPolicy (audit-level, no Zod)', () => {
  it('returns green on a valid explore fixture', () => {
    const result = checkWorkflowKindCanonicalPolicy(validExploreFixture());
    expect(result.kind).toBe('green');
    expect(result.detail).toMatch(/explore: canonical set/);
  });

  it('returns green on a policy-only review payload that satisfies REVIEW-I1', () => {
    const result = checkWorkflowKindCanonicalPolicy(reviewPolicyOnlyPayload());
    expect(result.kind).toBe('green');
    expect(result.detail).toMatch(/review: canonical set/);
    expect(result.detail).toMatch(/frame, analyze, close/);
  });

  it('returns green on a policy-only build payload with the Build canonical phase set', () => {
    const result = checkWorkflowKindCanonicalPolicy(buildPolicyOnlyPayload());
    expect(result.kind).toBe('green');
    expect(result.detail).toMatch(/build: canonical set/);
    expect(result.detail).toMatch(/frame, plan, act, verify, review, close/);
    expect(result.detail).toMatch(/omits \{analyze\}/);
  });

  it('returns exempt on dogfood-run-0 fixture', () => {
    const result = checkWorkflowKindCanonicalPolicy({
      schema_version: '2',
      id: 'dogfood-run-0',
      phases: [],
      spine_policy: { mode: 'partial', omits: [] },
    });
    expect(result.kind).toBe('exempt');
    expect(result.detail).toMatch(/dogfood-run-0.*exempt/);
  });

  it('returns pass_through on unknown workflow-kind ids', () => {
    const result = checkWorkflowKindCanonicalPolicy({
      schema_version: '2',
      id: 'future-kind',
      phases: [],
      spine_policy: { mode: 'partial', omits: [] },
    });
    expect(result.kind).toBe('pass_through');
    expect(result.detail).toMatch(/no canonical-set entry.*pass-through/);
  });

  it('returns red when explore fixture omits a required canonical phase', () => {
    const fixture = validExploreFixture();
    const phases = fixture.phases as Array<Record<string, unknown>>;
    fixture.phases = phases.filter((p) => p.canonical !== 'review');
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/missing canonical\(s\): review/);
  });

  it('returns red when explore fixture has mode=strict', () => {
    const fixture = validExploreFixture();
    fixture.spine_policy = { mode: 'strict' };
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/spine_policy\.mode must be 'partial'/);
  });

  it('returns red when omits list is missing expected entries', () => {
    const fixture = validExploreFixture();
    fixture.spine_policy = {
      mode: 'partial',
      omits: ['plan'], // missing 'verify'
    };
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/missing omit\(s\): verify/);
  });

  it('returns red when review declares the omitted review canonical', () => {
    const fixture = reviewPolicyOnlyPayload();
    const phases = fixture.phases as Array<Record<string, unknown>>;
    fixture.phases = [...phases, { title: 'Nested Review', canonical: 'review' }];
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/unexpected canonical\(s\): review/);
  });

  it('returns red when build declares the omitted analyze canonical', () => {
    const fixture = buildPolicyOnlyPayload();
    const phases = fixture.phases as Array<Record<string, unknown>>;
    fixture.phases = [...phases, { title: 'Analyze', canonical: 'analyze' }];
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/unexpected canonical\(s\): analyze/);
  });

  it('returns red when build omits verify from the canonical set', () => {
    const fixture = buildPolicyOnlyPayload();
    const phases = fixture.phases as Array<Record<string, unknown>>;
    fixture.phases = phases.filter((p) => p.canonical !== 'verify');
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/missing canonical\(s\): verify/);
  });

  it('returns red when review close writes a non-primary artifact shape', () => {
    const fixture = reviewPolicyOnlyPayload({
      steps: [
        { id: 'intake-step', kind: 'synthesis', writes: { artifact: {} } },
        { id: 'audit-step', kind: 'dispatch', role: 'reviewer' },
        {
          id: 'verdict-step',
          kind: 'synthesis',
          writes: {
            artifact: { path: 'artifacts/not-review-result.json', schema: 'wrong.result@v1' },
          },
        },
      ],
    });
    const result = checkWorkflowKindCanonicalPolicy(fixture);
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/primary review\.result artifact/);
  });

  it('returns red on non-object fixture input', () => {
    expect(checkWorkflowKindCanonicalPolicy(null).kind).toBe('red');
    expect(checkWorkflowKindCanonicalPolicy('not an object').kind).toBe('red');
    expect(checkWorkflowKindCanonicalPolicy(42).kind).toBe('red');
  });

  it('returns red when `id` field is missing', () => {
    const result = checkWorkflowKindCanonicalPolicy({ schema_version: '2' });
    expect(result.kind).toBe('red');
    expect(result.detail).toMatch(/missing top-level `id`/);
  });

  it('exposes WORKFLOW_KIND_CANONICAL_SETS and EXEMPT_WORKFLOW_IDS as single source of truth', () => {
    const explore = WORKFLOW_KIND_CANONICAL_SETS.explore;
    expect(explore).toBeDefined();
    if (explore === undefined) throw new Error('unreachable');
    expect(explore.canonicals).toEqual(['frame', 'analyze', 'act', 'review', 'close']);
    expect(explore.omits).toEqual(['plan', 'verify']);
    const review = WORKFLOW_KIND_CANONICAL_SETS.review;
    expect(review).toBeDefined();
    if (review === undefined) throw new Error('unreachable');
    expect(review.canonicals).toEqual(['frame', 'analyze', 'close']);
    expect(review.omits).toEqual(['plan', 'act', 'verify', 'review']);
    expect(review.title).toBe('Intake → Independent Audit → Verdict');
    expect(review.authority).toBe('specs/plans/p2-9-second-workflow.md §3');
    const build = WORKFLOW_KIND_CANONICAL_SETS.build;
    expect(build).toBeDefined();
    if (build === undefined) throw new Error('unreachable');
    expect(build.canonicals).toEqual(['frame', 'plan', 'act', 'verify', 'review', 'close']);
    expect(build.omits).toEqual(['analyze']);
    expect(build.title).toBe('Frame → Plan → Act → Verify → Review → Close');
    expect(build.authority).toBe('specs/plans/build-workflow-parity.md §9 Work item 1');
    expect(EXEMPT_WORKFLOW_IDS.has('dogfood-run-0')).toBe(true);
    expect(EXEMPT_WORKFLOW_IDS.has('explore')).toBe(false);
    expect(EXEMPT_WORKFLOW_IDS.has('build')).toBe(false);
  });
});

describe('validateWorkflowKindPolicy (runtime-level, safeParse-first)', () => {
  it('returns ok:true green on a fully valid explore workflow', () => {
    const result: ValidateWorkflowKindPolicyResult = validateWorkflowKindPolicy(
      validExploreFixture(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('green');
      expect(result.detail).toMatch(/explore: canonical set/);
    }
  });

  it('returns ok:false with Zod issue summary when safeParse fails (empty steps)', () => {
    const fixture = validExploreFixture({ steps: [] });
    const result = validateWorkflowKindPolicy(fixture);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Workflow\.safeParse failed/);
      expect(result.reason).toMatch(/steps/i);
    }
  });

  it('returns ok:false when Zod catches the violation at the safeParse layer (missing review phase)', () => {
    // For the `explore` kind, Workflow.safeParse's PHASE-I4 superRefine
    // already enforces the canonical-phase-set invariant — removing the
    // review phase fails at safeParse before the kind-specific policy
    // check can fire. The helper therefore surfaces the Zod issue
    // summary. This is by design: safeParse is the primary gate and
    // the kind-specific policy is defense-in-depth for future kinds
    // whose constraints Zod cannot express schematically.
    const fixture = validExploreFixture();
    const phases = fixture.phases as Array<Record<string, unknown>>;
    fixture.phases = phases.filter((p) => p.canonical !== 'review');
    const result = validateWorkflowKindPolicy(fixture);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Workflow\.safeParse failed/);
      expect(result.reason).toMatch(/review/);
    }
  });

  it('returns ok:true pass_through on unknown workflow kinds (not red at runtime load)', () => {
    const fixture = validExploreFixture({ id: 'future-kind' });
    const result = validateWorkflowKindPolicy(fixture);
    // pass_through is an acceptable runtime-load outcome; future workflow
    // kinds must land their own entry before enforcement tightens.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('pass_through');
    }
  });

  it('returns ok:false with a human-readable reason (no Zod dump) on malformed input', () => {
    const result = validateWorkflowKindPolicy({ id: 'explore' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.reason).not.toMatch(/undefined|\[object Object\]/);
    }
  });
});

describe('audit-level WorkflowKindPolicyCheckResult discriminated union shape', () => {
  it('all four result kinds are distinguishable', () => {
    const results: WorkflowKindPolicyCheckResult[] = [
      checkWorkflowKindCanonicalPolicy(validExploreFixture()),
      checkWorkflowKindCanonicalPolicy({
        id: 'dogfood-run-0',
        phases: [],
        spine_policy: { mode: 'partial', omits: [] },
      }),
      checkWorkflowKindCanonicalPolicy({
        id: 'future-kind',
        phases: [],
        spine_policy: { mode: 'partial', omits: [] },
      }),
      checkWorkflowKindCanonicalPolicy({ id: 'explore' }),
    ];
    expect(results.map((r) => r.kind)).toEqual(['green', 'exempt', 'pass_through', 'red']);
  });
});
