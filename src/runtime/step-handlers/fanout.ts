import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { RunId } from '../../schemas/ids.js';
import { runCrossReportValidator } from '../registries/cross-report-validators.js';
import { parseReport } from '../registries/report-schemas.js';
import { resultPath } from '../result-writer.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { CompiledFlowInvocation, WorktreeRunner } from '../runner-types.js';
import { buildAggregate } from './fanout/aggregate.js';
import { resolveBranches } from './fanout/branch-resolution.js';
import {
  type FanoutJoinInput,
  type FanoutJoinOutcome,
  type FanoutJoinResult,
  evaluateFanoutJoinPolicy,
} from './fanout/join-policy.js';
import {
  type BranchOutcome,
  type FanoutStepNarrow,
  NO_VERDICT_SENTINEL,
  type ResolvedBranch,
  type ResolvedRelayBranch,
} from './fanout/types.js';
import { type RelayStep, executeRelayPrimitive } from './relay.js';
import { isRunRelativePathError, writeJsonReport } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

export type { FanoutJoinInput, FanoutJoinOutcome, FanoutJoinResult };
export { evaluateFanoutJoinPolicy };

// Default worktree provisioner — shells out to `git worktree`. Tests
// inject a stub via CompiledFlowInvocation.worktreeRunner.
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

function relayBranchProvenanceFailure(
  branch: ResolvedRelayBranch,
  reportBody: unknown,
): string | undefined {
  const field = branch.provenance_field;
  if (field === undefined) return undefined;
  if (reportBody === null || typeof reportBody !== 'object' || Array.isArray(reportBody)) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}' but report body is not an object`;
  }
  const observed = (reportBody as Record<string, unknown>)[field];
  if (observed !== branch.branch_id) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}' (got ${typeof observed === 'string' ? `'${observed}'` : typeof observed})`;
  }
  return undefined;
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

async function runRelayFanoutBranch(
  ctx: StepHandlerContext & { readonly step: FanoutStepNarrow },
  branch: ResolvedRelayBranch,
  childRunIdValue: RunId,
  branchDirRel: string,
  branchDirAbs: string,
): Promise<BranchOutcome> {
  const { flow, step } = ctx;
  const relayStep: RelayStep = {
    id: `${step.id as unknown as string}-${branch.branch_id}` as never,
    title: `${step.title} / ${branch.branch_id}: ${branch.goal}`,
    protocol: step.protocol,
    reads: step.reads,
    routes: { pass: '@complete' },
    ...(branch.selection === undefined ? {} : { selection: branch.selection }),
    executor: 'worker',
    kind: 'relay',
    role: branch.role,
    writes: {
      request: `${branchDirRel}/request.txt` as never,
      receipt: `${branchDirRel}/receipt.txt` as never,
      result: `${branchDirRel}/result.json` as never,
      report: {
        path: `${branchDirRel}/report.json` as never,
        schema: branch.report_schema,
      },
    },
    check: {
      kind: 'result_verdict',
      source: { kind: 'relay_result', ref: 'result' },
      pass: step.check.verdicts.admit,
    },
  };

  const primitiveResult = await executeRelayPrimitive(
    { ...ctx, step: relayStep },
    {
      formatConnectorFailureReason: (_stepId, err) => {
        const reason = err instanceof Error ? err.message : String(err);
        return `relay fanout branch '${branch.branch_id}': connector invocation failed (${reason})`;
      },
      validateAcceptedResult: ({ relayResult, checkEvaluation }) => {
        const parseResult = parseReport(branch.report_schema, relayResult.result_body);
        if (parseResult.kind === 'fail') {
          return {
            evaluation: {
              kind: 'fail',
              reason: `relay fanout branch '${branch.branch_id}': ${parseResult.reason}`,
              observedVerdict: checkEvaluation.verdict,
            },
          };
        }
        const parsedBody = JSON.parse(relayResult.result_body);
        const provenanceFailure = relayBranchProvenanceFailure(branch, parsedBody);
        if (provenanceFailure !== undefined) {
          return {
            evaluation: {
              kind: 'fail',
              reason: provenanceFailure,
              observedVerdict: checkEvaluation.verdict,
            },
          };
        }
        const crossResult = runCrossReportValidator(
          branch.report_schema,
          flow,
          ctx.runFolder,
          relayResult.result_body,
        );
        if (crossResult.kind === 'fail') {
          return {
            evaluation: {
              kind: 'fail',
              reason: `relay fanout branch '${branch.branch_id}': ${crossResult.reason}`,
              observedVerdict: checkEvaluation.verdict,
            },
          };
        }
        return { evaluation: checkEvaluation, parsedBody };
      },
    },
  );

  if (primitiveResult.kind === 'connector_failed') {
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunIdValue,
      worktree_path: branchDirAbs,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL,
      result_path: relayStep.writes.result,
      result_body: undefined,
      duration_ms: primitiveResult.duration_ms,
      admitted: false,
      failure_reason: primitiveResult.reason,
    };
  }

  const { evaluation } = primitiveResult;
  if (evaluation.kind === 'pass') {
    if (primitiveResult.report_path === undefined) {
      throw new Error(`relay fanout branch '${branch.branch_id}': missing report write`);
    }
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunIdValue,
      worktree_path: branchDirAbs,
      child_outcome: 'complete',
      verdict: evaluation.verdict,
      result_path: primitiveResult.report_path,
      result_body: primitiveResult.parsed_body,
      duration_ms: primitiveResult.duration_ms,
      admitted: true,
    };
  }

  return {
    branch_id: branch.branch_id,
    child_run_id: childRunIdValue,
    worktree_path: branchDirAbs,
    child_outcome: 'aborted',
    verdict: primitiveResult.relay_completed_verdict,
    result_path: relayStep.writes.result,
    result_body: undefined,
    duration_ms: primitiveResult.duration_ms,
    admitted: false,
    failure_reason: evaluation.reason,
  };
}

