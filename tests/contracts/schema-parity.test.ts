import { describe, expect, it } from 'vitest';
import {
  Config,
  ContinuityRecord,
  DispatchConfig,
  Event,
  Gate,
  LaneDeclaration,
  Phase,
  Rigor,
  Role,
  RunLog,
  RunProjection,
  SelectionOverride,
  SkillDescriptor,
  Snapshot,
  Step,
  Workflow,
  isConsequentialRigor,
} from '../../src/index.js';

describe('rigor', () => {
  it('accepts known tiers and rejects unknown', () => {
    expect(Rigor.safeParse('standard').success).toBe(true);
    expect(Rigor.safeParse('tournament').success).toBe(true);
    expect(Rigor.safeParse('max').success).toBe(false);
  });

  it('consequential rigor includes autonomous (adversarial-review fix)', () => {
    expect(isConsequentialRigor('deep')).toBe(true);
    expect(isConsequentialRigor('tournament')).toBe(true);
    expect(isConsequentialRigor('autonomous')).toBe(true);
    expect(isConsequentialRigor('lite')).toBe(false);
    expect(isConsequentialRigor('standard')).toBe(false);
  });
});

describe('role', () => {
  it('only includes dispatch roles; orchestrator is an executor, not a role', () => {
    expect(Role.safeParse('researcher').success).toBe(true);
    expect(Role.safeParse('implementer').success).toBe(true);
    expect(Role.safeParse('reviewer').success).toBe(true);
    expect(Role.safeParse('orchestrator').success).toBe(false);
  });
});

describe('LaneDeclaration', () => {
  it('standard lanes require failure_mode + acceptance_evidence + alternate_framing', () => {
    const ok = LaneDeclaration.safeParse({
      lane: 'ratchet-advance',
      failure_mode: 'regression on X',
      acceptance_evidence: 'test Y passes',
      alternate_framing: 'could frame as discovery',
    });
    expect(ok.success).toBe(true);
  });

  it('migration-escrow requires expires_at + restoration_plan', () => {
    const missingExpiry = LaneDeclaration.safeParse({
      lane: 'migration-escrow',
      failure_mode: 'mid-migration state',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'could do it in one slice',
    });
    expect(missingExpiry.success).toBe(false);

    const ok = LaneDeclaration.safeParse({
      lane: 'migration-escrow',
      failure_mode: 'mid-migration',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'one slice',
      expires_at: '2026-05-01T00:00:00.000Z',
      restoration_plan: 'revert commit X + re-run legacy test suite',
    });
    expect(ok.success).toBe(true);
  });

  it('break-glass requires post_hoc_adr_deadline_at', () => {
    const noDeadline = LaneDeclaration.safeParse({
      lane: 'break-glass',
      failure_mode: 'prod down',
      acceptance_evidence: 'pager cleared',
      alternate_framing: 'triage then normal repair',
    });
    expect(noDeadline.success).toBe(false);
  });
});

