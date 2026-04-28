import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  FlowSchematic,
  validateFlowSchematicCatalogCompatibility,
} from '../../src/schemas/flow-schematic.js';
import { StepId } from '../../src/schemas/ids.js';
import { WorkflowPrimitiveCatalog } from '../../src/schemas/workflow-primitives.js';

const primitiveCatalogPath = 'docs/workflows/primitive-catalog.json';
const fixSchematicPath = 'src/workflows/fix/schematic.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function parsePrimitiveCatalog() {
  return WorkflowPrimitiveCatalog.parse(readJson(primitiveCatalogPath));
}

function parseFixSchematic() {
  return FlowSchematic.parse(readJson(fixSchematicPath));
}

describe('flow schematic schema — active Fix schematic', () => {
  it('parses the active Fix schematic', () => {
    const schematic = parseFixSchematic();
    expect(schematic.schema_version).toBe('1');
    expect(schematic.id as unknown as string).toBe('fix');
    expect(schematic.status).toBe('active');
    expect(schematic.starts_at as unknown as string).toBe('fix-frame');
  });

  it('keeps the Fix schematic compatible with the primitive catalog', () => {
    const issues = validateFlowSchematicCatalogCompatibility(
      parseFixSchematic(),
      parsePrimitiveCatalog(),
    );
    expect(issues).toEqual([]);
  });

  it('keeps Fix human-decision evidence bound through a generic evidence alias', () => {
    const schematic = parseFixSchematic();
    expect(schematic.contract_aliases).toContainEqual({
      generic: 'workflow.evidence@v1',
      actual: 'fix.diagnosis@v1',
    });
  });

  it('uses the expected Fix primitive sequence', () => {
    const schematic = parseFixSchematic();
    expect(schematic.items.map((item) => item.uses)).toEqual([
      'frame',
      'gather-context',
      'diagnose',
      'human-decision',
      'act',
      'run-verification',
      'review',
      'close-with-evidence',
      'close-with-evidence',
      'handoff',
    ]);
  });

  it('keeps Fix phase bindings aligned with the intended flow shape', () => {
    const schematic = parseFixSchematic();
    expect(schematic.items.map((item) => [item.id as unknown as string, item.phase])).toEqual([
      ['fix-frame', 'frame'],
      ['fix-gather-context', 'analyze'],
      ['fix-diagnose', 'analyze'],
      ['fix-no-repro-decision', 'analyze'],
      ['fix-act', 'act'],
      ['fix-verify', 'verify'],
      ['fix-review', 'review'],
      ['fix-close-lite', 'close'],
      ['fix-close', 'close'],
      ['fix-handoff', 'close'],
    ]);
  });

  it('keeps Fix execution bindings aligned with the intended compiler shape', () => {
    const schematic = parseFixSchematic();
    expect(schematic.items.map((item) => [item.id as unknown as string, item.execution])).toEqual([
      ['fix-frame', { kind: 'synthesis' }],
      ['fix-gather-context', { kind: 'dispatch', role: 'researcher' }],
      ['fix-diagnose', { kind: 'dispatch', role: 'researcher' }],
      ['fix-no-repro-decision', { kind: 'checkpoint' }],
      ['fix-act', { kind: 'dispatch', role: 'implementer' }],
      ['fix-verify', { kind: 'verification' }],
      ['fix-review', { kind: 'dispatch', role: 'reviewer' }],
      ['fix-close-lite', { kind: 'synthesis' }],
      ['fix-close', { kind: 'synthesis' }],
      ['fix-handoff', { kind: 'synthesis' }],
    ]);
  });

  it('keeps Fix close inputs aligned with the evidence path (lite skips review)', () => {
    const schematic = parseFixSchematic();
    const closeLite = schematic.items.find(
      (item) => (item.id as unknown as string) === 'fix-close-lite',
    );
    const close = schematic.items.find((item) => (item.id as unknown as string) === 'fix-close');
    if (closeLite === undefined) throw new Error('fix-close-lite missing');
    if (close === undefined) throw new Error('fix-close missing');

    expect(closeLite.input).toMatchObject({
      brief: 'fix.brief@v1',
      context: 'fix.context@v1',
      diagnosis: 'fix.diagnosis@v1',
      change: 'fix.change@v1',
      verification: 'fix.verification@v1',
    });
    expect(closeLite.input).not.toHaveProperty('review');
    expect(close.input).toMatchObject({
      brief: 'fix.brief@v1',
      context: 'fix.context@v1',
      diagnosis: 'fix.diagnosis@v1',
      change: 'fix.change@v1',
      verification: 'fix.verification@v1',
      review: 'fix.review@v1',
    });
  });

  it('routes Lite verification directly to a no-review close item via route_overrides', () => {
    const schematic = parseFixSchematic();
    const verify = schematic.items.find((item) => (item.id as unknown as string) === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');

    expect(verify.routes.continue).toBe('fix-review');
    expect(verify.route_overrides).toEqual({
      continue: {
        lite: 'fix-close-lite',
      },
    });
  });

  it('rejects an unknown route target at parse time', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const first = items[0];
    if (first === undefined) throw new Error('fixture missing first item');
    first.routes = { continue: 'missing-item' };
    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/unknown schematic item id/);
    }
  });

  it('rejects an unknown route override target at parse time', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const verify = items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fixture missing verify item');
    verify.route_overrides = { continue: { lite: 'missing-item' } };
    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /route override target references unknown schematic item/,
      );
    }
  });

  it('rejects route overrides for undeclared route outcomes', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const verify = items.find((item) => item.id === 'fix-verify');
    if (verify === undefined) throw new Error('fixture missing verify item');
    verify.route_overrides = { split: { lite: 'fix-close-lite' } };
    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/route override must target a declared route outcome/);
    }
  });

  it('rejects duplicate evidence requirements at parse time', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const diagnose = items.find((item) => item.id === 'fix-diagnose');
    if (diagnose === undefined) throw new Error('fixture missing diagnose item');
    diagnose.evidence_requirements = ['confidence', 'confidence'];

    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate evidence requirement/);
    }
  });

  it('rejects dispatch execution without a role at parse time', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const act = items.find((item) => item.id === 'fix-act');
    if (act === undefined) throw new Error('fixture missing act item');
    act.execution = { kind: 'dispatch' };

    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch execution requires a dispatch role/);
    }
  });

  it('rejects dispatch roles on non-dispatch execution at parse time', () => {
    const raw = readJson(fixSchematicPath) as Record<string, unknown>;
    const items = raw.items as Array<Record<string, unknown>>;
    const frame = items.find((item) => item.id === 'fix-frame');
    if (frame === undefined) throw new Error('fixture missing frame item');
    frame.execution = { kind: 'synthesis', role: 'researcher' };

    const result = FlowSchematic.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch role is only allowed for dispatch execution/);
    }
  });

  it('reports route outcomes that the selected primitive does not allow', () => {
    const schematic = parseFixSchematic();
    const frame = schematic.items.find((item) => (item.id as unknown as string) === 'fix-frame');
    if (frame === undefined) throw new Error('fix-frame missing');
    frame.routes = { ...frame.routes, complete: '@complete' };
    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-frame',
      message: 'route "complete" is not allowed by primitive "frame"',
    });
  });

  it('reports schematic items that omit primitive evidence requirements', () => {
    const schematic = parseFixSchematic();
    const diagnose = schematic.items.find(
      (item) => (item.id as unknown as string) === 'fix-diagnose',
    );
    if (diagnose === undefined) throw new Error('fix-diagnose missing');
    diagnose.evidence_requirements = ['cause hypothesis'];

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'evidence requirement "confidence" from primitive "diagnose" is not declared by schematic item',
    });
  });

  it('reports execution kinds that do not match the selected primitive surface', () => {
    const schematic = parseFixSchematic();
    const act = schematic.items.find((item) => (item.id as unknown as string) === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.execution = { kind: 'checkpoint' };

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message:
        'execution kind "checkpoint" is not compatible with primitive "act"; expected one of dispatch, synthesis',
    });
  });

  it('reports phase bindings that do not match the selected primitive', () => {
    const schematic = parseFixSchematic();
    const act = schematic.items.find((item) => (item.id as unknown as string) === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.phase = 'analyze';

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message: 'phase "analyze" is not compatible with primitive "act"; expected one of act',
    });
  });

  it('reports run-verification items that do not bind to verification execution', () => {
    const schematic = parseFixSchematic();
    const verify = schematic.items.find((item) => (item.id as unknown as string) === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');
    verify.execution = { kind: 'synthesis' };

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-verify',
      message:
        'execution kind "synthesis" is not compatible with primitive "run-verification"; expected one of verification',
    });
  });

  it('reports unavailable input contracts in schematic order', () => {
    const schematic = parseFixSchematic();
    const diagnose = schematic.items.find(
      (item) => (item.id as unknown as string) === 'fix-diagnose',
    );
    if (diagnose === undefined) throw new Error('fix-diagnose missing');
    diagnose.input.context = 'missing.context@v1';
    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'input "context" references unavailable contract "missing.context@v1" on at least one reachable route',
    });
    expect(issues).toContainEqual({
      item_id: 'fix-diagnose',
      message:
        'inputs do not satisfy primitive "diagnose"; expected one of [workflow.brief@v1, context.packet@v1]',
    });
  });

  it('reports schematic items that omit every accepted primitive input set', () => {
    const schematic = parseFixSchematic();
    const act = schematic.items.find((item) => (item.id as unknown as string) === 'fix-act');
    if (act === undefined) throw new Error('fix-act missing');
    act.input = { brief: 'fix.brief@v1' };

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-act',
      message:
        'inputs do not satisfy primitive "act"; expected one of [workflow.brief@v1, diagnosis.result@v1] or [workflow.brief@v1, plan.strategy@v1] or [workflow.brief@v1, plan.strategy@v1, diagnosis.result@v1]',
    });
  });

  it('reports inputs that are skipped by a reachable route', () => {
    const schematic = parseFixSchematic();
    const verify = schematic.items.find((item) => (item.id as unknown as string) === 'fix-verify');
    if (verify === undefined) throw new Error('fix-verify missing');
    verify.routes.continue = StepId.parse('fix-close');

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-close',
      message:
        'input "review" references unavailable contract "fix.review@v1" on at least one reachable route',
    });
  });

  it('reports schematic items that cannot be reached from starts_at', () => {
    const schematic = parseFixSchematic();
    const frame = schematic.items.find((item) => (item.id as unknown as string) === 'fix-frame');
    if (frame === undefined) throw new Error('fix-frame missing');
    frame.routes = { stop: '@stop' };

    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toContainEqual({
      item_id: 'fix-gather-context',
      message: 'schematic item is unreachable from starts_at',
    });
  });

  it('reports outputs that are not primitive outputs or declared aliases', () => {
    const schematic = parseFixSchematic();
    const close = schematic.items.find((item) => (item.id as unknown as string) === 'fix-close');
    if (close === undefined) throw new Error('fix-close missing');
    close.output = 'wrong.result@v1';
    const issues = validateFlowSchematicCatalogCompatibility(schematic, parsePrimitiveCatalog());
    expect(issues).toEqual([
      {
        item_id: 'fix-close',
        message:
          'output "wrong.result@v1" is not compatible with primitive output "workflow.result@v1"',
      },
    ]);
  });
});

