import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompiledFlow } from '../schemas/compiled-flow.js';
import { RunStatusProjectionV1 } from '../schemas/run-status.js';
import type { verifyManifestSnapshotBytes } from '../shared/manifest-snapshot.js';
import {
  errorMessage,
  invalidProjection,
  optionalReportPaths,
  readSavedFlowForProjection,
  stepMetadata,
} from './projection-common.js';

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

export function projectV2RunStatusFromRunFolder(
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
