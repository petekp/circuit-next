import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { RunId } from '../../schemas/ids.js';
import {
  type CompiledFlowRef,
  type FanoutBranch,
  FanoutBranch as FanoutBranchSchema,
  type FanoutRelayBranch,
  type FanoutStep,
  type FanoutSubRunBranch,
} from '../../schemas/step.js';
import { materializeRelay } from '../connectors/relay-materializer.js';
import { type RelayResult, sha256Hex } from '../connectors/shared.js';
import { runCrossReportValidator } from '../registries/cross-report-validators.js';
import { parseReport } from '../registries/report-schemas.js';
import { deriveResolvedSelection, resolveRelayDecision } from '../relay-selection.js';
import { resultPath } from '../result-writer.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { CompiledFlowInvocation, RelayInput, WorktreeRunner } from '../runner-types.js';
import {
  type CheckEvaluation,
  type RelayStep,
  composeRelayPrompt,
  connectorForRelayer,
  evaluateRelayCheck,
} from './relay.js';
import { isRunRelativePathError, writeJsonReport } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type FanoutStepNarrow = CompiledFlow['steps'][number] & { kind: 'fanout' };

type ResolvedBranch =
  | {
      readonly kind: 'sub-run';
      readonly branch_id: string;
      readonly flow_ref: CompiledFlowRef;
      readonly goal: string;
      readonly depth: FanoutSubRunBranch['depth'];
      readonly selection?: FanoutBranch['selection'];
    }
  | {
      readonly kind: 'relay';
      readonly branch_id: string;
      readonly role: FanoutRelayBranch['execution']['role'];
      readonly goal: string;
      readonly report_schema: string;
      readonly provenance_field?: string;
      readonly selection?: FanoutBranch['selection'];
    };
type ResolvedRelayBranch = Extract<ResolvedBranch, { kind: 'relay' }>;

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
  readonly failure_reason?: string;
}

// Pure-function inputs for the join policy decision. Every field
// listed here is either a literal from the flow (policy,
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
  readonly failure_reason?: string;
}

