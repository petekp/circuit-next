import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import type { ChangeKindDeclaration } from '../schemas/change-kind.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { LayeredConfig, type LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import {
  BUILTIN_CONNECTOR_CAPABILITIES,
  type FilesystemCapability,
  type ResolvedConnector,
} from '../schemas/connector.js';
import type { Depth } from '../schemas/depth.js';
import { type CompiledFlowId, type InvocationId, type RunId, StepId } from '../schemas/ids.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { ProgressEvent } from '../schemas/progress-event.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { RunClosedOutcome, TraceEntry } from '../schemas/trace-entry.js';
import { appendAndDerive } from './append-and-derive.js';
import { sha256Hex } from './connectors/shared.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  verifyManifestSnapshotBytes,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import { findCheckpointBriefBuilder } from './registries/checkpoint-writers/registry.js';
import { findCloseBuilder, resolveCloseReadPaths } from './registries/close-writers/registry.js';
import {
  findComposeBuilder,
  resolveComposeReadPaths,
} from './registries/compose-writers/registry.js';
import {
  bindsExecutionDepthToRelaySelection,
  selectionConfigLayersWithExecutionDepth,
} from './relay-selection.js';
import { writeResult } from './result-writer.js';
import { resolveRunRelative } from './run-relative-path.js';
import type {
  CheckpointResumeInvocation,
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  ComposeWriterFn,
  ComposeWriterInput,
  ProgressReporter,
  RelayFn,
  RelayResultMetadata,
  WorktreeRunner,
} from './runner-types.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';
import {
  type ResumeCheckpointState,
  type RunState,
  type StepHandlerResult,
  runStepHandler,
} from './step-handlers/index.js';
import { isRunRelativePathError, writeJsonReport } from './step-handlers/shared.js';
import { readRunTrace } from './trace-reader.js';
import { appendTraceEntry, traceEntryLogPath } from './trace-writer.js';

// Public API surface from runner.ts. Implementations have moved to
// dedicated modules during the handler-extraction split; the surface
// stays stable so existing callers (CLI, tests) keep their imports.
export type {
  CheckpointResumeInvocation,
  CheckpointWaitingResult,
  ChildCompiledFlowResolver,
  RelayFn,
  RelayInput,
  RelayResultMetadata,
  ResolvedChildCompiledFlow,
  ComposeWriterFn,
  ComposeWriterInput,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  WorktreeRunner,
  WorktreeProvisionInput,
} from './runner-types.js';
export { appendAndDerive } from './append-and-derive.js';
export type { AppendResult } from './append-and-derive.js';

interface RunFolderInit {
  runFolder: string;
}

export function initRunFolder({ runFolder }: RunFolderInit): void {
  mkdirSync(runFolder, { recursive: true });
  mkdirSync(dirname(traceEntryLogPath(runFolder)), { recursive: true });
}

const RUN_ROOT_CLAIM_FILE = '.run-folder.claim';

export interface FreshRunFolderClaim {
  readonly runFolder: string;
  readonly path: string;
}

function runFolderReuseError(runFolder: string, detail: string): Error {
  return new Error(
    `run-folder reuse rejected for ${runFolder}: ${detail}; use checkpoint resume for paused checkpoint runs`,
  );
}

export function claimFreshRunFolder(runFolder: string): FreshRunFolderClaim {
  const existing = lstatSync(runFolder, { throwIfNoEntry: false });
  if (existing === undefined) {
    try {
      mkdirSync(runFolder, { recursive: true });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err.code === 'EEXIST' || err.code === 'ENOTDIR')
      ) {
        throw runFolderReuseError(runFolder, 'path already exists and is not an empty directory');
      }
      throw err;
    }
  }
  const stat = lstatSync(runFolder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw runFolderReuseError(runFolder, 'path already exists and is not an empty directory');
  }
  const claimPath = join(runFolder, RUN_ROOT_CLAIM_FILE);
  let fd: number | undefined;
  try {
    fd = openSync(claimPath, 'wx');
    writeSync(fd, `${new Date().toISOString()}\n`);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      throw runFolderReuseError(
        runFolder,
        'another invocation has already claimed this run folder',
      );
    }
    throw err;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  const claim = { runFolder, path: claimPath };
  try {
    const entries = readdirSync(runFolder).filter((entry) => entry !== RUN_ROOT_CLAIM_FILE);
    if (entries.length > 0) {
      throw runFolderReuseError(
        runFolder,
        `existing directory is not empty (${entries.join(', ')})`,
      );
    }
    return claim;
  } catch (err) {
    releaseFreshRunFolderClaim(claim);
    throw err;
  }
}

