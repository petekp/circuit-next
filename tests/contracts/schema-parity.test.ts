import { describe, expect, it } from 'vitest';
import {
  Config,
  ContinuityRecord,
  DispatchConfig,
  Event,
  Gate,
  LaneDeclaration,
  Rigor,
  Role,
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

  it('happy path parses', () => {
    const wf = Workflow.safeParse({
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
      default_skills: [],
    });
    expect(wf.success).toBe(true);
  });

  it('rejects entry_modes.start_at referencing an unknown step', () => {
    const wf = Workflow.safeParse({
      schema_version: '2',
      id: 'build',
      version: '2026-04-18',
      purpose: 'Build features.',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [{ name: 'default', start_at: 'nowhere', rigor: 'standard', description: 'x' }],
      phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame'] }],
      steps: [okFrameStep],
      default_skills: [],
    });
    expect(wf.success).toBe(false);
  });

  it('rejects phase referencing an unknown step', () => {
    const wf = Workflow.safeParse({
      schema_version: '2',
      id: 'build',
      version: '2026-04-18',
      purpose: 'Build features.',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [{ name: 'default', start_at: 'frame', rigor: 'standard', description: 'x' }],
      phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['ghost'] }],
      steps: [okFrameStep],
      default_skills: [],
    });
    expect(wf.success).toBe(false);
  });

  it('rejects route target that is neither terminal nor a known step', () => {
    const wf = Workflow.safeParse({
      schema_version: '2',
      id: 'build',
      version: '2026-04-18',
      purpose: 'Build features.',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [{ name: 'default', start_at: 'frame', rigor: 'standard', description: 'x' }],
      phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame'] }],
      steps: [
        {
          ...okFrameStep,
          routes: { pass: 'missing-target' },
        },
      ],
      default_skills: [],
    });
    expect(wf.success).toBe(false);
  });

  it('rejects duplicate step ids', () => {
    const wf = Workflow.safeParse({
      schema_version: '2',
      id: 'build',
      version: '2026-04-18',
      purpose: 'Build features.',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [{ name: 'default', start_at: 'frame', rigor: 'standard', description: 'x' }],
      phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame'] }],
      steps: [okFrameStep, okFrameStep],
      default_skills: [],
    });
    expect(wf.success).toBe(false);
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
