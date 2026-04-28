// Exerciser schematics for the five primitives in the catalog that no
// active schematic currently uses: queue, batch, risk-rollback-check,
// human-decision, handoff. The unexercised primitives' contracts are
// unfalsified claims — they say "this primitive accepts these inputs
// and produces this output", but no schematic has ever tried to wire them
// up. This test forces each one through the validation + compile +
// runtime path and records what's actually missing.
//
// Each test is a tight contract probe: build the smallest possible
// schematic that uses one orphan primitive and assert what happens at
// each layer (schematic parse → catalog compatibility → schematic compile →
// runtime execution). When a layer rejects, the assertion captures
// the message so the test documents the contract gap as observed
// behavior. As gaps are closed, the assertions tighten.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type CompileResult,
  compileSchematicToWorkflow,
} from '../../src/runtime/compile-schematic-to-workflow.js';
import { runWorkflow } from '../../src/runtime/runner.js';
import {
  FlowSchematic,
  validateFlowSchematicCatalogCompatibility,
} from '../../src/schemas/flow-schematic.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { WorkflowPrimitiveCatalog } from '../../src/schemas/workflow-primitives.js';
import type { Workflow } from '../../src/schemas/workflow.js';

function exerciserLane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'orphan primitive contract is unfalsified — no schematic exercises it',
    acceptance_evidence:
      'synthetic schematic compiles and runs through the runtime placeholder substrate',
    alternate_framing: 'wait for real workflow — rejected because the contract gap stays hidden',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function singleWorkflow(result: CompileResult): Workflow {
  if (result.kind === 'single') return result.workflow;
  const first = [...result.workflows.values()][0];
  if (first === undefined) throw new Error('compile produced zero workflows');
  return first;
}

function loadCatalog() {
  const raw = JSON.parse(readFileSync('docs/workflows/primitive-catalog.json', 'utf8')) as unknown;
  return WorkflowPrimitiveCatalog.parse(raw);
}

// Minimal schematic shell. Per-test customizes the items and contract aliases.
// Default phases include frame + close so an orphan primitive that wants
// a different phase can be added by the test.
function schematicShell(overrides: {
  id: string;
  starts_at: string;
  initial_contracts?: readonly string[];
  contract_aliases?: ReadonlyArray<{ generic: string; actual: string }>;
  items: ReadonlyArray<unknown>;
  phases: ReadonlyArray<{ canonical: string; id: string; title: string }>;
  spine_omits: readonly string[];
  spine_rationale?: string;
}): unknown {
  return {
    schema_version: '1',
    id: overrides.id,
    title: `Orphan primitive exerciser: ${overrides.id}`,
    purpose: `Synthetic schematic that exercises a single orphan primitive (${overrides.id}) so its contract is forced through validate → compile → run.`,
    status: 'candidate',
    starts_at: overrides.starts_at,
    initial_contracts: overrides.initial_contracts ?? [],
    contract_aliases: overrides.contract_aliases ?? [],
    items: overrides.items,
    version: '0.0.1',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        rigor: 'standard',
        description: `Default exerciser entry mode for ${overrides.id}.`,
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: overrides.spine_omits,
      rationale:
        overrides.spine_rationale ??
        'Synthetic exerciser for orphan primitive — non-exercised canonical phases are deliberately omitted.',
    },
    phases: overrides.phases,
  };
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'circuit-next-orphan-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

