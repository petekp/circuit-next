// Direct unit tests for the fanout step handler.
//
// `tests/runner/fanout-runtime.test.ts` and
// `tests/runner/fanout-real-recursion.test.ts` exercise the handler
// transitively through full runWorkflow runs. Neither covers the
// handler-local pre-execution aborts (childWorkflowResolver / projectRoot
// undefined, branch resolution throws, zero-branches), the per-branch
// failure paths (worktree provisioning throw, resolver throw, child
// runner throw), or each join-policy decision lattice in isolation.
// This file invokes `runFanoutStep` directly against a minimal
// in-memory `StepHandlerContext` so each handler-local branch is
// pinned with named-failure attribution.
//
// FU-T11 priority target #6 (per HANDOFF.md).

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
  WorktreeRunner,
} from '../../src/runtime/runner.js';
import { runFanoutStep } from '../../src/runtime/step-handlers/fanout.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { Event } from '../../src/schemas/event.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

const PARENT_WORKFLOW_ID = 'fanout-direct-parent' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'fanout-direct-child' as unknown as WorkflowId;
const PARENT_RUN_ID = RunId.parse('88888888-8888-8888-8888-888888888888');

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'fanout handler emits the wrong event sequence on a known pre-execution, branch-level, or join-policy path',
    acceptance_evidence:
      'each handler-local error path emits the expected gate.evaluated/fail + step.aborted pair with the right reason; each happy path emits fanout.joined + gate.evaluated/pass',
    alternate_framing: 'unit test of the fanout step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

type JoinPolicy = 'pick-winner' | 'disjoint-merge' | 'aggregate-only';

interface ParentWorkflowOpts {
  readonly branches:
    | { readonly kind: 'static'; readonly branchIds: readonly string[] }
    | { readonly kind: 'dynamic'; readonly sourceArtifact: string; readonly itemsPath: string };
  readonly policy: JoinPolicy;
  readonly admit?: readonly string[];
  readonly onChildFailure?: 'abort-all' | 'continue-others';
}

