import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { relayClaudeCode } from '../../runtime/connectors/claude-code.js';
import { relayCodex } from '../../runtime/connectors/codex.js';
import { relayCustom } from '../../runtime/connectors/custom.js';
import { runCrossReportValidator } from '../../runtime/registries/cross-report-validators.js';
import { parseReport } from '../../runtime/registries/report-schemas.js';
import type { ResolvedConnector } from '../../schemas/connector.js';
import { Depth } from '../../schemas/depth.js';
import { ResolvedSelection } from '../../schemas/selection-policy.js';
import { RelayRole } from '../../schemas/step.js';
import { type RelayResult, sha256Hex } from '../../shared/connector-relay.js';
import { deriveResolvedSelection } from '../../shared/relay-selection.js';
import { composeRelayPrompt, evaluateRelayCheck } from '../../shared/relay-support.js';
import {
  assertConnectorSelectionCompatibleV2,
  resolveConnectorForRelayV2,
} from '../connectors/resolver.js';
import type { StepOutcomeV2 } from '../domain/step.js';
import type { RelayStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';
import {
  recoveryRouteForExecutableStep,
  requireCompiledFlowV1,
  requireCompiledStepV1,
} from '../run/v1-compat.js';

export interface RelayRequestV2 {
  readonly runId: string;
  readonly stepId: string;
  readonly role: string;
  readonly prompt: string;
  readonly connector?: string;
}

export interface RelayConnectorV2 {
  readonly connectorName?: string;
  readonly connector?: ResolvedConnector;
  relay(request: RelayRequestV2): Promise<unknown>;
}

export function createStubRelayConnectorV2(response: unknown = { ok: true }): RelayConnectorV2 {
  return {
    async relay() {
      return response;
    },
  };
}

function builtinConnector(name: string): ResolvedConnector | undefined {
  if (name === 'claude-code' || name === 'codex') {
    return { kind: 'builtin', name };
  }
  return undefined;
}

function resolvedConnectorName(connector: ResolvedConnector | undefined): string | undefined {
  return connector?.name;
}

function configLayerConnector(
  name: string,
  configLayers: Parameters<typeof resolveConnectorForRelayV2>[0]['configLayers'],
): ResolvedConnector | undefined {
  let descriptor: ResolvedConnector | undefined;
  for (const layer of configLayers ?? []) {
    descriptor = layer.config.relay.connectors[name] ?? descriptor;
  }
  return descriptor;
}

function requestedConnectorForRelay(input: {
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnectorV2;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelayV2>[0]['configLayers'];
}): ResolvedConnector | undefined {
  const suppliedResolved = input.suppliedConnector?.connector;
  const suppliedResolvedName = resolvedConnectorName(suppliedResolved);
  const suppliedName = input.suppliedConnector?.connectorName ?? suppliedResolvedName;

  if (
    input.suppliedConnector?.connectorName !== undefined &&
    suppliedResolvedName !== undefined &&
    input.suppliedConnector.connectorName !== suppliedResolvedName
  ) {
    throw new Error(
      `relay connector identity mismatch: connectorName '${input.suppliedConnector.connectorName}' does not match resolved connector '${suppliedResolvedName}'`,
    );
  }

  if (
    input.stepConnector !== undefined &&
    suppliedName !== undefined &&
    input.stepConnector !== suppliedName
  ) {
    throw new Error(
      `relay connector identity mismatch: step requests '${input.stepConnector}' but supplied connector is '${suppliedName}'`,
    );
  }

  const requested = input.stepConnector ?? suppliedName;
  if (requested === undefined) return undefined;

  const builtin = builtinConnector(requested);
  if (builtin !== undefined) return builtin;

  if (suppliedResolved !== undefined && suppliedResolved.name === requested) {
    return suppliedResolved;
  }

  const configured = configLayerConnector(requested, input.configLayers);
  if (configured !== undefined) return configured;

  throw new Error(
    `relay connector '${requested}' requires resolved connector capabilities before execution`,
  );
}

function selectionForCompatibility(selection: unknown) {
  if (selection === undefined) return undefined;
  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return undefined;
  }
  const selectionRecord = selection as {
    readonly model?: unknown;
    readonly effort?: unknown;
  };
  return ResolvedSelection.parse({
    ...(selectionRecord.model === undefined ? {} : { model: selectionRecord.model }),
    ...(selectionRecord.effort === undefined ? {} : { effort: selectionRecord.effort }),
    skills: [],
    invocation_options: {},
  });
}

