import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

// Adversarial-review fix #2: deriveTerminalVerdict (in runner.ts) had
// no direct end-to-end coverage. Every existing sub-run / migrate
// test stubs the childRunner and hand-writes the child's result.json,
// so the runner's own walk-backward over events never executes in
// those tests. These tests exercise real derivation through
// runWorkflow:
//
//   1) single-dispatch happy path — the only verdict-bearing step's
//      verdict surfaces as result.verdict.
//   2) multi-dispatch sequence — when a workflow admits two distinct
//      verdicts before close, walk-backward picks the LATER one
//      (the verdict on the route-segment closest to @complete).
//   3) aborted run — result.verdict is undefined regardless of any
//      mid-route admitted verdict.
//   4) synthesis-only run — no dispatch / sub-run admission means no
//      terminal verdict; result.verdict is undefined.

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadDogfood(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function fixedDispatcher(verdict: string): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-verdict-derivation',
      result_body: JSON.stringify({ verdict }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function sequenceDispatcher(verdicts: string[]): DispatchFn {
  let call = 0;
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      const verdict = verdicts[call++];
      if (verdict === undefined) {
        throw new Error(
          `sequenceDispatcher exhausted at call ${call}; provided ${verdicts.length} verdicts`,
        );
      }
      return {
        request_payload: input.prompt,
        receipt_id: `stub-receipt-verdict-${call}`,
        result_body: JSON.stringify({ verdict }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'pre-fix, deriveTerminalVerdict had no end-to-end coverage and could regress silently',
    acceptance_evidence:
      'walk-backward picks the latest admitted verdict on the route to @complete',
    alternate_framing: 'lean only on stubbed sub-run tests — rejected; they bypass derivation',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-verdict-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('deriveTerminalVerdict — fix #2 coverage', () => {
  it('single-dispatch run surfaces the verdict on result.json', async () => {
    const { workflow, bytes } = loadDogfood();
    const runRoot = join(runRootBase, 'run-single');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('aaaaaaaa-1111-1111-1111-111111111111'),
      goal: 'single-dispatch verdict derivation',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      dispatcher: fixedDispatcher('ok'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBe('ok');
  });

  it('multi-dispatch run surfaces the LATER admitted verdict (walk-backward)', async () => {
    // Two dispatch steps in sequence, each admitting a distinct
    // verdict. Walk-backward must return the second dispatch's
    // verdict — the one on the segment that reached @complete.
    const workflow = Workflow.parse({
      schema_version: '2',
      id: 'multi-dispatch-fixture',
      version: '0.1.0',
      purpose: 'Test fixture for multi-dispatch terminal verdict derivation.',
      entry: { signals: { include: ['multi'], exclude: [] }, intent_prefixes: ['multi'] },
      entry_modes: [
        {
          name: 'multi',
          start_at: 'first-dispatch',
          rigor: 'standard',
          description: 'two-dispatch route',
        },
      ],
      phases: [
        {
          id: 'act-phase',
          title: 'Act',
          canonical: 'act',
          steps: ['first-dispatch', 'second-dispatch'],
        },
      ],
      spine_policy: {
        mode: 'partial',
        omits: ['frame', 'plan', 'analyze', 'verify', 'review', 'close'],
        rationale: 'narrow test fixture for verdict derivation',
      },
      steps: [
        {
          id: 'first-dispatch',
          title: 'First dispatch — admits "intermediate"',
          protocol: 'multi-dispatch@v1',
          reads: [],
          routes: { pass: 'second-dispatch' },
          executor: 'worker',
          kind: 'dispatch',
          role: 'implementer',
          writes: {
            request: 'artifacts/first.request.json',
            receipt: 'artifacts/first.receipt.json',
            result: 'artifacts/first.result.json',
          },
          gate: {
            kind: 'result_verdict',
            source: { kind: 'dispatch_result', ref: 'result' },
            pass: ['intermediate'],
          },
        },
        {
          id: 'second-dispatch',
          title: 'Second dispatch — admits "final"',
          protocol: 'multi-dispatch@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'worker',
          kind: 'dispatch',
          role: 'implementer',
          writes: {
            request: 'artifacts/second.request.json',
            receipt: 'artifacts/second.receipt.json',
            result: 'artifacts/second.result.json',
          },
          gate: {
            kind: 'result_verdict',
            source: { kind: 'dispatch_result', ref: 'result' },
            pass: ['final'],
          },
        },
      ],
    });
    const bytes = Buffer.from(JSON.stringify(workflow));
    const runRoot = join(runRootBase, 'run-multi');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('bbbbbbbb-2222-2222-2222-222222222222'),
      goal: 'multi-dispatch terminal verdict derivation',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 13, 0, 0)),
      dispatcher: sequenceDispatcher(['intermediate', 'final']),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    // The chronologically-LATER admitted verdict wins. Pre-fix,
    // walk-backward already implemented this — these tests pin it
    // against regression to a "first verdict found" or
    // "closing-step's verdict" semantic.
    expect(outcome.result.verdict).toBe('final');
  });

  it('aborted run has no terminal verdict regardless of mid-route admissions', async () => {
    // dogfood gate.pass = ['ok']; force a verdict the gate rejects.
    // The earlier synthesis step admitted via gate_kind=schema_sections
    // (not result_verdict) so it doesn't contribute either way.
    const { workflow, bytes } = loadDogfood();
    const runRoot = join(runRootBase, 'run-aborted');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('cccccccc-3333-3333-3333-333333333333'),
      goal: 'aborted run has no terminal verdict',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 14, 0, 0)),
      dispatcher: fixedDispatcher('not-in-gate'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.verdict).toBeUndefined();
  });

  it('synthesis-only run has no terminal verdict (no result_verdict admission)', async () => {
    // No dispatch / sub-run step exists, so no gate.evaluated event
    // ever fires with kind='result_verdict'. The walk finds nothing
    // and returns undefined.
    const workflow = Workflow.parse({
      schema_version: '2',
      id: 'synthesis-only-fixture',
      version: '0.1.0',
      purpose: 'Test fixture: a workflow with no verdict-bearing steps.',
      entry: { signals: { include: ['syn'], exclude: [] }, intent_prefixes: ['syn'] },
      entry_modes: [
        {
          name: 'syn',
          start_at: 'only-synthesis',
          rigor: 'standard',
          description: 'one synthesis step',
        },
      ],
      phases: [{ id: 'plan-phase', title: 'Plan', canonical: 'plan', steps: ['only-synthesis'] }],
      spine_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
        rationale: 'narrow test fixture for verdict-undefined case',
      },
      steps: [
        {
          id: 'only-synthesis',
          title: 'Synthesis — no verdict surface',
          protocol: 'synthesis-only@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'synthesis',
          writes: {
            artifact: { path: 'artifacts/only.json', schema: 'dogfood-synthesis@v1' },
          },
          gate: {
            kind: 'schema_sections',
            source: { kind: 'artifact', ref: 'artifact' },
            required: ['summary'],
          },
        },
      ],
    });
    const bytes = Buffer.from(JSON.stringify(workflow));
    const runRoot = join(runRootBase, 'run-synth-only');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('dddddddd-4444-4444-4444-444444444444'),
      goal: 'synthesis-only run has no verdict',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 15, 0, 0)),
      dispatcher: fixedDispatcher('unused'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBeUndefined();
  });
});