export interface FanoutJoinInput {
  readonly policy: FanoutStep['check']['join']['policy'];
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
    const failedOutcome = outcomes.find((o) => o.failure_reason !== undefined);
    if (failedOutcome?.failure_reason !== undefined) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' aggregate-only: ${failedOutcome.failure_reason}`,
      };
    }
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not produce a parseable result body`,
    };
  }
  return { joinedSuccessfully: true };
}

const NO_VERDICT_SENTINEL = '<no-verdict>';

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

function resolveBranches(step: FanoutStepNarrow, runFolder: string): readonly ResolvedBranch[] {
  if (step.branches.kind === 'static') {
    return step.branches.branches.map((b) => resolveBranch(b));
  }
  // dynamic — load source report, traverse items_path, expand template per item.
  const sourceAbs = resolveRunRelative(runFolder, step.branches.source_report);
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
    expanded.push(resolveBranch(branch));
  }
  return expanded;
}

function resolveBranch(branch: FanoutBranch): ResolvedBranch {
  if ('flow_ref' in branch) {
    return {
      kind: 'sub-run',
      branch_id: branch.branch_id,
      flow_ref: branch.flow_ref,
      goal: branch.goal,
      depth: branch.depth,
      ...(branch.selection === undefined ? {} : { selection: branch.selection }),
    };
  }
  return {
    kind: 'relay',
    branch_id: branch.branch_id,
    role: branch.execution.role,
    goal: branch.execution.goal,
    report_schema: branch.execution.report_schema,
    ...(branch.execution.provenance_field === undefined
      ? {}
      : { provenance_field: branch.execution.provenance_field }),
    ...(branch.selection === undefined ? {} : { selection: branch.selection }),
  };
}

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

interface FanoutAggregateBody {
  readonly schema_version: 1;
  readonly join_policy: FanoutStep['check']['join']['policy'];
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
    readonly result_body?: unknown;
  }>;
}

function buildAggregate(
  policy: FanoutStep['check']['join']['policy'],
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
      ...(b.result_body === undefined ? {} : { result_body: b.result_body }),
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

async function runRelayFanoutBranch(
  ctx: StepHandlerContext & { readonly step: FanoutStepNarrow },
  branch: ResolvedRelayBranch,
  childRunIdValue: RunId,
  branchDirRel: string,
  branchDirAbs: string,
): Promise<BranchOutcome> {
  const {
    runFolder,
    flow,
    step,
    runId,
    depth,
    attempt,
    recordedAt,
    push,
    state,
    now,
    executionSelectionConfigLayers,
  } = ctx;
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

  const startMs = Date.now();
  const relayerInv = {
    ...(ctx.relayer === undefined ? {} : { relayer: ctx.relayer }),
    selectionConfigLayers: executionSelectionConfigLayers,
  };
  const prompt = composeRelayPrompt(relayStep, runFolder);
  const resolvedSelection = deriveResolvedSelection(relayerInv, flow, relayStep, depth);
  const relayInput: RelayInput = { prompt, resolvedSelection };
  if (relayStep.budgets?.wall_clock_ms !== undefined) {
    relayInput.timeoutMs = relayStep.budgets.wall_clock_ms;
  }
  const { relayer, resolvedFrom } = await resolveRelayDecision({
    ...(ctx.relayer === undefined ? {} : { explicitRelayer: ctx.relayer }),
    configLayers: executionSelectionConfigLayers,
    flow,
    step: relayStep,
  });
  const connector = connectorForRelayer(relayer);
  const requestAbs = resolveRunRelative(runFolder, relayStep.writes.request);
  mkdirSync(dirname(requestAbs), { recursive: true });
  writeFileSync(requestAbs, prompt);
  const requestPayloadHash = sha256Hex(prompt);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.started',
    step_id: relayStep.id,
    attempt,
    connector,
    role: relayStep.role,
    resolved_selection: resolvedSelection,
    resolved_from: resolvedFrom,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.request',
    step_id: relayStep.id,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  let relayResult: RelayResult;
  try {
    relayResult = await relayer.relay(relayInput);
  } catch (err) {
    const durationMs = Math.max(0, Date.now() - startMs);
    const reason = err instanceof Error ? err.message : String(err);
    const failureReason = `relay fanout branch '${branch.branch_id}': connector invocation failed (${reason})`;
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'relay.failed',
      step_id: relayStep.id,
      attempt,
      connector,
      role: relayStep.role,
      resolved_selection: resolvedSelection,
      resolved_from: resolvedFrom,
      request_payload_hash: requestPayloadHash,
      reason: failureReason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: relayStep.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'fail',
      reason: failureReason,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunIdValue,
      worktree_path: branchDirAbs,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL,
      result_path: '',
      result_body: undefined,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: failureReason,
    };
  }

  state.relayResults.push({
    stepId: relayStep.id as unknown as string,
    connectorName: relayer.connectorName,
    cli_version: relayResult.cli_version,
  });

  const checkEvaluation = evaluateRelayCheck(relayStep, relayResult.result_body);
  let evaluation: CheckEvaluation = checkEvaluation;
  let parsedBody: unknown;
  if (checkEvaluation.kind === 'pass') {
    const parseResult = parseReport(branch.report_schema, relayResult.result_body);
    if (parseResult.kind === 'fail') {
      evaluation = {
        kind: 'fail',
        reason: `relay fanout branch '${branch.branch_id}': ${parseResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      };
    } else {
      parsedBody = JSON.parse(relayResult.result_body);
      const provenanceFailure = relayBranchProvenanceFailure(branch, parsedBody);
      if (provenanceFailure !== undefined) {
        evaluation = {
          kind: 'fail',
          reason: provenanceFailure,
          observedVerdict: checkEvaluation.verdict,
        };
      } else {
        const crossResult = runCrossReportValidator(
          branch.report_schema,
          flow,
          runFolder,
          relayResult.result_body,
        );
        if (crossResult.kind === 'fail') {
          evaluation = {
            kind: 'fail',
            reason: `relay fanout branch '${branch.branch_id}': ${crossResult.reason}`,
            observedVerdict: checkEvaluation.verdict,
          };
        }
      }
    }
  }

  const relayCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);
  const materialized = materializeRelay({
    runId,
    stepId: relayStep.id,
    attempt,
    role: relayStep.role,
    startingSequence: state.sequence,
    runFolder,
    writes: {
      request: relayStep.writes.request,
      receipt: relayStep.writes.receipt,
      result: relayStep.writes.result,
      ...(evaluation.kind === 'pass' && relayStep.writes.report !== undefined
        ? { report: relayStep.writes.report }
        : {}),
    },
    connector,
    resolvedSelection,
    resolvedFrom,
    relayResult,
    verdict: relayCompletedVerdict,
    now,
    priorStart: { requestPayloadHash },
  });
  for (const ev of materialized.trace_entries) {
    push(ev);
  }

  const durationMs = Math.max(0, Date.now() - startMs);
  if (evaluation.kind === 'pass') {
    if (relayStep.writes.report === undefined) {
      throw new Error(`relay fanout branch '${branch.branch_id}': missing report write`);
    }
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: relayStep.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'pass',
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunIdValue,
      worktree_path: branchDirAbs,
      child_outcome: 'complete',
      verdict: evaluation.verdict,
      result_path: relayStep.writes.report.path,
      result_body: parsedBody,
      duration_ms: durationMs,
      admitted: true,
    };
  }

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'check.evaluated',
    step_id: relayStep.id,
    attempt,
    check_kind: 'result_verdict',
    outcome: 'fail',
    reason: evaluation.reason,
  });
  return {
    branch_id: branch.branch_id,
    child_run_id: childRunIdValue,
    worktree_path: branchDirAbs,
    child_outcome: 'aborted',
    verdict: relayCompletedVerdict,
    result_path: relayStep.writes.result,
    result_body: undefined,
    duration_ms: durationMs,
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
