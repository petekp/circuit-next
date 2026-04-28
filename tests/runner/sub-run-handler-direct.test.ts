// Direct unit tests for the sub-run step handler.
//
// `tests/runner/sub-run-runtime.test.ts` exercises the handler
// transitively (3 cases — happy path, out-of-gate verdict, missing
// resolver) and `tests/runner/sub-run-real-recursion.test.ts` proves
// real recursion works end-to-end. Neither covers the handler-local
// early-abort branches that fire BEFORE child execution: divergent
// writes.artifact path, resolver throw, resolver-returns-wrong-id,
// child invocation throw, child-returned-checkpoint-waiting, and
// the full evaluateChildVerdict shape lattice (parse fail, non-
// object, missing verdict). This file invokes `runSubRunStep`
// directly against a minimal in-memory `StepHandlerContext` to pin
// each branch's reason string + event sequence.
//
// FU-T11 priority target #4 (per HANDOFF.md).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resultPath } from '../../src/runtime/result-writer.js';
import type {
  ChildWorkflowResolver,
  WorkflowInvocation,
  WorkflowRunResult,
  WorkflowRunner,
} from '../../src/runtime/runner.js';
import { runSubRunStep } from '../../src/runtime/step-handlers/sub-run.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { Event } from '../../src/schemas/event.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

const PARENT_WORKFLOW_ID = 'sub-run-direct-parent' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'sub-run-direct-child' as unknown as WorkflowId;
const PARENT_RUN_ID = RunId.parse('55555555-5555-5555-5555-555555555555');

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'sub-run handler emits the wrong event sequence on a known early-abort or verdict-shape path',
    acceptance_evidence:
      'each handler-local error path emits the expected gate.evaluated/fail + step.aborted pair with the right reason',
    alternate_framing: 'unit test of the sub-run step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function buildParentWorkflow(opts: {
  passVerdicts: readonly string[];
  divergentArtifactPath?: string;
}): Workflow {
  const writes: Record<string, unknown> = { result: 'artifacts/child-result.json' };
  if (opts.divergentArtifactPath !== undefined) {
    writes.artifact = {
      path: opts.divergentArtifactPath,
      schema: 'sub-run-direct-result@v1',
    };
  }
  return Workflow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run handler direct-test fixture (parent).',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'sub-run-step',
        rigor: 'standard',
        description: 'parent fixture',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['sub-run-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct sub-run handler test fixture',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — direct handler test',
        protocol: 'sub-run-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        workflow_ref: {
          workflow_id: CHILD_WORKFLOW_ID as unknown as string,
          entry_mode: 'default',
        },
        goal: 'direct handler child goal',
        rigor: 'standard',
        writes,
        gate: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: opts.passVerdicts,
        },
      },
    ],
  });
}

function buildChildWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run handler direct-test fixture (child) — never executed end-to-end.',
    entry: { signals: { include: ['y'], exclude: [] }, intent_prefixes: ['y'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-step',
        rigor: 'standard',
        description: 'child fixture',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct sub-run handler test child',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child synthesis stub',
        protocol: 'sub-run-direct-child@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/child-synthesis.json', schema: 'child-synthesis@v1' },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        },
      },
    ],
  });
}

interface ChildRunnerSpec {
  // If set, the runner throws this error.
  readonly throwError?: Error;
  // If set, the runner returns checkpoint_waiting with this stepId.
  readonly checkpointStepId?: string;
  // Otherwise, the runner writes this result_body verbatim into the
  // child's result.json and returns outcome='complete' with that body.
  readonly resultBody?: string;
}