// =====================================================================
// handoff: inputs workflow.state + workflow.brief → output continuity.record
// surface: orchestrator, allowed kinds: synthesis | checkpoint
// allowed routes: continue | handoff | escalate
// phase: close
// =====================================================================
describe('orphan primitive: handoff', () => {
  const schematicRaw = schematicShell({
    id: 'orphan-handoff',
    starts_at: 'frame-step',
    initial_contracts: ['workflow.state@v1', 'task.intake@v1', 'route.decision@v1'],
    items: [
      {
        id: 'frame-step',
        uses: 'frame',
        title: 'Frame',
        phase: 'frame',
        input: { intake: 'task.intake@v1', route: 'route.decision@v1' },
        output: 'workflow.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        routes: { continue: 'handoff-step' },
      },
      {
        id: 'handoff-step',
        uses: 'handoff',
        title: 'Handoff',
        phase: 'close',
        input: { state: 'workflow.state@v1', brief: 'workflow.brief@v1' },
        output: 'continuity.record@v1',
        evidence_requirements: [
          'goal',
          'completed moves',
          'pending evidence',
          'next action',
          'known debt',
        ],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-handoff@v1',
        writes: { artifact_path: 'artifacts/handoff.json' },
        gate: { required: ['continuity_record_path'] },
        routes: { complete: '@complete' },
      },
    ],
    phases: [
      { canonical: 'frame', id: 'frame-phase', title: 'Frame' },
      { canonical: 'close', id: 'close-phase', title: 'Close' },
    ],
    spine_omits: ['analyze', 'plan', 'act', 'verify', 'review'],
  });

  it('parses through FlowSchematic', () => {
    expect(() => FlowSchematic.parse(schematicRaw)).not.toThrow();
  });

  it('passes catalog compatibility validation', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const issues = validateFlowSchematicCatalogCompatibility(schematic, loadCatalog());
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it('compiles to a Workflow', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    expect(() => compileSchematicToWorkflow(schematic)).not.toThrow();
  });

  it('runs end-to-end via the placeholder synthesis fallback', async () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const workflow = singleWorkflow(compileSchematicToWorkflow(schematic));
    const outcome = await runWorkflow({
      runRoot: join(runRoot, 'handoff-run'),
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-00000000aaaa'),
      goal: 'orphan-handoff exerciser',
      rigor: 'standard',
      lane: exerciserLane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
    });
    expect(outcome.result.outcome).toBe('complete');
  });
});

// =====================================================================
// human-decision: inputs workflow.question + workflow.evidence → output decision.answer
// surface: host, allowed kinds: checkpoint
// allowed routes: continue | retry | revise | ask | stop | handoff | escalate
// phase: any canonical phase
// =====================================================================
describe('orphan primitive: human-decision', () => {
  const schematicRaw = schematicShell({
    id: 'orphan-human-decision',
    starts_at: 'frame-step',
    initial_contracts: [
      'task.intake@v1',
      'route.decision@v1',
      'workflow.question@v1',
      'workflow.evidence@v1',
    ],
    items: [
      {
        id: 'frame-step',
        uses: 'frame',
        title: 'Frame',
        phase: 'frame',
        input: { intake: 'task.intake@v1', route: 'route.decision@v1' },
        output: 'workflow.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        routes: { continue: 'decision-step' },
      },
      {
        id: 'decision-step',
        uses: 'human-decision',
        title: 'Human Decision',
        phase: 'analyze',
        input: { question: 'workflow.question@v1', evidence: 'workflow.evidence@v1' },
        output: 'decision.answer@v1',
        evidence_requirements: [
          'question',
          'available options',
          'selected option',
          'answer source',
        ],
        execution: { kind: 'checkpoint' },
        protocol: 'orphan-decision@v1',
        writes: {
          checkpoint_request_path: 'artifacts/checkpoints/decision.request.json',
          checkpoint_response_path: 'artifacts/checkpoints/decision.response.json',
        },
        gate: { allow: ['continue'] },
        routes: { continue: '@complete' },
        checkpoint_policy: {
          prompt: 'Should the run continue past this human-decision exerciser?',
          choices: [
            {
              id: 'continue',
              label: 'Continue',
              description: 'Proceed past the human decision.',
            },
          ],
          safe_default_choice: 'continue',
          safe_autonomous_choice: 'continue',
        },
      },
    ],
    phases: [
      { canonical: 'frame', id: 'frame-phase', title: 'Frame' },
      { canonical: 'analyze', id: 'analyze-phase', title: 'Analyze' },
    ],
    spine_omits: ['plan', 'act', 'verify', 'review', 'close'],
  });

  it('parses through FlowSchematic', () => {
    expect(() => FlowSchematic.parse(schematicRaw)).not.toThrow();
  });

  it('passes catalog compatibility validation', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const issues = validateFlowSchematicCatalogCompatibility(schematic, loadCatalog());
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it('compiles to a Workflow', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    expect(() => compileSchematicToWorkflow(schematic)).not.toThrow();
  });

  it('resolves the checkpoint via safe_autonomous_choice and runs to complete', async () => {
    // The host primitive's runtime contract is "pause for the operator and
    // record the answer". When no operator is present, the runner takes
    // the safe_autonomous_choice declared in the policy — the same path
    // Build's autonomous mode uses for its frame checkpoint. So the run
    // resolves the checkpoint immediately and completes. To observe an
    // actual pause we'd need a checkpoint policy that omits
    // safe_autonomous_choice; the contract probe here just confirms the
    // primitive is wireable end-to-end.
    const schematic = FlowSchematic.parse(schematicRaw);
    const workflow = singleWorkflow(compileSchematicToWorkflow(schematic));
    const outcome = await runWorkflow({
      runRoot: join(runRoot, 'human-decision-run'),
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-00000000eeee'),
      goal: 'orphan-human-decision exerciser',
      rigor: 'standard',
      lane: exerciserLane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 20, 0)),
    });
    expect(outcome.result.outcome).toBe('complete');
  });
});