function buildParentWorkflow(opts: ParentWorkflowOpts): Workflow {
  const admit = opts.admit ?? ['ok'];
  const branches =
    opts.branches.kind === 'static'
      ? {
          kind: 'static',
          branches: opts.branches.branchIds.map((id) => ({
            branch_id: id,
            workflow_ref: {
              workflow_id: CHILD_WORKFLOW_ID as unknown as string,
              entry_mode: 'default',
            },
            goal: `branch-${id} goal`,
            rigor: 'standard',
          })),
        }
      : {
          kind: 'dynamic',
          source_artifact: opts.branches.sourceArtifact,
          items_path: opts.branches.itemsPath,
          template: {
            branch_id: '$item.id',
            workflow_ref: {
              workflow_id: CHILD_WORKFLOW_ID as unknown as string,
              entry_mode: 'default',
            },
            goal: '$item.goal',
            rigor: 'standard',
          },
        };
  return Workflow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout handler direct-test fixture (parent).',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'fanout-step',
        rigor: 'standard',
        description: 'parent fixture',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['fanout-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct fanout handler test fixture',
    },
    steps: [
      {
        id: 'fanout-step',
        title: 'Fanout — direct handler test',
        protocol: 'fanout-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'fanout',
        branches,
        concurrency: { kind: 'bounded', max: 4 },
        on_child_failure: opts.onChildFailure ?? 'abort-all',
        writes: {
          branches_dir: 'artifacts/branches',
          aggregate: { path: 'artifacts/aggregate.json', schema: 'fanout-aggregate@v1' },
        },
        gate: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: opts.policy },
          verdicts: { admit },
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
    purpose: 'fanout handler direct-test fixture (child) — never executed end-to-end.',
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
      rationale: 'narrow direct fanout handler test child',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child synthesis stub',
        protocol: 'fanout-direct-child@v1',
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

interface BranchPlanEntry {
  // 'aborted' makes the stub childRunner return outcome='aborted'; any
  // other string is the verdict written into the child result body.
  // 'throw' makes the stub childRunner throw an Error.
  // 'checkpoint' makes the stub return outcome='checkpoint_waiting'.
  readonly mode: 'verdict' | 'aborted' | 'throw' | 'checkpoint';
  readonly verdict?: string;
}

function makeStubChildRunner(plan: Record<string, BranchPlanEntry>): WorkflowRunner {
  return async (inv: WorkflowInvocation): Promise<WorkflowRunResult> => {
    // Match plan entry by goal — the parent constructs goals as
    // "branch-<id> goal" (static) or "$item.goal" (dynamic). The plan key
    // must appear in inv.goal for matching.
    const planEntry = Object.entries(plan).find(([branchId]) => inv.goal.includes(branchId));
    const entry: BranchPlanEntry = planEntry?.[1] ?? { mode: 'verdict', verdict: 'ok' };
    if (entry.mode === 'throw') throw new Error('child runner exploded');
    if (entry.mode === 'checkpoint') {
      return {
        runRoot: inv.runRoot,
        result: {
          schema_version: 1,
          run_id: inv.runId,
          workflow_id: inv.workflow.id,
          goal: inv.goal,
          outcome: 'checkpoint_waiting',
          summary: 'stub child waiting at checkpoint',
          events_observed: 1,
          manifest_hash: 'stub-manifest-hash',
          checkpoint: {
            step_id: 'frame-checkpoint',
            request_path: 'artifacts/checkpoint.request.json',
            allowed_choices: ['continue', 'stop'],
          },
        },
        snapshot: Snapshot.parse({
          schema_version: 1,
          run_id: inv.runId as unknown as string,
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
    const outcome: 'complete' | 'aborted' = entry.mode === 'aborted' ? 'aborted' : 'complete';
    const childResultAbs = resultPath(inv.runRoot);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      workflow_id: inv.workflow.id as unknown as string,
      goal: inv.goal,
      outcome,
      summary: 'stub child for fanout direct test',
      closed_at: new Date(0).toISOString(),
      events_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      ...(outcome === 'aborted' ? {} : { verdict: entry.verdict ?? 'ok' }),
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
        status: outcome === 'complete' ? 'complete' : 'aborted',
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

interface WorktreeStub {
  provisioned: Set<string>;
  released: Set<string>;
  changedFilesByPath: Map<string, readonly string[]>;
  runner: WorktreeRunner;
}

function makeStubWorktreeRunner(
  opts: {
    readonly throwOnAdd?: readonly string[];
    readonly changedFilesByBranch?: Record<string, readonly string[]>;
  } = {},
): WorktreeStub {
  const provisioned = new Set<string>();
  const released = new Set<string>();
  const changedFilesByPath = new Map<string, readonly string[]>();
  const throwOnAddBranches = new Set(opts.throwOnAdd ?? []);
  const runner: WorktreeRunner = {
    add: ({ worktreePath }) => {
      // worktreePath ends in `/<step_id>/<branch_id>`. Match by the
      // branch_id segment.
      const branchId = worktreePath.split('/').pop() ?? '';
      if (throwOnAddBranches.has(branchId)) {
        throw new Error(`stub worktreeRunner.add refused branch '${branchId}'`);
      }
      provisioned.add(worktreePath);
      mkdirSync(worktreePath, { recursive: true });
      const files = opts.changedFilesByBranch?.[branchId];
      if (files !== undefined) changedFilesByPath.set(worktreePath, files);
    },
    remove: (worktreePath: string) => {
      released.add(worktreePath);
    },
    changedFiles: (worktreePath: string) => changedFilesByPath.get(worktreePath) ?? [],
  };
  return { provisioned, released, changedFilesByPath, runner };
}

interface BuildHarnessOpts {
  readonly parent: ParentWorkflowOpts;
  readonly skipResolver?: boolean;
  readonly resolverThrowsForBranch?: string;
  readonly omitProjectRoot?: boolean;
  readonly worktreeOpts?: Parameters<typeof makeStubWorktreeRunner>[0];
  readonly childPlan?: Record<string, BranchPlanEntry>;
  // For dynamic-branches tests: write a source artifact at this run-relative
  // path with this body before invoking the handler.
  readonly seedSourceArtifact?: { readonly path: string; readonly body: unknown };
}

interface Harness {
  readonly events: Event[];
  readonly state: RunState;
  readonly worktree: WorktreeStub;
  readonly ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'fanout' };
  };
}

function buildHarness(opts: BuildHarnessOpts, parentRunRoot: string, projectRoot: string): Harness {
  const parent = buildParentWorkflow(opts.parent);
  const child = buildChildWorkflow();
  const childBytes = Buffer.from(JSON.stringify(child));
  const step = parent.steps[0];
  if (step === undefined || step.kind !== 'fanout') {
    throw new Error('test fixture invariant: step[0] must be a fanout step');
  }
  if (opts.seedSourceArtifact !== undefined) {
    const abs = join(parentRunRoot, opts.seedSourceArtifact.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(opts.seedSourceArtifact.body));
  }
  const events: Event[] = [];
  const state: RunState = { events, sequence: 0, dispatchResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  let resolver: ChildWorkflowResolver | undefined;
  if (opts.skipResolver === true) {
    resolver = undefined;
  } else {
    resolver = (ref) => {
      if (
        opts.resolverThrowsForBranch !== undefined &&
        ref.workflow_id === (CHILD_WORKFLOW_ID as unknown as string)
      ) {
        // A pure resolver can't see branch_id directly; the test only
        // sets resolverThrowsForBranch when there's a single branch.
        throw new Error(`stub resolver refused branch '${opts.resolverThrowsForBranch}'`);
      }
      return { workflow: child, bytes: childBytes };
    };
  }
  const worktree = makeStubWorktreeRunner(opts.worktreeOpts);
  const childRunner = makeStubChildRunner(opts.childPlan ?? {});
  const ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'fanout' };
  } = {
    runRoot: parentRunRoot,
    workflow: parent,
    runId: PARENT_RUN_ID,
    goal: 'direct fanout handler test goal',
    lane: lane(),
    rigor: 'standard',
    executionSelectionConfigLayers: [],
    ...(opts.omitProjectRoot === true ? {} : { projectRoot }),
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
    worktreeRunner: worktree.runner,
  };
  return { events, state, worktree, ctx };
}

let runRootBase: string;
let parentRunRoot: string;
let projectRoot: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'fanout-handler-direct-'));
  parentRunRoot = join(runRootBase, 'parent');
  mkdirSync(parentRunRoot, { recursive: true });
  projectRoot = mkdtempSync(join(tmpdir(), 'fanout-handler-direct-project-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runFanoutStep direct — pre-execution aborts', () => {
  it('aborts when childWorkflowResolver is undefined', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        skipResolver: true,
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/childWorkflowResolver is required/);
    // No fanout.started should fire — the abort happens before any
    // branch is touched.
    expect(harness.events.find((e) => e.kind === 'fanout.started')).toBeUndefined();
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(gate.gate_kind).toBe('fanout_aggregate');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
  });

  it('aborts when projectRoot is undefined', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        omitProjectRoot: true,
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/projectRoot is required to anchor per-branch worktrees/);
    expect(harness.events.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });

  it('aborts with branch-resolution-failed reason when dynamic source artifact has wrong shape', async () => {
    // Source artifact has items_path=items but the resolved value is an
    // object (not an array) — `dynamic fanout: items_path '...' did not
    // resolve to an array (got object)`.
    const harness = buildHarness(
      {
        parent: {
          branches: {
            kind: 'dynamic',
            sourceArtifact: 'artifacts/source.json',
            itemsPath: 'items',
          },
          policy: 'pick-winner',
        },
        seedSourceArtifact: {
          path: 'artifacts/source.json',
          body: { items: { not: 'an array' } },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/branch resolution failed/);
    expect(result.reason).toMatch(/did not resolve to an array/);
    expect(harness.events.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });

  it('aborts with zero-branches reason when dynamic source resolves to an empty array', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: {
            kind: 'dynamic',
            sourceArtifact: 'artifacts/source.json',
            itemsPath: 'items',
          },
          policy: 'pick-winner',
        },
        seedSourceArtifact: {
          path: 'artifacts/source.json',
          body: { items: [] },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/branch resolution produced zero branches/);
    expect(harness.events.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });
});

describe('runFanoutStep direct — branch-level failure paths', () => {
  it('records a branch as aborted when worktreeRunner.add throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        worktreeOpts: { throwOnAdd: ['a'] },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    // pick-winner with no admitted branch fails with the policy reason.
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    // The branch's branch_completed event records child_outcome='aborted'
    // and verdict=NO_VERDICT_SENTINEL.
    const completed = harness.events.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('records a branch as aborted when childWorkflowResolver throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        resolverThrowsForBranch: 'a',
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    const completed = harness.events.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
    // Worktree provisioning succeeded for this branch (the resolver
    // throw happens AFTER the worktree is added), so the branch path
    // should appear in the released set after cleanup.
    expect(harness.worktree.released.size).toBe(1);
  });

  it('records a branch as aborted when childRunner throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        childPlan: { 'branch-a': { mode: 'throw' } },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    const completed = harness.events.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
  });

  it('records a checkpoint_waiting child as aborted (nested checkpoint resume not supported)', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        childPlan: { 'branch-a': { mode: 'checkpoint' } },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    const completed = harness.events.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
  });
});

describe('runFanoutStep direct — join policies', () => {
  it('pick-winner: picks the first branch in admit order with a complete+admitted result', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'pick-winner',
          admit: ['gold', 'silver'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'silver' },
          'branch-b': { mode: 'verdict', verdict: 'gold' },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const joined = harness.events.find((e) => e.kind === 'fanout.joined');
    if (joined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    // 'gold' precedes 'silver' in admit order, so branch-b wins despite
    // alphabetical order putting branch-a first.
    expect(joined.selected_branch_id).toBe('b');
    expect(joined.policy).toBe('pick-winner');
  });

  it('pick-winner: aborts when no branch has an admitted verdict', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['gold'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'rust' },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /pick-winner: no branch closed 'complete' with an admitted verdict \(admit order \[gold\]\)/,
    );
  });

  it('disjoint-merge: aborts when branches modify the same file', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'disjoint-merge',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          'branch-b': { mode: 'verdict', verdict: 'ok' },
        },
        worktreeOpts: {
          changedFilesByBranch: {
            a: ['src/shared.ts'],
            b: ['src/shared.ts'],
          },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/disjoint-merge: file 'src\/shared\.ts' modified by branches/);
  });

  it('disjoint-merge: passes when each branch touches different files', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'disjoint-merge',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          'branch-b': { mode: 'verdict', verdict: 'ok' },
        },
        worktreeOpts: {
          changedFilesByBranch: {
            a: ['src/a.ts'],
            b: ['src/b.ts'],
          },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
  });

  it('aggregate-only: passes when all branches close complete with parseable bodies', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'aggregate-only',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          // verdict that is NOT in admit list — aggregate-only ignores
          // verdicts and only checks parseable+complete.
          'branch-b': { mode: 'verdict', verdict: 'something-else' },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const joined = harness.events.find((e) => e.kind === 'fanout.joined');
    if (joined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(joined.policy).toBe('aggregate-only');
  });
});

describe('runFanoutStep direct — event sequence invariants', () => {
  it('on success: fanout.started → branch_started/branch_completed × N → step.artifact_written → fanout.joined → gate.evaluated/pass', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    await runFanoutStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual([
      'fanout.started',
      'fanout.branch_started',
      'fanout.branch_completed',
      'step.artifact_written',
      'fanout.joined',
      'gate.evaluated',
    ]);
  });

  it('on join failure: fanout.started → ... → step.artifact_written → fanout.joined → gate.evaluated/fail → step.aborted', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['gold'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'rust' },
        },
      },
      parentRunRoot,
      projectRoot,
    );

    await runFanoutStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual([
      'fanout.started',
      'fanout.branch_started',
      'fanout.branch_completed',
      'step.artifact_written',
      'fanout.joined',
      'gate.evaluated',
      'step.aborted',
    ]);
  });
});
