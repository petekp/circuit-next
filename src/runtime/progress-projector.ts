import { readFileSync } from 'node:fs';

import type { CompiledFlow } from '../schemas/compiled-flow.js';
import {
  BUILTIN_CONNECTOR_CAPABILITIES,
  type FilesystemCapability,
  type ResolvedConnector,
} from '../schemas/connector.js';
import type { RunId } from '../schemas/ids.js';
import type {
  ProgressDisplay,
  ProgressTask,
  ProgressTaskStatus,
} from '../schemas/progress-event.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { progressDisplay, reportProgress } from '../shared/progress-output.js';
import { resolveRunRelative } from './run-relative-path.js';
import type { ProgressReporter } from './runner-types.js';
export { progressDisplay, reportProgress } from '../shared/progress-output.js';

function connectorName(connector: ResolvedConnector): string {
  return connector.name;
}

function connectorFilesystemCapability(connector: ResolvedConnector): FilesystemCapability {
  return connector.kind === 'builtin'
    ? BUILTIN_CONNECTOR_CAPABILITIES[connector.name].filesystem
    : connector.capabilities.filesystem;
}

function progressStepTitle(flow: CompiledFlow, stepId: unknown): string {
  const step = flow.steps.find((candidate) => candidate.id === stepId);
  return step?.title ?? String(stepId);
}

function readJsonReport(runFolder: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runFolder, path), 'utf8')) as unknown;
}

function progressTasks(
  flow: CompiledFlow,
  statuses: ReadonlyMap<string, ProgressTaskStatus>,
): ProgressTask[] {
  return flow.steps.map((step) => {
    const id = step.id as unknown as string;
    return {
      id,
      title: step.title,
      status: statuses.get(id) ?? 'pending',
    };
  });
}

export function taskStatusesFromTrace(
  flow: CompiledFlow,
  traceEntries: readonly TraceEntry[],
  startStepId: string | undefined,
): Map<string, ProgressTaskStatus> {
  const statuses = new Map<string, ProgressTaskStatus>(
    flow.steps.map((step) => [step.id as unknown as string, 'pending'] as const),
  );
  for (const traceEntry of traceEntries) {
    if (traceEntry.kind === 'step.entered') {
      const id = traceEntry.step_id as unknown as string;
      if (statuses.get(id) !== 'completed' && statuses.get(id) !== 'failed') {
        statuses.set(id, 'in_progress');
      }
    }
    if (traceEntry.kind === 'step.completed') {
      statuses.set(traceEntry.step_id as unknown as string, 'completed');
    }
    if (traceEntry.kind === 'step.aborted') {
      statuses.set(traceEntry.step_id as unknown as string, 'failed');
    }
  }
  if (startStepId !== undefined && statuses.get(startStepId) !== 'completed') {
    statuses.set(startStepId, 'in_progress');
  }
  return statuses;
}

export function reportTaskListProgress(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runId: RunId;
  readonly flow: CompiledFlow;
  readonly recordedAt: string;
  readonly statuses: ReadonlyMap<string, ProgressTaskStatus>;
  readonly label: string;
  readonly displayText: string;
  readonly tone?: ProgressDisplay['tone'];
}): void {
  reportProgress(input.progress, {
    schema_version: 1,
    type: 'task_list.updated',
    run_id: input.runId,
    flow_id: input.flow.id,
    recorded_at: input.recordedAt,
    label: input.label,
    display: progressDisplay(input.displayText, 'detail', input.tone ?? 'info'),
    tasks: progressTasks(input.flow, input.statuses),
  });
}

function warningRecordsFromReport(body: unknown): Array<{
  readonly kind: string;
  readonly message: string;
  readonly path?: string;
}> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return [];
  const raw = (body as Record<string, unknown>).evidence_warnings;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.kind !== 'string' || typeof record.message !== 'string') return [];
    return [
      {
        kind: record.kind,
        message: record.message,
        ...(typeof record.path === 'string' ? { path: record.path } : {}),
      },
    ];
  });
}