// =====================================================================
// queue: inputs workflow.brief + context.packet → output work.queue
// surface: orchestrator, allowed kinds: synthesis | checkpoint
// phase: plan
// =====================================================================
describe('orphan primitive: queue', () => {
  const schematicRaw = schematicShell({
    id: 'orphan-queue',
    starts_at: 'frame-step',
    initial_contracts: ['task.intake@v1', 'route.decision@v1', 'context.packet@v1'],
    items: [
      {
        id: 'frame-step',
        uses: 'frame',
        title: 'Frame',
        phase: 'frame',
        input: { intake: 'task.intake@v1', route: 'route.decision@v1' },
        output: 'workflow.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        routes: { continue: 'queue-step' },
      },
      {
        id: 'queue-step',
        uses: 'queue',
        title: 'Queue',
        phase: 'plan',
        input: { brief: 'workflow.brief@v1', context: 'context.packet@v1' },
        output: 'work.queue@v1',
        evidence_requirements: ['ordered items', 'item state', 'risk class', 'selection rule'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-queue@v1',
        writes: { artifact_path: 'artifacts/queue.json' },
        gate: { required: ['items'] },
        routes: { continue: '@complete' },
      },
    ],
    phases: [
      { canonical: 'frame', id: 'frame-phase', title: 'Frame' },
      { canonical: 'plan', id: 'plan-phase', title: 'Plan' },
    ],
    spine_omits: ['analyze', 'act', 'verify', 'review', 'close'],
  });

  it('parses through FlowSchematic', () => {
    expect(() => FlowSchematic.parse(schematicRaw)).not.toThrow();
  });

  it('passes catalog compatibility validation', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const issues = validateFlowSchematicCatalogCompatibility(schematic, loadCatalog());
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it('compiles to a Workflow', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    expect(() => compileSchematicToWorkflow(schematic)).not.toThrow();
  });

  it('runs end-to-end via the placeholder synthesis fallback', async () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const workflow = singleWorkflow(compileSchematicToWorkflow(schematic));
    const outcome = await runWorkflow({
      runRoot: join(runRoot, 'queue-run'),
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-00000000bbbb'),
      goal: 'orphan-queue exerciser',
      rigor: 'standard',
      lane: exerciserLane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 5, 0)),
    });
    expect(outcome.result.outcome).toBe('complete');
  });
});

