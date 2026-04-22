import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import { materializeDispatch } from '../../src/runtime/adapters/dispatch-materializer.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runDogfood } from '../../src/runtime/runner.js';
import { RunId, StepId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

// Slice 47a (CONVERGENT HIGH A from the Phase 2-to-date comprehensive
// review) — dispatch-event provenance plumbing through `runDogfood`.
//
// Pre-Slice-47a, `materializeDispatch` hardcoded
// `resolved_selection: { skills: [], invocation_options: {} }` and
// `resolved_from: { source: 'default' }` on every `dispatch.started`
// event regardless of the actual selection-resolution path or caller
// intent. Both the Claude fresh-read prong and the Codex cross-model
// challenger flagged this as a HIGH because P2.8 router and
// P2-MODEL-EFFORT will need to consume that audit-trail data. This
// test file pins the post-fold-in invariant: provenance is derived
// from real inputs at the runner boundary and the materializer is
// fail-closed at the type signature.

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function stubDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'dispatch.started event carries hardcoded `resolved_selection: empty` + `resolved_from: default` regardless of caller intent',
    acceptance_evidence:
      'dispatch.started event carries provenance derived from actual runner decision path',
    alternate_framing:
      'leave the materializer to fabricate defaults and let P2-MODEL-EFFORT fix it later — rejected because the audit trail consumed by P2.8 router work is materially false until this lands',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-47a-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe("Slice 47a — dispatch.started carries honest 'resolved_from' from the runner's decision path", () => {
  it('injecting a dispatcher via DogfoodInvocation.dispatcher lands resolved_from.source="explicit"', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'explicit-provenance');
    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a47'),
      goal: 'slice 47a explicit provenance',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    expect(dispatchStarted.resolved_from).toEqual({ source: 'explicit' });
  });
});

describe("Slice 47a — dispatch.started carries honest 'resolved_selection' from workflow + step inputs", () => {
  it('canonical empty selection survives when workflow.default_selection and step.selection are both absent', async () => {
    const { workflow, bytes } = loadFixture();
    // The dogfood fixture does not declare default_selection or per-step
    // selection; the canonical empty resolution is the honest claim and
    // is now genuinely derived from inputs that are empty (vs. fabricated
    // pre-Slice-47a regardless of inputs).
    expect(workflow.default_selection).toBeUndefined();
    const dispatchStep = workflow.steps.find((s) => s.kind === 'dispatch');
    if (dispatchStep === undefined) throw new Error('fixture missing dispatch step');
    expect(dispatchStep.selection).toBeUndefined();

    const runRoot = join(runRootBase, 'empty-selection');
    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a48'),
      goal: 'slice 47a empty selection composition',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    expect(dispatchStarted.resolved_selection).toEqual({ skills: [], invocation_options: {} });
  });

  it('workflow.default_selection contributes to resolved_selection when step.selection is absent', async () => {
    const { workflow: baseWorkflow, bytes } = loadFixture();
    // Inject a workflow.default_selection by re-parsing a mutated copy.
    const mutated = {
      ...JSON.parse(bytes.toString('utf8')),
      default_selection: {
        model: { provider: 'anthropic', model: 'claude-opus-4-7' },
        effort: 'medium',
        skills: { mode: 'replace', skills: ['tdd', 'react-doctor'] },
        invocation_options: { temperature: 0 },
      },
    };
    const workflow = Workflow.parse(mutated);
    expect(workflow.default_selection).toBeDefined();
    expect(baseWorkflow).toBeDefined();

    const runRoot = join(runRootBase, 'workflow-selection');
    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a49'),
      goal: 'slice 47a workflow-level selection',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    expect(dispatchStarted.resolved_selection).toEqual({
      model: { provider: 'anthropic', model: 'claude-opus-4-7' },
      effort: 'medium',
      skills: ['tdd', 'react-doctor'],
      invocation_options: { temperature: 0 },
    });
  });

  it('step.selection wins over workflow.default_selection on field collision (right-biased per SEL precedence)', async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = {
      model: { provider: 'anthropic', model: 'claude-opus-4-7' },
      effort: 'low',
      skills: { mode: 'replace', skills: ['tdd'] },
      invocation_options: { temperature: 0 },
    };
    // Find the dispatch step and overlay a step-level selection.
    for (const step of raw.steps) {
      if (step.kind === 'dispatch') {
        step.selection = {
          model: { provider: 'openai', model: 'gpt-5.4' },
          effort: 'high',
          skills: { mode: 'replace', skills: ['react-doctor'] },
          invocation_options: { reasoning: 'xhigh' },
        };
      }
    }
    const workflow = Workflow.parse(raw);

    const runRoot = join(runRootBase, 'step-overrides-workflow');
    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a4a'),
      goal: 'slice 47a step overrides workflow',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      dispatcher: stubDispatcher(),
    });

    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    // step.selection wins on collisions (model + effort + skills); both
    // layers contribute to invocation_options via shallow merge with
    // step-side keys winning collisions.
    expect(dispatchStarted.resolved_selection).toEqual({
      model: { provider: 'openai', model: 'gpt-5.4' },
      effort: 'high',
      skills: ['react-doctor'],
      invocation_options: { temperature: 0, reasoning: 'xhigh' },
    });
  });
});

describe("Slice 47a — materializer fails closed when resolved_from.role does not match the dispatch step's role", () => {
  it('materializeDispatch throws when resolvedFrom.source="role" carries a role that disagrees with the event role', () => {
    const stub: DispatchResult = {
      request_payload: 'x',
      receipt_id: 'r',
      result_body: 'y',
      duration_ms: 1,
      cli_version: '0',
    };
    const runRoot = mkdtempSync(join(tmpdir(), 'circuit-next-47a-throw-'));
    try {
      expect(() =>
        materializeDispatch({
          runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a4b'),
          stepId: StepId.parse('s1'),
          attempt: 1,
          role: 'researcher',
          startingSequence: 0,
          runRoot,
          writes: { request: 'request', receipt: 'receipt', result: 'result' },
          adapterName: 'agent',
          resolvedSelection: { skills: [], invocation_options: {} },
          // `role` source with a role that does NOT equal the step's role
          // — the cross-validation in src/schemas/event.ts catches this at
          // the Event-union level; the materializer surfaces it earlier
          // with a precise error.
          resolvedFrom: { source: 'role', role: 'implementer' },
          dispatchResult: stub,
          verdict: 'accept',
          now: () => new Date(0),
        }),
      ).toThrowError(
        /resolvedFrom.role 'implementer' does not match dispatch step role 'researcher'/,
      );
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });
});
