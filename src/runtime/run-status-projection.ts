import { constants, accessSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { LayeredConfig } from '../schemas/config.js';
import type { EngineErrorCodeV1, RunStatusInvalidReason } from '../schemas/run-status.js';
import { RunStatusProjectionV1 } from '../schemas/run-status.js';
import type { RunTrace } from '../schemas/run.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { sha256Hex } from '../shared/connector-relay.js';
import { verifyManifestSnapshotBytes } from '../shared/manifest-snapshot.js';
import { reduce } from './reducer.js';
import { findCheckpointBriefBuilder } from './registries/checkpoint-writers/registry.js';
import { resultPath } from './result-writer.js';
import { resolveRunRelative } from './run-relative-path.js';
import { readRunTrace } from './trace-reader.js';

export class RunStatusFolderError extends Error {
  readonly code: Extract<EngineErrorCodeV1, 'folder_not_found' | 'folder_unreadable'>;
  readonly runFolder: string;

  constructor(
    code: Extract<EngineErrorCodeV1, 'folder_not_found' | 'folder_unreadable'>,
    runFolder: string,
    message: string,
  ) {
    super(message);
    this.name = 'RunStatusFolderError';
    this.code = code;
    this.runFolder = runFolder;
  }
}

const CheckpointRequestProjection = z
  .object({
    schema_version: z.literal(1),
    step_id: z.string().min(1),
    prompt: z.string().min(1).optional(),
    allowed_choices: z.array(z.string().min(1)).min(1),
    execution_context: z
      .object({
        project_root: z.string().optional(),
        selection_config_layers: z.array(z.unknown()).optional(),
        checkpoint_report_sha256: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

type CheckpointRequestProjection = z.infer<typeof CheckpointRequestProjection>;
type BootstrapTraceEntry = Extract<TraceEntry, { kind: 'run.bootstrapped' }>;
type CheckpointRequestedTraceEntry = Extract<TraceEntry, { kind: 'checkpoint.requested' }>;
type CheckpointStep = CompiledFlow['steps'][number] & { readonly kind: 'checkpoint' };
type SavedFlowProjection =
  | { readonly kind: 'available'; readonly flow: CompiledFlow }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'identity_mismatch'; readonly parsedFlowId: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function invalidProjection(input: {
  readonly runFolder: string;
  readonly reason: RunStatusInvalidReason;
  readonly code: string;
  readonly message: string;
  readonly bootstrap?: BootstrapTraceEntry;
  readonly manifestIdentity?: { readonly run_id: string; readonly flow_id: string };
}): RunStatusProjectionV1 {
  return RunStatusProjectionV1.parse({
    api_version: 'run-status-v1',
    schema_version: 1,
    run_folder: input.runFolder,
    engine_state: 'invalid',
    reason: input.reason,
    legal_next_actions: ['none'],
    error: {
      code: input.code,
      message: input.message,
    },
    ...(input.bootstrap === undefined ? {} : { goal: input.bootstrap.goal }),
    ...(input.manifestIdentity === undefined
      ? input.bootstrap === undefined
        ? {}
        : { run_id: input.bootstrap.run_id, flow_id: input.bootstrap.flow_id }
      : { run_id: input.manifestIdentity.run_id, flow_id: input.manifestIdentity.flow_id }),
  });
}

function assertReadableRunFolder(runFolder: string): void {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(runFolder);
  } catch (err) {
    const nodeCode = (err as NodeJS.ErrnoException).code;
    if (nodeCode === 'ENOENT' || nodeCode === 'ENOTDIR') {
      throw new RunStatusFolderError(
        'folder_not_found',
        runFolder,
        `run folder does not exist: ${runFolder}`,
      );
    }
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is unreadable: ${runFolder} (${errorMessage(err)})`,
    );
  }

  if (!stat.isDirectory()) {
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is not a directory: ${runFolder}`,
    );
  }

  try {
    // Directory execute permission is required to read files inside it.
    accessSync(runFolder, constants.R_OK | constants.X_OK);
  } catch (err) {
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is unreadable: ${runFolder} (${errorMessage(err)})`,
    );
  }
}

function readSavedFlowForProjection(
  manifestBytesBase64: string,
  manifestFlowId: string,
): SavedFlowProjection {
  try {
    const text = Buffer.from(manifestBytesBase64, 'base64').toString('utf8');
    const flow = CompiledFlow.parse(JSON.parse(text));
    const parsedFlowId = flow.id as unknown as string;
    if (parsedFlowId !== manifestFlowId) {
      return { kind: 'identity_mismatch', parsedFlowId };
    }
    return { kind: 'available', flow };
  } catch {
    return { kind: 'unavailable' };
  }
}

function optionalReportPaths(runFolder: string): {
  readonly result_path?: string;
  readonly operator_summary_path?: string;
  readonly operator_summary_markdown_path?: string;
} {
  const result = resultPath(runFolder);
  const operatorSummary = join(runFolder, 'reports', 'operator-summary.json');
  const operatorSummaryMarkdown = join(runFolder, 'reports', 'operator-summary.md');
  return {
    ...(existsSync(result) ? { result_path: result } : {}),
    ...(existsSync(operatorSummary) ? { operator_summary_path: operatorSummary } : {}),
    ...(existsSync(operatorSummaryMarkdown)
      ? { operator_summary_markdown_path: operatorSummaryMarkdown }
      : {}),
  };
}

function lastEvent(log: RunTrace): {
  readonly sequence: number;
  readonly type: string;
  readonly timestamp: string;
} {
  const entry = log[log.length - 1];
  if (entry === undefined) {
    throw new Error('validated RunTrace unexpectedly had no final trace_entry');
  }
  return {
    sequence: entry.sequence,
    type: entry.kind,
    timestamp: entry.recorded_at,
  };
}

type RawTraceEntry = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readRawTraceEntries(runFolder: string): RawTraceEntry[] {
  const tracePath = join(runFolder, 'trace.ndjson');
  const text = readFileSync(tracePath, 'utf8');
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split('\n').map((line) => {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('trace entry is not a JSON object');
    }
    return parsed;
  });
}

function traceString(entry: RawTraceEntry, key: string): string | undefined {
  const value = entry[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function traceNumber(entry: RawTraceEntry, key: string): number | undefined {
  const value = entry[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function traceDataString(entry: RawTraceEntry, key: string): string | undefined {
  const data = entry.data;
  if (!isRecord(data)) return undefined;
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function v2TraceString(entry: RawTraceEntry, key: string): string | undefined {
  return traceString(entry, key) ?? traceDataString(entry, key);
}

function isV2Trace(log: readonly RawTraceEntry[]): boolean {
  const bootstrap = log[0];
  return (
    bootstrap !== undefined &&
    bootstrap.kind === 'run.bootstrapped' &&
    v2TraceString(bootstrap, 'engine') === 'core-v2' &&
    v2TraceString(bootstrap, 'manifest_hash') !== undefined
  );
}

function v2LastEvent(log: readonly RawTraceEntry[]): {
  readonly sequence: number;
  readonly type: string;
  readonly timestamp: string;
} {
  const entry = log[log.length - 1];
  if (entry === undefined) {
    throw new Error('v2 trace unexpectedly had no final trace entry');
  }
  const sequence = traceNumber(entry, 'sequence');
  const kind = traceString(entry, 'kind');
  const recordedAt = traceString(entry, 'recorded_at');
  if (sequence === undefined || kind === undefined || recordedAt === undefined) {
    throw new Error('v2 trace final event is missing sequence, kind, or recorded_at');
  }
  return {
    sequence,
    type: kind,
    timestamp: recordedAt,
  };
}

function v2RunOutcome(
  entry: RawTraceEntry,
): 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated' | undefined {
  const outcome = v2TraceString(entry, 'outcome');
  if (
    outcome === 'complete' ||
    outcome === 'aborted' ||
    outcome === 'handoff' ||
    outcome === 'stopped' ||
    outcome === 'escalated'
  ) {
    return outcome;
  }
  return undefined;
}

function v2CurrentStepProjection(
  log: readonly RawTraceEntry[],
  flow: CompiledFlow | undefined,
):
  | {
      readonly step_id: string;
      readonly attempt?: number;
      readonly stage_id?: string;
      readonly label?: string;
    }
  | undefined {
  const completed = new Set<string>();
  for (const entry of log) {
    if (entry.kind !== 'step.completed' && entry.kind !== 'step.aborted') continue;
    const stepId = traceString(entry, 'step_id');
    const attempt = traceNumber(entry, 'attempt');
    if (stepId !== undefined && attempt !== undefined) completed.add(`${stepId}:${attempt}`);
  }
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === undefined || entry.kind !== 'step.entered') continue;
    const stepId = traceString(entry, 'step_id');
    const attempt = traceNumber(entry, 'attempt');
    if (stepId === undefined || attempt === undefined || completed.has(`${stepId}:${attempt}`)) {
      continue;
    }
    return {
      step_id: stepId,
      attempt,
      ...stepMetadata(flow, stepId),
    };
  }
  return undefined;
}

function projectV2RunStatusFromRunFolder(
  runFolder: string,
  manifest: ReturnType<typeof verifyManifestSnapshotBytes>,
): RunStatusProjectionV1 | undefined {
  let log: RawTraceEntry[];
  try {
    log = readRawTraceEntries(runFolder);
  } catch {
    return undefined;
  }
  if (!isV2Trace(log)) return undefined;

  const bootstrap = log[0];
  if (bootstrap === undefined) {
    return invalidProjection({
      runFolder,
      reason: 'trace_invalid',
      code: 'trace_bootstrap_missing',
      message: 'v2 trace is missing its run.bootstrapped entry',
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  const bootstrapRunId = traceString(bootstrap, 'run_id');
  const bootstrapFlowId = v2TraceString(bootstrap, 'flow_id');
  const bootstrapManifestHash = v2TraceString(bootstrap, 'manifest_hash');
  const bootstrapGoal = v2TraceString(bootstrap, 'goal');

  if (
    bootstrapRunId === undefined ||
    bootstrapFlowId === undefined ||
    bootstrapManifestHash === undefined ||
    bootstrapGoal === undefined
  ) {
    return invalidProjection({
      runFolder,
      reason: 'trace_invalid',
      code: 'trace_bootstrap_incomplete',
      message: 'v2 trace run.bootstrapped entry is missing identity or goal fields',
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  if (
    bootstrapRunId !== (manifest.run_id as unknown as string) ||
    bootstrapFlowId !== (manifest.flow_id as unknown as string) ||
    bootstrapManifestHash !== manifest.hash
  ) {
    return invalidProjection({
      runFolder,
      reason: 'identity_mismatch',
      code: 'identity_mismatch',
      message: 'manifest snapshot does not match the v2 bootstrapped trace identity',
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  const savedFlow = readSavedFlowForProjection(
    manifest.bytes_base64,
    manifest.flow_id as unknown as string,
  );
  const flow = savedFlow.kind === 'available' ? savedFlow.flow : undefined;
  const reportPaths = optionalReportPaths(runFolder);
  let event: ReturnType<typeof v2LastEvent>;
  try {
    event = v2LastEvent(log);
  } catch (err) {
    return invalidProjection({
      runFolder,
      reason: 'trace_invalid',
      code: 'trace_last_event_invalid',
      message: `v2 trace final event is invalid (${errorMessage(err)})`,
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  const terminal = log[log.length - 1];
  if (terminal?.kind === 'run.closed') {
    const outcome = v2RunOutcome(terminal);
    if (outcome === undefined) {
      return invalidProjection({
        runFolder,
        reason: 'trace_invalid',
        code: 'trace_terminal_outcome_invalid',
        message: 'v2 run.closed trace entry is missing a valid outcome',
        manifestIdentity: {
          run_id: manifest.run_id as unknown as string,
          flow_id: manifest.flow_id as unknown as string,
        },
      });
    }
    const base = {
      api_version: 'run-status-v1' as const,
      schema_version: 1 as const,
      run_folder: runFolder,
      run_id: bootstrapRunId,
      flow_id: bootstrapFlowId,
      goal: bootstrapGoal,
      reason: 'run_closed' as const,
      legal_next_actions: ['inspect'] as const,
      terminal_outcome: outcome,
      last_event: event,
      ...reportPaths,
    };
    return RunStatusProjectionV1.parse(
      outcome === 'aborted'
        ? { ...base, engine_state: 'aborted' as const }
        : { ...base, engine_state: 'completed' as const },
    );
  }

  return RunStatusProjectionV1.parse({
    api_version: 'run-status-v1',
    schema_version: 1,
    run_folder: runFolder,
    engine_state: 'open',
    reason: 'active_or_unknown',
    legal_next_actions: ['inspect'],
    run_id: bootstrapRunId,
    flow_id: bootstrapFlowId,
    goal: bootstrapGoal,
    current_step: v2CurrentStepProjection(log, flow),
    last_event: event,
    ...reportPaths,
  });
}

function stepMetadata(
  flow: CompiledFlow | undefined,
  stepId: string,
): {
  readonly stage_id?: string;
  readonly label?: string;
} {
  if (flow === undefined) return {};
  const step = flow.steps.find((candidate) => (candidate.id as unknown as string) === stepId);
  const stage = flow.stages.find((candidate) =>
    candidate.steps.some((candidateStepId) => (candidateStepId as unknown as string) === stepId),
  );
  return {
    ...(stage === undefined ? {} : { stage_id: stage.id as unknown as string }),
    ...(step === undefined ? {} : { label: step.title }),
  };
}

function currentStepProjection(
  snapshot: Snapshot,
  log: RunTrace,
  flow: CompiledFlow | undefined,
):
  | {
      readonly step_id: string;
      readonly attempt?: number;
      readonly stage_id?: string;
      readonly label?: string;
    }
  | undefined {
  if (snapshot.current_step === undefined) return undefined;
  const stepId = snapshot.current_step as unknown as string;
  const attempt = latestAttemptForStep(log, stepId);
  return {
    step_id: stepId,
    ...(attempt === undefined ? {} : { attempt }),
    ...stepMetadata(flow, stepId),
  };
}

function latestAttemptForStep(log: RunTrace, stepId: string): number | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === undefined || !('step_id' in entry) || !('attempt' in entry)) continue;
    if ((entry.step_id as unknown as string) !== stepId) continue;
    return entry.attempt;
  }
  return undefined;
}

function findNewestUnresolvedCheckpoint(log: RunTrace): CheckpointRequestedTraceEntry | undefined {
  const resolved = new Set<string>();
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === undefined) continue;
    if (entry.kind === 'checkpoint.resolved') {
      resolved.add(`${entry.step_id as unknown as string}:${entry.attempt}`);
      continue;
    }
    if (entry.kind !== 'checkpoint.requested') continue;
    const key = `${entry.step_id as unknown as string}:${entry.attempt}`;
    if (!resolved.has(key)) return entry;
  }
  return undefined;
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function checkpointInvalid(
  runFolder: string,
  bootstrap: BootstrapTraceEntry,
  code: string,
  message: string,
): RunStatusProjectionV1 {
  return invalidProjection({
    runFolder,
    reason: 'checkpoint_invalid',
    code,
    message,
    bootstrap,
  });
}

function validateCheckpointRequest(input: {
  readonly runFolder: string;
  readonly bootstrap: BootstrapTraceEntry;
  readonly snapshot: Snapshot;
  readonly flow: CompiledFlow | undefined;
  readonly requested: CheckpointRequestedTraceEntry;
}):
  | {
      readonly ok: true;
      readonly checkpoint: {
        readonly checkpoint_id: string;
        readonly step_id: string;
        readonly attempt: number;
        readonly prompt?: string;
        readonly choices: readonly {
          readonly id: string;
          readonly label: string;
          readonly value: string;
        }[];
        readonly request_path?: string;
      };
    }
  | { readonly ok: false; readonly projection: RunStatusProjectionV1 } {
  const stepId = input.requested.step_id as unknown as string;
  if (input.snapshot.current_step === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_snapshot_missing_current_step',
        `checkpoint '${stepId}' is waiting but the derived snapshot has no current step`,
      ),
    };
  }
  if ((input.snapshot.current_step as unknown as string) !== stepId) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_snapshot_mismatch',
        `checkpoint '${stepId}' is waiting but the derived snapshot current step is '${input.snapshot.current_step as unknown as string}'`,
      ),
    };
  }
  if (input.flow === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_flow_unreadable',
        `checkpoint '${stepId}' cannot be resumed because the saved flow manifest bytes cannot be parsed`,
      ),
    };
  }

  const step = input.flow.steps.find(
    (candidate): candidate is CheckpointStep =>
      (candidate.id as unknown as string) === stepId && candidate.kind === 'checkpoint',
  );
  if (step === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_step_missing',
        `checkpoint '${stepId}' is not a checkpoint step in the saved flow`,
      ),
    };
  }

  let requestAbs: string;
  let requestText: string;
  let request: CheckpointRequestProjection;
  try {
    if (input.requested.request_path !== step.writes.request) {
      throw new Error(
        `checkpoint request path '${input.requested.request_path}' differs from saved flow path '${step.writes.request}'`,
      );
    }
    requestAbs = resolveRunRelative(input.runFolder, step.writes.request);
    requestText = readFileSync(requestAbs, 'utf8');
    const observedHash = sha256Hex(requestText);
    if (observedHash !== input.requested.request_report_hash) {
      throw new Error('checkpoint request hash differs from trace');
    }
    request = CheckpointRequestProjection.parse(JSON.parse(requestText));
  } catch (err) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_request_invalid',
        `checkpoint '${stepId}' request file is missing or corrupt (${errorMessage(err)})`,
      ),
    };
  }

  if (request.step_id !== stepId) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_request_stale',
        `checkpoint '${stepId}' request file belongs to '${request.step_id}'`,
      ),
    };
  }
  if (!arrayEquals(request.allowed_choices, input.requested.options)) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_choices_mismatch',
        `checkpoint '${stepId}' request choices differ from trace choices`,
      ),
    };
  }
  try {
    LayeredConfig.array().parse(request.execution_context.selection_config_layers ?? []);
  } catch (err) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_context_invalid',
        `checkpoint '${stepId}' execution context is invalid (${errorMessage(err)})`,
      ),
    };
  }

  const disallowedChoice = request.allowed_choices.find(
    (choice) => !step.check.allow.includes(choice),
  );
  if (disallowedChoice !== undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_choice_not_allowed',
        `checkpoint '${stepId}' choice '${disallowedChoice}' is not allowed by the saved flow`,
      ),
    };
  }

  const report = step.writes.report;
  const reportHash = request.execution_context.checkpoint_report_sha256;
  if (report !== undefined && reportHash !== undefined) {
    const builder = findCheckpointBriefBuilder(report.schema);
    if (builder?.validateResumeContext === undefined) {
      return {
        ok: false,
        projection: checkpointInvalid(
          input.runFolder,
          input.bootstrap,
          'checkpoint_report_validator_missing',
          `checkpoint '${stepId}' report '${report.schema}' has no resume validator`,
        ),
      };
    }
    try {
      builder.validateResumeContext({
        runFolder: input.runFolder,
        step,
        reportPath: report.path,
        reportSha256: reportHash,
      });
    } catch (err) {
      return {
        ok: false,
        projection: checkpointInvalid(
          input.runFolder,
          input.bootstrap,
          'checkpoint_report_invalid',
          `checkpoint '${stepId}' report is missing or corrupt (${errorMessage(err)})`,
        ),
      };
    }
  }

  const labels = new Map(
    step.policy.choices.map((choice) => [choice.id, choice.label ?? choice.id] as const),
  );
  return {
    ok: true,
    checkpoint: {
      checkpoint_id: `${stepId}:${input.requested.attempt}`,
      step_id: stepId,
      attempt: input.requested.attempt,
      ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
      choices: request.allowed_choices.map((choice) => ({
        id: choice,
        label: labels.get(choice) ?? choice,
        value: choice,
      })),
      request_path: requestAbs,
    },
  };
}

export function projectRunStatusFromRunFolder(runFolder: string): RunStatusProjectionV1 {
  const resolvedRunFolder = resolve(runFolder);
  assertReadableRunFolder(resolvedRunFolder);

  let manifest: ReturnType<typeof verifyManifestSnapshotBytes>;
  try {
    manifest = verifyManifestSnapshotBytes(resolvedRunFolder);
  } catch (err) {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'manifest_invalid',
      code: 'manifest_invalid',
      message: `manifest snapshot is missing or invalid (${errorMessage(err)})`,
    });
  }

  let log: RunTrace;
  try {
    log = readRunTrace(resolvedRunFolder);
  } catch (err) {
    const v2Projection = projectV2RunStatusFromRunFolder(resolvedRunFolder, manifest);
    if (v2Projection !== undefined) return v2Projection;
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'trace_invalid',
      code: 'trace_invalid',
      message: `trace is missing or invalid (${errorMessage(err)})`,
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  const bootstrap = log[0];
  if (bootstrap === undefined || bootstrap.kind !== 'run.bootstrapped') {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'trace_invalid',
      code: 'trace_bootstrap_missing',
      message: 'trace is missing its run.bootstrapped entry',
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
    });
  }

  if (
    bootstrap.run_id !== manifest.run_id ||
    bootstrap.flow_id !== manifest.flow_id ||
    bootstrap.manifest_hash !== manifest.hash
  ) {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'identity_mismatch',
      code: 'identity_mismatch',
      message: 'manifest snapshot does not match the bootstrapped trace identity',
      manifestIdentity: {
        run_id: manifest.run_id as unknown as string,
        flow_id: manifest.flow_id as unknown as string,
      },
      bootstrap,
    });
  }

  let snapshot: Snapshot;
  try {
    snapshot = reduce(log);
  } catch (err) {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'unknown',
      code: 'projection_reduce_failed',
      message: `trace could not be reduced (${errorMessage(err)})`,
      bootstrap,
    });
  }

  const savedFlow = readSavedFlowForProjection(
    manifest.bytes_base64,
    manifest.flow_id as unknown as string,
  );
  const flow = savedFlow.kind === 'available' ? savedFlow.flow : undefined;
  const reportPaths = optionalReportPaths(resolvedRunFolder);
  const event = lastEvent(log);
  const terminal = log[log.length - 1];
  if (terminal?.kind === 'run.closed') {
    const base = {
      api_version: 'run-status-v1' as const,
      schema_version: 1 as const,
      run_folder: resolvedRunFolder,
      run_id: bootstrap.run_id,
      flow_id: bootstrap.flow_id,
      goal: bootstrap.goal,
      reason: 'run_closed' as const,
      legal_next_actions: ['inspect'] as const,
      terminal_outcome: terminal.outcome,
      last_event: event,
      ...reportPaths,
    };
    return RunStatusProjectionV1.parse(
      terminal.outcome === 'aborted'
        ? { ...base, engine_state: 'aborted' as const }
        : { ...base, engine_state: 'completed' as const },
    );
  }

  const waiting = findNewestUnresolvedCheckpoint(log);
  if (waiting !== undefined) {
    if (savedFlow.kind === 'identity_mismatch') {
      return invalidProjection({
        runFolder: resolvedRunFolder,
        reason: 'identity_mismatch',
        code: 'flow_identity_mismatch',
        message: `manifest flow_id '${manifest.flow_id as unknown as string}' does not match saved flow bytes '${savedFlow.parsedFlowId}'`,
        manifestIdentity: {
          run_id: manifest.run_id as unknown as string,
          flow_id: manifest.flow_id as unknown as string,
        },
        bootstrap,
      });
    }
    const projectedCheckpoint = validateCheckpointRequest({
      runFolder: resolvedRunFolder,
      bootstrap,
      snapshot,
      flow,
      requested: waiting,
    });
    if (!projectedCheckpoint.ok) return projectedCheckpoint.projection;
    return RunStatusProjectionV1.parse({
      api_version: 'run-status-v1',
      schema_version: 1,
      run_folder: resolvedRunFolder,
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      run_id: bootstrap.run_id,
      flow_id: bootstrap.flow_id,
      goal: bootstrap.goal,
      current_step: currentStepProjection(snapshot, log, flow),
      checkpoint: projectedCheckpoint.checkpoint,
      last_event: event,
      ...reportPaths,
    });
  }

  return RunStatusProjectionV1.parse({
    api_version: 'run-status-v1',
    schema_version: 1,
    run_folder: resolvedRunFolder,
    engine_state: 'open',
    reason: 'active_or_unknown',
    legal_next_actions: ['inspect'],
    run_id: bootstrap.run_id,
    flow_id: bootstrap.flow_id,
    goal: bootstrap.goal,
    current_step: currentStepProjection(snapshot, log, flow),
    last_event: event,
    ...reportPaths,
  });
}