// =====================================================================
// batch: inputs work.queue + workflow.brief → output batch.result
// surface: mixed, allowed kinds: synthesis | dispatch | verification | checkpoint
// phase: act
// =====================================================================
describe('orphan primitive: batch', () => {
  const schematicRaw = schematicShell({
    id: 'orphan-batch',
    starts_at: 'frame-step',
    initial_contracts: ['task.intake@v1', 'route.decision@v1', 'work.queue@v1'],
    items: [
      {
        id: 'frame-step',
        uses: 'frame',
        title: 'Frame',
        phase: 'frame',
        input: { intake: 'task.intake@v1', route: 'route.decision@v1' },
        output: 'workflow.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        routes: { continue: 'batch-step' },
      },
      {
        id: 'batch-step',
        uses: 'batch',
        title: 'Batch',
        phase: 'act',
        input: { queue: 'work.queue@v1', brief: 'workflow.brief@v1' },
        output: 'batch.result@v1',
        evidence_requirements: [
          'completed items',
          'skipped items',
          'blocked items',
          'failed items',
        ],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-batch@v1',
        writes: { artifact_path: 'artifacts/batch.json' },
        gate: { required: ['items'] },
        routes: { continue: '@complete' },
      },
    ],
    phases: [
      { canonical: 'frame', id: 'frame-phase', title: 'Frame' },
      { canonical: 'act', id: 'act-phase', title: 'Act' },
    ],
    spine_omits: ['analyze', 'plan', 'verify', 'review', 'close'],
  });

  it('parses through FlowSchematic', () => {
    expect(() => FlowSchematic.parse(schematicRaw)).not.toThrow();
  });

  it('passes catalog compatibility validation', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const issues = validateFlowSchematicCatalogCompatibility(schematic, loadCatalog());
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it('compiles to a Workflow', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    expect(() => compileSchematicToWorkflow(schematic)).not.toThrow();
  });

  it('runs end-to-end via the placeholder synthesis fallback', async () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const workflow = singleWorkflow(compileSchematicToWorkflow(schematic));
    const outcome = await runWorkflow({
      runRoot: join(runRoot, 'batch-run'),
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-00000000cccc'),
      goal: 'orphan-batch exerciser',
      rigor: 'standard',
      lane: exerciserLane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 10, 0)),
    });
    expect(outcome.result.outcome).toBe('complete');
  });
});

// =====================================================================
// risk-rollback-check: inputs change.evidence + verification.result + workflow.brief
// → output risk.decision
// surface: orchestrator, allowed kinds: synthesis | checkpoint
// phase: verify or close
// =====================================================================
describe('orphan primitive: risk-rollback-check', () => {
  const schematicRaw = schematicShell({
    id: 'orphan-risk-rollback-check',
    starts_at: 'frame-step',
    initial_contracts: [
      'task.intake@v1',
      'route.decision@v1',
      'change.evidence@v1',
      'verification.result@v1',
    ],
    items: [
      {
        id: 'frame-step',
        uses: 'frame',
        title: 'Frame',
        phase: 'frame',
        input: { intake: 'task.intake@v1', route: 'route.decision@v1' },
        output: 'workflow.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-frame@v1',
        writes: { artifact_path: 'artifacts/brief.json' },
        gate: { required: ['scope'] },
        routes: { continue: 'risk-step' },
      },
      {
        id: 'risk-step',
        uses: 'risk-rollback-check',
        title: 'Risk and Rollback',
        phase: 'close',
        input: {
          change: 'change.evidence@v1',
          verification: 'verification.result@v1',
          brief: 'workflow.brief@v1',
        },
        output: 'risk.decision@v1',
        evidence_requirements: ['risk class', 'allowed next action', 'recovery option'],
        execution: { kind: 'synthesis' },
        protocol: 'orphan-risk@v1',
        writes: { artifact_path: 'artifacts/risk.json' },
        gate: { required: ['decision'] },
        routes: { continue: '@complete' },
      },
    ],
    phases: [
      { canonical: 'frame', id: 'frame-phase', title: 'Frame' },
      { canonical: 'close', id: 'close-phase', title: 'Close' },
    ],
    spine_omits: ['analyze', 'plan', 'act', 'verify', 'review'],
  });

  it('parses through FlowSchematic', () => {
    expect(() => FlowSchematic.parse(schematicRaw)).not.toThrow();
  });

  it('passes catalog compatibility validation', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const issues = validateFlowSchematicCatalogCompatibility(schematic, loadCatalog());
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it('compiles to a Workflow', () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    expect(() => compileSchematicToWorkflow(schematic)).not.toThrow();
  });

  it('runs end-to-end via the placeholder synthesis fallback', async () => {
    const schematic = FlowSchematic.parse(schematicRaw);
    const workflow = singleWorkflow(compileSchematicToWorkflow(schematic));
    const outcome = await runWorkflow({
      runRoot: join(runRoot, 'risk-run'),
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-00000000dddd'),
      goal: 'orphan-risk exerciser',
      rigor: 'standard',
      lane: exerciserLane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 15, 0)),
    });
    expect(outcome.result.outcome).toBe('complete');
  });
});
