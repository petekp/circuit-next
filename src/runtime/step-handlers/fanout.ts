import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RunId } from '../../schemas/ids.js';
import {
  type FanoutBranch,
  FanoutBranch as FanoutBranchSchema,
  type FanoutStep,
  type WorkflowRef,
} from '../../schemas/step.js';
import type { Workflow } from '../../schemas/workflow.js';
import { resultPath } from '../result-writer.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { WorkflowInvocation, WorktreeRunner } from '../runner-types.js';
import { isRunRelativePathError, writeJsonArtifact } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type FanoutStepNarrow = Workflow['steps'][number] & { kind: 'fanout' };

interface ResolvedBranch {
  readonly branch_id: string;
  readonly workflow_ref: WorkflowRef;
  readonly goal: string;
  readonly rigor: FanoutBranch['rigor'];
  readonly selection?: FanoutBranch['selection'];
}

interface BranchOutcome {
  readonly branch_id: string;
  readonly child_run_id: RunId;
  readonly worktree_path: string;
  readonly child_outcome: 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated';
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
}

// Pure-function inputs for the join policy decision. Every field
// listed here is either a literal from the workflow (policy,
// admitOrder, stepId), a per-branch summary derived from
// already-completed child runs (outcomes), or a precomputed pair of
// changed-file lists / file-discovery-error string for the
// disjoint-merge branch (which is the one impure dimension in
// runFanoutStep — hoisted ahead of the call so the join decision
// itself stays pure and table-testable).
export interface FanoutJoinOutcome {
  readonly branch_id: string;
  readonly child_outcome: BranchOutcome['child_outcome'];
  readonly verdict: string;
  readonly admitted: boolean;
  // Present iff `child_outcome === 'complete'` and the child's
  // `result.json` parsed to an object. aggregate-only treats
  // `undefined` as "non-parseable".
  readonly result_body?: unknown;
}

export interface FanoutJoinInput {
  readonly policy: FanoutStep['gate']['join']['policy'];
  readonly stepId: string;
  readonly admitOrder: readonly string[];
  readonly outcomes: readonly FanoutJoinOutcome[];
  // disjoint-merge only: changed files per branch_id. Either
  // `branchFiles` is provided (the usual path) or `branchFilesError`
  // is set when the worktree-runner threw during discovery.
  readonly branchFiles?: ReadonlyMap<string, readonly string[]>;
  readonly branchFilesError?: string;
}

export interface FanoutJoinResult {
  readonly joinedSuccessfully: boolean;
  readonly winnerBranchId?: string;
  readonly failureReason?: string;
}

export function evaluateFanoutJoinPolicy(input: FanoutJoinInput): FanoutJoinResult {
  const { policy, stepId, admitOrder, outcomes } = input;

  if (policy === 'pick-winner') {
    for (const admittedVerdict of admitOrder) {
      const found = outcomes.find(
        (o) => o.child_outcome === 'complete' && o.verdict === admittedVerdict,
      );
      if (found !== undefined) {
        return { joinedSuccessfully: true, winnerBranchId: found.branch_id };
      }
    }
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' pick-winner: no branch closed 'complete' with an admitted verdict (admit order [${admitOrder.join(', ')}])`,
    };
  }

  if (policy === 'disjoint-merge') {
    const allAdmitted = outcomes.every((o) => o.admitted);
    if (!allAdmitted) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: not all branches closed 'complete' with an admitted verdict`,
      };
    }
    if (input.branchFilesError !== undefined) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: file-disjoint validation failed (${input.branchFilesError})`,
      };
    }
    const branchFiles = input.branchFiles;
    if (branchFiles === undefined) {
      // Caller contract violation: disjoint-merge requires either
      // branchFiles or branchFilesError. Surface as a pure-function
      // assertion instead of silently passing.
      throw new Error(
        'evaluateFanoutJoinPolicy: disjoint-merge requires branchFiles or branchFilesError',
      );
    }
    const seenFile = new Map<string, string>();
    for (const outcome of outcomes) {
      const files = branchFiles.get(outcome.branch_id) ?? [];
      for (const file of files) {
        const prior = seenFile.get(file);
        if (prior !== undefined && prior !== outcome.branch_id) {
          return {
            joinedSuccessfully: false,
            failureReason: `fanout step '${stepId}' disjoint-merge: file '${file}' modified by branches '${prior}' and '${outcome.branch_id}'`,
          };
        }
        seenFile.set(file, outcome.branch_id);
      }
    }
    return { joinedSuccessfully: true };
  }

  // aggregate-only.
  const allClosed = outcomes.every(
    (o) =>
      o.child_outcome === 'complete' ||
      o.child_outcome === 'aborted' ||
      o.child_outcome === 'handoff' ||
      o.child_outcome === 'stopped' ||
      o.child_outcome === 'escalated',
  );
  const allParseable = outcomes.every(
    (o) => o.child_outcome === 'complete' && o.result_body !== undefined,
  );
  if (!allClosed) {
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not close cleanly`,
    };
  }
  if (!allParseable) {
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not produce a parseable result body`,
    };
  }
  return { joinedSuccessfully: true };
}