export function resolveRelayExecutionV2(input: {
  readonly flowId: string;
  readonly role: string;
  readonly selection?: unknown;
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnectorV2;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelayV2>[0]['configLayers'];
}): {
  readonly role: string;
  readonly connectorName: string;
  readonly connector: ResolvedConnector;
} {
  const role = RelayRole.parse(input.role);
  const explicitConnector = requestedConnectorForRelay({
    ...(input.stepConnector === undefined ? {} : { stepConnector: input.stepConnector }),
    ...(input.suppliedConnector === undefined
      ? {}
      : { suppliedConnector: input.suppliedConnector }),
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
  });
  const resolved = resolveConnectorForRelayV2({
    flowId: input.flowId,
    role,
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
    ...(explicitConnector === undefined ? {} : { explicitConnector }),
  });
  const resolvedConnector = resolved.connector;
  assertConnectorSelectionCompatibleV2(
    resolvedConnector.name,
    selectionForCompatibility(input.selection),
  );
  return { role, connectorName: resolvedConnector.name, connector: resolvedConnector };
}

export async function relayWithResolvedConnectorV2(
  connector: ResolvedConnector,
  input: {
    readonly prompt: string;
    readonly timeoutMs?: number;
    readonly resolvedSelection?: unknown;
  },
): Promise<RelayResult> {
  const relayInput = {
    prompt: input.prompt,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.resolvedSelection === undefined
      ? {}
      : { resolvedSelection: ResolvedSelection.parse(input.resolvedSelection) }),
  };
  if (connector.kind === 'builtin' && connector.name === 'claude-code') {
    return relayClaudeCode(relayInput);
  }
  if (connector.kind === 'builtin' && connector.name === 'codex') {
    return relayCodex(relayInput);
  }
  if (connector.kind === 'custom') {
    return relayCustom({ ...relayInput, descriptor: connector });
  }
  throw new Error(`unsupported relay connector '${connector.name}'`);
}

function timeoutMs(step: RelayStepV2): number | undefined {
  const wallClock = (step.budgets as { readonly wall_clock_ms?: unknown } | undefined)
    ?.wall_clock_ms;
  return typeof wallClock === 'number' ? wallClock : undefined;
}

function suppliedConnectorFromRelayer(context: RunContextV2): RelayConnectorV2 | undefined {
  if (context.relayer === undefined) return undefined;
  return {
    connectorName: context.relayer.connectorName,
    ...(context.relayer.connector === undefined ? {} : { connector: context.relayer.connector }),
    async relay() {
      throw new Error('relay identity placeholder should not be invoked');
    },
  };
}

export async function executeRelayV2(
  step: RelayStepV2,
  context: RunContextV2,
  connector?: RelayConnectorV2,
): Promise<StepOutcomeV2> {
  if (connector === undefined && context.compiledFlowV1 !== undefined) {
    return executeProductionRelayV2(step, context);
  }
  const suppliedConnector = connector ?? createStubRelayConnectorV2();
  const relayExecution = resolveRelayExecutionV2({
    flowId: context.flow.id,
    role: step.role,
    suppliedConnector,
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.connector === undefined ? {} : { stepConnector: step.connector }),
  });

  const request: RelayRequestV2 = {
    runId: context.runId,
    stepId: step.id,
    role: relayExecution.role,
    prompt: step.prompt ?? '',
    connector: relayExecution.connectorName,
  };
  const response = await suppliedConnector.relay(request);

  const writes = step.writes ?? {};
  await Promise.all(
    Object.values(writes).map((ref) =>
      context.files.writeJson(ref, {
        stepId: step.id,
        role: step.role,
        response,
      }),
    ),
  );

  return { route: 'pass', details: { role: step.role } };
}

