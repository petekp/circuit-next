// Real recursion integration test for sub-run.
//
// Sister test to `sub-run-runtime.test.ts`. That file exercises the
// parent's sub-run handler with a stubbed `childRunner` so the
// handler's own surface (path derivation, file copy, audit events,
// gate admission) can be tested in isolation. THIS test omits the
// stub: when `childRunner` is undefined on the WorkflowInvocation,
// the runner defaults to `runWorkflow` itself (see
// `src/runtime/runner.ts:633`), and the parent's sub-run step
// recurses into a real child execution end-to-end.
//
// Why this is worth its own test: every other parent sub-run /
// fanout test stubs the child. The "child workflow actually runs
// through the same runner code path the parent did" claim has been
// trust-by-stubbing. This test pins it: a real recursive call
// produces a real child event log, a real child result.json, and
// a real verdict that the parent admits via its gate.
//
// Hermetic: a fake dispatcher serves both parent and child (the
// child's single dispatch step uses it); no subprocesses spawn.
// Fast: ~50ms.
//
// Captures FU-T06 from HANDOFF.md.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import {
  type ChildWorkflowResolver,
  type DispatchFn,
  runWorkflow,
} from '../../src/runtime/runner.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const PARENT_WORKFLOW_ID = 'parent-recursion-test' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'child-recursion-test' as unknown as WorkflowId;

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'sub-run handler skips real child execution or shares the runner instance with the parent',
    acceptance_evidence:
      'real runWorkflow recurses into the child with a fresh RunId and a sibling run-root, child emits its own event log, parent admits child verdict',
    alternate_framing:
      'integration test of sub-run + real recursive runWorkflow rather than handler-isolation unit test',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

