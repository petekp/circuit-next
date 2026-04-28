// Workflow graph closure schema — WF-I1..I11 from
// docs/contracts/workflow.md v0.1.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { Workflow } from '../../src/index.js';

describe('Workflow graph closure', () => {
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
    // Include a second, valid entry mode
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

  it('WF-I8: rejects a workflow with a step that cannot reach a terminal route target', () => {
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

  it('WF-I8: accepts a workflow where every step has a terminal route chain', () => {
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

  it('WF-I9: rejects a workflow with a step unreachable from any entry_mode', () => {
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

  it('WF-I9: accepts when both steps are reached by distinct entry_modes', () => {
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

  it('WF-I10: rejects a step whose routes use an author-friendly alias (no `pass` key)', () => {
    // Routes use `success` instead of `pass`. WF-I8 would accept (the
    // `success` edge reaches @complete) but at runtime the
    // gate.evaluated outcome is `pass`, and routes['pass'] is undefined
    // — the run stalls. WF-I10 fails this at parse time.
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

  it('WF-I10: accepts a step that contains the `pass` key among its routes', () => {
    // Minimum legal fixture for WF-I10: routes contains `pass`. Extra
    // route labels (like `fail`) are allowed but not required at v0.2.
    const result = Workflow.safeParse(
      okWorkflow({
        steps: [{ ...okFrameStep, routes: { pass: '@complete', fail: '@stop' } }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('WF-I11 (Runtime Safety Floor): rejects a self-cycle on routes.pass even when fail reaches @complete', () => {
    const loopStep = {
      ...okFrameStep,
      id: 'loop-step',
      routes: { pass: 'loop-step', fail: '@complete' },
    };
    const result = Workflow.safeParse(
      okWorkflow({
        entry_modes: [
          { name: 'default', start_at: 'loop-step', rigor: 'standard', description: 'loop' },
        ],
        phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['loop-step'] }],
        steps: [loopStep],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = JSON.stringify(result.error.issues);
      expect(msg).toContain('WF-I11');
      expect(msg).toContain('loop-step');
    }
  });

  it('WF-I11 (Runtime Safety Floor): rejects a multi-step pass-cycle even when alternate routes reach terminals', () => {
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: 'b', fail: '@complete' },
    };
    const stepB = {
      ...okFrameStep,
      id: 'b',
      routes: { pass: 'a', fail: '@complete' },
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
      expect(msg).toContain('WF-I11');
      expect(msg).toContain('routes.pass');
    }
  });

  it('WF-I11 (Runtime Safety Floor): accepts a pass chain that reaches a terminal', () => {
    const stepA = {
      ...okFrameStep,
      id: 'a',
      routes: { pass: 'b', fail: '@complete' },
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
});