export function releaseFreshRunFolderClaim(claim: FreshRunFolderClaim): void {
  rmSync(claim.path, { force: true });
}

interface BootstrapInput {
  runFolder: string;
  manifest: ManifestSnapshotInput;
  bootstrapTraceEntry: TraceEntry;
}

interface BootstrapResult {
  manifestSnapshotPath: string;
  traceEntryLogPath: string;
  snapshot: Snapshot;
}

export function bootstrapRun(input: BootstrapInput): BootstrapResult {
  const claim = claimFreshRunFolder(input.runFolder);
  try {
    initRunFolder({ runFolder: input.runFolder });
    writeManifestSnapshot(input.runFolder, input.manifest);
    appendTraceEntry(input.runFolder, input.bootstrapTraceEntry);
    const snapshot = writeDerivedSnapshot(input.runFolder);
    return {
      manifestSnapshotPath: manifestSnapshotPath(input.runFolder),
      traceEntryLogPath: traceEntryLogPath(input.runFolder),
      snapshot,
    };
  } finally {
    releaseFreshRunFolderClaim(claim);
  }
}

const TERMINAL_ROUTE_OUTCOME = {
  '@complete': 'complete',
  '@stop': 'stopped',
  '@escalate': 'escalated',
  '@handoff': 'handoff',
} as const satisfies Record<string, RunClosedOutcome>;

function terminalOutcomeForRoute(route: string): RunClosedOutcome | undefined {
  return Object.hasOwn(TERMINAL_ROUTE_OUTCOME, route)
    ? TERMINAL_ROUTE_OUTCOME[route as keyof typeof TERMINAL_ROUTE_OUTCOME]
    : undefined;
}

function readJsonReport(runFolder: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runFolder, path), 'utf8')) as unknown;
}

function reportProgress(progress: ProgressReporter | undefined, event: ProgressEvent): void {
  if (progress === undefined) return;
  try {
    progress(event);
  } catch {
    // Progress is a host-facing side channel. A broken renderer must not
    // corrupt the run or change terminal behavior.
  }
}

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
      step_id: input.traceEntry.step_id,
      report_path: input.traceEntry.report_path,
      warning_kind: warning.kind,
      message: warning.message,
      ...(warning.path === undefined ? {} : { path: warning.path }),
    });
  }
}

// Compose writer fallback. CompiledFlow-specific compose logic lives
// under src/runtime/registries/compose-writers/ and is registered by
// output schema name; close-with-evidence relay lives in
// src/runtime/registries/close-writers/. The runner stays flow-
// agnostic — adding a new compose step means adding a ComposeBuilder
// file + registry entry.
function tryWriteRegisteredComposeReport(input: ComposeWriterInput): boolean {
  const { runFolder, flow, step, goal, projectRoot } = input;
  const schemaName = step.writes.report.schema;

  const composeBuilder = findComposeBuilder(schemaName);
  if (composeBuilder !== undefined) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(runFolder, path);
    }
    const report = composeBuilder.build({
      runFolder,
      flow,
      step,
      goal,
      ...(projectRoot === undefined ? {} : { projectRoot }),
      inputs,
    });
    writeJsonReport(runFolder, step.writes.report.path, report);
    return true;
  }

  const closeBuilder = findCloseBuilder(schemaName);
  if (closeBuilder !== undefined && step.kind === 'compose') {
    const readPaths = resolveCloseReadPaths(closeBuilder, flow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(runFolder, path);
    }
    const report = closeBuilder.build({
      runFolder,
      flow,
      closeStep: step,
      goal,
      inputs,
    });
    writeJsonReport(runFolder, step.writes.report.path, report);
    return true;
  }

  return false;
}