const NO_VERDICT_SENTINEL = '<no-verdict>';

// Default worktree provisioner — shells out to `git worktree`. Tests
// inject a stub via WorkflowInvocation.worktreeRunner.
const DEFAULT_WORKTREE_RUNNER: WorktreeRunner = {
  add: ({ worktreePath, baseRef, branchName }): void => {
    const result = spawnSync('git', ['worktree', 'add', '-b', branchName, worktreePath, baseRef], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(
        `git worktree add failed (exit ${result.status ?? 'null'}): ${result.stderr ?? ''}`.trim(),
      );
    }
  },
  remove: (worktreePath: string): void => {
    const result = spawnSync('git', ['worktree', 'remove', '--force', worktreePath], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(
        `git worktree remove failed (exit ${result.status ?? 'null'}): ${result.stderr ?? ''}`.trim(),
      );
    }
  },
  changedFiles: (worktreePath: string, baseRef: string): readonly string[] => {
    const result = spawnSync('git', ['diff', '--name-only', `${baseRef}..HEAD`], {
      cwd: worktreePath,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(
        `git diff --name-only failed (exit ${result.status ?? 'null'}): ${result.stderr ?? ''}`.trim(),
      );
    }
    return (result.stdout ?? '').split('\n').filter((line) => line.length > 0);
  },
};

// Resolve dotted path segments against an unknown root. `path` like
// `batches.items` walks `root.batches.items`. Returns the iterable
// array if found; throws on missing or wrong-typed segment.
function resolveDottedPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      throw new Error(`items_path '${path}' descended into a non-object at segment '${segment}'`);
    }
    cursor = (cursor as Record<string, unknown>)[segment];
    if (cursor === undefined) {
      throw new Error(`items_path '${path}' is missing at segment '${segment}'`);
    }
  }
  return cursor;
}

