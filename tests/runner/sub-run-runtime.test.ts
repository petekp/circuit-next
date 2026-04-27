import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type DispatchFn,
  runWorkflow,
  type ChildWorkflowResolver,
  type WorkflowRunner,
  type WorkflowInvocation,
  type WorkflowRunResult,
} from '../../src/runtime/runner.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import { RunId, WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Workflow } from '../../src/schemas/workflow.js';
import { Snapshot } from '../../src/schemas/snapshot.js';

// Sub-run runtime test. Verifies that a parent workflow declaring a
// `sub-run` step:
//   - Resolves the child workflow through the injected resolver.
//   - Mints a fresh RunId for the child (RUN-I3 cross-run smuggling
//     stays forbidden — no shared run_id).
//   - Provisions a sibling child run-root under the parent's runs base.
//   - Emits sub_run.{started,completed} on the parent's event log
//     carrying the child_run_id linkage and the observed verdict.
//   - Copies the child's result.json bytes into the parent's
//     `step.writes.result` slot for downstream consumers.
//   - Admits or rejects the child against `step.gate.pass`.

const PARENT_WORKFLOW_ID = 'parent-test' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'child-test' as unknown as WorkflowId;

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'sub-run handler omits child audit linkage or shares parent run id',
    acceptance_evidence:
      'parent log carries sub_run.started + sub_run.completed with distinct child_run_id, child run-root sibling to parent, child result.json copied verbatim into parent writes.result slot',
    alternate_framing: 'unit test of the sub-run handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function unusedDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async () => {
      throw new Error('dispatcher should not run during sub-run-only parent execution');
    },
  };
}

function buildParentWorkflow(parentGatePass: readonly string[]): Workflow {
  const raw = {
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run runtime test parent — exercises one sub-run step end-to-end',
    entry: { signals: { include: ['sub-run-test'], exclude: [] }, intent_prefixes: ['sub-run-test'] },
    entry_modes: [
      {
        name: 'sub-run-test',
        start_at: 'sub-run-step',
        rigor: 'standard',
        description: 'Default sub-run-test entry mode.',
      },
    ],
    phases: [
      {
        id: 'act-phase',
        title: 'Act',
        canonical: 'act',
        steps: ['sub-run-step'],
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow sub-run runtime test — only act phase carries the sub-run step.',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — invoke child workflow',
        protocol: 'sub-run-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        workflow_ref: { workflow_id: CHILD_WORKFLOW_ID as unknown as string, entry_mode: 'default' },
        goal: 'child run goal',
        rigor: 'standard',
        writes: { result: 'artifacts/child-result.json' },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: parentGatePass,
        },
      },
    ],
  };
  return Workflow.parse(raw);
}

function buildChildWorkflow(): Workflow {
  // The child has a single synthesis step. The child runner is stubbed
  // anyway (it never runs the child's loop), so the child workflow
  // shape only has to type-check through Workflow.parse — the stub
  // childRunner produces a synthetic result.json.
  const raw = {
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run runtime test child — single synthesis step.',
    entry: { signals: { include: ['child-test'], exclude: [] }, intent_prefixes: ['child-test'] },
    entry_modes: [
      { name: 'default', start_at: 'child-step', rigor: 'standard', description: 'Default child entry mode.' },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow stub child for sub-run test.',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child synthesis',
        protocol: 'child-synthesis@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/child-synthesis.json', schema: 'child-synthesis@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        },
      },
    ],
  };
  return Workflow.parse(raw);
}

function makeChildResolver(child: { workflow: Workflow; bytes: Buffer }): ChildWorkflowResolver {
  return () => child;
}