function makeStubChildRunner(spec: ChildRunnerSpec): WorkflowRunner {
  return async (inv: WorkflowInvocation): Promise<WorkflowRunResult> => {
    if (spec.throwError !== undefined) throw spec.throwError;
    const childRunId = inv.runId;
    if (spec.checkpointStepId !== undefined) {
      // Per result-writer semantics, a checkpoint_waiting result is
      // not written to disk — the runner returns it on the WorkflowRunResult.
      return {
        runRoot: inv.runRoot,
        result: {
          schema_version: 1,
          run_id: childRunId,
          workflow_id: inv.workflow.id,
          goal: inv.goal,
          outcome: 'checkpoint_waiting',
          summary: 'stub child waiting at checkpoint',
          events_observed: 1,
          manifest_hash: 'stub-manifest-hash',
          checkpoint: {
            step_id: spec.checkpointStepId,
            request_path: 'artifacts/checkpoint.request.json',
            allowed_choices: ['proceed', 'abort'],
          },
        },
        snapshot: Snapshot.parse({
          schema_version: 1,
          run_id: childRunId as unknown as string,
          workflow_id: inv.workflow.id as unknown as string,
          rigor: inv.rigor ?? 'standard',
          lane: inv.lane,
          status: 'in_progress',
          steps: [],
          events_consumed: 1,
          manifest_hash: 'stub-manifest-hash',
          updated_at: new Date(0).toISOString(),
        }),
        events: [],
        dispatchResults: [],
      };
    }
    // Default path: write the requested body into the child's result.json.
    const childResultAbs = resultPath(inv.runRoot);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = spec.resultBody ?? '';
    writeFileSync(childResultAbs, body);
    // Build a RunResult shape for the return value. The handler reads
    // from the file on disk for verdict evaluation, so the in-memory
    // .result body just needs `outcome` to be set.
    let runResult: unknown;
    try {
      runResult = RunResult.parse(JSON.parse(body));
    } catch {
      // Body is intentionally malformed for some tests — return a
      // minimum valid shape so the handler can read the file and
      // observe its parse failure on its own.
      runResult = RunResult.parse({
        schema_version: 1,
        run_id: childRunId as unknown as string,
        workflow_id: inv.workflow.id as unknown as string,
        goal: inv.goal,
        outcome: 'complete',
        summary: 'stub for direct test',
        closed_at: new Date(0).toISOString(),
        events_observed: 1,
        manifest_hash: 'stub-manifest-hash',
      });
    }
    return {
      runRoot: inv.runRoot,
      result: runResult as WorkflowRunResult['result'],
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: childRunId as unknown as string,
        workflow_id: inv.workflow.id as unknown as string,
        rigor: inv.rigor ?? 'standard',
        lane: inv.lane,
        status: 'complete',
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

interface BuildHarnessOpts {
  readonly passVerdicts: readonly string[];
  readonly divergentArtifactPath?: string;
  readonly skipResolver?: boolean;
  readonly resolverThrow?: Error;
  readonly resolverReturnsWrongId?: boolean;
  readonly childRunner?: ChildRunnerSpec;
}

interface Harness {
  readonly events: Event[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'sub-run' };
  };
}

function buildHarness(opts: BuildHarnessOpts, parentRunRoot: string): Harness {
  const parentWorkflow = buildParentWorkflow({
    passVerdicts: opts.passVerdicts,
    ...(opts.divergentArtifactPath === undefined
      ? {}
      : { divergentArtifactPath: opts.divergentArtifactPath }),
  });
  const childWorkflow = buildChildWorkflow();
  const step = parentWorkflow.steps[0];
  if (step === undefined || step.kind !== 'sub-run') {
    throw new Error('test fixture invariant: step[0] must be a sub-run step');
  }

  let resolver: ChildWorkflowResolver | undefined;
  if (opts.skipResolver === true) {
    resolver = undefined;
  } else if (opts.resolverThrow !== undefined) {
    resolver = () => {
      throw opts.resolverThrow;
    };
  } else if (opts.resolverReturnsWrongId === true) {
    const altWorkflow = Workflow.parse({
      ...JSON.parse(JSON.stringify(childWorkflow)),
      id: 'wrong-workflow-id',
    });
    resolver = () => ({
      workflow: altWorkflow,
      bytes: Buffer.from(JSON.stringify(altWorkflow)),
    });
  } else {
    resolver = () => ({
      workflow: childWorkflow,
      bytes: Buffer.from(JSON.stringify(childWorkflow)),
    });
  }

  const events: Event[] = [];
  const state: RunState = { events, sequence: 0, dispatchResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const childRunnerSpec = opts.childRunner ?? { resultBody: JSON.stringify({ verdict: 'accept' }) };
  const childRunner = makeStubChildRunner(childRunnerSpec);
  const ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'sub-run' };
  } = {
    runRoot: parentRunRoot,
    workflow: parentWorkflow,
    runId: PARENT_RUN_ID,
    goal: 'direct sub-run handler test goal',
    lane: lane(),
    rigor: 'standard',
    executionSelectionConfigLayers: [],
    dispatcher: {
      adapterName: 'agent',
      dispatch: async () => {
        throw new Error('dispatcher should not be invoked by these tests');
      },
    },
    synthesisWriter: () => {
      throw new Error('synthesisWriter should not be invoked by these tests');
    },
    now,
    recordedAt,
    state,
    push: (ev: Event) => {
      events.push({ ...ev, sequence: state.sequence });
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner,
    ...(resolver === undefined ? {} : { childWorkflowResolver: resolver }),
  };
  return { events, state, ctx };
}

let runRootBase: string;
let parentRunRoot: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'sub-run-handler-direct-'));
  parentRunRoot = join(runRootBase, 'parent');
  mkdirSync(parentRunRoot, { recursive: true });
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('runSubRunStep direct — early aborts (before child execution)', () => {
  it('aborts when writes.artifact.path is divergent from writes.result', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        divergentArtifactPath: 'artifacts/divergent.json',
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/writes\.artifact materialization at a path different/);
    expect(harness.events.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
  });

  it('aborts when childWorkflowResolver is undefined', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        skipResolver: true,
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/childWorkflowResolver is required/);
    expect(harness.events.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });

  it('aborts with resolution-failed reason when the resolver throws', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        resolverThrow: new Error('resolver blew up'),
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child workflow resolution failed.*resolver blew up/);
    expect(harness.events.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });

  it('aborts when the resolver returns a workflow with a different id than workflow_ref names', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        resolverReturnsWrongId: true,
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/resolver returned workflow id 'wrong-workflow-id'/);
    expect(harness.events.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });
});

