import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { EnabledConnector, type ResolvedConnector } from '../../schemas/connector.js';
import { materializeRelay } from '../connectors/relay-materializer.js';
import { type RelayResult, sha256Hex } from '../connectors/shared.js';
import { runCrossReportValidator } from '../registries/cross-report-validators.js';
import { parseReport } from '../registries/report-schemas.js';
import { deriveResolvedSelection, resolveRelayDecision } from '../relay-selection.js';
import {
  type CheckEvaluation,
  NO_VERDICT_SENTINEL,
  type RelayStep,
  composeRelayPrompt,
  evaluateRelayCheck,
} from '../relay-support.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { RelayInput } from '../runner-types.js';
import { recoveryRouteForStep } from './recovery-route.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

function connectorFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `relay step '${stepId}': connector invocation failed (${message})`;
}

export function connectorForRelayer(relayer: {
  connectorName: string;
  connector?: ResolvedConnector;
}) {
  return (
    relayer.connector ?? {
      kind: 'builtin' as const,
      name: EnabledConnector.parse(relayer.connectorName),
    }
  );
}

export interface RelayPrimitiveValidationInput {
  readonly flow: CompiledFlow;
  readonly runFolder: string;
  readonly step: RelayStep;
  readonly relayResult: RelayResult;
  readonly checkEvaluation: Extract<CheckEvaluation, { kind: 'pass' }>;
}

export interface RelayPrimitiveValidationResult {
  readonly evaluation: CheckEvaluation;
  readonly parsedBody?: unknown;
}

export type RelayPrimitiveResult =
  | {
      readonly kind: 'connector_failed';
      readonly reason: string;
      readonly duration_ms: number;
    }
  | {
      readonly kind: 'completed';
      readonly evaluation: CheckEvaluation;
      readonly relay_completed_verdict: string;
      readonly duration_ms: number;
      readonly parsed_body?: unknown;
      readonly report_path?: string;
    };

function validateAcceptedRelayResult(
  input: RelayPrimitiveValidationInput,
): RelayPrimitiveValidationResult {
  const { flow, runFolder, step, relayResult, checkEvaluation } = input;
  if (step.writes.report === undefined) {
    return { evaluation: checkEvaluation };
  }
  const parseResult = parseReport(step.writes.report.schema, relayResult.result_body);
  if (parseResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail',
        reason: `relay step '${step.id}': ${parseResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      },
    };
  }
  const crossResult = runCrossReportValidator(
    step.writes.report.schema,
    flow,
    runFolder,
    relayResult.result_body,
  );
  if (crossResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail',
        reason: `relay step '${step.id}': ${crossResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      },
    };
  }
  return { evaluation: checkEvaluation };
}