// Stub childRunner that bypasses real child execution. Writes a
// synthetic child result.json (with a verdict field) into the child's
// runRoot/artifacts and returns a minimal WorkflowRunResult. This
// isolates the parent's sub-run handler logic from the child's full
// loop while still exercising the path-derivation, file-copy, and
// audit-event surface the handler is responsible for.
function makeStubChildRunner(observed: {
  verdict: string;
  outcome: 'complete' | 'aborted';
  capturedRunIds: { value: RunId | undefined };
}): WorkflowRunner {
  return async (inv: WorkflowInvocation): Promise<WorkflowRunResult> => {
    observed.capturedRunIds.value = inv.runId;
    const childResultAbs = resultPath(inv.runRoot);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      workflow_id: inv.workflow.id as unknown as string,
      goal: inv.goal,
      outcome: observed.outcome,
      summary: 'stub child result',
      closed_at: new Date(0).toISOString(),
      events_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      verdict: observed.verdict,
    });
    writeFileSync(childResultAbs, `${JSON.stringify(body, null, 2)}\n`);
    return {
      runRoot: inv.runRoot,
      result: body,
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: body.run_id,
        workflow_id: body.workflow_id,
        rigor: 'standard',
        lane: inv.lane,
        status: observed.outcome === 'complete' ? 'complete' : 'aborted',
        steps: [],
        events_consumed: 1,
        manifest_hash: 'stub-manifest-hash',
        updated_at: new Date(0).toISOString(),
      }),
      events: [],
      dispatchResults: [],
    };
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-sub-run-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('sub-run runtime', () => {
  it('runs the child, copies result.json into parent writes.result, and admits an in-gate verdict', async () => {
    const parentWorkflow = buildParentWorkflow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentWorkflow));
    const childWorkflow = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(childWorkflow));

    const observed = { verdict: 'ok', outcome: 'complete' as const, capturedRunIds: { value: undefined as RunId | undefined } };
    const stubChildRunner = makeStubChildRunner(observed);
    const childResolver = makeChildResolver({ workflow: childWorkflow, bytes: childBytes });

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111111');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parentWorkflow,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent run goal',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0)),
      dispatcher: unusedDispatcher(),
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
    });

    expect(outcome.result.outcome).toBe('complete');

    // RUN-I3: child has a fresh RunId distinct from parent.
    const childRunId = observed.capturedRunIds.value;
    expect(childRunId).toBeDefined();
    expect(childRunId).not.toBe(parentRunId);

    // sub_run.started + sub_run.completed both fired with matching
    // child_run_id. (The parent's events log is the audit trail.)
    const subRunStarted = outcome.events.find((e) => e.kind === 'sub_run.started');
    const subRunCompleted = outcome.events.find((e) => e.kind === 'sub_run.completed');
    if (subRunStarted?.kind !== 'sub_run.started') throw new Error('expected sub_run.started');
    if (subRunCompleted?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(subRunStarted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.verdict).toBe('ok');
    expect(subRunCompleted.child_outcome).toBe('complete');

    // Parent's gate admitted the child verdict.
    const passGate = outcome.events.find(
      (e) =>
        e.kind === 'gate.evaluated' &&
        e.gate_kind === 'result_verdict' &&
        e.step_id === ('sub-run-step' as unknown as typeof e.step_id),
    );
    if (passGate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(passGate.outcome).toBe('pass');

    // Parent's writes.result slot received the child's result.json bytes.
    const parentResultPath = join(parentRunRoot, 'artifacts', 'child-result.json');
    const parentBody = JSON.parse(readFileSync(parentResultPath, 'utf8')) as { verdict: string };
    expect(parentBody.verdict).toBe('ok');

    // Child run-root is a sibling of parent's run-root under the same
    // runs-base directory, NOT nested under parent's run-root.
    const expectedChildRunRoot = join(runRootBase, childRunId as unknown as string);
    expect(observed.capturedRunIds.value).toBeDefined();
    const childResultJsonExists = readFileSync(
      join(expectedChildRunRoot, 'artifacts', 'result.json'),
      'utf8',
    );
    expect(childResultJsonExists).toContain('"verdict": "ok"');
  });

  it('rejects an out-of-gate child verdict and aborts the parent step', async () => {
    const parentWorkflow = buildParentWorkflow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentWorkflow));
    const childWorkflow = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(childWorkflow));

    const observed = { verdict: 'reject', outcome: 'complete' as const, capturedRunIds: { value: undefined as RunId | undefined } };
    const stubChildRunner = makeStubChildRunner(observed);
    const childResolver = makeChildResolver({ workflow: childWorkflow, bytes: childBytes });

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111112');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parentWorkflow,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent gate-rejection test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 30, 0)),
      dispatcher: unusedDispatcher(),
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('reject');

    // sub_run.completed still fired with the observed verdict before
    // the gate rejected — durable transcript of what the child said.
    const subRunCompleted = outcome.events.find((e) => e.kind === 'sub_run.completed');
    if (subRunCompleted?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(subRunCompleted.verdict).toBe('reject');

    const failGate = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict' && e.outcome === 'fail',
    );
    expect(failGate).toBeDefined();
  });

  it('aborts cleanly when the resolver is missing', async () => {
    const parentWorkflow = buildParentWorkflow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentWorkflow));

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111113');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parentWorkflow,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'missing-resolver test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 1, 0, 0)),
      dispatcher: unusedDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('childWorkflowResolver');
  });
});