describe('Gate', () => {
  it('discriminates on kind', () => {
    expect(
      Gate.safeParse({
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['Objective'],
      }).success,
    ).toBe(true);
    expect(
      Gate.safeParse({
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue', 'revise'],
      }).success,
    ).toBe(true);
    expect(
      Gate.safeParse({
        kind: 'magical',
        source: { kind: 'artifact', ref: 'x' },
        allow: ['y'],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown source.kind (MED #7 closed)', () => {
    const bad = Gate.safeParse({
      kind: 'schema_sections',
      source: { kind: 'bogus', ref: 'artifact' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects cross-kind source on SchemaSectionsGate (kind-bound source)', () => {
    // A schema_sections gate must carry an ArtifactSource; a
    // dispatch_result source would be a type-layer mismatch, proven here
    // at runtime via safeParse.
    const bad = Gate.safeParse({
      kind: 'schema_sections',
      source: { kind: 'dispatch_result', ref: 'result' },
      required: ['Objective'],
    });
    expect(bad.success).toBe(false);
  });
});

describe('SelectionOverride', () => {
  it('inherit is the default for skill override', () => {
    const parsed = SelectionOverride.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skills.mode).toBe('inherit');
    }
  });

  it('replace/append/remove all accept skill lists', () => {
    for (const mode of ['replace', 'append', 'remove'] as const) {
      const parsed = SelectionOverride.safeParse({ skills: { mode, skills: ['tdd', 'rust'] } });
      expect(parsed.success).toBe(true);
    }
  });

  it('model is provider-scoped (not an enum of marketing names)', () => {
    const ok = SelectionOverride.safeParse({
      model: { provider: 'anthropic', model: 'claude-opus-4-7' },
      effort: 'high',
    });
    expect(ok.success).toBe(true);
  });
});

describe('SkillDescriptor', () => {
  it('parses with default domain', () => {
    const parsed = SkillDescriptor.safeParse({
      id: 'tdd',
      title: 'Test-Driven Development',
      description: 'Red-green-refactor.',
      trigger: 'when the user asks to write tests first',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.domain).toBe('domain-general');
    }
  });
});

describe('Step discriminated union', () => {
  const baseSynthesis = {
    id: 'frame',
    title: 'Frame',
    executor: 'orchestrator' as const,
    kind: 'synthesis' as const,
    protocol: 'build-frame@v1',
    reads: [],
    writes: { artifact: { path: 'artifacts/brief.md', schema: 'brief@v1' } },
    gate: {
      kind: 'schema_sections' as const,
      source: { kind: 'artifact' as const, ref: 'artifact' },
      required: ['Objective'],
    },
    routes: { pass: '@complete' },
  };

  it('synthesis step is legal', () => {
    expect(Step.safeParse(baseSynthesis).success).toBe(true);
  });

  it('worker + dispatch requires a dispatch role', () => {
    const noRole = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'result' },
        pass: ['ok'],
      },
    });
    expect(noRole.success).toBe(false);

    const ok = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'result' },
        pass: ['ok'],
      },
    });
    expect(ok.success).toBe(true);
  });

  it('orchestrator + dispatch is rejected', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'dispatch',
      writes: { request: 'r.json', receipt: 'c.json', result: 's.json' },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'result' },
        pass: ['ok'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('checkpoint step requires checkpoint_selection gate', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['y'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('SynthesisStep rejects gate.source.ref naming a missing writes slot (STEP-I3, MED #7 closed)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections' as const,
        source: { kind: 'artifact' as const, ref: 'missing-slot' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CheckpointStep rejects gate.source.ref naming a missing writes slot (STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'nope' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('DispatchStep rejects gate.source.ref naming a missing writes slot (STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'ghost' },
        pass: ['ok'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CheckpointStep accepts ref naming a real writes slot (positive pair for STEP-I3)', () => {
    const ok = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue', 'revise'],
      },
    });
    expect(ok.success).toBe(true);
  });

  // Codex review HIGH #1: prototype-chain `in` operator attack.
  // With `ref` as a Zod literal per source kind, these fail at parse.
  it('rejects artifact source with ref "toString" (prototype-chain attack, STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'toString' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects artifact source with ref "__proto__" (prototype-chain attack, STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: '__proto__' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  // Codex review HIGH #2: source.kind must semantically pair with the correct
  // writes slot, not just any existing slot. `ref` literal enforces this.
  it('rejects checkpoint_response source with ref "request" (cross-slot drift, STEP-I4)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'request' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects dispatch_result source with ref "receipt" (cross-slot drift, STEP-I4)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'receipt' },
        pass: ['ok'],
      },
    });
    expect(bad.success).toBe(false);
  });

  // Codex review MED #4 / STEP-I6: `.strict()` rejects surplus keys.
  it('rejects SynthesisStep with surplus top-level key (STEP-I6 strict)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      role: 'implementer',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects gate source with surplus key (STEP-I6 strict on source objects)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact', stray: true },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects gate top-level with surplus key (STEP-I6 strict on gate variants)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['Objective'],
        extra: 'field',
      },
    });
    expect(bad.success).toBe(false);
  });
});

describe('Workflow graph closure (adversarial-review fix #1)', () => {
  const okFrameStep = {
    id: 'frame',
    title: 'Frame',
    executor: 'orchestrator' as const,
    kind: 'synthesis' as const,
    protocol: 'build-frame@v1',
    reads: [],
    writes: { artifact: { path: 'artifacts/brief.md', schema: 'brief@v1' } },
    gate: {
      kind: 'schema_sections' as const,
      source: { kind: 'artifact' as const, ref: 'artifact' },
      required: ['Objective'],
    },
    routes: { pass: '@complete' },
  };

  // Partial spine policy omitting the 6 non-frame canonicals, for fixtures that
  // only need to isolate one phase. Verbose by design (PHASE-I4): every omission
  // is named and rationalized.
  const partialSpineOmittingNonFrame = {
    mode: 'partial' as const,
    omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'] as const,
    rationale: 'minimal test fixture isolating the frame phase',
  };

  const okWorkflow = (overrides: Record<string, unknown> = {}) => ({
    schema_version: '2',
    id: 'build',
    version: '2026-04-18',
    purpose: 'Build features.',
    entry: {
      signals: { include: ['feature'], exclude: ['bug'] },
      intent_prefixes: ['develop:'],
    },
    entry_modes: [
      { name: 'default', start_at: 'frame', rigor: 'standard', description: 'Standard.' },
    ],
    phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame'] }],
    steps: [okFrameStep],
    spine_policy: partialSpineOmittingNonFrame,
    default_skills: [],
    ...overrides,
  });

  it('happy path parses', () => {
    expect(Workflow.safeParse(okWorkflow()).success).toBe(true);
  });

  it('rejects entry_modes.start_at referencing an unknown step', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          entry_modes: [
            { name: 'default', start_at: 'nowhere', rigor: 'standard', description: 'x' },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects phase referencing an unknown step', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['ghost'] }],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects route target that is neither terminal nor a known step', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          steps: [{ ...okFrameStep, routes: { pass: 'missing-target' } }],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects duplicate step ids', () => {
    expect(Workflow.safeParse(okWorkflow({ steps: [okFrameStep, okFrameStep] })).success).toBe(
      false,
    );
  });
});