function reportEvidenceProgress(input: {
  readonly progress?: ProgressReporter;
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly runId: RunId;
  readonly recordedAt: string;
  readonly traceEntry: Extract<TraceEntry, { kind: 'step.report_written' }>;
}): void {
  let body: unknown;
  try {
    body = readJsonReport(input.runFolder, input.traceEntry.report_path);
  } catch {
    return;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return;
  const record = body as Record<string, unknown>;
  const hasEvidence = Object.hasOwn(record, 'evidence');
  const warnings = warningRecordsFromReport(record);
  if (!hasEvidence && warnings.length === 0) return;

  reportProgress(input.progress, {
    schema_version: 1,
    type: 'evidence.collected',
    run_id: input.runId,
    flow_id: input.flow.id,
    recorded_at: input.recordedAt,
    label: warnings.length > 0 ? 'Collected evidence with warnings' : 'Collected evidence',
    display: progressDisplay(
      warnings.length > 0
        ? `Circuit collected evidence with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`
        : 'Circuit collected evidence.',
      'major',
      warnings.length > 0 ? 'warning' : 'info',
    ),
    step_id: input.traceEntry.step_id,
    report_path: input.traceEntry.report_path,
    report_schema: input.traceEntry.report_schema,
    warning_count: warnings.length,
  });
  for (const warning of warnings) {
    reportProgress(input.progress, {
      schema_version: 1,
      type: 'evidence.warning',
      run_id: input.runId,
      flow_id: input.flow.id,
      recorded_at: input.recordedAt,
      label: 'Evidence warning',
      display: progressDisplay(`Circuit evidence warning: ${warning.message}`, 'major', 'warning'),
      step_id: input.traceEntry.step_id,
      report_path: input.traceEntry.report_path,
      warning_kind: warning.kind,
      message: warning.message,
      ...(warning.path === undefined ? {} : { path: warning.path }),
    });
  }
}

export function projectTraceEntryToProgress(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly runId: RunId;
  readonly taskStatuses: Map<string, ProgressTaskStatus>;
  readonly traceEntry: TraceEntry;
}): void {
  const { flow, progress, runFolder, runId, taskStatuses, traceEntry } = input;

  switch (traceEntry.kind) {
    case 'step.entered':
      taskStatuses.set(traceEntry.step_id as unknown as string, 'in_progress');
      reportProgress(progress, {
        schema_version: 1,
        type: 'step.started',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: traceEntry.recorded_at,
        label: progressStepTitle(flow, traceEntry.step_id),
        display: progressDisplay(
          `Circuit started ${progressStepTitle(flow, traceEntry.step_id)}.`,
          'major',
          'info',
        ),
        step_id: traceEntry.step_id,
        step_title: progressStepTitle(flow, traceEntry.step_id),
        attempt: traceEntry.attempt,
      });
      reportTaskListProgress({
        progress,
        runId,
        flow,
        recordedAt: traceEntry.recorded_at,
        statuses: taskStatuses,
        label: `${progressStepTitle(flow, traceEntry.step_id)} in progress`,
        displayText: `Circuit is working on ${progressStepTitle(flow, traceEntry.step_id)}.`,
      });
      break;
    case 'step.report_written':
      reportEvidenceProgress({
        runFolder,
        flow,
        runId,
        recordedAt: traceEntry.recorded_at,
        traceEntry,
        ...(progress === undefined ? {} : { progress }),
      });
      break;
    case 'relay.started':
      reportProgress(progress, {
        schema_version: 1,
        type: 'relay.started',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: traceEntry.recorded_at,
        label: `Running ${traceEntry.role} relay with ${connectorName(traceEntry.connector)}`,
        display: progressDisplay(
          `Circuit is running the ${traceEntry.role} relay with ${connectorName(traceEntry.connector)} (${connectorFilesystemCapability(traceEntry.connector)}).`,
          'major',
          'info',
        ),
        step_id: traceEntry.step_id,
        step_title: progressStepTitle(flow, traceEntry.step_id),
        attempt: traceEntry.attempt,
        role: traceEntry.role,
        connector_name: connectorName(traceEntry.connector),
        connector_kind: traceEntry.connector.kind,
        filesystem_capability: connectorFilesystemCapability(traceEntry.connector),
      });
      break;
    case 'relay.completed':
      reportProgress(progress, {
        schema_version: 1,
        type: 'relay.completed',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: traceEntry.recorded_at,
        label: `Relay completed with ${traceEntry.verdict}`,
        display: progressDisplay(
          `Circuit relay completed with ${traceEntry.verdict}.`,
          'major',
          'success',
        ),
        step_id: traceEntry.step_id,
        step_title: progressStepTitle(flow, traceEntry.step_id),
        attempt: traceEntry.attempt,
        verdict: traceEntry.verdict,
        duration_ms: traceEntry.duration_ms,
      });
      break;
    case 'step.completed':
      taskStatuses.set(traceEntry.step_id as unknown as string, 'completed');
      reportProgress(progress, {
        schema_version: 1,
        type: 'step.completed',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: traceEntry.recorded_at,
        label: `Completed ${progressStepTitle(flow, traceEntry.step_id)}`,
        display: progressDisplay(
          `Circuit completed ${progressStepTitle(flow, traceEntry.step_id)}.`,
          'detail',
          'success',
        ),
        step_id: traceEntry.step_id,
        step_title: progressStepTitle(flow, traceEntry.step_id),
        attempt: traceEntry.attempt,
        route_taken: traceEntry.route_taken,
      });
      reportTaskListProgress({
        progress,
        runId,
        flow,
        recordedAt: traceEntry.recorded_at,
        statuses: taskStatuses,
        label: `${progressStepTitle(flow, traceEntry.step_id)} completed`,
        displayText: `Circuit finished ${progressStepTitle(flow, traceEntry.step_id)}.`,
        tone: 'success',
      });
      break;
    case 'step.aborted':
      taskStatuses.set(traceEntry.step_id as unknown as string, 'failed');
      reportProgress(progress, {
        schema_version: 1,
        type: 'step.aborted',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: traceEntry.recorded_at,
        label: `Aborted ${progressStepTitle(flow, traceEntry.step_id)}`,
        display: progressDisplay(
          `Circuit aborted ${progressStepTitle(flow, traceEntry.step_id)}: ${traceEntry.reason}`,
          'major',
          'error',
        ),
        step_id: traceEntry.step_id,
        step_title: progressStepTitle(flow, traceEntry.step_id),
        attempt: traceEntry.attempt,
        reason: traceEntry.reason,
      });
      reportTaskListProgress({
        progress,
        runId,
        flow,
        recordedAt: traceEntry.recorded_at,
        statuses: taskStatuses,
        label: `${progressStepTitle(flow, traceEntry.step_id)} failed`,
        displayText: `Circuit marked ${progressStepTitle(flow, traceEntry.step_id)} as failed.`,
        tone: 'error',
      });
      break;
  }
}