export function writeComposeReport(input: ComposeWriterInput): void {
  const { runFolder, step } = input;
  if (tryWriteRegisteredComposeReport(input)) return;
  const body: Record<string, string> = {};
  for (const section of step.check.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeJsonReport(runFolder, step.writes.report.path, body);
}

interface CompiledFlowExecutionContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly flowBytes: Buffer;
  readonly runId: RunId;
  readonly goal: string;
  readonly depth?: Depth;
  readonly entryModeName?: string;
  readonly change_kind: ChangeKindDeclaration;
  readonly now: () => Date;
  readonly relayer?: RelayFn;
  readonly composeWriter?: ComposeWriterFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly projectRoot?: string;
  readonly invocationId?: InvocationId;
  readonly initialTraceEntries?: readonly TraceEntry[];
  readonly startStepId?: string;
  readonly resumeCheckpoint?: ResumeCheckpointState;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly worktreeRunner?: WorktreeRunner;
  readonly progress?: ProgressReporter;
}

function selectEntryMode(
  flow: CompiledFlow,
  entryModeName: string | undefined,
): CompiledFlow['entry_modes'][number] {
  if (flow.entry_modes.length === 0) {
    throw new Error(`runCompiledFlow: flow ${flow.id} declares no entry_modes`);
  }
  if (entryModeName === undefined) {
    const entry = flow.entry_modes[0];
    if (entry === undefined) {
      throw new Error(`runCompiledFlow: flow ${flow.id} entry_modes[0] unreadable`);
    }
    return entry;
  }
  const entry = flow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) {
    throw new Error(
      `runCompiledFlow: flow ${flow.id} declares no entry_mode named '${entryModeName}'`,
    );
  }
  return entry;
}

function flowFromManifestBytes(bytes: Buffer): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(bytes.toString('utf8')));
}

interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}

type CheckpointCompiledFlowStep = CompiledFlow['steps'][number] & { kind: 'checkpoint' };

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