export async function runFanoutStep(
  ctx: StepHandlerContext & { readonly step: FanoutStepNarrow },
): Promise<StepHandlerResult> {
  const {
    runFolder,
    step,
    runId,
    attempt,
    recordedAt,
    push,
    state,
    now,
    childRunner,
    childCompiledFlowResolver,
    worktreeRunner: ctxWorktreeRunner,
    relayer,
    composeWriter,
    executionSelectionConfigLayers,
    projectRoot,
    change_kind,
  } = ctx;

  const abortReason = (reason: string): StepHandlerResult => {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'fanout_aggregate',
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

  let resolvedBranches: readonly ResolvedBranch[];
  try {
    resolvedBranches = resolveBranches(step, runFolder);
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return abortReason(`fanout step '${step.id}': branch resolution failed (${message})`);
  }
  if (resolvedBranches.length === 0) {
    return abortReason(`fanout step '${step.id}': branch resolution produced zero branches`);
  }
  const hasSubRunBranches = resolvedBranches.some((branch) => branch.kind === 'sub-run');
  if (hasSubRunBranches && childCompiledFlowResolver === undefined) {
    return abortReason(
      `fanout step '${step.id}': CompiledFlowInvocation.childCompiledFlowResolver is required to resolve branch flows`,
    );
  }
  if (hasSubRunBranches && projectRoot === undefined) {
    return abortReason(
      `fanout step '${step.id}': CompiledFlowInvocation.projectRoot is required to anchor per-branch worktrees`,
    );
  }
  if (
    step.check.join.policy === 'disjoint-merge' &&
    resolvedBranches.some((branch) => branch.kind === 'relay')
  ) {
    return abortReason(
      `fanout step '${step.id}': disjoint-merge is only supported for sub-run branches with worktrees`,
    );
  }

  const worktreeRunner = ctxWorktreeRunner ?? DEFAULT_WORKTREE_RUNNER;

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
  const runsBase = dirname(runFolder);
  const baseRef = 'HEAD';
  const provisioned: Array<{ branch_id: string; worktree_path: string }> = [];
  const outcomes: BranchOutcome[] = [];

  try {
    await runWithConcurrency(resolvedBranches, concurrencyLimit, async (branch, abortSignal) => {
      if (abortSignal.value) return;
      const childRunIdValue: RunId = RunId.parse(randomUUID());
      const branchDirRel = `${step.writes.branches_dir}/${branch.branch_id}`;
      const branchDirAbs = resolveRunRelative(runFolder, branchDirRel);
      const branchResultPathRel = `${branchDirRel}/result.json`;

      if (branch.kind === 'relay') {
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
          worktree_path: branchDirAbs,
        });
        const relayOutcome = await runRelayFanoutBranch(
          ctx,
          branch,
          childRunIdValue,
          branchDirRel,
          branchDirAbs,
        );
        outcomes.push(relayOutcome);
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
          child_outcome: relayOutcome.child_outcome,
          verdict: relayOutcome.verdict,
          duration_ms: relayOutcome.duration_ms,
          result_path: relayOutcome.result_path,
        });
        if (!relayOutcome.admitted && step.on_child_failure === 'abort-all') {
          abortSignal.value = true;
        }
        return;
      }

      const childRunFolder = join(runsBase, childRunIdValue as unknown as string);
      if (projectRoot === undefined || childCompiledFlowResolver === undefined) {
        throw new Error('fanout sub-run branch reached without required projectRoot/resolver');
      }
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
          result_path: branchResultPathRel,
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
          result_path: branchResultPathRel,
        });
        // worktree provisioning failure is recorded on the
        // branch_completed trace_entry with verdict=NO_VERDICT; the abort
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

      let resolved: { flow: CompiledFlow; bytes: Buffer };
      try {
        resolved = childCompiledFlowResolver(branch.flow_ref);
      } catch (err) {
        if (step.on_child_failure === 'abort-all') abortSignal.value = true;
        const message = err instanceof Error ? err.message : String(err);
        outcomes.push({
          branch_id: branch.branch_id,
          child_run_id: childRunIdValue,
          worktree_path: worktreePath,
          child_outcome: 'aborted',
          verdict: NO_VERDICT_SENTINEL,
          result_path: branchResultPathRel,
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
          result_path: branchResultPathRel,
        });
        // child flow resolver failure is recorded on the
        // branch_completed trace_entry with verdict=NO_VERDICT.
        void message;
        return;
      }

      const startMs = Date.now();
      const childInvocation: CompiledFlowInvocation = {
        runFolder: childRunFolder,
        flow: resolved.flow,
        flowBytes: resolved.bytes,
        runId: childRunIdValue,
        goal: branch.goal,
        depth: branch.depth,
        entryModeName: branch.flow_ref.entry_mode,
        change_kind,
        now,
        ...(relayer === undefined ? {} : { relayer }),
        composeWriter,
        selectionConfigLayers: executionSelectionConfigLayers,
        childCompiledFlowResolver,
        ...(ctxWorktreeRunner === undefined ? {} : { worktreeRunner: ctxWorktreeRunner }),
        projectRoot: worktreePath,
      };

      let childOutcome: BranchOutcome['child_outcome'] = 'aborted';
      let childResultPathRel = branchResultPathRel;
      let childResultBody: unknown = undefined;
      let durationMs = 0;
      try {
        const childResult = await childRunner(childInvocation);
        durationMs = Math.max(0, Date.now() - startMs);
        if (childResult.result.outcome === 'checkpoint_waiting') {
          childOutcome = 'aborted';
        } else {
          childOutcome = childResult.result.outcome;
          const childResultAbs = resultPath(childRunFolder);
          const bodyText = readFileSync(childResultAbs, 'utf8');
          childResultBody = JSON.parse(bodyText);
          // Materialise child result.json into parent's
          // <branches_dir>/<branch_id>/result.json slot.
          childResultPathRel = `${step.writes.branches_dir}/${branch.branch_id}/result.json`;
          const dest = resolveRunRelative(runFolder, childResultPathRel);
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(childResultAbs, dest);
        }
      } catch (err) {
        if (isRunRelativePathError(err)) throw err;
        durationMs = Math.max(0, Date.now() - startMs);
        childOutcome = 'aborted';
      }

      const verdictEval = evaluateChildVerdict(childResultBody, step.check.verdicts.admit);
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
  const policy = step.check.join.policy;
  const admitOrder = step.check.verdicts.admit;
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
      ...(o.failure_reason === undefined ? {} : { failure_reason: o.failure_reason }),
    })),
    ...(branchFiles === undefined ? {} : { branchFiles }),
    ...(branchFilesError === undefined ? {} : { branchFilesError }),
  });
  const joinedSuccessfully = joinDecision.joinedSuccessfully;
  const winnerBranchId = joinDecision.winnerBranchId;
  const joinFailureReason = joinDecision.failureReason;
  // v0 limitation: disjoint-merge file-disjoint validation runs but
  // the actual merge into the parent tree is not yet wired. Aggregate
  // report still records the per-branch outcomes for operators to
  // merge manually until the merge slice lands.

  // Always materialise the aggregate report — the durable record of
  // what happened, regardless of join outcome.
  const aggregateBody = buildAggregate(policy, outcomes, winnerBranchId);
  writeJsonReport(runFolder, step.writes.aggregate.path, aggregateBody);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.report_written',
    step_id: step.id,
    attempt,
    report_path: step.writes.aggregate.path,
    report_schema: step.writes.aggregate.schema,
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
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'fanout_aggregate',
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
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'fanout_aggregate',
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