export async function executeRelayPrimitive(
  ctx: StepHandlerContext & { readonly step: RelayStep },
  options: {
    readonly formatConnectorFailureReason?: (stepId: string, err: unknown) => string;
    readonly validateAcceptedResult?: (
      input: RelayPrimitiveValidationInput,
    ) => RelayPrimitiveValidationResult;
  } = {},
): Promise<RelayPrimitiveResult> {
  const { runFolder, flow, step, runId, depth, attempt, recordedAt, push, state, now } = ctx;
  const relayerInv = {
    ...(ctx.relayer === undefined ? {} : { relayer: ctx.relayer }),
    selectionConfigLayers: ctx.executionSelectionConfigLayers,
  };

  const prompt = composeRelayPrompt(step, runFolder);
  const resolvedSelection = deriveResolvedSelection(relayerInv, flow, step, depth);
  const relayInput: RelayInput = { prompt, resolvedSelection };
  if (step.budgets?.wall_clock_ms !== undefined) {
    relayInput.timeoutMs = step.budgets.wall_clock_ms;
  }
  const { relayer, resolvedFrom } = await resolveRelayDecision({
    ...(ctx.relayer === undefined ? {} : { explicitRelayer: ctx.relayer }),
    configLayers: ctx.executionSelectionConfigLayers,
    flow,
    step,
  });
  const requestAbs = resolveRunRelative(runFolder, step.writes.request);
  const connector = connectorForRelayer(relayer);
  mkdirSync(dirname(requestAbs), { recursive: true });
  writeFileSync(requestAbs, prompt);
  const requestPayloadHash = sha256Hex(prompt);
  const startMs = Date.now();

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.started',
    step_id: step.id,
    attempt,
    connector,
    role: step.role,
    resolved_selection: resolvedSelection,
    resolved_from: resolvedFrom,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.request',
    step_id: step.id,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  let relayResult: RelayResult;
  try {
    relayResult = await relayer.relay(relayInput);
  } catch (err) {
    const reason = (options.formatConnectorFailureReason ?? connectorFailureReason)(
      step.id as unknown as string,
      err,
    );
    const durationMs = Math.max(0, Date.now() - startMs);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'relay.failed',
      step_id: step.id,
      attempt,
      connector,
      role: step.role,
      resolved_selection: resolvedSelection,
      resolved_from: resolvedFrom,
      request_payload_hash: requestPayloadHash,
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'fail',
      reason,
    });
    return { kind: 'connector_failed', reason, duration_ms: durationMs };
  }

  state.relayResults.push({
    stepId: step.id as unknown as string,
    connectorName: relayer.connectorName,
    cli_version: relayResult.cli_version,
  });

  const checkEvaluation = evaluateRelayCheck(step, relayResult.result_body);
  let parsedBody: unknown;
  let evaluation: CheckEvaluation = checkEvaluation;
  if (checkEvaluation.kind === 'pass') {
    const validation = (options.validateAcceptedResult ?? validateAcceptedRelayResult)({
      flow,
      runFolder,
      step,
      relayResult,
      checkEvaluation,
    });
    evaluation = validation.evaluation;
    parsedBody = validation.parsedBody;
  }

  const relayCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);
  const materialized = materializeRelay({
    runId,
    stepId: step.id,
    attempt,
    role: step.role,
    startingSequence: state.sequence,
    runFolder,
    writes: {
      request: step.writes.request,
      receipt: step.writes.receipt,
      result: step.writes.result,
      ...(step.writes.report === undefined || evaluation.kind !== 'pass'
        ? {}
        : { report: step.writes.report }),
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

  if (evaluation.kind === 'pass') {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'pass',
    });
  } else {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'fail',
      reason: evaluation.reason,
    });
  }

  return {
    kind: 'completed',
    evaluation,
    relay_completed_verdict: relayCompletedVerdict,
    duration_ms: Math.max(0, Date.now() - startMs),
    ...(parsedBody === undefined ? {} : { parsed_body: parsedBody }),
    ...(step.writes.report === undefined || evaluation.kind !== 'pass'
      ? {}
      : { report_path: step.writes.report.path }),
  };
}

export async function runRelayStep(
  ctx: StepHandlerContext & { readonly step: RelayStep },
): Promise<StepHandlerResult> {
  const { step, runId, attempt, recordedAt, push, state } = ctx;
  const primitiveResult = await executeRelayPrimitive(ctx);
  if (primitiveResult.kind === 'connector_failed') {
    const recoveryRoute = recoveryRouteForStep(step, ['retry', 'revise']);
    if (recoveryRoute !== undefined) {
      return { kind: 'advance', route: recoveryRoute, recovery_reason: primitiveResult.reason };
    }
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.aborted',
      step_id: step.id,
      attempt,
      reason: primitiveResult.reason,
    });
    return { kind: 'aborted', reason: primitiveResult.reason };
  }
  const { evaluation } = primitiveResult;
  if (evaluation.kind === 'pass') return { kind: 'advance' };

  // Check-fail termination path.
  const recoveryRoute = recoveryRouteForStep(step);
  if (recoveryRoute !== undefined) {
    return { kind: 'advance', route: recoveryRoute, recovery_reason: evaluation.reason };
  }
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.aborted',
    step_id: step.id,
    attempt,
    reason: evaluation.reason,
  });
  return { kind: 'aborted', reason: evaluation.reason };
}