// Substitute `$item` and `$item.<key>` placeholders in a string against
// a single item value. Returns the substituted string. When the entire
// string IS exactly `$item` or `$item.<key>` and the substitution
// resolves to a non-string, the literal value is converted via String().
// Inline patterns are always stringified.
function substituteItemPlaceholders(template: string, item: unknown): string {
  if (template === '$item') return typeof item === 'string' ? item : JSON.stringify(item);
  const exactMatch = /^\$item\.([a-z_][a-z0-9_]*)$/i.exec(template);
  if (exactMatch !== null) {
    const key = exactMatch[1] as string;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = (item as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === 'string' ? value : String(value);
  }
  return template.replace(/\$item\.([a-z_][a-z0-9_]*)/gi, (_match, key: string) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = (item as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === 'string' ? value : String(value);
  });
}

// Recursively walk a template object, substituting `$item.<key>`
// placeholders in any string-typed leaf. Object structure is preserved.
function expandTemplate<T>(template: T, item: unknown): T {
  if (typeof template === 'string') {
    return substituteItemPlaceholders(template, item) as unknown as T;
  }
  if (template === null || typeof template !== 'object') return template;
  if (Array.isArray(template)) {
    return template.map((entry) => expandTemplate(entry, item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
    out[key] = expandTemplate(value, item);
  }
  return out as T;
}

function resolveBranches(step: FanoutStepNarrow, runRoot: string): readonly ResolvedBranch[] {
  if (step.branches.kind === 'static') {
    return step.branches.branches.map((b) => ({
      branch_id: b.branch_id,
      workflow_ref: b.workflow_ref,
      goal: b.goal,
      rigor: b.rigor,
      ...(b.selection === undefined ? {} : { selection: b.selection }),
    }));
  }
  // dynamic — load source artifact, traverse items_path, expand template per item.
  const sourceAbs = resolveRunRelative(runRoot, step.branches.source_artifact);
  const sourceRaw: unknown = JSON.parse(readFileSync(sourceAbs, 'utf8'));
  const items = resolveDottedPath(sourceRaw, step.branches.items_path);
  if (!Array.isArray(items)) {
    throw new Error(
      `dynamic fanout: items_path '${step.branches.items_path}' did not resolve to an array (got ${typeof items})`,
    );
  }
  const cap = step.branches.max_branches;
  if (items.length > cap) {
    throw new Error(`dynamic fanout expanded to ${items.length} items but max_branches is ${cap}`);
  }
  const expanded: ResolvedBranch[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const expandedRaw = expandTemplate(step.branches.template, item);
    // Re-parse the substituted branch through FanoutBranch (strict
    // kebab-case regex) so an invalid placeholder substitution fails
    // loudly at expansion time rather than later at worktree-add /
    // path-derivation time.
    const branch: FanoutBranch = FanoutBranchSchema.parse(expandedRaw);
    if (seen.has(branch.branch_id)) {
      throw new Error(
        `dynamic fanout produced duplicate branch_id '${branch.branch_id}'; template substitution must yield unique ids`,
      );
    }
    seen.add(branch.branch_id);
    expanded.push({
      branch_id: branch.branch_id,
      workflow_ref: branch.workflow_ref,
      goal: branch.goal,
      rigor: branch.rigor,
      ...(branch.selection === undefined ? {} : { selection: branch.selection }),
    });
  }
  return expanded;
}

function evaluateChildVerdict(
  resultBody: unknown,
  admitList: readonly string[],
): { verdict: string; admitted: boolean } {
  if (resultBody === null || typeof resultBody !== 'object' || Array.isArray(resultBody)) {
    return { verdict: NO_VERDICT_SENTINEL, admitted: false };
  }
  const verdictRaw = (resultBody as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return { verdict: NO_VERDICT_SENTINEL, admitted: false };
  }
  return { verdict: verdictRaw, admitted: admitList.includes(verdictRaw) };
}

interface FanoutAggregateBody {
  readonly schema_version: 1;
  readonly join_policy: FanoutStep['gate']['join']['policy'];
  readonly branch_count: number;
  readonly winner_branch_id?: string;
  readonly branches: ReadonlyArray<{
    readonly branch_id: string;
    readonly child_run_id: string;
    readonly child_outcome: BranchOutcome['child_outcome'];
    readonly verdict: string;
    readonly admitted: boolean;
    readonly result_path: string;
    readonly duration_ms: number;
  }>;
}

function buildAggregate(
  policy: FanoutStep['gate']['join']['policy'],
  outcomes: readonly BranchOutcome[],
  winnerBranchId: string | undefined,
): FanoutAggregateBody {
  return {
    schema_version: 1,
    join_policy: policy,
    branch_count: outcomes.length,
    ...(winnerBranchId === undefined ? {} : { winner_branch_id: winnerBranchId }),
    branches: outcomes.map((b) => ({
      branch_id: b.branch_id,
      child_run_id: b.child_run_id as unknown as string,
      child_outcome: b.child_outcome,
      verdict: b.verdict,
      admitted: b.admitted,
      result_path: b.result_path,
      duration_ms: b.duration_ms,
    })),
  };
}

// Bounded-concurrency runner. Spawns up to `limit` promises at a time
// from the work queue and awaits all of them. `unbounded` runs all at
// once. Aborts pending work when `abortSignal.value === true`.
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number | 'unbounded',
  worker: (item: T, abortSignal: { value: boolean }) => Promise<void>,
): Promise<void> {
  const abortSignal = { value: false };
  if (limit === 'unbounded') {
    await Promise.all(items.map((item) => worker(item, abortSignal)));
    return;
  }
  let cursor = 0;
  const workers: Promise<void>[] = [];
  const max = Math.min(limit, items.length);
  for (let i = 0; i < max; i += 1) {
    workers.push(
      (async () => {
        while (true) {
          if (abortSignal.value) return;
          const idx = cursor;
          cursor += 1;
          if (idx >= items.length) return;
          const item = items[idx];
          if (item === undefined) return;
          await worker(item, abortSignal);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

export async function runFanoutStep(
  ctx: StepHandlerContext & { readonly step: FanoutStepNarrow },
): Promise<StepHandlerResult> {
  const {
    runRoot,
    step,
    runId,
    attempt,
    recordedAt,
    push,
    state,
    now,
    childRunner,
    childWorkflowResolver,
    worktreeRunner: ctxWorktreeRunner,
    dispatcher,
    synthesisWriter,
    executionSelectionConfigLayers,
    projectRoot,
    lane,
  } = ctx;

  const abortReason = (reason: string): StepHandlerResult => {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'fanout_aggregate',
      outcome: 'fail',
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.aborted',
      step_id: step.id,
      attempt,
      reason,
    });
    return { kind: 'aborted', reason };
  };

  if (childWorkflowResolver === undefined) {
    return abortReason(
      `fanout step '${step.id}': WorkflowInvocation.childWorkflowResolver is required to resolve branch workflows`,
    );
  }
  if (projectRoot === undefined) {
    return abortReason(
      `fanout step '${step.id}': WorkflowInvocation.projectRoot is required to anchor per-branch worktrees`,
    );
  }

  const worktreeRunner = ctxWorktreeRunner ?? DEFAULT_WORKTREE_RUNNER;

  let resolvedBranches: readonly ResolvedBranch[];
  try {
    resolvedBranches = resolveBranches(step, runRoot);
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return abortReason(`fanout step '${step.id}': branch resolution failed (${message})`);
  }
  if (resolvedBranches.length === 0) {
    return abortReason(`fanout step '${step.id}': branch resolution produced zero branches`);
  }

  const branchIds = resolvedBranches.map((b) => b.branch_id);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'fanout.started',
    step_id: step.id,
    attempt,
    branch_ids: branchIds,
    on_child_failure: step.on_child_failure,
  });

  const concurrencyLimit: number | 'unbounded' =
    step.concurrency.kind === 'unbounded' ? 'unbounded' : step.concurrency.max;
  const runsBase = dirname(runRoot);
  const baseRef = 'HEAD';
  const provisioned: Array<{ branch_id: string; worktree_path: string }> = [];
  const outcomes: BranchOutcome[] = [];

  try {
    await runWithConcurrency(resolvedBranches, concurrencyLimit, async (branch, abortSignal) => {
      if (abortSignal.value) return;
      const childRunIdValue: RunId = RunId.parse(randomUUID());
      const childRunRoot = join(runsBase, childRunIdValue as unknown as string);
      const worktreePath = join(
        projectRoot,
        '.circuit-next',
        'worktrees',
        runId as unknown as string,
        step.id as unknown as string,
        branch.branch_id,
      );
      const worktreeBranchName = `circuit-next/${runId as unknown as string}/${step.id as unknown as string}/${branch.branch_id}`;

      try {
        await Promise.resolve(
          worktreeRunner.add({
            worktreePath,
            baseRef,
            branchName: worktreeBranchName,
          }),
        );
      } catch (err) {
        if (step.on_child_failure === 'abort-all') abortSignal.value = true;
        const message = err instanceof Error ? err.message : String(err);
        outcomes.push({
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          worktree_path: worktreePath,
          child_outcome: 'aborted',
          verdict: NO_VERDICT_SENTINEL,
          result_path: '',
          result_body: undefined,
          duration_ms: 0,
          admitted: false,
        });
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'fanout.branch_started',
          step_id: step.id,
          attempt,
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          worktree_path: worktreePath,
        });
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'fanout.branch_completed',
          step_id: step.id,
          attempt,
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          child_outcome: 'aborted',
          verdict: NO_VERDICT_SENTINEL,
          duration_ms: 0,
          result_path: '',
        });
        // worktree provisioning failure is recorded on the
        // branch_completed event with verdict=NO_VERDICT; the abort
        // signal short-circuits remaining work when policy says so.
        void message;
        return;
      }
      provisioned.push({ branch_id: branch.branch_id, worktree_path: worktreePath });

      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'fanout.branch_started',
        step_id: step.id,
        attempt,
        branch_id: branch.branch_id,
        child_run_id: childRunIdValue,
        worktree_path: worktreePath,
      });

      let resolved: { workflow: Workflow; bytes: Buffer };
      try {
        resolved = childWorkflowResolver(branch.workflow_ref);
      } catch (err) {
        if (step.on_child_failure === 'abort-all') abortSignal.value = true;
        const message = err instanceof Error ? err.message : String(err);
        outcomes.push({
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          worktree_path: worktreePath,
          child_outcome: 'aborted',
          verdict: NO_VERDICT_SENTINEL,
          result_path: '',
          result_body: undefined,
          duration_ms: 0,
          admitted: false,
        });
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'fanout.branch_completed',
          step_id: step.id,
          attempt,
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          child_outcome: 'aborted',
          verdict: NO_VERDICT_SENTINEL,
          duration_ms: 0,
          result_path: '',
        });
        // child workflow resolver failure is recorded on the
        // branch_completed event with verdict=NO_VERDICT.
        void message;
        return;
      }

      const startMs = Date.now();
      const childInvocation: WorkflowInvocation = {
        runRoot: childRunRoot,
        workflow: resolved.workflow,
        workflowBytes: resolved.bytes,
        runId: childRunIdValue,
        goal: branch.goal,
        rigor: branch.rigor,
        entryModeName: branch.workflow_ref.entry_mode,
        lane,
        now,
        dispatcher,
        synthesisWriter,
        selectionConfigLayers: executionSelectionConfigLayers,
        childWorkflowResolver,
        ...(ctxWorktreeRunner === undefined ? {} : { worktreeRunner: ctxWorktreeRunner }),
        projectRoot: worktreePath,
      };

      let childOutcome: BranchOutcome['child_outcome'] = 'aborted';
      let childResultPathRel = '';
      let childResultBody: unknown = undefined;
      let durationMs = 0;
      try {
        const childResult = await childRunner(childInvocation);
        durationMs = Math.max(0, Date.now() - startMs);
        if (childResult.result.outcome === 'checkpoint_waiting') {
          childOutcome = 'aborted';
        } else {
          childOutcome = childResult.result.outcome;
          const childResultAbs = resultPath(childRunRoot);
          const bodyText = readFileSync(childResultAbs, 'utf8');
          childResultBody = JSON.parse(bodyText);
          // Materialise child result.json into parent's
          // <branches_dir>/<branch_id>/result.json slot.
          childResultPathRel = `${step.writes.branches_dir}/${branch.branch_id}/result.json`;
          const dest = resolveRunRelative(runRoot, childResultPathRel);
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(childResultAbs, dest);
        }
      } catch (err) {
        if (isRunRelativePathError(err)) throw err;
        durationMs = Math.max(0, Date.now() - startMs);
        childOutcome = 'aborted';
      }

      const verdictEval = evaluateChildVerdict(childResultBody, step.gate.verdicts.admit);
      const branchAdmitted = childOutcome === 'complete' && verdictEval.admitted;
      outcomes.push({
        branch_id: branch.branch_id,
        child_run_id: childRunIdValue,
        worktree_path: worktreePath,
        child_outcome: childOutcome,
        verdict: verdictEval.verdict,
        result_path: childResultPathRel,
        result_body: childResultBody,
        duration_ms: durationMs,
        admitted: branchAdmitted,
      });
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'fanout.branch_completed',
        step_id: step.id,
        attempt,
        branch_id: branch.branch_id,
        child_run_id: childRunIdValue,
        child_outcome: childOutcome,
        verdict: verdictEval.verdict,
        duration_ms: durationMs,
        result_path: childResultPathRel,
      });

      if (!branchAdmitted && step.on_child_failure === 'abort-all') {
        abortSignal.value = true;
      }
    });
  } finally {
    for (const entry of provisioned) {
      try {
        await Promise.resolve(worktreeRunner.remove(entry.worktree_path));
      } catch {
        // Best-effort cleanup. A leftover worktree is operator-visible
        // (occupies disk + git worktree list) but does not corrupt the
        // run; surfacing as a fatal would mask the original failure.
      }
    }
  }

  // Apply join policy to determine pass / fail and (for pick-winner) the
  // winning branch id. Heavy lifting is in `evaluateFanoutJoinPolicy`
  // (pure); the only impure dimension — disjoint-merge's per-branch
  // changed-file discovery — is hoisted ahead of the call so the join
  // decision itself is table-testable.
  const policy = step.gate.join.policy;
  const admitOrder = step.gate.verdicts.admit;
  let branchFiles: ReadonlyMap<string, readonly string[]> | undefined;
  let branchFilesError: string | undefined;
  if (policy === 'disjoint-merge' && outcomes.every((o) => o.admitted)) {
    try {
      const collected = await Promise.all(
        outcomes.map(async (o) => {
          const files = worktreeRunner.changedFiles
            ? await Promise.resolve(worktreeRunner.changedFiles(o.worktree_path, baseRef))
            : [];
          return [o.branch_id, files] as const;
        }),
      );
      branchFiles = new Map(collected);
    } catch (err) {
      branchFilesError = err instanceof Error ? err.message : String(err);
    }
  }
  const joinDecision = evaluateFanoutJoinPolicy({
    policy,
    stepId: step.id,
    admitOrder,
    outcomes: outcomes.map((o) => ({
      branch_id: o.branch_id,
      child_outcome: o.child_outcome,
      verdict: o.verdict,
      admitted: o.admitted,
      result_body: o.result_body,
    })),
    ...(branchFiles === undefined ? {} : { branchFiles }),
    ...(branchFilesError === undefined ? {} : { branchFilesError }),
  });
  const joinedSuccessfully = joinDecision.joinedSuccessfully;
  const winnerBranchId = joinDecision.winnerBranchId;
  const joinFailureReason = joinDecision.failureReason;
  // v0 limitation: disjoint-merge file-disjoint validation runs but
  // the actual merge into the parent tree is not yet wired. Aggregate
  // artifact still records the per-branch outcomes for operators to
  // merge manually until the merge slice lands.

  // Always materialise the aggregate artifact — the durable record of
  // what happened, regardless of join outcome.
  const aggregateBody = buildAggregate(policy, outcomes, winnerBranchId);
  writeJsonArtifact(runRoot, step.writes.aggregate.path, aggregateBody);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.artifact_written',
    step_id: step.id,
    attempt,
    artifact_path: step.writes.aggregate.path,
    artifact_schema: step.writes.aggregate.schema,
  });

  const branchesCompleted = outcomes.filter((o) => o.child_outcome === 'complete').length;
  const branchesFailed = outcomes.length - branchesCompleted;
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'fanout.joined',
    step_id: step.id,
    attempt,
    policy,
    ...(winnerBranchId === undefined ? {} : { selected_branch_id: winnerBranchId }),
    aggregate_path: step.writes.aggregate.path,
    branches_completed: branchesCompleted,
    branches_failed: branchesFailed,
  });

  if (joinedSuccessfully) {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'fanout_aggregate',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  }

  const reason =
    joinFailureReason ?? `fanout step '${step.id}': join policy '${policy}' did not pass`;
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'gate.evaluated',
    step_id: step.id,
    attempt,
    gate_kind: 'fanout_aggregate',
    outcome: 'fail',
    reason,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.aborted',
    step_id: step.id,
    attempt,
    reason,
  });
  return { kind: 'aborted', reason };
}