describe('Phase contract (PHASE-I1..I3)', () => {
  it('rejects surplus keys (PHASE-I2 strict mode)', () => {
    // A typo like `conanical` must fail parse, not silently lose the canonical binding.
    const result = Phase.safeParse({
      id: 'frame-phase',
      title: 'Frame',
      conanical: 'frame', // typo of canonical
      steps: ['frame'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty steps array (PHASE-I1)', () => {
    const result = Phase.safeParse({
      id: 'frame-phase',
      title: 'Frame',
      canonical: 'frame',
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid canonical enum values (PHASE-I3)', () => {
    for (const canonical of ['frame', 'analyze', 'plan', 'act', 'verify', 'review', 'close']) {
      const result = Phase.safeParse({
        id: `${canonical}-phase`,
        title: canonical,
        canonical,
        steps: ['s'],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown canonical labels (PHASE-I3)', () => {
    const result = Phase.safeParse({
      id: 'x-phase',
      title: 'X',
      canonical: 'unknown-phase',
      steps: ['s'],
    });
    expect(result.success).toBe(false);
  });

  it('canonical is optional (workflow-specific phases allowed)', () => {
    const result = Phase.safeParse({ id: 'custom-phase', title: 'Custom', steps: ['s'] });
    expect(result.success).toBe(true);
  });
});

describe('Workflow spine_policy (PHASE-I4, closes adversarial-review MED #11)', () => {
  const okFrameStep = {
    id: 'frame',
    title: 'Frame',
    executor: 'orchestrator' as const,
    kind: 'synthesis' as const,
    protocol: 'build-frame@v1',
    reads: [],
    writes: { artifact: { path: 'artifacts/brief.md', schema: 'brief@v1' } },
    gate: {
      kind: 'schema_sections' as const,
      source: { kind: 'artifact' as const, ref: 'artifact' },
      required: ['Objective'],
    },
    routes: { pass: '@complete' },
  };

  const sevenPhases = [
    { id: 'p-frame', title: 'Frame', canonical: 'frame', steps: ['frame'] },
    { id: 'p-analyze', title: 'Analyze', canonical: 'analyze', steps: ['frame'] },
    { id: 'p-plan', title: 'Plan', canonical: 'plan', steps: ['frame'] },
    { id: 'p-act', title: 'Act', canonical: 'act', steps: ['frame'] },
    { id: 'p-verify', title: 'Verify', canonical: 'verify', steps: ['frame'] },
    { id: 'p-review', title: 'Review', canonical: 'review', steps: ['frame'] },
    { id: 'p-close', title: 'Close', canonical: 'close', steps: ['frame'] },
  ];

  const workflowBase = {
    schema_version: '2',
    id: 'build',
    version: '2026-04-18',
    purpose: 'Build features.',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      { name: 'default', start_at: 'frame', rigor: 'standard', description: 'Standard.' },
    ],
    steps: [okFrameStep],
    default_skills: [],
  };

  it('rejects workflow without spine_policy (required field)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
    });
    expect(result.success).toBe(false);
  });

  it('strict mode accepts workflow with all seven canonical phases', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
      spine_policy: { mode: 'strict' },
    });
    expect(result.success).toBe(true);
  });

  it('strict mode rejects workflow missing review (the gate that matters)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'review'),
      spine_policy: { mode: 'strict' },
    });
    expect(result.success).toBe(false);
  });

  it('strict mode rejects workflow missing verify', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'verify'),
      spine_policy: { mode: 'strict' },
    });
    expect(result.success).toBe(false);
  });

  it('partial mode accepts workflow that omits exactly what spine_policy.omits declares', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'plan'),
      spine_policy: {
        mode: 'partial',
        omits: ['plan'],
        rationale: 'repair workflow skips plan — root-cause analysis replaces it',
      },
    });
    expect(result.success).toBe(true);
  });

  it('partial mode rejects workflow that omits something NOT declared in omits', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'review'),
      spine_policy: {
        mode: 'partial',
        omits: ['plan'],
        rationale: 'repair workflow skips plan — root-cause analysis replaces it',
      },
    });
    expect(result.success).toBe(false);
  });

  it('partial mode requires non-empty omits (the SpinePolicy discriminated union)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
      spine_policy: {
        mode: 'partial',
        omits: [],
        rationale: 'this rationale is over twenty characters long for sure',
      },
    });
    expect(result.success).toBe(false);
  });

  it('partial mode requires rationale ≥20 characters', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'plan'),
      spine_policy: { mode: 'partial', omits: ['plan'], rationale: 'too short' },
    });
    expect(result.success).toBe(false);
  });

  it('strict mode rejects unknown spine_policy fields (strict discriminated union)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
      spine_policy: { mode: 'strict', extra: 'surplus' },
    });
    expect(result.success).toBe(false);
  });

  // Codex adversarial-auditor pass (2026-04-18): MED #4, MED #6, LOW #8 coverage.

  it('PHASE-I5: rejects duplicate canonical phases (Codex MED #4)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: [
        ...sevenPhases,
        { id: 'p-review-2', title: 'Second Review', canonical: 'review', steps: ['frame'] },
      ],
      spine_policy: { mode: 'strict' },
    });
    expect(result.success).toBe(false);
  });

  it('PHASE-I5: multiple phases without canonical are permitted (workflow-specific)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: [
        ...sevenPhases,
        { id: 'p-extra-1', title: 'Helper 1', steps: ['frame'] },
        { id: 'p-extra-2', title: 'Helper 2', steps: ['frame'] },
      ],
      spine_policy: { mode: 'strict' },
    });
    expect(result.success).toBe(true);
  });

  it('partial-mode omits must be disjoint from declared canonicals (Codex MED #6.a)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases, // includes canonical: 'plan'
      spine_policy: {
        mode: 'partial',
        omits: ['plan'], // but plan is declared above — contradiction
        rationale: 'contradictory — plan is both declared and omitted',
      },
    });
    expect(result.success).toBe(false);
  });

  it('partial-mode omits must be pairwise unique (Codex MED #6.b)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases.filter((p) => p.canonical !== 'plan'),
      spine_policy: {
        mode: 'partial',
        omits: ['plan', 'plan'], // duplicate
        rationale: 'duplicate omits — should be rejected by Workflow superRefine',
      },
    });
    expect(result.success).toBe(false);
  });

  it('PHASE-I6: Workflow itself rejects top-level surplus keys (Codex LOW #8)', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
      spine_policy: { mode: 'strict' },
      audit_notes: 'surplus top-level key should be rejected', // surplus
    });
    expect(result.success).toBe(false);
  });
});

