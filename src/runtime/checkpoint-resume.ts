import { readFileSync } from 'node:fs';

import { CompiledFlow } from '../schemas/compiled-flow.js';
import { LayeredConfig, type LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { sha256Hex } from '../shared/connector-relay.js';
import { resolveRunRelative } from '../shared/run-relative-path.js';
import { verifyManifestSnapshotBytes } from './manifest-snapshot-writer.js';
import { findCheckpointBriefBuilder } from './registries/checkpoint-writers/registry.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';
import { readRunTrace } from './trace-reader.js';

export interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}

type CheckpointCompiledFlowStep = CompiledFlow['steps'][number] & { kind: 'checkpoint' };

export interface PreparedCheckpointResume {
  readonly flow: CompiledFlow;
  readonly flowBytes: Buffer;
  readonly trace_entries: readonly TraceEntry[];
  readonly stepId: string;
  readonly attempt: number;
  readonly bootstrap: Extract<TraceEntry, { kind: 'run.bootstrapped' }>;
  readonly requestContext: CheckpointRequestContext;
}

function flowFromManifestBytes(bytes: Buffer): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(bytes.toString('utf8')));
}

function readCheckpointRequestContext(input: {
  readonly runFolder: string;
  readonly step: CheckpointCompiledFlowStep;
  readonly expectedRequestReportHash: string;
}): CheckpointRequestContext {
  const requestAbs = resolveRunRelative(input.runFolder, input.step.writes.request);
  const requestText = readFileSync(requestAbs, 'utf8');
  const observedRequestHash = sha256Hex(requestText);
  if (observedRequestHash !== input.expectedRequestReportHash) {
    throw new Error('checkpoint resume rejected: checkpoint request hash differs from trace');
  }
  const raw: unknown = JSON.parse(requestText);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`checkpoint resume rejected: request report for '${input.step.id}' is invalid`);
  }
  const record = raw as Record<string, unknown>;
  if (record.schema_version !== 1 || record.step_id !== input.step.id) {
    throw new Error(`checkpoint resume rejected: request report for '${input.step.id}' is stale`);
  }
  const context = record.execution_context;
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error(
      `checkpoint resume rejected: request report for '${input.step.id}' has no execution context`,
    );
  }
  const contextRecord = context as Record<string, unknown>;
  const projectRoot = contextRecord.project_root;
  if (projectRoot !== undefined && typeof projectRoot !== 'string') {
    throw new Error('checkpoint resume rejected: project_root in checkpoint request is invalid');
  }
  const selectionConfigLayers = LayeredConfig.array().parse(
    contextRecord.selection_config_layers ?? [],
  );
  const checkpointReportSha256 = contextRecord.checkpoint_report_sha256;
  if (checkpointReportSha256 !== undefined && typeof checkpointReportSha256 !== 'string') {
    throw new Error(
      'checkpoint resume rejected: checkpoint_report_sha256 in checkpoint request is invalid',
    );
  }
  return {
    ...(projectRoot === undefined ? {} : { projectRoot }),
    selectionConfigLayers,
    ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
  };
}

