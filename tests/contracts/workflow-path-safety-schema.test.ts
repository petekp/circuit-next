// Phase contract + Workflow spine_policy schema —
// PHASE-I1..I6 from docs/contracts/phase.md v0.1.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { Phase, Workflow } from '../../src/index.js';

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

describe('Workflow spine_policy (PHASE-I4)', () => {
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

  it('PHASE-I5: rejects duplicate canonical phases', () => {
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

  it('partial-mode omits must be disjoint from declared canonicals', () => {
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

  it('partial-mode omits must be pairwise unique', () => {
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

  it('PHASE-I6: Workflow itself rejects top-level surplus keys', () => {
    const result = Workflow.safeParse({
      ...workflowBase,
      phases: sevenPhases,
      spine_policy: { mode: 'strict' },
      audit_notes: 'surplus top-level key should be rejected', // surplus
    });
    expect(result.success).toBe(false);
  });
});