describe('Event has lane + manifest_hash at bootstrap', () => {
  it('bootstrapped event requires lane (adversarial-review fix #2)', () => {
    const noLane = Event.safeParse({
      schema_version: 1,
      sequence: 0,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000',
      kind: 'run.bootstrapped',
      workflow_id: 'explore',
      rigor: 'deep',
      goal: 'Test',
      manifest_hash: 'abc',
    });
    expect(noLane.success).toBe(false);
  });

  it('bootstrapped event with lane passes', () => {
    const ok = Event.safeParse({
      schema_version: 1,
      sequence: 0,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000',
      kind: 'run.bootstrapped',
      workflow_id: 'explore',
      rigor: 'deep',
      goal: 'Test',
      manifest_hash: 'abc',
      lane: {
        lane: 'discovery',
        failure_mode: 'evidence gap',
        acceptance_evidence: 'evidence draft complete',
        alternate_framing: 'directly author contract',
      },
    });
    expect(ok.success).toBe(true);
  });

  it('step.completed carries route_taken (adversarial-review fix #3)', () => {
    const ok = Event.safeParse({
      schema_version: 1,
      sequence: 5,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000',
      kind: 'step.completed',
      step_id: 'frame',
      attempt: 1,
      route_taken: 'pass',
    });
    expect(ok.success).toBe(true);
  });
});