// Fake dispatcher serves both parent and child. The parent's only
// step is a sub-run (no dispatch path), so this dispatcher is
// invoked exactly once — by the child's single dispatch step.
function acceptingDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-real-recursion',
      result_body: JSON.stringify({ verdict: 'accept' }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function buildChildWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion test child — single dispatch step admits an accept verdict via the fake dispatcher.',
    entry: { signals: { include: ['child'], exclude: [] }, intent_prefixes: ['child'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-dispatch',
        rigor: 'standard',
        description: 'Default child entry mode.',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['child-dispatch'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow real-recursion test child — only act phase carries the dispatch step.',
    },
    steps: [
      {
        id: 'child-dispatch',
        title: 'Child dispatch — admits an accept verdict',
        protocol: 'real-recursion-child@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'dispatch',
        role: 'implementer',
        writes: {
          request: 'artifacts/dispatch.request.json',
          receipt: 'artifacts/dispatch.receipt.json',
          result: 'artifacts/dispatch.result.json',
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  });
}

function buildParentWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion test parent — single sub-run step recurses into the child via real runWorkflow.',
    entry: { signals: { include: ['parent'], exclude: [] }, intent_prefixes: ['parent'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'sub-run-step',
        rigor: 'standard',
        description: 'Default parent entry mode.',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['sub-run-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow real-recursion test parent — only act phase carries the sub-run step.',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — recurse into child via real runWorkflow',
        protocol: 'real-recursion-parent@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        workflow_ref: {
          workflow_id: CHILD_WORKFLOW_ID as unknown as string,
          entry_mode: 'default',
        },
        goal: 'child run goal — exercise real recursion',
        rigor: 'standard',
        writes: { result: 'artifacts/child-result.json' },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  });
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'sub-run-real-recursion-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('sub-run real recursion', () => {
  it('runs the child via real runWorkflow (no childRunner stub) and admits the child verdict', async () => {
    const parentWorkflow = buildParentWorkflow();
    const parentBytes = Buffer.from(JSON.stringify(parentWorkflow));
    const childWorkflow = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(childWorkflow));

    const childResolver: ChildWorkflowResolver = () => ({
      workflow: childWorkflow,
      bytes: childBytes,
    });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222222');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    // KEY: NO `childRunner` field — runner defaults to `runWorkflow`
    // itself, so the sub-run step recurses through the real runner.
    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parentWorkflow,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent run goal — exercise real recursion',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0)),
      dispatcher: acceptingDispatcher(),
      childWorkflowResolver: childResolver,
    });

    // Parent closed with verdict admitted.
    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('parent unexpectedly waited at a checkpoint');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBe('accept');

    // Sub-run audit linkage on the parent's event log.
    const subRunStarted = outcome.events.find((e) => e.kind === 'sub_run.started');
    const subRunCompleted = outcome.events.find((e) => e.kind === 'sub_run.completed');
    if (subRunStarted?.kind !== 'sub_run.started') throw new Error('expected sub_run.started');
    if (subRunCompleted?.kind !== 'sub_run.completed')
      throw new Error('expected sub_run.completed');

    // RUN-I3: child run id is a fresh UUID, not the parent's.
    const childRunId = subRunStarted.child_run_id;
    expect(childRunId).not.toBe(parentRunId as unknown as string);
    expect(subRunCompleted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.verdict).toBe('accept');
    expect(subRunCompleted.child_outcome).toBe('complete');

    // Child run-root is a sibling of parent's run-root under the
    // shared runs-base directory.
    const expectedChildRunRoot = join(runRootBase, childRunId);

    // Child's OWN result.json was written at the child's run-root.
    const childResultBytes = readFileSync(
      join(expectedChildRunRoot, 'artifacts', 'result.json'),
      'utf8',
    );
    const childResultBody = JSON.parse(childResultBytes) as {
      run_id: string;
      workflow_id: string;
      verdict: string;
      outcome: string;
    };
    expect(childResultBody.run_id).toBe(childRunId);
    expect(childResultBody.workflow_id).toBe(CHILD_WORKFLOW_ID as unknown as string);
    expect(childResultBody.verdict).toBe('accept');
    expect(childResultBody.outcome).toBe('complete');

    // Child has its OWN event log under its run-root — proof the
    // recursive runner produced a separate event stream rather than
    // appending to the parent's. Real-recursion's smoking gun.
    const childEventsPath = join(expectedChildRunRoot, 'events.ndjson');
    const childEventsRaw = readFileSync(childEventsPath, 'utf8');
    const childEventLines = childEventsRaw.split('\n').filter((line) => line.length > 0);
    expect(childEventLines.length).toBeGreaterThan(0);
    // Every child event carries the child's run_id, never the parent's.
    for (const line of childEventLines) {
      const parsed = JSON.parse(line) as { run_id: string };
      expect(parsed.run_id).toBe(childRunId);
      expect(parsed.run_id).not.toBe(parentRunId as unknown as string);
    }
    // Child event log includes the dispatch lifecycle events that
    // prove the child's dispatch step actually executed (rather than
    // being short-circuited).
    const childEventKinds = new Set(
      childEventLines.map((line) => (JSON.parse(line) as { kind: string }).kind),
    );
    expect(childEventKinds.has('dispatch.started')).toBe(true);
    expect(childEventKinds.has('dispatch.completed')).toBe(true);
    expect(childEventKinds.has('gate.evaluated')).toBe(true);

    // Parent's writes.result slot received a verbatim copy of the
    // child's result.json bytes (NOT a re-derived projection).
    const parentResultCopyPath = join(parentRunRoot, 'artifacts', 'child-result.json');
    const parentCopyBytes = readFileSync(parentResultCopyPath, 'utf8');
    expect(parentCopyBytes).toBe(childResultBytes);

    // Parent's gate admitted the child's verdict.
    const passGate = outcome.events.find(
      (e) =>
        e.kind === 'gate.evaluated' &&
        e.gate_kind === 'result_verdict' &&
        e.step_id === ('sub-run-step' as unknown as typeof e.step_id),
    );
    if (passGate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(passGate.outcome).toBe('pass');

    // Two distinct run-roots exist as siblings under the runs base.
    const runRootEntries = readdirSync(runRootBase).sort();
    expect(runRootEntries).toContain(parentRunId as unknown as string);
    expect(runRootEntries).toContain(childRunId);
    expect(runRootEntries.length).toBeGreaterThanOrEqual(2);
  });
});