// Compiler-required metadata. These fields are optional at parse time to
// avoid breaking candidate schematics mid-upgrade, but their cross-field
// shape (kind ↔ writes, kind ↔ gate, checkpoint_policy ↔ checkpoint kind)
// is enforced when present so authors get clear feedback.
describe('flow schematic compiler-required metadata', () => {
  function frameItemWithExtras(extras: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'a-frame',
      uses: 'frame',
      title: 'Frame',
      phase: 'frame',
      input: {},
      output: 'workflow.brief@v1',
      evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
      execution: { kind: 'synthesis' },
      routes: { continue: '@complete' },
      ...extras,
    };
  }

  function actItemWithExtras(extras: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'a-act',
      uses: 'act',
      title: 'Act',
      phase: 'act',
      input: { brief: 'workflow.brief@v1', plan: 'plan.strategy@v1' },
      output: 'change.evidence@v1',
      evidence_requirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: { kind: 'dispatch', role: 'implementer' },
      routes: { continue: '@complete' },
      ...extras,
    };
  }

  function baseSchematic(items: Array<Record<string, unknown>>): Record<string, unknown> {
    return {
      schema_version: '1',
      id: 'demo',
      title: 'Demo',
      purpose: 'demo',
      status: 'candidate',
      starts_at: items[0]?.id,
      initial_contracts: [],
      contract_aliases: [],
      items,
    };
  }

  it('accepts a synthesis item with required gate, schema-sections writes, and protocol', () => {
    const schematic = baseSchematic([
      frameItemWithExtras({
        protocol: 'demo-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope', 'constraints'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(true);
  });

  it('rejects synthesis item missing writes.artifact_path', () => {
    const schematic = baseSchematic([
      frameItemWithExtras({
        writes: {},
        gate: { required: ['scope'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/synthesis execution requires writes\.artifact_path/);
    }
  });

  it('rejects synthesis item with gate.allow (checkpoint-only field)', () => {
    const schematic = baseSchematic([
      frameItemWithExtras({
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'], allow: ['continue'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/gate\.allow is only allowed for checkpoint execution/);
    }
  });

  it('accepts a dispatch item with full path slots and gate.pass', () => {
    const schematic = baseSchematic([
      actItemWithExtras({
        protocol: 'demo-act@v1',
        writes: {
          artifact_path: 'artifacts/change.json',
          request_path: 'artifacts/dispatch/act.request.json',
          receipt_path: 'artifacts/dispatch/act.receipt.txt',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(true);
  });

  it('rejects dispatch item missing receipt_path', () => {
    const schematic = baseSchematic([
      actItemWithExtras({
        writes: {
          request_path: 'artifacts/dispatch/act.request.json',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dispatch execution requires writes\.receipt_path/);
    }
  });

  it('rejects dispatch item with gate.required (synthesis-only field)', () => {
    const schematic = baseSchematic([
      actItemWithExtras({
        writes: {
          request_path: 'artifacts/dispatch/act.request.json',
          receipt_path: 'artifacts/dispatch/act.receipt.txt',
          result_path: 'artifacts/dispatch/act.result.json',
        },
        gate: { pass: ['accept'], required: ['summary'] },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /gate\.required is only allowed for synthesis\|verification execution/,
      );
    }
  });

  it('rejects checkpoint_policy on non-checkpoint execution', () => {
    const schematic = baseSchematic([
      frameItemWithExtras({
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        checkpoint_policy: {
          prompt: 'go?',
          choices: [{ id: 'continue' }],
        },
      }),
    ]);
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /checkpoint_policy is only allowed for checkpoint execution/,
      );
    }
  });

  it('accepts schematic-level entry, entry_modes, spine_policy, phases', () => {
    const schematic = {
      ...baseSchematic([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      version: '0.1.0',
      entry: { signals: { include: ['demo'], exclude: [] }, intent_prefixes: ['demo'] },
      entry_modes: [{ name: 'default', rigor: 'standard', description: 'default mode' }],
      spine_policy: {
        mode: 'partial',
        omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
        rationale: 'demo schematic with only a frame phase for testing',
      },
      phases: [{ canonical: 'frame', id: 'frame-phase', title: 'Frame' }],
    };
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(true);
  });

  it('rejects duplicate entry mode names', () => {
    const schematic = {
      ...baseSchematic([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      entry_modes: [
        { name: 'default', rigor: 'standard', description: 'a' },
        { name: 'default', rigor: 'lite', description: 'b' },
      ],
    };
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate entry mode name: default/);
    }
  });

  it('rejects phases entry mismatch with item phase usage', () => {
    const schematic = {
      ...baseSchematic([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      phases: [{ canonical: 'analyze', id: 'analyze-phase', title: 'Analyze' }],
    };
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /phases is missing an entry for canonical phase 'frame'/,
      );
    }
  });

  it('rejects spine_policy.omits that includes a used canonical phase', () => {
    const schematic = {
      ...baseSchematic([
        frameItemWithExtras({
          writes: { artifact_path: 'artifacts/brief.json' },
          gate: { required: ['scope'] },
        }),
      ]),
      spine_policy: {
        mode: 'partial',
        omits: ['frame'],
        rationale: 'invalid omit because frame is used by an item',
      },
    };
    const result = FlowSchematic.safeParse(schematic);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(
        /canonical phase 'frame' is omitted but used by at least one item/,
      );
    }
  });
});