describe('Snapshot requires lane + manifest_hash', () => {
  const validLane = {
    lane: 'discovery' as const,
    failure_mode: 'evidence gap',
    acceptance_evidence: 'evidence draft complete',
    alternate_framing: 'directly author contract',
  };

  it('snapshot with lane + manifest_hash passes', () => {
    const ok = Snapshot.safeParse({
      schema_version: 1,
      run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000',
      workflow_id: 'explore',
      rigor: 'deep',
      lane: validLane,
      status: 'in_progress',
      steps: [{ step_id: 'frame', status: 'complete', attempts: 1 }],
      events_consumed: 2,
      manifest_hash: 'abc',
      updated_at: '2026-04-18T05:00:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('snapshot without lane fails (adversarial-review fix #2)', () => {
    const noLane = Snapshot.safeParse({
      schema_version: 1,
      run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000',
      workflow_id: 'explore',
      rigor: 'deep',
      status: 'in_progress',
      steps: [],
      events_consumed: 0,
      manifest_hash: 'abc',
      updated_at: '2026-04-18T05:00:00.000Z',
    });
    expect(noLane.success).toBe(false);
  });
});

describe('Config + adapter registry (adversarial-review fix #5)', () => {
  it('dispatch.default parses auto/builtin/registered-adapter-name', () => {
    const a = DispatchConfig.safeParse({ default: 'auto' });
    expect(a.success).toBe(true);
    const b = DispatchConfig.safeParse({ default: 'codex-isolated' });
    expect(b.success).toBe(true);
  });

  it('dispatch.default rejects unknown adapter name without registry entry', () => {
    const bad = DispatchConfig.safeParse({ default: 'gemini' });
    expect(bad.success).toBe(false);
  });

  it('dispatch.default resolves to registered named adapter', () => {
    const ok = DispatchConfig.safeParse({
      default: 'gemini',
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./docs/examples/gemini-dispatch.sh', '--model', 'gemini-2.5-pro'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });

  it('role adapter reference to unregistered named adapter fails', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini' } },
    });
    expect(bad.success).toBe(false);
  });

  it('Config with empty input applies all defaults', () => {
    const c = Config.safeParse({ schema_version: 1 });
    expect(c.success).toBe(true);
    if (c.success) {
      expect(c.data.dispatch.default).toBe('auto');
    }
  });
});

describe('Continuity discriminated union (adversarial-review fix #9)', () => {
  const narrative = {
    goal: 'Resume circuit-next work',
    next: 'Read PROJECT_STATE.md',
    state_markdown: '- state',
    debt_markdown: '- debt',
  };

  it('standalone form parses and cannot carry run_ref', () => {
    const ok = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'standalone',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('run-backed must carry run_ref', () => {
    const missing = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'run-backed',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative,
      resume_contract: {
        mode: 'resume_run',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(missing.success).toBe(false);
  });

  it('run-backed mode cannot pair with resume_standalone', () => {
    const bad = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'run-backed',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative,
      run_ref: { run_id: '0191d2f0-aaaa-7fff-8aaa-000000000000' },
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(bad.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Run contract — RUN-I1..I8 from specs/contracts/run.md v0.1
// ---------------------------------------------------------------------------

const RUN_A = '0191d2f0-aaaa-7fff-8aaa-000000000000';
const RUN_B = '0191d2f0-bbbb-7fff-8aaa-000000000001';

const lane = {
  lane: 'discovery' as const,
  failure_mode: 'evidence gap',
  acceptance_evidence: 'evidence draft complete',
  alternate_framing: 'directly author contract',
};

const bootstrapAt = (
  sequence: number,
  runId: string = RUN_A,
  overrides: Record<string, unknown> = {},
) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:00:00.000Z',
  run_id: runId,
  kind: 'run.bootstrapped',
  workflow_id: 'explore',
  rigor: 'deep',
  goal: 'Test',
  manifest_hash: 'abc',
  lane,
  ...overrides,
});

const stepEntered = (sequence: number, runId: string = RUN_A) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:01:00.000Z',
  run_id: runId,
  kind: 'step.entered',
  step_id: 'frame',
  attempt: 1,
});

const runClosed = (
  sequence: number,
  runId: string = RUN_A,
  outcome: 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated' = 'complete',
) => ({
  schema_version: 1,
  sequence,
  recorded_at: '2026-04-18T05:02:00.000Z',
  run_id: runId,
  kind: 'run.closed',
  outcome,
});

describe('RunLog structural invariants (RUN-I1..I5)', () => {
  it('happy path: well-formed log parses', () => {
    const ok = RunLog.safeParse([bootstrapAt(0), stepEntered(1), runClosed(2)]);
    expect(ok.success).toBe(true);
  });

  it('RUN-I1: empty log is rejected', () => {
    const bad = RunLog.safeParse([]);
    expect(bad.success).toBe(false);
  });

  it('RUN-I1: first event must be run.bootstrapped', () => {
    const bad = RunLog.safeParse([stepEntered(0), runClosed(1)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes("'run.bootstrapped'"))).toBe(true);
    }
  });

  it('RUN-I2: non-contiguous sequence (gap) is rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(0), stepEntered(2)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('sequence'))).toBe(true);
    }
  });

  it('RUN-I2: repeated sequence number is rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(0), stepEntered(1), stepEntered(1)]);
    expect(bad.success).toBe(false);
  });

  it('RUN-I2: sequence not starting at 0 is rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(1), stepEntered(2)]);
    expect(bad.success).toBe(false);
  });

  it('RUN-I3: mismatched run_id across events is rejected (cross-run smuggle)', () => {
    const bad = RunLog.safeParse([bootstrapAt(0, RUN_A), stepEntered(1, RUN_B)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('run_id'))).toBe(true);
    }
  });

  it('RUN-I4: multiple run.bootstrapped events rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(0), bootstrapAt(1)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('bootstrap'))).toBe(true);
    }
  });

  it('RUN-I5: multiple run.closed events rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(0), runClosed(1), runClosed(2)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('close'))).toBe(true);
    }
  });

  it('RUN-I5: event after run.closed rejected', () => {
    const bad = RunLog.safeParse([bootstrapAt(0), runClosed(1), stepEntered(2)]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('after'))).toBe(true);
    }
  });

  it('RUN-I5: log without run.closed is legal (run still in progress)', () => {
    const ok = RunLog.safeParse([bootstrapAt(0), stepEntered(1)]);
    expect(ok.success).toBe(true);
  });
});