// Execution loop. Bootstrap, walk routes from entry.start_at, delegate
// per-step work to the kind→handler relayer, advance pass route, emit
// run.closed, write result.json. The loop stays narrow: it owns the
// route walk and run-level trace_entries; per-kind logic lives in
// src/runtime/step-handlers/.
async function executeCompiledFlow(
  ctx: CompiledFlowExecutionContext,
): Promise<CompiledFlowRunResult> {
  const { runFolder, flow, flowBytes, runId, goal, change_kind, now } = ctx;
  const composeWriter = ctx.composeWriter ?? writeComposeReport;
  const entry = selectEntryMode(flow, ctx.entryModeName);
  const depth = ctx.depth ?? entry.depth;
  const executionSelectionConfigLayers = bindsExecutionDepthToRelaySelection(flow)
    ? selectionConfigLayersWithExecutionDepth(ctx, flow, depth)
    : (ctx.selectionConfigLayers ?? []);

  const manifestHash = computeManifestHash(flowBytes);
  const bootstrapTs = now().toISOString();
  const bootstrapTraceEntry: TraceEntry = {
    schema_version: 1,
    sequence: 0,
    recorded_at: bootstrapTs,
    run_id: runId,
    kind: 'run.bootstrapped',
    flow_id: flow.id as CompiledFlowId,
    ...(ctx.invocationId === undefined ? {} : { invocation_id: ctx.invocationId }),
    depth,
    goal,
    change_kind,
    manifest_hash: manifestHash,
  };

  const trace_entries: TraceEntry[] =
    ctx.initialTraceEntries === undefined ? [bootstrapTraceEntry] : [...ctx.initialTraceEntries];
  if (ctx.initialTraceEntries === undefined) {
    bootstrapRun({
      runFolder,
      manifest: {
        run_id: runId,
        flow_id: flow.id as CompiledFlowId,
        captured_at: bootstrapTs,
        bytes: flowBytes,
      },
      bootstrapTraceEntry,
    });
  }
  reportProgress(ctx.progress, {
    schema_version: 1,
    type: 'run.started',
    run_id: runId,
    flow_id: flow.id,
    recorded_at: bootstrapTs,
    label: ctx.initialTraceEntries === undefined ? 'Started Circuit run' : 'Resumed Circuit run',
    run_folder: runFolder,
  });
  // Capture per-relay metadata for AGENT_SMOKE / CODEX_SMOKE
  // fingerprint binding to cli_version without forcing a relay trace_entry
  // schema bump.
  const relayResults: RelayResultMetadata[] = [];
  const state: RunState = { trace_entries, sequence: trace_entries.length, relayResults };
  const recordedAt = (): string => now().toISOString();
  // push() is the single sequence-assignment authority: it overwrites
  // the caller-supplied `sequence` field on the trace_entry with the current
  // state.sequence and increments. JS is single-threaded and push() is
  // fully synchronous (appendAndDerive uses sync fs writes), so today
  // concurrent callers cannot interleave at the trace_entry-loop level. The
  // overwrite locks that property in by construction and guards
  // against (a) future async refactors that would expose the
  // read-then-increment as a real race, and (b) callers reading a
  // stale `state.sequence` snapshot into an trace_entry literal across an
  // await boundary. Adversarial-review fix #3 + #12: handlers can no
  // longer corrupt the sequence stream by passing wrong values, and
  // the only path to emit an trace_entry is push().
  const push = (ev: TraceEntry): void => {
    const sequenced: TraceEntry = { ...ev, sequence: state.sequence };
    trace_entries.push(sequenced);
    appendAndDerive(runFolder, sequenced);
    switch (sequenced.kind) {
      case 'step.entered':
        reportProgress(ctx.progress, {
          schema_version: 1,
          type: 'step.started',
          run_id: runId,
          flow_id: flow.id,
          recorded_at: sequenced.recorded_at,
          label: progressStepTitle(flow, sequenced.step_id),
          step_id: sequenced.step_id,
          step_title: progressStepTitle(flow, sequenced.step_id),
          attempt: sequenced.attempt,
        });
        break;
      case 'step.report_written':
        reportEvidenceProgress({
          runFolder,
          flow,
          runId,
          recordedAt: sequenced.recorded_at,
          traceEntry: sequenced,
          ...(ctx.progress === undefined ? {} : { progress: ctx.progress }),
        });
        break;
      case 'relay.started':
        reportProgress(ctx.progress, {
          schema_version: 1,
          type: 'relay.started',
          run_id: runId,
          flow_id: flow.id,
          recorded_at: sequenced.recorded_at,
          label: `Running ${sequenced.role} relay with ${connectorName(sequenced.connector)}`,
          step_id: sequenced.step_id,
          step_title: progressStepTitle(flow, sequenced.step_id),
          attempt: sequenced.attempt,
          role: sequenced.role,
          connector_name: connectorName(sequenced.connector),
          connector_kind: sequenced.connector.kind,
          filesystem_capability: connectorFilesystemCapability(sequenced.connector),
        });
        break;
      case 'relay.completed':
        reportProgress(ctx.progress, {
          schema_version: 1,
          type: 'relay.completed',
          run_id: runId,
          flow_id: flow.id,
          recorded_at: sequenced.recorded_at,
          label: `Relay completed with ${sequenced.verdict}`,
          step_id: sequenced.step_id,
          step_title: progressStepTitle(flow, sequenced.step_id),
          attempt: sequenced.attempt,
          verdict: sequenced.verdict,
          duration_ms: sequenced.duration_ms,
        });
        break;
      case 'step.completed':
        reportProgress(ctx.progress, {
          schema_version: 1,
          type: 'step.completed',
          run_id: runId,
          flow_id: flow.id,
          recorded_at: sequenced.recorded_at,
          label: `Completed ${progressStepTitle(flow, sequenced.step_id)}`,
          step_id: sequenced.step_id,
          step_title: progressStepTitle(flow, sequenced.step_id),
          attempt: sequenced.attempt,
          route_taken: sequenced.route_taken,
        });
        break;
      case 'step.aborted':
        reportProgress(ctx.progress, {
          schema_version: 1,
          type: 'step.aborted',
          run_id: runId,
          flow_id: flow.id,
          recorded_at: sequenced.recorded_at,
          label: `Aborted ${progressStepTitle(flow, sequenced.step_id)}`,
          step_id: sequenced.step_id,
          step_title: progressStepTitle(flow, sequenced.step_id),
          attempt: sequenced.attempt,
          reason: sequenced.reason,
        });
        break;
    }
    state.sequence += 1;
  };

  // Walk the routes graph from entry.start_at. Terminate when a step's
  // pass route resolves to one of the terminal route labels, or when a
  // step handler reports an aborted outcome.
  const stepsById = new Map(flow.steps.map((s) => [s.id as unknown as string, s] as const));
  const executedStepIds = new Set(
    trace_entries
      .filter((trace_entry) => trace_entry.kind === 'step.completed')
      .map((trace_entry) => trace_entry.step_id as unknown as string),
  );
  let currentStepId: string | undefined = ctx.startStepId ?? (entry.start_at as unknown as string);
  let runOutcome: RunClosedOutcome = 'complete';
  let closeReason: string | undefined;

  while (currentStepId !== undefined) {
    const step = stepsById.get(currentStepId);
    if (step === undefined) {
      throw new Error(
        `runCompiledFlow: route target '${currentStepId}' is not a known step id (fixture/reduction mismatch)`,
      );
    }
    if (executedStepIds.has(currentStepId)) {
      runOutcome = 'aborted';
      closeReason = `pass-route cycle detected at step '${currentStepId}'; aborting run before re-entering an already executed step`;
      currentStepId = undefined;
      break;
    }
    executedStepIds.add(currentStepId);
    const isResumedCheckpoint = ctx.resumeCheckpoint?.stepId === currentStepId;
    const attempt = isResumedCheckpoint ? ctx.resumeCheckpoint.attempt : 1;

    if (!isResumedCheckpoint) {
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.entered',
        step_id: step.id,
        attempt,
      });
    }

    // Handler exceptions must not corrupt the run-folder: a thrown error
    // that escapes executeCompiledFlow leaves step.entered on disk with no
    // matching step.aborted, no run.closed, and no result.json — the
    // run-folder is then half-bootstrapped and claimFreshRunFolder rejects
    // every retry. Wrap so unexpected throws emit step.aborted and fall
    // through to the standard close path. Path-escape errors are a
    // security boundary (callers must see no partial output is trusted)
    // and continue to propagate.
    let result: StepHandlerResult;
    try {
      result = await runStepHandler({
        runFolder,
        flow,
        runId,
        goal,
        change_kind,
        depth,
        executionSelectionConfigLayers,
        ...(ctx.projectRoot === undefined ? {} : { projectRoot: ctx.projectRoot }),
        ...(ctx.invocationId === undefined ? {} : { invocationId: ctx.invocationId }),
        ...(ctx.relayer === undefined ? {} : { relayer: ctx.relayer }),
        composeWriter,
        now,
        recordedAt,
        state,
        push,
        step,
        attempt,
        isResumedCheckpoint,
        ...(ctx.resumeCheckpoint === undefined ? {} : { resumeCheckpoint: ctx.resumeCheckpoint }),
        childRunner: ctx.childRunner ?? runCompiledFlow,
        ...(ctx.childCompiledFlowResolver === undefined
          ? {}
          : { childCompiledFlowResolver: ctx.childCompiledFlowResolver }),
        ...(ctx.worktreeRunner === undefined ? {} : { worktreeRunner: ctx.worktreeRunner }),
      });
    } catch (err) {
      if (isRunRelativePathError(err)) throw err;
      const message = err instanceof Error ? err.message : String(err);
      const reason = `step '${step.id as unknown as string}' (kind '${step.kind}') handler threw: ${message}`;
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
      runOutcome = 'aborted';
      closeReason = reason;
      currentStepId = undefined;
      break;
    }

    if (result.kind === 'waiting_checkpoint') {
      const waitingRecordedAt = recordedAt();
      reportProgress(ctx.progress, {
        schema_version: 1,
        type: 'checkpoint.waiting',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: waitingRecordedAt,
        label: `Waiting for checkpoint ${result.checkpoint.stepId}`,
        step_id: StepId.parse(result.checkpoint.stepId),
        request_path: result.checkpoint.requestPath,
        allowed_choices: [...result.checkpoint.allowedChoices],
      });
      const snapshot = writeDerivedSnapshot(runFolder);
      return {
        runFolder,
        result: {
          schema_version: 1,
          run_id: runId,
          flow_id: flow.id,
          goal,
          outcome: 'checkpoint_waiting',
          summary: `checkpoint '${result.checkpoint.stepId}' is waiting for an operator choice.`,
          trace_entries_observed: trace_entries.length,
          manifest_hash: manifestHash,
          checkpoint: {
            step_id: result.checkpoint.stepId,
            request_path: result.checkpoint.requestPath,
            allowed_choices: result.checkpoint.allowedChoices,
          },
        },
        snapshot,
        trace_entries,
        relayResults,
      };
    }

    if (result.kind === 'aborted') {
      runOutcome = 'aborted';
      closeReason = result.reason;
      currentStepId = undefined;
      break;
    }

    const passRoute = step.routes.pass;
    if (passRoute === undefined) {
      throw new Error(`runCompiledFlow: step '${step.id}' missing 'pass' route (WF-I10 violation)`);
    }
    const terminalOutcome = terminalOutcomeForRoute(passRoute);

    if (terminalOutcome === undefined && executedStepIds.has(passRoute)) {
      const reason = `pass-route cycle detected: step '${step.id}' routes to already executed step '${passRoute}'`;
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
      runOutcome = 'aborted';
      closeReason = reason;
      currentStepId = undefined;
      break;
    }

    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.completed',
      step_id: step.id,
      attempt,
      route_taken: 'pass',
    });

    if (terminalOutcome !== undefined) {
      runOutcome = terminalOutcome;
      currentStepId = undefined;
      if (passRoute !== '@complete') {
        closeReason = `terminal route ${passRoute}`;
      }
    } else {
      currentStepId = passRoute;
    }
  }

  const closedAt = recordedAt();
  const closed: TraceEntry = {
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: closedAt,
    run_id: runId,
    kind: 'run.closed',
    outcome: runOutcome,
    ...(closeReason === undefined ? {} : { reason: closeReason }),
  };
  push(closed);

  const terminalVerdict = deriveTerminalVerdict(trace_entries, runOutcome);
  const result = writeResult(runFolder, {
    schema_version: 1,
    run_id: runId,
    flow_id: flow.id,
    goal,
    outcome: runOutcome,
    summary: buildSummary({ flow, goal, trace_entries }),
    closed_at: closedAt,
    trace_entries_observed: trace_entries.length,
    manifest_hash: manifestHash,
    // Mirror the close-entry reason onto the user-visible result.json so
    // an aborted run explains itself without forcing readers to walk the
    // trace.
    ...(closeReason === undefined ? {} : { reason: closeReason }),
    // Expose the run's terminal admitted verdict so a parent sub-run
    // can admit/reject the child against its own check.pass.
    ...(terminalVerdict === undefined ? {} : { verdict: terminalVerdict }),
  });
  if (runOutcome === 'aborted') {
    reportProgress(ctx.progress, {
      schema_version: 1,
      type: 'run.aborted',
      run_id: runId,
      flow_id: flow.id,
      recorded_at: closedAt,
      label: 'Circuit run aborted',
      outcome: 'aborted',
      result_path: `${runFolder}/reports/result.json`,
      ...(closeReason === undefined ? {} : { reason: closeReason }),
    });
  } else {
    reportProgress(ctx.progress, {
      schema_version: 1,
      type: 'run.completed',
      run_id: runId,
      flow_id: flow.id,
      recorded_at: closedAt,
      label: `Circuit run ${runOutcome}`,
      outcome: runOutcome,
      result_path: `${runFolder}/reports/result.json`,
    });
  }

  // Final snapshot is whatever the last appendAndDerive produced; re-derive
  // once at close to return the definitive state.
  const finalSnapshot = writeDerivedSnapshot(runFolder);

  return {
    runFolder,
    result,
    snapshot: finalSnapshot,
    trace_entries,
    relayResults,
  };
}