async function executeProductionRelayV2(
  step: RelayStepV2,
  context: RunContextV2,
): Promise<StepOutcomeV2> {
  const compiledFlow = requireCompiledFlowV1(context, step);
  const compiledStep = requireCompiledStepV1(context, step, 'relay');
  const prompt = composeRelayPrompt(compiledStep, context.runDir);
  const suppliedConnector = suppliedConnectorFromRelayer(context);
  const relayExecution = resolveRelayExecutionV2({
    flowId: context.flow.id,
    role: step.role,
    ...(suppliedConnector === undefined ? {} : { suppliedConnector }),
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.connector === undefined ? {} : { stepConnector: step.connector }),
  });
  const resolvedSelection = deriveResolvedSelection(
    {
      ...(context.relayer === undefined ? {} : { relayer: context.relayer }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
    },
    compiledFlow,
    compiledStep,
    Depth.parse(context.depth ?? 'standard'),
  );
  assertConnectorSelectionCompatibleV2(relayExecution.connectorName, resolvedSelection);

  const request = step.writes?.request;
  const receipt = step.writes?.receipt;
  const result = step.writes?.result;
  if (request === undefined || receipt === undefined || result === undefined) {
    throw new Error(
      `relay step '${step.id}' requires writes.request, writes.receipt, and writes.result`,
    );
  }
  const requestPath = context.files.resolve(request);
  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, prompt, 'utf8');
  const requestPayloadHash = sha256Hex(prompt);
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.started',
    step_id: step.id,
    data: {
      connector: relayExecution.connector,
      role: step.role,
      resolved_selection: resolvedSelection,
    },
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.request',
    step_id: step.id,
    data: { request_payload_hash: requestPayloadHash },
  });

  let relayResult: RelayResult;
  try {
    const relayTimeoutMs = timeoutMs(step);
    relayResult =
      context.relayer === undefined
        ? await relayWithResolvedConnectorV2(relayExecution.connector, {
            prompt,
            ...(relayTimeoutMs === undefined ? {} : { timeoutMs: relayTimeoutMs }),
            resolvedSelection,
          })
        : await context.relayer.relay({
            prompt,
            ...(relayTimeoutMs === undefined ? {} : { timeoutMs: relayTimeoutMs }),
            resolvedSelection,
          });
  } catch (error) {
    const reason = `relay step '${step.id}': connector invocation failed (${(error as Error).message})`;
    await context.trace.append({
      run_id: context.runId,
      kind: 'relay.failed',
      step_id: step.id,
      reason,
      data: { request_payload_hash: requestPayloadHash },
    });
    const recoveryRoute = recoveryRouteForExecutableStep(step);
    if (recoveryRoute !== undefined) return { route: recoveryRoute, details: { reason } };
    throw new Error(reason);
  }

  await context.files.writeText(receipt, relayResult.receipt_id);
  await context.files.writeText(result, relayResult.result_body);
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.receipt',
    step_id: step.id,
    data: { receipt_id: relayResult.receipt_id },
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.result',
    step_id: step.id,
    data: { result_report_hash: sha256Hex(relayResult.result_body) },
  });

  const evaluation = evaluateRelayCheck(compiledStep, relayResult.result_body);
  if (evaluation.kind === 'pass' && step.report?.schema !== undefined) {
    const parseResult = parseReport(step.report.schema, relayResult.result_body);
    if (parseResult.kind === 'fail') {
      const reason = `relay step '${step.id}': ${parseResult.reason}`;
      await context.trace.append({
        run_id: context.runId,
        kind: 'check.evaluated',
        step_id: step.id,
        check_kind: 'result_verdict',
        outcome: 'fail',
        reason,
      });
      const recoveryRoute = recoveryRouteForExecutableStep(step);
      if (recoveryRoute !== undefined) return { route: recoveryRoute, details: { reason } };
      throw new Error(reason);
    }
    const crossResult = runCrossReportValidator(
      step.report.schema,
      compiledFlow,
      context.runDir,
      relayResult.result_body,
    );
    if (crossResult.kind === 'fail') {
      const reason = `relay step '${step.id}': ${crossResult.reason}`;
      await context.trace.append({
        run_id: context.runId,
        kind: 'check.evaluated',
        step_id: step.id,
        check_kind: 'result_verdict',
        outcome: 'fail',
        reason,
      });
      const recoveryRoute = recoveryRouteForExecutableStep(step);
      if (recoveryRoute !== undefined) return { route: recoveryRoute, details: { reason } };
      throw new Error(reason);
    }
    await context.files.writeJson(step.report, JSON.parse(relayResult.result_body) as unknown);
  }

  const relayCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? '<no-verdict>');
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.completed',
    step_id: step.id,
    verdict: relayCompletedVerdict,
    duration_ms: relayResult.duration_ms,
    result_path: result.path,
    ...(step.report === undefined ? {} : { report_path: step.report.path }),
  });

  if (evaluation.kind === 'pass') {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      check_kind: 'result_verdict',
      outcome: 'pass',
    });
    return { route: 'pass', details: { verdict: evaluation.verdict } };
  }

  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    check_kind: 'result_verdict',
    outcome: 'fail',
    reason: evaluation.reason,
  });
  const recoveryRoute = recoveryRouteForExecutableStep(step);
  if (recoveryRoute !== undefined)
    return { route: recoveryRoute, details: { reason: evaluation.reason } };
  throw new Error(evaluation.reason);
}