describe('Event + Snapshot strict mode (RUN-I8)', () => {
  it('bootstrapped event rejects surplus top-level key', () => {
    const bad = Event.safeParse({ ...bootstrapAt(0), extra_field: 'smuggled' });
    expect(bad.success).toBe(false);
  });

  it('step.completed rejects surplus key', () => {
    const bad = Event.safeParse({
      schema_version: 1,
      sequence: 5,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: RUN_A,
      kind: 'step.completed',
      step_id: 'frame',
      attempt: 1,
      route_taken: 'pass',
      extra: 'surplus',
    });
    expect(bad.success).toBe(false);
  });

  it('Snapshot rejects surplus top-level key', () => {
    const bad = Snapshot.safeParse({
      schema_version: 1,
      run_id: RUN_A,
      workflow_id: 'explore',
      rigor: 'deep',
      lane,
      status: 'in_progress',
      steps: [],
      events_consumed: 0,
      manifest_hash: 'abc',
      updated_at: '2026-04-18T05:00:00.000Z',
      extra_audit_note: 'smuggled',
    });
    expect(bad.success).toBe(false);
  });

  it('StepState rejects surplus key', () => {
    const bad = Snapshot.safeParse({
      schema_version: 1,
      run_id: RUN_A,
      workflow_id: 'explore',
      rigor: 'deep',
      lane,
      status: 'in_progress',
      steps: [{ step_id: 'frame', status: 'complete', attempts: 1, extra: 'surplus' }],
      events_consumed: 1,
      manifest_hash: 'abc',
      updated_at: '2026-04-18T05:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });
});

describe('RunProjection binding (RUN-I6, RUN-I7)', () => {
  const validLog = [bootstrapAt(0), stepEntered(1)];

  const snapshotBase = {
    schema_version: 1,
    run_id: RUN_A,
    workflow_id: 'explore',
    rigor: 'deep' as const,
    lane,
    status: 'in_progress' as const,
    steps: [{ step_id: 'frame', status: 'in_progress' as const, attempts: 1 }],
    events_consumed: 2,
    manifest_hash: 'abc',
    updated_at: '2026-04-18T05:02:00.000Z',
  };

  it('happy path: aligned projection parses', () => {
    const ok = RunProjection.safeParse({ log: validLog, snapshot: snapshotBase });
    expect(ok.success).toBe(true);
  });

  it('RUN-I6: mismatched run_id rejects projection', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, run_id: RUN_B },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('run_id'))).toBe(true);
    }
  });

  it('RUN-I6: mismatched workflow_id rejects projection', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, workflow_id: 'repair' },
    });
    expect(bad.success).toBe(false);
  });

  it('RUN-I6: mismatched manifest_hash rejects projection (manifest is immutable per run)', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, manifest_hash: 'xyz' },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('manifest'))).toBe(true);
    }
  });

  it('RUN-I6: mismatched rigor rejects projection', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, rigor: 'standard' },
    });
    expect(bad.success).toBe(false);
  });

  it('RUN-I6: mismatched lane rejects projection (lane is frozen at bootstrap)', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: {
        ...snapshotBase,
        lane: {
          lane: 'ratchet-advance',
          failure_mode: 'different',
          acceptance_evidence: 'different',
          alternate_framing: 'different',
        },
      },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('lane'))).toBe(true);
    }
  });

  it('RUN-I6: mismatched invocation_id rejects projection', () => {
    const logWithInvocation = [
      bootstrapAt(0, RUN_A, { invocation_id: 'inv_aaaa' }),
      stepEntered(1),
    ];
    const bad = RunProjection.safeParse({
      log: logWithInvocation,
      snapshot: { ...snapshotBase, invocation_id: 'inv_bbbb' },
    });
    expect(bad.success).toBe(false);
  });

  it('RUN-I6: snapshot claims invocation_id but bootstrap has none', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, invocation_id: 'inv_cccc' },
    });
    expect(bad.success).toBe(false);
  });

  it('RUN-I7: events_consumed exceeding log length is rejected', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, events_consumed: 99 },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('events_consumed'))).toBe(true);
    }
  });

  it('RUN-I7: status must be in_progress when log has no run.closed', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, status: 'complete' },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('in_progress'))).toBe(true);
    }
  });

  it('RUN-I7: run.closed.outcome=aborted requires snapshot.status=aborted', () => {
    const closedLog = [bootstrapAt(0), runClosed(1, RUN_A, 'aborted')];
    const bad = RunProjection.safeParse({
      log: closedLog,
      snapshot: { ...snapshotBase, status: 'complete', events_consumed: 2 },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('aborted'))).toBe(true);
    }
  });

  it('RUN-I7: run.closed.outcome=handoff → snapshot.status=handoff accepted', () => {
    const closedLog = [bootstrapAt(0), runClosed(1, RUN_A, 'handoff')];
    const ok = RunProjection.safeParse({
      log: closedLog,
      snapshot: { ...snapshotBase, status: 'handoff', events_consumed: 2 },
    });
    expect(ok.success).toBe(true);
  });

  it('RUN-I7: run.closed.outcome=escalated → snapshot.status=escalated accepted', () => {
    const closedLog = [bootstrapAt(0), runClosed(1, RUN_A, 'escalated')];
    const ok = RunProjection.safeParse({
      log: closedLog,
      snapshot: { ...snapshotBase, status: 'escalated', events_consumed: 2 },
    });
    expect(ok.success).toBe(true);
  });

  it('RunProjection itself is strict (rejects surplus key)', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: snapshotBase,
      extra: 'surplus',
    });
    expect(bad.success).toBe(false);
  });

  // HIGH #2 fold-in — prefix snapshot rejection.
  it('RUN-I7: events_consumed less than log.length is rejected (prefix snapshot)', () => {
    const bad = RunProjection.safeParse({
      log: validLog,
      snapshot: { ...snapshotBase, events_consumed: 1 },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('prefix'))).toBe(true);
    }
  });

  // LOW #8 fold-in — missing-direction invocation_id.
  it('RUN-I6: bootstrap carries invocation_id but snapshot lacks it', () => {
    const logWithInvocation = [
      bootstrapAt(0, RUN_A, { invocation_id: 'inv_aaaa' }),
      stepEntered(1),
    ];
    const bad = RunProjection.safeParse({
      log: logWithInvocation,
      // snapshotBase has no invocation_id
      snapshot: snapshotBase,
    });
    expect(bad.success).toBe(false);
  });

  it('RUN-I6: both bootstrap and snapshot carry the same invocation_id (positive)', () => {
    const logWithInvocation = [
      bootstrapAt(0, RUN_A, { invocation_id: 'inv_aaaa' }),
      stepEntered(1),
    ];
    const ok = RunProjection.safeParse({
      log: logWithInvocation,
      snapshot: { ...snapshotBase, invocation_id: 'inv_aaaa' },
    });
    expect(ok.success).toBe(true);
  });

  // MED #6 fold-in — positive coverage for all five run.closed.outcome values.
  for (const outcome of ['complete', 'aborted', 'handoff', 'stopped', 'escalated'] as const) {
    it(`RUN-I7: run.closed.outcome=${outcome} → snapshot.status=${outcome} accepted`, () => {
      const closedLog = [bootstrapAt(0), runClosed(1, RUN_A, outcome)];
      const ok = RunProjection.safeParse({
        log: closedLog,
        snapshot: { ...snapshotBase, status: outcome, events_consumed: 2 },
      });
      expect(ok.success).toBe(true);
    });
  }

  // LOW #9 fold-in — lane equality is structural, not key-order dependent.
  it('RUN-I6: lane equality is structural across different field insertion orders', () => {
    const laneAKeyOrder = {
      failure_mode: 'evidence gap',
      alternate_framing: 'directly author contract',
      acceptance_evidence: 'evidence draft complete',
      lane: 'discovery' as const,
    };
    const laneBKeyOrder = {
      lane: 'discovery' as const,
      failure_mode: 'evidence gap',
      acceptance_evidence: 'evidence draft complete',
      alternate_framing: 'directly author contract',
    };
    const ok = RunProjection.safeParse({
      log: [bootstrapAt(0, RUN_A, { lane: laneAKeyOrder }), stepEntered(1)],
      snapshot: { ...snapshotBase, lane: laneBKeyOrder },
    });
    expect(ok.success).toBe(true);
  });
});