export async function runCompiledFlow(inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> {
  return executeCompiledFlow(inv);
}

export async function resumeCompiledFlowCheckpoint(
  inv: CheckpointResumeInvocation,
): Promise<CompiledFlowRunResult> {
  const manifest = verifyManifestSnapshotBytes(inv.runFolder);
  const flowBytes = Buffer.from(manifest.bytes_base64, 'base64');
  const flow = flowFromManifestBytes(flowBytes);
  if (flow.id !== manifest.flow_id) {
    throw new Error(
      `checkpoint resume rejected: manifest flow_id '${manifest.flow_id as unknown as string}' does not match flow bytes '${flow.id as unknown as string}'`,
    );
  }
  const waiting = findWaitingCheckpoint({
    runFolder: inv.runFolder,
    flow,
    selection: inv.selection,
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

  return executeCompiledFlow({
    runFolder: inv.runFolder,
    flow,
    flowBytes,
    runId: waiting.bootstrap.run_id,
    goal: waiting.bootstrap.goal,
    depth: waiting.bootstrap.depth,
    change_kind: waiting.bootstrap.change_kind,
    now: inv.now,
    ...(inv.relayer === undefined ? {} : { relayer: inv.relayer }),
    ...(inv.composeWriter === undefined ? {} : { composeWriter: inv.composeWriter }),
    ...(inv.childCompiledFlowResolver === undefined
      ? {}
      : { childCompiledFlowResolver: inv.childCompiledFlowResolver }),
    ...(inv.childRunner === undefined ? {} : { childRunner: inv.childRunner }),
    ...(inv.worktreeRunner === undefined ? {} : { worktreeRunner: inv.worktreeRunner }),
    ...(inv.progress === undefined ? {} : { progress: inv.progress }),
    selectionConfigLayers: waiting.requestContext.selectionConfigLayers,
    ...(waiting.requestContext.projectRoot !== undefined
      ? { projectRoot: waiting.requestContext.projectRoot }
      : {}),
    ...(waiting.bootstrap.invocation_id === undefined
      ? {}
      : { invocationId: waiting.bootstrap.invocation_id }),
    initialTraceEntries: waiting.trace_entries,
    startStepId: waiting.stepId,
    resumeCheckpoint: {
      stepId: waiting.stepId,
      attempt: waiting.attempt,
      selection: inv.selection,
    },
  });
}

function buildSummary(input: {
  flow: CompiledFlow;
  goal: string;
  trace_entries: TraceEntry[];
}): string {
  const stepCount = input.trace_entries.filter((e) => e.kind === 'step.completed').length;
  return `${input.flow.id} v${input.flow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

// Derive the run's terminal admitted verdict for the user-visible
// result.json. Contract:
//
// - Returns the verdict from the LATEST (chronologically last)
//   relay.completed | sub_run.completed trace entry whose corresponding
//   check.evaluated for the same (step_id, attempt) had
//   check_kind='result_verdict' and outcome='pass'.
// - Returns undefined for any run that did not reach outcome=complete.
// - Returns undefined for runs that completed with no verdict-bearing
//   admitted step (compose-only routes, close-with-evidence
//   terminations, fanout-only steps).
//
// Why walk-backward instead of "the closing step's verdict":
//   Every flow we ship has a non-verdict-bearing close step (a compose
//   that materializes the canonical close report). A "closing step's
//   verdict" semantic would therefore return undefined for every
//   Build / Migrate / Sweep / Review / Fix run, defeating the purpose
//   of the field. Authors place the verdict-bearing step ahead of the
//   close compose (Build's review step, Migrate's cutover-review step)
//   and expect the latest such admission to surface. Walk-backward
//   picks that exact entry.
//
// Why filter to check_kind='result_verdict':
//   Compose steps emit check.evaluated with kind='schema_sections'
//   (report admission), verification steps with kind='verification',
//   fanout with kind='fanout_aggregate'. None of those carry a verdict
//   — only result_verdict checks do, and only relay / sub-run steps
//   emit them. Including any other kind would conflate schema admission
//   with verdict admission.
//
// Why this is safe across re-routes / retries:
//   The runner emits check.evaluated outcome='pass' only on the route
//   actually taken to @complete (relay.ts emits outcome='fail' then
//   step.aborted on a failed check; failed checks do not advance to a
//   fail-route). So every (step_id, attempt) with a matching pass check
//   is a step whose verdict was admitted on the path to @complete.
function deriveTerminalVerdict(
  trace_entries: readonly TraceEntry[],
  runOutcome: RunClosedOutcome,
): string | undefined {
  if (runOutcome !== 'complete') return undefined;
  for (let i = trace_entries.length - 1; i >= 0; i -= 1) {
    const ev = trace_entries[i];
    if (ev === undefined) continue;
    if (ev.kind !== 'relay.completed' && ev.kind !== 'sub_run.completed') continue;
    const matchingCheckPass = trace_entries.some(
      (g) =>
        g.kind === 'check.evaluated' &&
        g.check_kind === 'result_verdict' &&
        g.outcome === 'pass' &&
        (g.step_id as unknown as string) === (ev.step_id as unknown as string) &&
        g.attempt === ev.attempt,
    );
    if (matchingCheckPass) return ev.verdict;
  }
  return undefined;
}

export type { RunId, CompiledFlowId };