function readCheckpointResumeReport(input: {
  readonly runFolder: string;
  readonly step: CheckpointCompiledFlowStep;
  readonly requestContext: CheckpointRequestContext;
}): unknown {
  const report = input.step.writes.report;
  if (report === undefined) return undefined;
  const builder = findCheckpointBriefBuilder(report.schema);
  if (builder === undefined) return undefined;
  // step-handlers/checkpoint.ts stores checkpoint_report_sha256 in the
  // request iff a builder exists for the report schema. So on resume,
  // if the request carries a hash, the builder MUST own resume
  // validation. A builder that writes reports but skips
  // validateResumeContext would silently lose hash protection.
  if (builder.validateResumeContext === undefined) {
    if (input.requestContext.checkpointReportSha256 !== undefined) {
      throw new Error(
        `checkpoint resume rejected: builder for schema '${report.schema}' is missing validateResumeContext but the checkpoint request carries an report hash`,
      );
    }
    return undefined;
  }
  // Defense-in-depth: builders are expected to throw `checkpoint resume
  // rejected: ...` errors, but raw Node throws (ENOENT, SyntaxError,
  // ZodError) would surface without resume framing and confuse the
  // operator. Wrap so every error from this seam carries the prefix.
  try {
    return builder.validateResumeContext({
      runFolder: input.runFolder,
      step: input.step,
      reportPath: report.path,
      ...(input.requestContext.checkpointReportSha256 === undefined
        ? {}
        : { reportSha256: input.requestContext.checkpointReportSha256 }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('checkpoint resume rejected:')) throw err;
    throw new Error(
      `checkpoint resume rejected: builder for schema '${report.schema}' validateResumeContext threw: ${message}`,
    );
  }
}

function findWaitingCheckpoint(input: {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly selection: string;
}): {
  readonly trace_entries: readonly TraceEntry[];
  readonly stepId: string;
  readonly attempt: number;
  readonly bootstrap: Extract<TraceEntry, { kind: 'run.bootstrapped' }>;
  readonly requestContext: CheckpointRequestContext;
} {
  const trace_entries = readRunTrace(input.runFolder);
  const bootstrap = trace_entries[0];
  if (bootstrap === undefined || bootstrap.kind !== 'run.bootstrapped') {
    throw new Error('checkpoint resume requires a bootstrapped trace');
  }
  if (trace_entries.some((trace_entry) => trace_entry.kind === 'run.closed')) {
    throw new Error('checkpoint resume rejected: run is already closed');
  }
  // Resume discovery intentionally refreshes the retained v1 derived snapshot
  // before deciding whether the run is paused at a checkpoint.
  const snapshot = writeDerivedSnapshot(input.runFolder);
  if (snapshot.status !== 'in_progress' || snapshot.current_step === undefined) {
    throw new Error('checkpoint resume rejected: run is not paused at an in-progress step');
  }
  const stepId = snapshot.current_step as unknown as string;
  const step = input.flow.steps.find((candidate) => (candidate.id as unknown as string) === stepId);
  if (step === undefined || step.kind !== 'checkpoint') {
    throw new Error(`checkpoint resume rejected: current step '${stepId}' is not a checkpoint`);
  }
  const requested = [...trace_entries]
    .reverse()
    .find(
      (trace_entry): trace_entry is Extract<TraceEntry, { kind: 'checkpoint.requested' }> =>
        trace_entry.kind === 'checkpoint.requested' &&
        (trace_entry.step_id as unknown as string) === stepId,
    );
  if (requested === undefined) {
    throw new Error(
      `checkpoint resume rejected: checkpoint '${stepId}' has no request trace_entry`,
    );
  }
  const alreadyResolved = trace_entries.some(
    (trace_entry) =>
      trace_entry.kind === 'checkpoint.resolved' &&
      (trace_entry.step_id as unknown as string) === stepId &&
      trace_entry.attempt === requested.attempt,
  );
  if (alreadyResolved) {
    throw new Error(`checkpoint resume rejected: checkpoint '${stepId}' is already resolved`);
  }
  if (!step.check.allow.includes(input.selection)) {
    throw new Error(
      `checkpoint resume rejected: selection '${input.selection}' is not allowed for checkpoint '${stepId}'`,
    );
  }
  const requestContext = readCheckpointRequestContext({
    runFolder: input.runFolder,
    step,
    expectedRequestReportHash: requested.request_report_hash,
  });
  // Run validateResumeContext for tamper detection + shape verification.
  // Return value is unused — the brief is no longer re-stamped post-
  // resolution, so the runtime doesn't need an `existingReport`
  // handle to thread through.
  readCheckpointResumeReport({
    runFolder: input.runFolder,
    step,
    requestContext,
  });
  return {
    trace_entries,
    stepId,
    attempt: requested.attempt,
    bootstrap,
    requestContext,
  };
}

export function prepareCheckpointResume(input: {
  readonly runFolder: string;
  readonly selection: string;
}): PreparedCheckpointResume {
  const manifest = verifyManifestSnapshotBytes(input.runFolder);
  const flowBytes = Buffer.from(manifest.bytes_base64, 'base64');
  const flow = flowFromManifestBytes(flowBytes);
  if (flow.id !== manifest.flow_id) {
    throw new Error(
      `checkpoint resume rejected: manifest flow_id '${manifest.flow_id as unknown as string}' does not match flow bytes '${flow.id as unknown as string}'`,
    );
  }
  const waiting = findWaitingCheckpoint({
    runFolder: input.runFolder,
    flow,
    selection: input.selection,
  });
  if (waiting.bootstrap.run_id !== manifest.run_id) {
    throw new Error('checkpoint resume rejected: manifest run_id differs from trace');
  }
  if (waiting.bootstrap.flow_id !== manifest.flow_id) {
    throw new Error('checkpoint resume rejected: manifest flow_id differs from trace');
  }
  if (waiting.bootstrap.manifest_hash !== manifest.hash) {
    throw new Error('checkpoint resume rejected: manifest hash differs from trace');
  }

  return {
    flow,
    flowBytes,
    trace_entries: waiting.trace_entries,
    stepId: waiting.stepId,
    attempt: waiting.attempt,
    bootstrap: waiting.bootstrap,
    requestContext: waiting.requestContext,
  };
}