// MED #7 fold-in — table-driven strict-mode coverage across all 11 Event variants.
describe('Event variants reject top-level surplus keys (RUN-I8 coverage expansion)', () => {
  const base = {
    schema_version: 1 as const,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
  };

  const cases: Array<[string, Record<string, unknown>]> = [
    [
      'run.bootstrapped',
      {
        ...base,
        sequence: 0,
        kind: 'run.bootstrapped',
        workflow_id: 'explore',
        rigor: 'deep',
        goal: 'Test',
        manifest_hash: 'abc',
        lane,
      },
    ],
    ['step.entered', { ...base, sequence: 1, kind: 'step.entered', step_id: 'frame', attempt: 1 }],
    [
      'step.artifact_written',
      {
        ...base,
        sequence: 2,
        kind: 'step.artifact_written',
        step_id: 'frame',
        attempt: 1,
        artifact_path: 'brief.md',
        artifact_schema: 'brief',
      },
    ],
    [
      'gate.evaluated',
      {
        ...base,
        sequence: 3,
        kind: 'gate.evaluated',
        step_id: 'frame',
        attempt: 1,
        gate_kind: 'schema_sections',
        outcome: 'pass',
      },
    ],
    [
      'checkpoint.requested',
      {
        ...base,
        sequence: 4,
        kind: 'checkpoint.requested',
        step_id: 'frame',
        attempt: 1,
        options: ['accept', 'revise'],
      },
    ],
    [
      'checkpoint.resolved',
      {
        ...base,
        sequence: 5,
        kind: 'checkpoint.resolved',
        step_id: 'frame',
        attempt: 1,
        selection: 'accept',
        auto_resolved: false,
      },
    ],
    [
      'dispatch.started',
      {
        ...base,
        sequence: 6,
        kind: 'dispatch.started',
        step_id: 'frame',
        attempt: 1,
        adapter: { kind: 'builtin', name: 'codex' },
        role: 'researcher',
        resolved_selection: { skills: [] },
        resolved_from: 'explicit',
      },
    ],
    [
      'dispatch.completed',
      {
        ...base,
        sequence: 7,
        kind: 'dispatch.completed',
        step_id: 'frame',
        attempt: 1,
        verdict: 'pass',
        duration_ms: 1000,
        result_path: 'r.json',
        receipt_path: 'rc.json',
      },
    ],
    [
      'step.completed',
      {
        ...base,
        sequence: 8,
        kind: 'step.completed',
        step_id: 'frame',
        attempt: 1,
        route_taken: 'pass',
      },
    ],
    [
      'step.aborted',
      {
        ...base,
        sequence: 9,
        kind: 'step.aborted',
        step_id: 'frame',
        attempt: 1,
        reason: 'timeout',
      },
    ],
    ['run.closed', { ...base, sequence: 10, kind: 'run.closed', outcome: 'complete' }],
  ];

  for (const [name, event] of cases) {
    it(`${name} rejects top-level surplus key`, () => {
      const bad = Event.safeParse({ ...event, extra_smuggled: 'x' });
      expect(bad.success).toBe(false);
    });
    it(`${name} passes without surplus (positive)`, () => {
      const ok = Event.safeParse(event);
      expect(ok.success).toBe(true);
    });
  }
});