describe('runSubRunStep direct — child execution failures', () => {
  it('aborts with child-invocation-failed reason when the child runner throws', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { throwError: new Error('child blew up') },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child workflow invocation failed.*child blew up/);
    // sub_run.started fires BEFORE the child runner is called, so it
    // should be present even on child throw.
    expect(harness.events.some((e) => e.kind === 'sub_run.started')).toBe(true);
    // sub_run.completed should NOT fire — the child invocation
    // failed.
    expect(harness.events.find((e) => e.kind === 'sub_run.completed')).toBeUndefined();
  });

  it('aborts with checkpoint-resume-not-supported reason when the child returns checkpoint_waiting', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { checkpointStepId: 'frame-checkpoint' },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /child workflow waited at checkpoint 'frame-checkpoint'.*nested checkpoint resume is not yet supported/,
    );
  });
});

describe('runSubRunStep direct — child verdict evaluation', () => {
  it('aborts when child result body does not parse as JSON', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { resultBody: 'not-json{{{' },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child result body did not parse as JSON/);
    // sub_run.completed fires before verdict evaluation finalizes —
    // verdict slot carries the no-verdict sentinel.
    const completed = harness.events.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts when child result body parses to an array (not an object)', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { resultBody: JSON.stringify(['accept']) },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child result body parsed but is not a JSON object/);
  });

  it('aborts when child result body lacks a verdict field', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: {
          resultBody: JSON.stringify({
            schema_version: 1,
            run_id: '11111111-1111-1111-1111-111111111111',
            workflow_id: CHILD_WORKFLOW_ID as unknown as string,
            goal: 'no-verdict goal',
            outcome: 'complete',
            summary: 'no verdict here',
            closed_at: '1970-01-01T00:00:00.000Z',
            events_observed: 1,
            manifest_hash: 'stub',
          }),
        },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
    const completed = harness.events.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts and surfaces the observed verdict when not in gate.pass', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: {
          resultBody: JSON.stringify({
            schema_version: 1,
            run_id: '11111111-1111-1111-1111-111111111111',
            workflow_id: CHILD_WORKFLOW_ID as unknown as string,
            goal: 'reject goal',
            outcome: 'complete',
            summary: 'rejected',
            closed_at: '1970-01-01T00:00:00.000Z',
            events_observed: 1,
            manifest_hash: 'stub',
            verdict: 'reject',
          }),
        },
      },
      parentRunRoot,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child verdict 'reject' is not in gate\.pass \[accept\]/);
    const completed = harness.events.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('reject');
  });
});
