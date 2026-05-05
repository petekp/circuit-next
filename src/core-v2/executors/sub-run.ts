import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CompiledFlow as CompiledFlowSchema } from '../../schemas/compiled-flow.js';
import { RunResult } from '../../schemas/result.js';
import type { StepOutcomeV2 } from '../domain/step.js';
import type { SubRunStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';

const NO_VERDICT_SENTINEL = '<no-verdict>';

function checkPassVerdicts(step: SubRunStepV2): readonly string[] {
  const pass = (step.check as { readonly pass?: unknown }).pass;
  return Array.isArray(pass)
    ? pass.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

async function recordSubRunCheckFailure(
  step: SubRunStepV2,
  context: RunContextV2,
  reason: string,
): Promise<never> {
  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    check_kind: 'result_verdict',
    outcome: 'fail',
    reason,
  });
  throw new Error(reason);
}

function evaluateChildResult(
  step: SubRunStepV2,
  resultBody: unknown,
): { verdict: string; admitted: boolean; failureReason?: string } {
  if (resultBody === null || typeof resultBody !== 'object' || Array.isArray(resultBody)) {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body parsed but is not a JSON object`,
    };
  }
  const verdict = (resultBody as { readonly verdict?: unknown }).verdict;
  if (typeof verdict !== 'string' || verdict.length === 0) {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body lacks a non-empty string 'verdict' field`,
    };
  }
  const pass = checkPassVerdicts(step);
  if (!pass.includes(verdict)) {
    return {
      verdict,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child verdict '${verdict}' is not in check.pass [${pass.join(', ')}]`,
    };
  }
  return { verdict, admitted: true };
}

export async function executeSubRunV2(
  step: SubRunStepV2,
  context: RunContextV2,
): Promise<StepOutcomeV2> {
  const resultWrite = step.writes?.result;
  if (resultWrite === undefined) {
    throw new Error(`sub-run step '${step.id}' is missing writes.result`);
  }
  if (step.writes?.report !== undefined && step.writes.report.path !== resultWrite.path) {
    return await recordSubRunCheckFailure(
      step,
      context,
      `sub-run step '${step.id}': writes.report materialization at a path different from writes.result is not yet supported`,
    );
  }
  if (context.childCompiledFlowResolver === undefined) {
    return await recordSubRunCheckFailure(
      step,
      context,
      `sub-run step '${step.id}': childCompiledFlowResolver is required to resolve child flow '${step.flowRef}'`,
    );
  }
  if (context.childRunner === undefined) {
    return await recordSubRunCheckFailure(
      step,
      context,
      `sub-run step '${step.id}': childRunner is required to run child flow '${step.flowRef}'`,
    );
  }

  const resolved = await context.childCompiledFlowResolver({
    flowId: step.flowRef,
    entryMode: step.entryMode,
    ...(step.version === undefined ? {} : { version: step.version }),
  });
  const childFlow = CompiledFlowSchema.parse(
    JSON.parse(Buffer.from(resolved.flowBytes).toString('utf8')),
  );
  if (childFlow.id !== step.flowRef) {
    return await recordSubRunCheckFailure(
      step,
      context,
      `sub-run step '${step.id}': resolver returned flow id '${childFlow.id}' but flow_ref names '${step.flowRef}'`,
    );
  }

  const childRunId = randomUUID();
  const childRunDir = join(dirname(context.runDir), childRunId);
  await mkdir(dirname(childRunDir), { recursive: true });
  await context.trace.append({
    run_id: context.runId,
    kind: 'sub_run.started',
    step_id: step.id,
    child_run_id: childRunId,
    child_flow_id: childFlow.id,
    child_entry_mode: step.entryMode,
    child_depth: step.depth,
  });

  const startMs = Date.now();
  let childResult: Awaited<ReturnType<NonNullable<RunContextV2['childRunner']>>>;
  try {
    childResult = await context.childRunner({
      flowBytes: resolved.flowBytes,
      runDir: childRunDir,
      runId: childRunId,
      goal: step.goal,
      entryModeName: step.entryMode,
      depth: step.depth,
      now: context.now,
      ...(context.childExecutors === undefined ? {} : { executors: context.childExecutors }),
      ...(context.childCompiledFlowResolver === undefined
        ? {}
        : { childCompiledFlowResolver: context.childCompiledFlowResolver }),
      childRunner: context.childRunner,
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      ...(context.evidencePolicy === undefined ? {} : { evidencePolicy: context.evidencePolicy }),
      ...(context.worktreeRunner === undefined ? {} : { worktreeRunner: context.worktreeRunner }),
      ...(context.relayConnector === undefined ? {} : { relayConnector: context.relayConnector }),
      ...(context.relayer === undefined ? {} : { relayer: context.relayer }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
      ...(context.progress === undefined ? {} : { progress: context.progress }),
    });
  } catch (error) {
    return await recordSubRunCheckFailure(
      step,
      context,
      `sub-run step '${step.id}': child flow invocation failed (${(error as Error).message})`,
    );
  }

  const durationMs = Math.max(0, Date.now() - startMs);
  const childResultText = await readFile(childResult.resultPath, 'utf8');
  const childResultBody = RunResult.parse(JSON.parse(childResultText));
  const parentResultPath = context.files.resolve(resultWrite);
  await mkdir(dirname(parentResultPath), { recursive: true });
  await writeFile(parentResultPath, childResultText, 'utf8');

  const verdict = evaluateChildResult(step, childResultBody);
  await context.trace.append({
    run_id: context.runId,
    kind: 'sub_run.completed',
    step_id: step.id,
    child_run_id: childRunId,
    child_outcome: childResultBody.outcome,
    verdict: verdict.verdict,
    duration_ms: durationMs,
    result_path: resultWrite.path,
    data: { admitted: verdict.admitted },
  });

  if (verdict.admitted && childResultBody.outcome === 'complete') {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      check_kind: 'result_verdict',
      outcome: 'pass',
    });
    return { route: 'pass', details: { child_run_id: childRunId, verdict: verdict.verdict } };
  }

  return await recordSubRunCheckFailure(
    step,
    context,
    verdict.failureReason ??
      `sub-run step '${step.id}': child closed with outcome '${childResultBody.outcome}'`,
  );
}