// HIGH #1 fold-in — nested schemas are transitively strict.
describe('Nested schemas reject surplus keys transitively (RUN-I8 transitivity)', () => {
  it('bootstrap lane with surplus key is rejected', () => {
    const bad = Event.safeParse({
      ...bootstrapAt(0),
      lane: { ...lane, smuggled: 'x' },
    });
    expect(bad.success).toBe(false);
  });

  it('snapshot lane with surplus key is rejected', () => {
    const bad = Snapshot.safeParse({
      schema_version: 1,
      run_id: RUN_A,
      workflow_id: 'explore',
      rigor: 'deep',
      lane: { ...lane, smuggled: 'x' },
      status: 'in_progress',
      steps: [],
      events_consumed: 0,
      manifest_hash: 'abc',
      updated_at: '2026-04-18T05:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('dispatch.started adapter with surplus key is rejected', () => {
    const bad = Event.safeParse({
      schema_version: 1,
      sequence: 3,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: RUN_A,
      kind: 'dispatch.started',
      step_id: 'frame',
      attempt: 1,
      adapter: { kind: 'builtin', name: 'codex', surplus: 'x' },
      role: 'researcher',
      resolved_selection: { skills: [] },
      resolved_from: 'explicit',
    });
    expect(bad.success).toBe(false);
  });

  it('dispatch.started resolved_selection with surplus key is rejected', () => {
    const bad = Event.safeParse({
      schema_version: 1,
      sequence: 3,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: RUN_A,
      kind: 'dispatch.started',
      step_id: 'frame',
      attempt: 1,
      adapter: { kind: 'builtin', name: 'codex' },
      role: 'researcher',
      resolved_selection: { skills: [], smuggled: 'x' },
      resolved_from: 'explicit',
    });
    expect(bad.success).toBe(false);
  });

  it('dispatch.started resolved_selection.model with surplus key is rejected', () => {
    const bad = Event.safeParse({
      schema_version: 1,
      sequence: 3,
      recorded_at: '2026-04-18T05:00:00.000Z',
      run_id: RUN_A,
      kind: 'dispatch.started',
      step_id: 'frame',
      attempt: 1,
      adapter: { kind: 'builtin', name: 'codex' },
      role: 'researcher',
      resolved_selection: {
        skills: [],
        model: { provider: 'openai', model: 'gpt-5', smuggled: 'x' },
      },
      resolved_from: 'explicit',
    });
    expect(bad.success).toBe(false);
  });

  it('SelectionOverride rejects surplus top-level key', () => {
    const bad = SelectionOverride.safeParse({ rigor: 'standard', smuggled: 'x' });
    expect(bad.success).toBe(false);
  });
});

// MED #3 fold-in — own-property guard against prototype-chain identity smuggle.
describe('RunLog rejects prototype-chain inherited identity keys (RUN-I3 defense-in-depth)', () => {
  it('rejects event whose run_id is inherited (not own)', () => {
    // Event parse may coerce (Zod reads inherited), but RunLog's own-property
    // guard catches the absence of an own `run_id`.
    const inherited = Object.assign(Object.create({ run_id: RUN_A }), {
      schema_version: 1,
      sequence: 1,
      recorded_at: '2026-04-18T05:01:00.000Z',
      kind: 'step.entered',
      step_id: 'frame',
      attempt: 1,
    });
    const bad = RunLog.safeParse([bootstrapAt(0), inherited]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('prototype-chain'))).toBe(true);
    }
  });

  it('rejects event whose kind is inherited (not own)', () => {
    const inherited = Object.assign(Object.create({ kind: 'step.entered' }), {
      schema_version: 1,
      sequence: 1,
      recorded_at: '2026-04-18T05:01:00.000Z',
      run_id: RUN_A,
      step_id: 'frame',
      attempt: 1,
    });
    const bad = RunLog.safeParse([bootstrapAt(0), inherited]);
    expect(bad.success).toBe(false);
  });

  it('rejects event whose sequence is inherited (not own)', () => {
    const inherited = Object.assign(Object.create({ sequence: 1 }), {
      schema_version: 1,
      recorded_at: '2026-04-18T05:01:00.000Z',
      run_id: RUN_A,
      kind: 'step.entered',
      step_id: 'frame',
      attempt: 1,
    });
    const bad = RunLog.safeParse([bootstrapAt(0), inherited]);
    expect(bad.success).toBe(false);
  });
});
