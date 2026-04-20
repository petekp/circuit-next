import { describe, expect, it } from 'vitest';
import {
  AdapterName,
  AdapterRef,
  AdapterReference,
  AttachedRunPointer,
  BuiltInAdapter,
  CircuitOverride,
  Config,
  ConfigLayer,
  ContinuityIndex,
  ContinuityRecord,
  CustomAdapterDescriptor,
  DispatchConfig,
  DispatchResolutionSource,
  Effort,
  Event,
  Gate,
  LaneDeclaration,
  LayeredConfig,
  PendingRecordPointer,
  Phase,
  ProviderScopedModel,
  RESERVED_ADAPTER_NAMES,
  ResolvedAdapter,
  ResolvedSelection,
  Rigor,
  Role,
  RunAttachedProvenance,
  RunLog,
  RunProjection,
  SELECTION_PRECEDENCE,
  SelectionOverride,
  SelectionResolution,
  SelectionSource,
  SkillDescriptor,
  SkillOverride,
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

describe('SkillDescriptor — SKILL-I1..I5 from specs/contracts/skill.md v0.1', () => {
  const base = {
    id: 'tdd',
    title: 'Test-Driven Development',
    description: 'Red-green-refactor.',
    trigger: 'when the user asks to write tests first',
  };

  it('SKILL-I3 — parses with default domain', () => {
    const parsed = SkillDescriptor.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.domain).toBe('domain-general');
    }
  });

  it('SKILL-I1 — rejects invalid SkillId (uppercase)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: 'TDD' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I1 — rejects invalid SkillId (leading digit)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: '1tdd' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I1 — rejects SkillId with path separator', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: 'foo/bar' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty title', () => {
    const bad = SkillDescriptor.safeParse({ ...base, title: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty description', () => {
    const bad = SkillDescriptor.safeParse({ ...base, description: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty trigger', () => {
    const bad = SkillDescriptor.safeParse({ ...base, trigger: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I3 — rejects unknown domain', () => {
    const bad = SkillDescriptor.safeParse({ ...base, domain: 'marketing' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I3 — accepts each closed-enum domain', () => {
    for (const d of ['coding', 'design', 'research', 'ops', 'domain-general'] as const) {
      expect(SkillDescriptor.safeParse({ ...base, domain: d }).success).toBe(true);
    }
  });

  it('SKILL-I4 — capabilities optional: undefined is legal', () => {
    const parsed = SkillDescriptor.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('SKILL-I4 — rejects capabilities: []', () => {
    const bad = SkillDescriptor.safeParse({ ...base, capabilities: [] });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I4 — rejects empty-string element in capabilities', () => {
    const bad = SkillDescriptor.safeParse({ ...base, capabilities: ['red-green', ''] });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I4 — accepts non-empty capabilities', () => {
    const parsed = SkillDescriptor.safeParse({
      ...base,
      capabilities: ['red-green-refactor', 'property-based'],
    });
    expect(parsed.success).toBe(true);
  });

  it('SKILL-I5 — rejects surplus keys (strict)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, version: '1.0.0' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I5 — rejects ad-hoc selection-override smuggle key', () => {
    const bad = SkillDescriptor.safeParse({ ...base, adapter: 'agent' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited id via prototype chain', () => {
    const { id, ...rest } = base;
    const smuggled = Object.create({ id });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited title via prototype chain', () => {
    const { title, ...rest } = base;
    const smuggled = Object.create({ title });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited description via prototype chain', () => {
    const { description, ...rest } = base;
    const smuggled = Object.create({ description });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited trigger via prototype chain', () => {
    const { trigger, ...rest } = base;
    const smuggled = Object.create({ trigger });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
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
    ...overrides,
  });

  it('happy path parses', () => {
    expect(Workflow.safeParse(okWorkflow()).success).toBe(true);
  });

  it('WF-I1: rejects duplicate step ids', () => {
    expect(Workflow.safeParse(okWorkflow({ steps: [okFrameStep, okFrameStep] })).success).toBe(
      false,
    );
  });

  it('WF-I2: rejects entry_modes.start_at referencing an unknown step', () => {
    // Codex challenger MED #4 fold-in: include a second, valid entry mode
    // so that WF-I9 (no dead steps) is satisfied via the valid entry, and
    // WF-I2 is the unique failure mode the test proves. Without this, a
    // single unknown start_at would cascade into a WF-I9 violation, and
    // removing the explicit WF-I2 check in the schema would still fail
    // the fixture for the wrong reason.
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [
          { name: 'covers', start_at: 'frame', rigor: 'standard', description: 'valid' },
          { name: 'broken', start_at: 'nowhere', rigor: 'standard', description: 'bad ref' },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((i) => i.path.join('.'));
      expect(
        issuePaths.some((p) => p === 'entry_modes.1.start_at'),
        `WF-I2 isolation: expected an issue at entry_modes[1].start_at, got paths ${JSON.stringify(issuePaths)}`,
      ).toBe(true);
    }
  });

  it('WF-I3: rejects phase referencing an unknown step', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['ghost'] }],
        }),
      ).success,
    ).toBe(false);
  });

  it('WF-I4: rejects route target that is neither terminal nor a known step', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          steps: [{ ...okFrameStep, routes: { pass: 'missing-target' } }],
        }),
      ).success,
    ).toBe(false);
  });

  it('WF-I5: rejects duplicate entry_mode names', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          entry_modes: [
            { name: 'default', start_at: 'frame', rigor: 'standard', description: 'a' },
            { name: 'default', start_at: 'frame', rigor: 'standard', description: 'b' },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('WF-I6: rejects duplicate phase ids', () => {
    expect(
      Workflow.safeParse(
        okWorkflow({
          phases: [
            { id: 'frame-phase', title: 'Frame A', canonical: 'frame', steps: ['frame'] },
            { id: 'frame-phase', title: 'Frame B', steps: ['frame'] },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('WF-I7: rejects schema_version other than the literal "2"', () => {
    expect(Workflow.safeParse(okWorkflow({ schema_version: '1' })).success).toBe(false);
    expect(Workflow.safeParse(okWorkflow({ schema_version: 2 })).success).toBe(false);
  });

  it('WF-I8 (Slice 27 v0.2): rejects a workflow with a step that cannot reach a terminal route target', () => {
    // Two steps routing only to each other — cycle with no terminal escape.
    // Neither step can reach @complete/@stop/@escalate/@handoff.
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: 'b' },
    };
    const stepB = {
      ...okFrameStep,
      id: 'b',
      routes: { pass: 'a' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [{ name: 'default', start_at: 'a', rigor: 'standard', description: 'cycle' }],
        phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['a', 'b'] }],
        steps: [stepA, stepB],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = JSON.stringify(result.error.issues);
      expect(msg).toContain('WF-I8');
    }
  });

  it('WF-I8 (Slice 27 v0.2): accepts a workflow where every step has a terminal route chain', () => {
    // Two steps: a → b → @complete. Both reach a terminal.
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: 'b' },
    };
    const stepB = {
      ...okFrameStep,
      id: 'b',
      routes: { pass: '@complete' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [{ name: 'default', start_at: 'a', rigor: 'standard', description: 'chain' }],
        phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['a', 'b'] }],
        steps: [stepA, stepB],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('WF-I9 (Slice 27 v0.2): rejects a workflow with a step unreachable from any entry_mode', () => {
    // Step 'a' goes to @complete. Step 'b' goes to @complete but nothing
    // routes into 'b' and no entry_mode.start_at is 'b'. 'b' is declared but dead.
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: '@complete' },
    };
    const stepB = {
      ...okFrameStep,
      id: 'b',
      routes: { pass: '@complete' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [{ name: 'default', start_at: 'a', rigor: 'standard', description: 'only a' }],
        phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['a', 'b'] }],
        steps: [stepA, stepB],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = JSON.stringify(result.error.issues);
      expect(msg).toContain('WF-I9');
    }
  });

  it('WF-I9 (Slice 27 v0.2): accepts when both steps are reached by distinct entry_modes', () => {
    // Two entry_modes, each pointing at a different step. Both steps are
    // reached. Both close to @complete.
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: '@complete' },
    };
    const stepB = {
      ...okFrameStep,
      id: 'b',
      routes: { pass: '@complete' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [
          { name: 'default', start_at: 'a', rigor: 'standard', description: 'entry a' },
          { name: 'alt', start_at: 'b', rigor: 'standard', description: 'entry b' },
        ],
        phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['a', 'b'] }],
        steps: [stepA, stepB],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('WF-I10 (Slice 27 v0.2): rejects a step whose routes use an author-friendly alias (no `pass` key)', () => {
    // Codex challenger HIGH #1 fixture: routes use `success` instead of
    // `pass`. WF-I8 would accept (the `success` edge reaches @complete)
    // but at runtime the gate.evaluated outcome is `pass`, and
    // routes['pass'] is undefined — the run stalls. WF-I10 fails this
    // at parse time.
    const aliasedStep = {
      ...okFrameStep,
      routes: { success: '@complete' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        steps: [aliasedStep],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = JSON.stringify(result.error.issues);
      expect(msg).toContain('WF-I10');
    }
  });

  it('WF-I10 (Slice 27 v0.2): accepts a step that contains the `pass` key among its routes', () => {
    // Minimum legal fixture for WF-I10: routes contains `pass`. Extra
    // route labels (like `fail`) are allowed but not required at v0.2.
    const result = Workflow.safeParse(
      okWorkflow({
        steps: [{ ...okFrameStep, routes: { pass: '@complete', fail: '@stop' } }],
      }),
    );
    expect(result.success).toBe(true);
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

// ---------------------------------------------------------------------------
// Continuity contract — CONT-I1..I11 from specs/contracts/continuity.md v0.1
// ---------------------------------------------------------------------------

const CONT_RUN = '0191d2f0-cccc-7fff-8aaa-000000000030' as const;
const CONT_NARRATIVE = {
  goal: 'Resume circuit-next work',
  next: 'Read PROJECT_STATE.md',
  state_markdown: '- state',
  debt_markdown: '- debt',
} as const;
const CONT_RUN_PROVENANCE = {
  run_id: CONT_RUN,
  current_phase: 'frame',
  current_step: 'frame-goal',
  runtime_status: 'in_progress',
  runtime_updated_at: '2026-04-19T00:00:00.000Z',
} as const;

describe('Continuity discriminated union (CONT-I3..I5)', () => {
  it('standalone form parses when auto_resume XOR requires_explicit_resume', () => {
    const ok = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'standalone',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('CONT-I4 — standalone form rejects run_ref (strict)', () => {
    const bad = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'standalone',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
      run_ref: CONT_RUN_PROVENANCE,
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I4 — run-backed form requires run_ref', () => {
    const missing = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'run-backed',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      resume_contract: {
        mode: 'resume_run',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(missing.success).toBe(false);
  });

  it('CONT-I5 — run-backed kind rejects resume_standalone mode', () => {
    const bad = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'run-backed',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      run_ref: CONT_RUN_PROVENANCE,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I5 — standalone kind rejects resume_run mode', () => {
    const bad = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'standalone',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      resume_contract: {
        mode: 'resume_run',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(bad.success).toBe(false);
  });

  it('run-backed form parses with full run_ref provenance', () => {
    const ok = ContinuityRecord.safeParse({
      schema_version: 1,
      record_id: 'continuity-xyz',
      project_root: '/Users/x/Code',
      continuity_kind: 'run-backed',
      created_at: '2026-04-19T00:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      run_ref: CONT_RUN_PROVENANCE,
      resume_contract: {
        mode: 'resume_run',
        auto_resume: true,
        requires_explicit_resume: false,
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('Continuity record_id — CONT-I1 (ControlPlaneFileStem)', () => {
  const baseStandalone = {
    schema_version: 1,
    project_root: '/Users/x/Code',
    continuity_kind: 'standalone' as const,
    created_at: '2026-04-18T05:00:00.000Z',
    git: { cwd: '/Users/x/Code' },
    narrative: CONT_NARRATIVE,
    resume_contract: {
      mode: 'resume_standalone' as const,
      auto_resume: false,
      requires_explicit_resume: true,
    },
  };

  it('CONT-I1 — rejects path separator in record_id', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseStandalone,
      record_id: 'continuity/bad',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I1 — rejects uppercase in record_id', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseStandalone,
      record_id: 'Continuity-ABC',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I1 — rejects parent-traversal in record_id', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseStandalone,
      record_id: 'foo..bar',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I1 — accepts UUID-suffixed lowercase record_id', () => {
    const ok = ContinuityRecord.safeParse({
      ...baseStandalone,
      record_id: 'continuity-19ee6b12-e0f6-4a67-a225-9cb93c6fa5b1',
    });
    expect(ok.success).toBe(true);
  });
});

describe('Continuity resume_contract — CONT-I6 (safety-boolean non-contradiction)', () => {
  const baseStandalone = {
    schema_version: 1,
    record_id: 'continuity-abc',
    project_root: '/Users/x/Code',
    continuity_kind: 'standalone' as const,
    created_at: '2026-04-18T05:00:00.000Z',
    git: { cwd: '/Users/x/Code' },
    narrative: CONT_NARRATIVE,
  };

  it('CONT-I6 — rejects auto_resume=true AND requires_explicit_resume=true', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseStandalone,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: true,
        requires_explicit_resume: true,
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I6 — rejects auto_resume=false AND requires_explicit_resume=false', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseStandalone,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: false,
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I6 — accepts explicit-resume (auto=false, requires=true)', () => {
    const ok = ContinuityRecord.safeParse({
      ...baseStandalone,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('CONT-I6 — accepts auto-resume (auto=true, requires=false)', () => {
    const ok = ContinuityRecord.safeParse({
      ...baseStandalone,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: true,
        requires_explicit_resume: false,
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('RunAttachedProvenance — CONT-I7', () => {
  it('CONT-I7 — requires run_id + current_phase + current_step + runtime_status + runtime_updated_at', () => {
    expect(RunAttachedProvenance.safeParse(CONT_RUN_PROVENANCE).success).toBe(true);
  });

  it('CONT-I7 — rejects run_ref carrying only run_id (legacy under-provenance)', () => {
    const bad = RunAttachedProvenance.safeParse({ run_id: CONT_RUN });
    expect(bad.success).toBe(false);
  });

  it('CONT-I7 — rejects invalid runtime_status enum value', () => {
    const bad = RunAttachedProvenance.safeParse({
      ...CONT_RUN_PROVENANCE,
      runtime_status: 'frozen',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I7 — accepts optional invocation_id', () => {
    const ok = RunAttachedProvenance.safeParse({
      ...CONT_RUN_PROVENANCE,
      invocation_id: 'inv_0191d2f0-cccc-7fff-8aaa-000000000031',
    });
    expect(ok.success).toBe(true);
  });

  it('CONT-I8 — strict: rejects surplus keys (legacy "manifest_present")', () => {
    const bad = RunAttachedProvenance.safeParse({
      ...CONT_RUN_PROVENANCE,
      manifest_present: true,
    });
    expect(bad.success).toBe(false);
  });
});

describe('Continuity transitive strict — CONT-I8', () => {
  const baseRunBacked = {
    schema_version: 1,
    record_id: 'continuity-abc',
    project_root: '/Users/x/Code',
    continuity_kind: 'run-backed' as const,
    created_at: '2026-04-18T05:00:00.000Z',
    git: { cwd: '/Users/x/Code' },
    narrative: CONT_NARRATIVE,
    run_ref: CONT_RUN_PROVENANCE,
    resume_contract: {
      mode: 'resume_run' as const,
      auto_resume: true,
      requires_explicit_resume: false,
    },
  };

  it('CONT-I8 — top-level rejects surplus keys', () => {
    const bad = ContinuityRecord.safeParse({ ...baseRunBacked, unknown: 'x' });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — git rejects surplus keys', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseRunBacked,
      git: { cwd: '/Users/x/Code', remote: 'origin' },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — narrative rejects surplus keys', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseRunBacked,
      narrative: { ...CONT_NARRATIVE, tags: ['x'] },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — resume_contract rejects surplus keys', () => {
    const bad = ContinuityRecord.safeParse({
      ...baseRunBacked,
      resume_contract: {
        mode: 'resume_run',
        auto_resume: true,
        requires_explicit_resume: false,
        policy: 'immediate',
      },
    });
    expect(bad.success).toBe(false);
  });
});

describe('ContinuityIndex aggregate — CONT-I9..I11', () => {
  it('CONT-I9 — parses fully null (idle index)', () => {
    const ok = ContinuityIndex.safeParse({
      schema_version: 1,
      project_root: '/Users/x/Code',
      pending_record: null,
      current_run: null,
    });
    expect(ok.success).toBe(true);
  });

  it('CONT-I9 — parses with both pointers populated (attached + pending)', () => {
    const ok = ContinuityIndex.safeParse({
      schema_version: 1,
      project_root: '/Users/x/Code',
      pending_record: {
        record_id: 'continuity-abc',
        continuity_kind: 'run-backed',
        created_at: '2026-04-19T00:00:00.000Z',
      },
      current_run: {
        run_id: CONT_RUN,
        current_phase: 'frame',
        current_step: 'frame-goal',
        runtime_status: 'in_progress',
        attached_at: '2026-04-19T00:00:00.000Z',
        last_validated_at: '2026-04-19T00:00:00.000Z',
      },
    });
    expect(ok.success).toBe(true);
  });

  it('CONT-I10 — pending_record.record_id uses ControlPlaneFileStem (rejects uppercase)', () => {
    const bad = PendingRecordPointer.safeParse({
      record_id: 'CONTINUITY-ABC',
      continuity_kind: 'standalone',
      created_at: '2026-04-19T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I10 — pending_record rejects unknown continuity_kind', () => {
    const bad = PendingRecordPointer.safeParse({
      record_id: 'continuity-abc',
      continuity_kind: 'archival',
      created_at: '2026-04-19T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I11 — current_run requires run_id + phase/step + status + timestamps', () => {
    const bad = AttachedRunPointer.safeParse({
      run_id: CONT_RUN,
      current_phase: 'frame',
      current_step: 'frame-goal',
      runtime_status: 'in_progress',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — ContinuityIndex rejects surplus top-level keys', () => {
    const bad = ContinuityIndex.safeParse({
      schema_version: 1,
      project_root: '/Users/x/Code',
      pending_record: null,
      current_run: null,
      last_synced_at: '2026-04-19T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — pending_record rejects surplus keys (legacy "run_slug")', () => {
    const bad = PendingRecordPointer.safeParse({
      record_id: 'continuity-abc',
      continuity_kind: 'run-backed',
      created_at: '2026-04-19T00:00:00.000Z',
      run_slug: 'dispatch-adapter-fallback-i5',
    });
    expect(bad.success).toBe(false);
  });
});

describe('Continuity own-property guard — CONT-I12 (Codex HIGH #1)', () => {
  const buildStandalone = (): Record<string, unknown> => ({
    schema_version: 1,
    record_id: 'continuity-abc',
    project_root: '/Users/x/Code',
    continuity_kind: 'standalone' as const,
    created_at: '2026-04-18T05:00:00.000Z',
    git: { cwd: '/Users/x/Code' },
    narrative: CONT_NARRATIVE,
    resume_contract: {
      mode: 'resume_standalone' as const,
      auto_resume: false,
      requires_explicit_resume: true,
    },
  });

  it('CONT-I12 — rejects record_id inherited via prototype chain', () => {
    const good = buildStandalone();
    const { record_id, ...rest } = good;
    const smuggled = Object.create({ record_id });
    Object.assign(smuggled, rest);
    const result = ContinuityRecord.safeParse(smuggled);
    expect(result.success).toBe(false);
  });

  it('CONT-I12 — rejects continuity_kind inherited via prototype chain', () => {
    const good = buildStandalone();
    const { continuity_kind, ...rest } = good;
    const smuggled = Object.create({ continuity_kind });
    Object.assign(smuggled, rest);
    const result = ContinuityRecord.safeParse(smuggled);
    expect(result.success).toBe(false);
  });

  it('CONT-I12 — rejects schema_version inherited via prototype chain', () => {
    const good = buildStandalone();
    const { schema_version, ...rest } = good;
    const smuggled = Object.create({ schema_version });
    Object.assign(smuggled, rest);
    const result = ContinuityRecord.safeParse(smuggled);
    expect(result.success).toBe(false);
  });

  it('CONT-I12 — ContinuityIndex rejects inherited pending_record key', () => {
    const good = {
      schema_version: 1,
      project_root: '/Users/x/Code',
      pending_record: null,
      current_run: null,
    };
    const { pending_record, ...rest } = good;
    const smuggled = Object.create({ pending_record });
    Object.assign(smuggled, rest);
    const result = ContinuityIndex.safeParse(smuggled);
    expect(result.success).toBe(false);
  });

  it('CONT-I12 — ContinuityIndex rejects inherited schema_version', () => {
    const good = {
      schema_version: 1,
      project_root: '/Users/x/Code',
      pending_record: null,
      current_run: null,
    };
    const { schema_version, ...rest } = good;
    const smuggled = Object.create({ schema_version });
    Object.assign(smuggled, rest);
    const result = ContinuityIndex.safeParse(smuggled);
    expect(result.success).toBe(false);
  });
});

describe('Continuity LOW #6 coverage additions', () => {
  it('CONT-I2 — rejects record with string schema_version "1" (legacy shape)', () => {
    const bad = ContinuityRecord.safeParse({
      schema_version: '1',
      record_id: 'continuity-abc',
      project_root: '/Users/x/Code',
      continuity_kind: 'standalone',
      created_at: '2026-04-18T05:00:00.000Z',
      git: { cwd: '/Users/x/Code' },
      narrative: CONT_NARRATIVE,
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I2 — rejects index with string schema_version "1"', () => {
    const bad = ContinuityIndex.safeParse({
      schema_version: '1',
      project_root: '/Users/x/Code',
      pending_record: null,
      current_run: null,
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I8 — AttachedRunPointer rejects surplus key (legacy "manifest_present")', () => {
    const bad = AttachedRunPointer.safeParse({
      run_id: CONT_RUN,
      current_phase: 'frame',
      current_step: 'frame-goal',
      runtime_status: 'in_progress',
      attached_at: '2026-04-19T00:00:00.000Z',
      last_validated_at: '2026-04-19T00:00:00.000Z',
      manifest_present: true,
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I10 — pending_record.record_id rejects path separator', () => {
    const bad = PendingRecordPointer.safeParse({
      record_id: 'continuity/abc',
      continuity_kind: 'standalone',
      created_at: '2026-04-19T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('CONT-I10 — pending_record.record_id rejects parent-traversal "..", ', () => {
    const bad = PendingRecordPointer.safeParse({
      record_id: 'foo..bar',
      continuity_kind: 'standalone',
      created_at: '2026-04-19T00:00:00.000Z',
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
        resolved_from: { source: 'explicit' },
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

// Selection contract — SEL-I1..I9 from specs/contracts/selection.md v0.1.
// Each invariant gets positive + negative coverage; SEL-I6/I7 get adversarial
// permutations of the applied chain to guard against accidental ordering or
// uniqueness regressions in future resolver changes.

describe('SelectionSource enum is closed (SEL-I1 declaration layer)', () => {
  it('accepts every documented source', () => {
    for (const s of [
      'default',
      'user-global',
      'project',
      'workflow',
      'phase',
      'step',
      'invocation',
    ] as const) {
      expect(SelectionSource.safeParse(s).success).toBe(true);
    }
  });

  it('rejects unknown source labels', () => {
    expect(SelectionSource.safeParse('cli').success).toBe(false);
    expect(SelectionSource.safeParse('env').success).toBe(false);
    expect(SelectionSource.safeParse('').success).toBe(false);
  });
});

describe('SELECTION_PRECEDENCE (SEL-I1)', () => {
  it('is the documented 7-tuple in order', () => {
    expect(SELECTION_PRECEDENCE).toEqual([
      'default',
      'user-global',
      'project',
      'workflow',
      'phase',
      'step',
      'invocation',
    ]);
  });

  it('contains every SelectionSource enum value exactly once', () => {
    const enumValues = new Set(SelectionSource.options);
    const tupleValues = new Set(SELECTION_PRECEDENCE);
    expect(tupleValues).toEqual(enumValues);
    expect(SELECTION_PRECEDENCE.length).toBe(SelectionSource.options.length);
  });
});

describe('SelectionOverride (SEL-I2)', () => {
  it('parses the empty contribution', () => {
    const parsed = SelectionOverride.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skills).toEqual({ mode: 'inherit' });
      expect(parsed.data.invocation_options).toEqual({});
    }
  });

  it('rejects surplus key (typo that would silently revert to prior layer)', () => {
    const bad = SelectionOverride.safeParse({ rigr: 'standard' });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key alongside valid fields', () => {
    const bad = SelectionOverride.safeParse({
      rigor: 'standard',
      effort: 'high',
      smuggled: true,
    });
    expect(bad.success).toBe(false);
  });
});

describe('SkillOverride (SEL-I3)', () => {
  it('inherit carries no skills field', () => {
    expect(SkillOverride.safeParse({ mode: 'inherit' }).success).toBe(true);
  });

  it('inherit rejects an accompanying skills field', () => {
    const bad = SkillOverride.safeParse({ mode: 'inherit', skills: ['tdd'] });
    expect(bad.success).toBe(false);
  });

  it('replace/append/remove accept empty arrays as meaningful operations', () => {
    for (const mode of ['replace', 'append', 'remove'] as const) {
      expect(SkillOverride.safeParse({ mode, skills: [] }).success).toBe(true);
    }
  });

  it('replace/append/remove reject missing skills field', () => {
    for (const mode of ['replace', 'append', 'remove'] as const) {
      expect(SkillOverride.safeParse({ mode }).success).toBe(false);
    }
  });

  it('rejects unknown mode', () => {
    expect(SkillOverride.safeParse({ mode: 'override', skills: [] }).success).toBe(false);
  });

  it('rejects surplus keys on every variant', () => {
    expect(SkillOverride.safeParse({ mode: 'inherit', smuggled: 'x' }).success).toBe(false);
    expect(SkillOverride.safeParse({ mode: 'replace', skills: [], smuggled: 'x' }).success).toBe(
      false,
    );
    expect(SkillOverride.safeParse({ mode: 'append', skills: [], smuggled: 'x' }).success).toBe(
      false,
    );
    expect(SkillOverride.safeParse({ mode: 'remove', skills: [], smuggled: 'x' }).success).toBe(
      false,
    );
  });

  it('rejects duplicate skills in replace (Codex MED #8 fold-in)', () => {
    const bad = SkillOverride.safeParse({ mode: 'replace', skills: ['tdd', 'tdd'] });
    expect(bad.success).toBe(false);
  });

  it('rejects duplicate skills in append (MED #8)', () => {
    const bad = SkillOverride.safeParse({ mode: 'append', skills: ['tdd', 'tdd'] });
    expect(bad.success).toBe(false);
  });

  it('rejects duplicate skills in remove (MED #8)', () => {
    const bad = SkillOverride.safeParse({ mode: 'remove', skills: ['tdd', 'tdd'] });
    expect(bad.success).toBe(false);
  });
});

describe('ProviderScopedModel (SEL-I4)', () => {
  it('accepts the four-provider enum with an open model string', () => {
    for (const provider of ['openai', 'anthropic', 'gemini', 'custom'] as const) {
      expect(ProviderScopedModel.safeParse({ provider, model: 'x' }).success).toBe(true);
    }
  });

  it('rejects a marketing-only identifier (no provider)', () => {
    expect(ProviderScopedModel.safeParse({ model: 'gpt-5.4' }).success).toBe(false);
  });

  it('rejects unknown provider', () => {
    expect(ProviderScopedModel.safeParse({ provider: 'cohere', model: 'x' }).success).toBe(false);
  });

  it('rejects empty model string', () => {
    expect(ProviderScopedModel.safeParse({ provider: 'openai', model: '' }).success).toBe(false);
  });

  it('rejects surplus key', () => {
    const bad = ProviderScopedModel.safeParse({
      provider: 'openai',
      model: 'gpt-5.4',
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });
});

describe('Effort (SEL-I4)', () => {
  it('accepts the 6-tier OpenAI vocabulary', () => {
    for (const e of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const) {
      expect(Effort.safeParse(e).success).toBe(true);
    }
  });

  it('rejects legacy or provider-specific labels', () => {
    expect(Effort.safeParse('max').success).toBe(false);
    expect(Effort.safeParse('reasoning-high').success).toBe(false);
  });
});

describe('ResolvedSelection (SEL-I5)', () => {
  it('accepts a flat projection', () => {
    const parsed = ResolvedSelection.safeParse({
      skills: ['tdd', 'manual-testing'],
      effort: 'high',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts invocation_options (Codex HIGH #4 fold-in: effective state at dispatch time)', () => {
    const ok = ResolvedSelection.safeParse({
      skills: [],
      invocation_options: { temperature: 0 },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a nested SkillOverride (resolver must flatten)', () => {
    const bad = ResolvedSelection.safeParse({
      skills: { mode: 'replace', skills: ['tdd'] },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key (silent strip would mask a resolver bug)', () => {
    const bad = ResolvedSelection.safeParse({ skills: [], smuggled: 'x' });
    expect(bad.success).toBe(false);
  });

  it('rejects duplicate skill ids (Codex MED #8 fold-in)', () => {
    const bad = ResolvedSelection.safeParse({ skills: ['tdd', 'tdd'] });
    expect(bad.success).toBe(false);
  });

  it('rejects non-JSON invocation_options value: function (Codex MED #10 fold-in)', () => {
    const bad = ResolvedSelection.safeParse({
      skills: [],
      invocation_options: { hook: () => 1 },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects non-JSON invocation_options value: Date (Codex MED #10)', () => {
    const bad = ResolvedSelection.safeParse({
      skills: [],
      invocation_options: { deadline: new Date() },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects non-JSON invocation_options value: NaN (Codex MED #10)', () => {
    const bad = ResolvedSelection.safeParse({
      skills: [],
      invocation_options: { temperature: Number.NaN },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects non-JSON invocation_options value: Infinity (Codex MED #10)', () => {
    const bad = ResolvedSelection.safeParse({
      skills: [],
      invocation_options: { temperature: Number.POSITIVE_INFINITY },
    });
    expect(bad.success).toBe(false);
  });
});

describe('SelectionResolution ordering and uniqueness (SEL-I6, SEL-I7)', () => {
  // Codex MED #7 fold-in: applied entries require non-empty overrides
  // (ghost-provenance rejection). Each helper below sets exactly one field
  // so the override legitimately contributes to the chain.
  const contributes = { rigor: 'standard' as const };

  it('accepts in-order applied chain with unique sources', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'default', override: contributes },
        { source: 'user-global', override: contributes },
        { source: 'project', override: contributes },
        { source: 'workflow', override: contributes },
        { source: 'phase', phase_id: 'review', override: contributes },
        { source: 'step', step_id: 'review-step', override: contributes },
        { source: 'invocation', override: contributes },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a sparse in-order chain (non-contributing layers can be omitted)', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'user-global', override: contributes },
        { source: 'step', step_id: 'review-step', override: contributes },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts an empty applied chain (no layer contributed)', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [],
    });
    expect(ok.success).toBe(true);
  });

  it('SEL-I6 rejects out-of-order: workflow before user-global', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'workflow', override: contributes },
        { source: 'user-global', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('out of precedence order'))).toBe(
        true,
      );
    }
  });

  it('SEL-I6 rejects out-of-order: invocation before step', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'invocation', override: contributes },
        { source: 'step', step_id: 'review-step', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it('SEL-I6 rejects phase before workflow (the cross-layer case)', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'phase', phase_id: 'review', override: contributes },
        { source: 'workflow', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it('SEL-I7 rejects duplicate singleton source: two workflow entries', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'workflow', override: contributes },
        { source: 'workflow', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('duplicate applied identity'))).toBe(
        true,
      );
    }
  });

  it('SEL-I7 rejects duplicate singleton source even when non-adjacent', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'user-global', override: contributes },
        { source: 'workflow', override: contributes },
        { source: 'step', step_id: 'review-step', override: contributes },
        { source: 'user-global', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
  });
});

// Codex HIGH #1 + HIGH #2 fold-in: phase/step applied entries are
// disambiguated by id, so two distinct phases or steps can legally appear
// in the same applied chain. SEL-I7's uniqueness is now keyed on identity
// (source + disambiguator), not bare source.
describe('SelectionResolution HIGH #1/#2 fold-in: phase/step disambiguators', () => {
  const contributes = { rigor: 'standard' as const };

  it('accepts two phase entries with distinct phase_ids (overlapping phases)', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'phase', phase_id: 'review', override: contributes },
        { source: 'phase', phase_id: 'verify', override: contributes },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts two step entries with distinct step_ids', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'step', step_id: 'compose-brief', override: contributes },
        { source: 'step', step_id: 'review-step', override: contributes },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('SEL-I7 rejects two phase entries with the same phase_id', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'phase', phase_id: 'review', override: contributes },
        { source: 'phase', phase_id: 'review', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('duplicate applied identity'))).toBe(
        true,
      );
    }
  });

  it('SEL-I7 rejects two step entries with the same step_id', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'step', step_id: 'compose-brief', override: contributes },
        { source: 'step', step_id: 'compose-brief', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects phase applied entry missing the phase_id disambiguator', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'phase', override: contributes }],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects step applied entry missing the step_id disambiguator', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'step', override: contributes }],
    });
    expect(bad.success).toBe(false);
  });

  it('SEL-I6 rejects step-then-phase: category order still holds when disambiguator is present', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        { source: 'step', step_id: 'compose-brief', override: contributes },
        { source: 'phase', phase_id: 'review', override: contributes },
      ],
    });
    expect(bad.success).toBe(false);
  });
});

// Codex MED #7 fold-in: ghost provenance rejection. An applied entry
// whose override is empty (no model/effort/rigor, skills at inherit,
// empty invocation_options) fabricates provenance for a non-contributing
// layer. v0.1 rejects at the schema layer.
describe('SelectionResolution ghost provenance (MED #7)', () => {
  it('rejects applied entry with fully empty override', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'workflow', override: {} }],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message.includes('empty override'))).toBe(true);
    }
  });

  it('rejects applied entry with explicit inherit + empty invocation_options', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        {
          source: 'workflow',
          override: { skills: { mode: 'inherit' }, invocation_options: {} },
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it('accepts applied entry contributing only rigor', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'workflow', override: { rigor: 'deep' } }],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts applied entry contributing only an append skill op', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        {
          source: 'workflow',
          override: { skills: { mode: 'append', skills: ['tdd'] } },
        },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts applied entry contributing only invocation_options', () => {
    const ok = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'workflow', override: { invocation_options: { verbose: true } } }],
    });
    expect(ok.success).toBe(true);
  });
});

describe('SelectionResolution transitive strict (SEL-I8)', () => {
  const contributes = { rigor: 'standard' as const };

  it('rejects surplus key on the top-level SelectionResolution', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [],
      smuggled: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key on an applied[] entry', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'workflow', override: contributes, smuggled: 'x' }],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key inside applied[].override', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [{ source: 'workflow', override: { rigor: 'standard', smuggled: 'x' } }],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key inside applied[].override.model', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        {
          source: 'workflow',
          override: { model: { provider: 'openai', model: 'gpt-5.4', smuggled: 'x' } },
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key inside applied[].override.skills', () => {
    const bad = SelectionResolution.safeParse({
      resolved: { skills: [] },
      applied: [
        {
          source: 'workflow',
          override: { skills: { mode: 'replace', skills: [], smuggled: 'x' } },
        },
      ],
    });
    expect(bad.success).toBe(false);
  });
});

describe('Phase.selection (SEL-I9 — closes phase.md v0.1 Codex MED #7)', () => {
  it('accepts a Phase with no selection (backward compatibility with existing phase.md)', () => {
    const ok = Phase.safeParse({
      id: 'frame',
      title: 'Frame',
      canonical: 'frame',
      steps: ['compose-brief'],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a Phase with a selection override', () => {
    const ok = Phase.safeParse({
      id: 'review',
      title: 'Review',
      canonical: 'review',
      steps: ['review-step'],
      selection: {
        model: { provider: 'anthropic', model: 'claude-opus-4-7' },
        effort: 'high',
      },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a Phase with a misspelled selection field (PHASE-I2 still governs)', () => {
    const bad = Phase.safeParse({
      id: 'review',
      title: 'Review',
      steps: ['review-step'],
      selectoin: { effort: 'high' },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a Phase whose selection override has a typo inside it (SEL-I2 transitive)', () => {
    const bad = Phase.safeParse({
      id: 'review',
      title: 'Review',
      steps: ['review-step'],
      selection: { rigr: 'standard' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('BuiltInAdapter (ADAPTER-I1)', () => {
  it('accepts the 3 declared built-ins', () => {
    expect(BuiltInAdapter.safeParse('agent').success).toBe(true);
    expect(BuiltInAdapter.safeParse('codex').success).toBe(true);
    expect(BuiltInAdapter.safeParse('codex-isolated').success).toBe(true);
  });

  it('rejects unknown built-in names', () => {
    expect(BuiltInAdapter.safeParse('gemini').success).toBe(false);
    expect(BuiltInAdapter.safeParse('ollama').success).toBe(false);
    expect(BuiltInAdapter.safeParse('').success).toBe(false);
  });

  it('built-in enum is the frozen 3-tuple and ordering is stable', () => {
    expect(BuiltInAdapter.options).toEqual(['agent', 'codex', 'codex-isolated']);
  });
});

describe('AdapterName regex (ADAPTER-I2 syntax)', () => {
  it('accepts lowercase, digits-after-first, hyphens', () => {
    expect(AdapterName.safeParse('gemini').success).toBe(true);
    expect(AdapterName.safeParse('ollama-local').success).toBe(true);
    expect(AdapterName.safeParse('a1-b2-c3').success).toBe(true);
  });

  it('rejects uppercase, leading digit, whitespace, empty, underscores', () => {
    expect(AdapterName.safeParse('Gemini').success).toBe(false);
    expect(AdapterName.safeParse('1gemini').success).toBe(false);
    expect(AdapterName.safeParse('gem ini').success).toBe(false);
    expect(AdapterName.safeParse('').success).toBe(false);
    expect(AdapterName.safeParse('gem_ini').success).toBe(false);
    expect(AdapterName.safeParse('-gemini').success).toBe(false);
  });
});

describe('RESERVED_ADAPTER_NAMES (ADAPTER-I2 reservation set)', () => {
  it('contains every built-in plus the auto sentinel and nothing else', () => {
    expect(RESERVED_ADAPTER_NAMES).toEqual(['agent', 'codex', 'codex-isolated', 'auto']);
  });
});

describe('CustomAdapterDescriptor (ADAPTER-I3)', () => {
  const ok = {
    kind: 'custom' as const,
    name: 'gemini',
    command: ['./docs/examples/gemini-dispatch.sh', '--model', 'gemini-2.5-pro'],
  };

  it('parses a well-formed descriptor', () => {
    expect(CustomAdapterDescriptor.safeParse(ok).success).toBe(true);
  });

  it('rejects empty command vector', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: [] }).success).toBe(false);
  });

  it('rejects empty string element in command (ADAPTER-I3 element-level min)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: ['codex', ''] }).success).toBe(
      false,
    );
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: [''] }).success).toBe(false);
  });

  it('rejects surplus keys (ADAPTER-I9 transitive .strict() on the descriptor)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, env: { API_KEY: 'x' } }).success).toBe(false);
  });

  it('rejects wrong kind literal (ADAPTER-I4 discriminant)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, kind: 'builtin' }).success).toBe(false);
  });

  it('rejects name that violates AdapterName regex', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, name: 'Gemini' }).success).toBe(false);
  });
});

describe('AdapterRef discriminated union (ADAPTER-I4)', () => {
  it('accepts builtin variant', () => {
    const ok = AdapterRef.safeParse({ kind: 'builtin', name: 'codex-isolated' });
    expect(ok.success).toBe(true);
  });

  it('accepts named variant', () => {
    const ok = AdapterRef.safeParse({ kind: 'named', name: 'gemini' });
    expect(ok.success).toBe(true);
  });

  it('accepts inline custom variant (distinct from AdapterReference — ADAPTER-I5)', () => {
    const ok = AdapterRef.safeParse({
      kind: 'custom',
      name: 'gemini',
      command: ['./bin/gemini-dispatch'],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown kind discriminant', () => {
    const bad = AdapterRef.safeParse({ kind: 'mystery', name: 'x' });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key on builtin variant (ADAPTER-I9 transitive strict)', () => {
    const bad = AdapterRef.safeParse({ kind: 'builtin', name: 'codex', hint: 'x' });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key on named variant', () => {
    const bad = AdapterRef.safeParse({ kind: 'named', name: 'gemini', alias: 'g' });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchConfig reserved-name disjointness (ADAPTER-I2)', () => {
  it('rejects a custom adapter keyed under a BuiltInAdapter value', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        codex: {
          kind: 'custom',
          name: 'codex',
          command: ['./bin/shadow-codex'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a custom adapter keyed under the `auto` sentinel', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        auto: {
          kind: 'custom',
          name: 'auto',
          command: ['./bin/pick-for-me'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('accepts non-reserved custom adapter names', () => {
    const ok = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchConfig strict surface (ADAPTER-I9)', () => {
  it('rejects surplus top-level key (`dispatch.adpaters` typo transposition)', () => {
    const bad = DispatchConfig.safeParse({
      adpaters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference (registry-layer) with inline custom kind — ADAPTER-I5', () => {
    const bad = DispatchConfig.safeParse({
      roles: {
        researcher: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference surplus keys (typo smuggle)', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini', alias: 'g' } },
      adapters: {
        gemini: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference with unknown kind discriminant', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'inline', name: 'gemini' } },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects DispatchRole key outside the closed enum (ADAPTER-I6 — orchestrator not a role)', () => {
    const bad = DispatchConfig.safeParse({
      roles: { orchestrator: { kind: 'builtin', name: 'codex' } },
    });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchResolutionSource (ADAPTER-I7)', () => {
  it('accepts the 5 category variants with correct disambiguators', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'explicit' }).success).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'role', role: 'researcher' }).success).toBe(
      true,
    );
    expect(
      DispatchResolutionSource.safeParse({ source: 'circuit', workflow_id: 'explore' }).success,
    ).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'default' }).success).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'auto' }).success).toBe(true);
  });

  it('rejects role variant missing the role disambiguator', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'role' }).success).toBe(false);
  });

  it('rejects circuit variant missing the workflow_id disambiguator', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'circuit' }).success).toBe(false);
  });

  it('rejects role with a disambiguator for a different category (cross-variant smuggle)', () => {
    const bad = DispatchResolutionSource.safeParse({
      source: 'role',
      workflow_id: 'explore',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects unknown source category', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'heuristic' }).success).toBe(false);
  });

  it('rejects surplus keys on every variant (ADAPTER-I9)', () => {
    expect(
      DispatchResolutionSource.safeParse({ source: 'explicit', flag: '--adapter' }).success,
    ).toBe(false);
    expect(
      DispatchResolutionSource.safeParse({
        source: 'role',
        role: 'researcher',
        fallback: 'default',
      }).success,
    ).toBe(false);
    expect(
      DispatchResolutionSource.safeParse({
        source: 'circuit',
        workflow_id: 'explore',
        smuggled: 'x',
      }).success,
    ).toBe(false);
    expect(DispatchResolutionSource.safeParse({ source: 'default', hint: 'x' }).success).toBe(
      false,
    );
    expect(DispatchResolutionSource.safeParse({ source: 'auto', reason: 'x' }).success).toBe(false);
  });

  it('rejects role variant with an invalid DispatchRole value (closed-enum parity)', () => {
    expect(
      DispatchResolutionSource.safeParse({ source: 'role', role: 'orchestrator' }).success,
    ).toBe(false);
  });
});

describe('DispatchStartedEvent.resolved_from consumes DispatchResolutionSource (ADAPTER-I7 × event)', () => {
  const base = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    adapter: { kind: 'builtin' as const, name: 'codex' as const },
    role: 'researcher' as const,
    resolved_selection: { skills: [] },
  };

  it('accepts role-sourced dispatch with role disambiguator', () => {
    const ok = Event.safeParse({
      ...base,
      resolved_from: { source: 'role', role: 'researcher' },
    });
    expect(ok.success).toBe(true);
  });

  it('accepts circuit-sourced dispatch with workflow_id disambiguator', () => {
    const ok = Event.safeParse({
      ...base,
      resolved_from: { source: 'circuit', workflow_id: 'explore' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects pre-ADAPTER-I7 flat-enum shape (migration guard)', () => {
    const bad = Event.safeParse({
      ...base,
      resolved_from: 'role',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects role-sourced dispatch missing the role disambiguator', () => {
    const bad = Event.safeParse({
      ...base,
      resolved_from: { source: 'role' },
    });
    expect(bad.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Codex cross-model adversarial pass fold-ins (2026-04-19)
// ─────────────────────────────────────────────────────────────────────────

describe('ResolvedAdapter — named references are not a resolved form (Codex HIGH #1)', () => {
  it('accepts built-in variant', () => {
    expect(ResolvedAdapter.safeParse({ kind: 'builtin', name: 'codex-isolated' }).success).toBe(
      true,
    );
  });

  it('accepts inline custom descriptor variant', () => {
    expect(
      ResolvedAdapter.safeParse({
        kind: 'custom',
        name: 'gemini',
        command: ['./bin/g'],
      }).success,
    ).toBe(true);
  });

  it('rejects named reference — resolver must dereference before event emission', () => {
    expect(ResolvedAdapter.safeParse({ kind: 'named', name: 'gemini' }).success).toBe(false);
  });
});

describe('DispatchStartedEvent.adapter rejects named references (Codex HIGH #1 via event)', () => {
  const baseEv = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    role: 'researcher' as const,
    resolved_selection: { skills: [] },
    resolved_from: { source: 'explicit' as const },
  };

  it('parses with a fully-resolved built-in adapter', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'builtin', name: 'codex' },
      }).success,
    ).toBe(true);
  });

  it('parses with a fully-resolved custom descriptor', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      }).success,
    ).toBe(true);
  });

  it('rejects a pre-resolution named reference in event.adapter', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'named', name: 'gemini' },
      }).success,
    ).toBe(false);
  });
});

describe('DispatchConfig registry-key/descriptor-name parity (ADAPTER-I11, Codex HIGH #2)', () => {
  it('ADAPTER-I11 — rejects a descriptor whose `name` does not equal its registry key', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'ollama',
          command: ['./bin/ollama'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I11 — accepts matching registry key and descriptor name', () => {
    const ok = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchConfig closure via own-property check (ADAPTER-I8, Codex HIGH #3)', () => {
  it('ADAPTER-I8 — rejects a role reference to `constructor` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'constructor' } },
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — rejects a circuit reference to `toString` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      circuits: { explore: { kind: 'named', name: 'toString' } },
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — rejects dispatch.default = `hasOwnProperty` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      default: 'hasOwnProperty',
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — accepts a role reference to a name that IS registered as an own key', () => {
    const ok = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini' } },
      adapters: {
        gemini: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchStartedEvent role ↔ resolved_from.role binding (Codex HIGH #4)', () => {
  const baseEv = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    adapter: { kind: 'builtin' as const, name: 'codex' as const },
    resolved_selection: { skills: [] },
  };

  it('accepts event when role matches resolved_from.role', () => {
    const ok = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'role', role: 'researcher' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects event when role disagrees with resolved_from.role', () => {
    const bad = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'role', role: 'reviewer' },
    });
    expect(bad.success).toBe(false);
  });

  it('binding only applies when resolved_from.source === "role"', () => {
    const ok = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'default' },
    });
    expect(ok.success).toBe(true);
  });
});

describe('AdapterReference registry-layer refusal (Codex MED #8 — exported surface)', () => {
  it('accepts builtin variant', () => {
    expect(AdapterReference.safeParse({ kind: 'builtin', name: 'codex' }).success).toBe(true);
  });

  it('accepts named variant', () => {
    expect(AdapterReference.safeParse({ kind: 'named', name: 'gemini' }).success).toBe(true);
  });

  it('rejects inline custom variant (ADAPTER-I5 — registry references by name only)', () => {
    const bad = AdapterReference.safeParse({
      kind: 'custom',
      name: 'gemini',
      command: ['./bin/g'],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus keys (per-variant strict)', () => {
    expect(AdapterReference.safeParse({ kind: 'named', name: 'gemini', alias: 'g' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Config contract — CONFIG-I1 through CONFIG-I7 (Slice 26).
// ---------------------------------------------------------------------------

describe('Config strict surface (CONFIG-I1)', () => {
  it('accepts bare `{schema_version: 1}` and applies all defaults (CONFIG-I7)', () => {
    const ok = Config.safeParse({ schema_version: 1 });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.dispatch.default).toBe('auto');
      expect(ok.data.circuits).toEqual({});
      expect(ok.data.defaults).toEqual({});
    }
  });

  it('rejects surplus top-level key (CONFIG-I1 — `defuults` typo at root)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      defuults: { selection: {} },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus top-level key (CONFIG-I1 — `dispath` typo at root)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      dispath: { default: 'codex' },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects schema_version other than 1 (CONFIG-I6)', () => {
    const bad = Config.safeParse({ schema_version: 2 });
    expect(bad.success).toBe(false);
  });

  it('rejects missing schema_version', () => {
    const bad = Config.safeParse({});
    expect(bad.success).toBe(false);
  });
});

describe('Config.defaults nested strict surface (CONFIG-I4)', () => {
  it('accepts empty defaults object', () => {
    const ok = Config.safeParse({ schema_version: 1, defaults: {} });
    expect(ok.success).toBe(true);
  });

  it('accepts defaults.selection as a valid SelectionOverride', () => {
    const ok = Config.safeParse({
      schema_version: 1,
      defaults: { selection: { effort: 'medium' } },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects surplus key inside defaults (CONFIG-I4 — `selections` plural typo)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      defaults: { selections: { effort: 'medium' } },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects unexpected nested field in defaults (CONFIG-I4 — attempted smuggle)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      defaults: { selection: {}, rigor: 'crucible' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('CircuitOverride strict surface (CONFIG-I3)', () => {
  it('accepts empty circuit override', () => {
    const ok = CircuitOverride.safeParse({});
    expect(ok.success).toBe(true);
  });

  it('accepts circuit override with selection field', () => {
    const ok = CircuitOverride.safeParse({ selection: { effort: 'high' } });
    expect(ok.success).toBe(true);
  });

  it('rejects circuit override with `skills: string[]` v0.0 shortcut (CONFIG-I3)', () => {
    const bad = CircuitOverride.safeParse({ skills: ['dogfood'] });
    expect(bad.success).toBe(false);
  });

  it('rejects circuit override with surplus key (CONFIG-I3 — typo smuggle)', () => {
    const bad = CircuitOverride.safeParse({ selection: {}, priority: 'high' });
    expect(bad.success).toBe(false);
  });
});

describe('LayeredConfig strict surface (CONFIG-I2)', () => {
  it('accepts minimal LayeredConfig with required fields only', () => {
    const ok = LayeredConfig.safeParse({
      layer: 'user-global',
      config: { schema_version: 1 },
    });
    expect(ok.success).toBe(true);
  });

  it('accepts LayeredConfig with optional source_path', () => {
    const ok = LayeredConfig.safeParse({
      layer: 'project',
      source_path: '/workspace/.circuit/config.yaml',
      config: { schema_version: 1 },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects LayeredConfig with surplus wrapper-level key (CONFIG-I2)', () => {
    const bad = LayeredConfig.safeParse({
      layer: 'project',
      source_path: '/workspace/.circuit/config.yaml',
      config: { schema_version: 1 },
      checksum: 'sha256:deadbeef',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects LayeredConfig with `souce_path` typo (CONFIG-I2 — silent-strip defense)', () => {
    const bad = LayeredConfig.safeParse({
      layer: 'project',
      souce_path: '/workspace/.circuit/config.yaml',
      config: { schema_version: 1 },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects LayeredConfig whose config payload carries a surplus key (CONFIG-I1 transitivity)', () => {
    const bad = LayeredConfig.safeParse({
      layer: 'default',
      config: { schema_version: 1, defuults: {} },
    });
    expect(bad.success).toBe(false);
  });
});

describe('ConfigLayer closed enum (CONFIG-I5)', () => {
  it('accepts the four documented layers', () => {
    for (const layer of ['default', 'user-global', 'project', 'invocation']) {
      expect(ConfigLayer.safeParse(layer).success).toBe(true);
    }
  });

  it('rejects an undocumented layer name (CONFIG-I5)', () => {
    expect(ConfigLayer.safeParse('environment').success).toBe(false);
    expect(ConfigLayer.safeParse('remote').success).toBe(false);
    expect(ConfigLayer.safeParse('').success).toBe(false);
  });
});

describe('Config.circuits key closure (CONFIG-I8, Codex MED #5 fold-in)', () => {
  it('accepts a valid slug WorkflowId as a circuits key', () => {
    const ok = Config.safeParse({
      schema_version: 1,
      circuits: { explore: { selection: { effort: 'medium' } } },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a circuits key that fails WorkflowId regex (CONFIG-I8 — whitespace)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      circuits: { 'Bad Id': {} },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a circuits key that fails WorkflowId regex (CONFIG-I8 — path separator)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      circuits: { 'workflow/name': {} },
    });
    expect(bad.success).toBe(false);
  });
});

describe('Config strictness scoped to declared shapes (Codex MED #4 fold-in)', () => {
  it('rejects a typo INSIDE SelectionOverride (declared shape — `rigr` for `rigor`)', () => {
    const bad = Config.safeParse({
      schema_version: 1,
      defaults: { selection: { rigr: 'crucible' } },
    });
    expect(bad.success).toBe(false);
  });

  it('accepts arbitrary keys INSIDE invocation_options (open data-map value by design)', () => {
    const ok = Config.safeParse({
      schema_version: 1,
      defaults: {
        selection: {
          invocation_options: {
            some_adapter_key: 'value',
            another_knob: 42,
            nested_payload: { a: 1, b: [2, 3] },
          },
        },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('LayeredConfig default-layer ergonomic (CONFIG-I7 + CONFIG-I2 composition — Codex LOW #6 fold-in)', () => {
  it('`{layer: "default", config: {schema_version: 1}}` parses and produces all schema-level defaults', () => {
    const ok = LayeredConfig.safeParse({
      layer: 'default',
      config: { schema_version: 1 },
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.layer).toBe('default');
      expect(ok.data.config.schema_version).toBe(1);
      expect(ok.data.config.dispatch.default).toBe('auto');
      expect(ok.data.config.dispatch.roles).toEqual({});
      expect(ok.data.config.dispatch.circuits).toEqual({});
      expect(ok.data.config.dispatch.adapters).toEqual({});
      expect(ok.data.config.circuits).toEqual({});
      expect(ok.data.config.defaults).toEqual({});
    }
  });
});
