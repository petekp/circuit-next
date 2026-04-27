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

import { BuildBrief } from '../schemas/artifacts/build.js';
import { LayeredConfig, type LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Event, RunClosedOutcome } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { Rigor } from '../schemas/rigor.js';
import type { Snapshot } from '../schemas/snapshot.js';
import { Workflow } from '../schemas/workflow.js';
import { sha256Hex } from './adapters/shared.js';
import { appendAndDerive } from './append-and-derive.js';
import { findCloseBuilder, resolveCloseReadPaths } from './close-writers/registry.js';
import {
  bindsExecutionRigorToDispatchSelection,
  selectionConfigLayersWithExecutionRigor,
} from './dispatch-selection.js';
import { readRunLog } from './event-log-reader.js';
import { appendEvent, eventLogPath } from './event-writer.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  verifyManifestSnapshotBytes,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import { writeResult } from './result-writer.js';
import { resolveRunRelative } from './run-relative-path.js';
import type {
  CheckpointResumeInvocation,
  ChildWorkflowResolver,
  DispatchFn,
  DispatchResultMetadata,
  SynthesisWriterFn,
  SynthesisWriterInput,
  WorkflowInvocation,
  WorkflowRunResult,
  WorkflowRunner,
  WorktreeRunner,
} from './runner-types.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';
import { checkpointChoiceIds } from './step-handlers/checkpoint.js';
import {
  type ResumeCheckpointState,
  type RunState,
  type StepHandlerResult,
  runStepHandler,
} from './step-handlers/index.js';
import { isRunRelativePathError, writeJsonArtifact } from './step-handlers/shared.js';
import { findSynthesisBuilder, resolveSynthesisReadPaths } from './synthesis-writers/registry.js';

// Public API surface from runner.ts. Implementations have moved to
// dedicated modules during the handler-extraction split; the surface
// stays stable so existing callers (CLI, tests) keep their imports.
export type {
  CheckpointResumeInvocation,
  CheckpointWaitingResult,
  ChildWorkflowResolver,
  DispatchFn,
  DispatchInput,
  DispatchResultMetadata,
  ResolvedChildWorkflow,
  SynthesisWriterFn,
  SynthesisWriterInput,
  WorkflowInvocation,
  WorkflowRunResult,
  WorkflowRunner,
  WorktreeRunner,
  WorktreeProvisionInput,
} from './runner-types.js';
export { appendAndDerive } from './append-and-derive.js';
export type { AppendResult } from './append-and-derive.js';

interface RunRootInit {
  runRoot: string;
}

export function initRunRoot({ runRoot }: RunRootInit): void {
  mkdirSync(runRoot, { recursive: true });
  mkdirSync(dirname(eventLogPath(runRoot)), { recursive: true });
}

const RUN_ROOT_CLAIM_FILE = '.run-root.claim';

export interface FreshRunRootClaim {
  readonly runRoot: string;
  readonly path: string;
}

function runRootReuseError(runRoot: string, detail: string): Error {
  return new Error(
    `run-root reuse rejected for ${runRoot}: ${detail}; use checkpoint resume for paused checkpoint runs`,
  );
}

export function claimFreshRunRoot(runRoot: string): FreshRunRootClaim {
  const existing = lstatSync(runRoot, { throwIfNoEntry: false });
  if (existing === undefined) {
    try {
      mkdirSync(runRoot, { recursive: true });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err.code === 'EEXIST' || err.code === 'ENOTDIR')
      ) {
        throw runRootReuseError(runRoot, 'path already exists and is not an empty directory');
      }
      throw err;
    }
  }
  const stat = lstatSync(runRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw runRootReuseError(runRoot, 'path already exists and is not an empty directory');
  }
  const claimPath = join(runRoot, RUN_ROOT_CLAIM_FILE);
  let fd: number | undefined;
  try {
    fd = openSync(claimPath, 'wx');
    writeSync(fd, `${new Date().toISOString()}\n`);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      throw runRootReuseError(runRoot, 'another invocation has already claimed this run root');
    }
    throw err;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  const claim = { runRoot, path: claimPath };
  try {
    const entries = readdirSync(runRoot).filter((entry) => entry !== RUN_ROOT_CLAIM_FILE);
    if (entries.length > 0) {
      throw runRootReuseError(runRoot, `existing directory is not empty (${entries.join(', ')})`);
    }
    return claim;
  } catch (err) {
    releaseFreshRunRootClaim(claim);
    throw err;
  }
}

export function releaseFreshRunRootClaim(claim: FreshRunRootClaim): void {
  rmSync(claim.path, { force: true });
}

interface BootstrapInput {
  runRoot: string;
  manifest: ManifestSnapshotInput;
  bootstrapEvent: Event;
}

interface BootstrapResult {
  manifestSnapshotPath: string;
  eventLogPath: string;
  snapshot: Snapshot;
}

export function bootstrapRun(input: BootstrapInput): BootstrapResult {
  const claim = claimFreshRunRoot(input.runRoot);
  try {
    initRunRoot({ runRoot: input.runRoot });
    writeManifestSnapshot(input.runRoot, input.manifest);
    appendEvent(input.runRoot, input.bootstrapEvent);
    const snapshot = writeDerivedSnapshot(input.runRoot);
    return {
      manifestSnapshotPath: manifestSnapshotPath(input.runRoot),
      eventLogPath: eventLogPath(input.runRoot),
      snapshot,
    };
  } finally {
    releaseFreshRunRootClaim(claim);
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

function readJsonArtifact(runRoot: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runRoot, path), 'utf8')) as unknown;
}

// Slice 43c synthesis writer fallback. Workflow-specific synthesis logic
// lives under src/runtime/synthesis-writers/ and is registered by output
// schema name; close-with-evidence dispatch lives in
// src/runtime/close-writers/. The runner stays workflow-agnostic — adding
// a new synthesis step means adding a SynthesisBuilder file + registry
// entry.
function tryWriteRegisteredSynthesisArtifact(input: SynthesisWriterInput): boolean {
  const { runRoot, workflow, step, goal } = input;
  const schemaName = step.writes.artifact.schema;

  const synthesisBuilder = findSynthesisBuilder(schemaName);
  if (synthesisBuilder !== undefined) {
    const readPaths = resolveSynthesisReadPaths(synthesisBuilder, workflow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonArtifact(runRoot, path);
    }
    const artifact = synthesisBuilder.build({ runRoot, workflow, step, goal, inputs });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  const closeBuilder = findCloseBuilder(schemaName);
  if (closeBuilder !== undefined && step.kind === 'synthesis') {
    const readPaths = resolveCloseReadPaths(closeBuilder, workflow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonArtifact(runRoot, path);
    }
    const artifact = closeBuilder.build({
      runRoot,
      workflow,
      closeStep: step,
      goal,
      inputs,
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  return false;
}

export function writeSynthesisArtifact(input: SynthesisWriterInput): void {
  const { runRoot, step } = input;
  if (tryWriteRegisteredSynthesisArtifact(input)) return;
  const body: Record<string, string> = {};
  for (const section of step.gate.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeJsonArtifact(runRoot, step.writes.artifact.path, body);
}

interface WorkflowExecutionContext {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly workflowBytes: Buffer;
  readonly runId: RunId;
  readonly goal: string;
  readonly rigor?: Rigor;
  readonly entryModeName?: string;
  readonly lane: LaneDeclaration;
  readonly now: () => Date;
  readonly dispatcher?: DispatchFn;
  readonly synthesisWriter?: SynthesisWriterFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly projectRoot?: string;
  readonly invocationId?: InvocationId;
  readonly initialEvents?: readonly Event[];
  readonly startStepId?: string;
  readonly resumeCheckpoint?: ResumeCheckpointState;
  readonly childWorkflowResolver?: ChildWorkflowResolver;
  readonly childRunner?: WorkflowRunner;
  readonly worktreeRunner?: WorktreeRunner;
}

async function resolveDispatcher(inv: { dispatcher?: DispatchFn }): Promise<DispatchFn> {
  if (inv.dispatcher !== undefined) return inv.dispatcher;
  const { dispatchAgent } = await import('./adapters/agent.js');
  return { adapterName: 'agent', dispatch: dispatchAgent };
}

function selectEntryMode(
  workflow: Workflow,
  entryModeName: string | undefined,
): Workflow['entry_modes'][number] {
  if (workflow.entry_modes.length === 0) {
    throw new Error(`runWorkflow: workflow ${workflow.id} declares no entry_modes`);
  }
  if (entryModeName === undefined) {
    const entry = workflow.entry_modes[0];
    if (entry === undefined) {
      throw new Error(`runWorkflow: workflow ${workflow.id} entry_modes[0] unreadable`);
    }
    return entry;
  }
  const entry = workflow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) {
    throw new Error(
      `runWorkflow: workflow ${workflow.id} declares no entry_mode named '${entryModeName}'`,
    );
  }
  return entry;
}

function workflowFromManifestBytes(bytes: Buffer): Workflow {
  return Workflow.parse(JSON.parse(bytes.toString('utf8')));
}

interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly buildBriefSha256?: string;
}

type CheckpointWorkflowStep = Workflow['steps'][number] & { kind: 'checkpoint' };

function readCheckpointRequestContext(input: {
  readonly runRoot: string;
  readonly step: CheckpointWorkflowStep;
  readonly expectedRequestArtifactHash: string;
}): CheckpointRequestContext {
  const requestAbs = resolveRunRelative(input.runRoot, input.step.writes.request);
  const requestText = readFileSync(requestAbs, 'utf8');
  const observedRequestHash = sha256Hex(requestText);
  if (observedRequestHash !== input.expectedRequestArtifactHash) {
    throw new Error('checkpoint resume rejected: checkpoint request hash differs from event log');
  }
  const raw: unknown = JSON.parse(requestText);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `checkpoint resume rejected: request artifact for '${input.step.id}' is invalid`,
    );
  }
  const record = raw as Record<string, unknown>;
  if (record.schema_version !== 1 || record.step_id !== input.step.id) {
    throw new Error(`checkpoint resume rejected: request artifact for '${input.step.id}' is stale`);
  }
  const context = record.execution_context;
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error(
      `checkpoint resume rejected: request artifact for '${input.step.id}' has no execution context`,
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
  const buildBriefSha256 = contextRecord.build_brief_sha256;
  if (buildBriefSha256 !== undefined && typeof buildBriefSha256 !== 'string') {
    throw new Error(
      'checkpoint resume rejected: build_brief_sha256 in checkpoint request is invalid',
    );
  }
  return {
    ...(projectRoot === undefined ? {} : { projectRoot }),
    selectionConfigLayers,
    ...(buildBriefSha256 === undefined ? {} : { buildBriefSha256 }),
  };
}

function readCheckpointBuildBrief(input: {
  readonly runRoot: string;
  readonly step: CheckpointWorkflowStep;
  readonly requestContext: CheckpointRequestContext;
}): BuildBrief | undefined {
  const artifact = input.step.writes.artifact;
  if (artifact === undefined) return undefined;
  if (artifact.schema !== 'build.brief@v1') return undefined;
  const artifactAbs = resolveRunRelative(input.runRoot, artifact.path);
  const raw = readFileSync(artifactAbs, 'utf8');
  if (input.requestContext.buildBriefSha256 === undefined) {
    throw new Error('checkpoint resume rejected: checkpoint request is missing build_brief_sha256');
  }
  const observedHash = sha256Hex(raw);
  if (observedHash !== input.requestContext.buildBriefSha256) {
    throw new Error('checkpoint resume rejected: waiting Build brief hash differs from request');
  }
  const brief = BuildBrief.parse(JSON.parse(raw));
  const expectedChoices = checkpointChoiceIds(input.step);
  if (
    brief.checkpoint.request_path !== input.step.writes.request ||
    brief.checkpoint.response_path !== undefined ||
    brief.checkpoint.allowed_choices.length !== expectedChoices.length ||
    brief.checkpoint.allowed_choices.some((choice, index) => choice !== expectedChoices[index])
  ) {
    throw new Error(
      `checkpoint resume rejected: waiting Build brief does not belong to checkpoint '${input.step.id}'`,
    );
  }
  return brief;
}

function findWaitingCheckpoint(input: {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly selection: string;
}): {
  readonly events: readonly Event[];
  readonly stepId: string;
  readonly attempt: number;
  readonly bootstrap: Extract<Event, { kind: 'run.bootstrapped' }>;
  readonly requestContext: CheckpointRequestContext;
  readonly existingBrief?: BuildBrief;
} {
  const events = readRunLog(input.runRoot);
  const bootstrap = events[0];
  if (bootstrap === undefined || bootstrap.kind !== 'run.bootstrapped') {
    throw new Error('checkpoint resume requires a bootstrapped event log');
  }
  if (events.some((event) => event.kind === 'run.closed')) {
    throw new Error('checkpoint resume rejected: run is already closed');
  }
  const snapshot = writeDerivedSnapshot(input.runRoot);
  if (snapshot.status !== 'in_progress' || snapshot.current_step === undefined) {
    throw new Error('checkpoint resume rejected: run is not paused at an in-progress step');
  }
  const stepId = snapshot.current_step as unknown as string;
  const step = input.workflow.steps.find(
    (candidate) => (candidate.id as unknown as string) === stepId,
  );
  if (step === undefined || step.kind !== 'checkpoint') {
    throw new Error(`checkpoint resume rejected: current step '${stepId}' is not a checkpoint`);
  }
  const requested = [...events]
    .reverse()
    .find(
      (event): event is Extract<Event, { kind: 'checkpoint.requested' }> =>
        event.kind === 'checkpoint.requested' && (event.step_id as unknown as string) === stepId,
    );
  if (requested === undefined) {
    throw new Error(`checkpoint resume rejected: checkpoint '${stepId}' has no request event`);
  }
  const alreadyResolved = events.some(
    (event) =>
      event.kind === 'checkpoint.resolved' &&
      (event.step_id as unknown as string) === stepId &&
      event.attempt === requested.attempt,
  );
  if (alreadyResolved) {
    throw new Error(`checkpoint resume rejected: checkpoint '${stepId}' is already resolved`);
  }
  if (!step.gate.allow.includes(input.selection)) {
    throw new Error(
      `checkpoint resume rejected: selection '${input.selection}' is not allowed for checkpoint '${stepId}'`,
    );
  }
  const requestContext = readCheckpointRequestContext({
    runRoot: input.runRoot,
    step,
    expectedRequestArtifactHash: requested.request_artifact_hash,
  });
  const existingBrief = readCheckpointBuildBrief({
    runRoot: input.runRoot,
    step,
    requestContext,
  });
  return {
    events,
    stepId,
    attempt: requested.attempt,
    bootstrap,
    requestContext,
    ...(existingBrief === undefined ? {} : { existingBrief }),
  };
}

// Slice 27d execution loop. Bootstrap, walk routes from entry.start_at,
// delegate per-step work to the kind→handler dispatcher, advance pass
// route, emit run.closed, write result.json. The loop stays narrow: it
// owns the route walk and run-level events; per-kind logic lives in
// src/runtime/step-handlers/.
async function executeWorkflow(ctx: WorkflowExecutionContext): Promise<WorkflowRunResult> {
  const { runRoot, workflow, workflowBytes, runId, goal, lane, now } = ctx;
  const dispatcher = await resolveDispatcher(ctx);
  const synthesisWriter = ctx.synthesisWriter ?? writeSynthesisArtifact;
  const entry = selectEntryMode(workflow, ctx.entryModeName);
  const rigor = ctx.rigor ?? entry.rigor;
  const executionSelectionConfigLayers = bindsExecutionRigorToDispatchSelection(workflow)
    ? selectionConfigLayersWithExecutionRigor(ctx, workflow, rigor)
    : (ctx.selectionConfigLayers ?? []);

  const manifestHash = computeManifestHash(workflowBytes);
  const bootstrapTs = now().toISOString();
  const bootstrapEvent: Event = {
    schema_version: 1,
    sequence: 0,
    recorded_at: bootstrapTs,
    run_id: runId,
    kind: 'run.bootstrapped',
    workflow_id: workflow.id as WorkflowId,
    ...(ctx.invocationId === undefined ? {} : { invocation_id: ctx.invocationId }),
    rigor,
    goal,
    lane,
    manifest_hash: manifestHash,
  };

  const events: Event[] =
    ctx.initialEvents === undefined ? [bootstrapEvent] : [...ctx.initialEvents];
  if (ctx.initialEvents === undefined) {
    bootstrapRun({
      runRoot,
      manifest: {
        run_id: runId,
        workflow_id: workflow.id as WorkflowId,
        captured_at: bootstrapTs,
        bytes: workflowBytes,
      },
      bootstrapEvent,
    });
  }
  // Slice 47a Codex HIGH 2 fold-in — capture per-dispatch metadata
  // for AGENT_SMOKE / CODEX_SMOKE fingerprint binding to cli_version
  // without forcing a dispatch event schema bump.
  const dispatchResults: DispatchResultMetadata[] = [];
  const state: RunState = { events, sequence: events.length, dispatchResults };
  const recordedAt = (): string => now().toISOString();
  // push() is the single sequence-assignment authority: it overwrites
  // the caller-supplied `sequence` field on the event with the current
  // state.sequence and increments. JS is single-threaded and push() is
  // fully synchronous (appendAndDerive uses sync fs writes), so today
  // concurrent callers cannot interleave at the event-loop level. The
  // overwrite locks that property in by construction and guards
  // against (a) future async refactors that would expose the
  // read-then-increment as a real race, and (b) callers reading a
  // stale `state.sequence` snapshot into an event literal across an
  // await boundary. Adversarial-review fix #3 + #12: handlers can no
  // longer corrupt the sequence stream by passing wrong values, and
  // the only path to emit an event is push().
  const push = (ev: Event): void => {
    const sequenced: Event = { ...ev, sequence: state.sequence };
    events.push(sequenced);
    appendAndDerive(runRoot, sequenced);
    state.sequence += 1;
  };

  // Walk the routes graph from entry.start_at. Terminate when a step's
  // pass route resolves to one of the terminal route labels, or when a
  // step handler reports an aborted outcome.
  const stepsById = new Map(workflow.steps.map((s) => [s.id as unknown as string, s] as const));
  const executedStepIds = new Set(
    events
      .filter((event) => event.kind === 'step.completed')
      .map((event) => event.step_id as unknown as string),
  );
  let currentStepId: string | undefined = ctx.startStepId ?? (entry.start_at as unknown as string);
  let runOutcome: RunClosedOutcome = 'complete';
  let closeReason: string | undefined;

  while (currentStepId !== undefined) {
    const step = stepsById.get(currentStepId);
    if (step === undefined) {
      throw new Error(
        `runWorkflow: route target '${currentStepId}' is not a known step id (fixture/reduction mismatch)`,
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

    // Handler exceptions must not corrupt the run-root: a thrown error
    // that escapes executeWorkflow leaves step.entered on disk with no
    // matching step.aborted, no run.closed, and no result.json — the
    // run-root is then half-bootstrapped and claimFreshRunRoot rejects
    // every retry. Wrap so unexpected throws emit step.aborted and fall
    // through to the standard close path. Path-escape errors are a
    // security boundary (callers must see no partial output is trusted)
    // and continue to propagate.
    let result: StepHandlerResult;
    try {
      result = await runStepHandler({
        runRoot,
        workflow,
        runId,
        goal,
        lane,
        rigor,
        executionSelectionConfigLayers,
        ...(ctx.projectRoot === undefined ? {} : { projectRoot: ctx.projectRoot }),
        ...(ctx.invocationId === undefined ? {} : { invocationId: ctx.invocationId }),
        dispatcher,
        synthesisWriter,
        now,
        recordedAt,
        state,
        push,
        step,
        attempt,
        isResumedCheckpoint,
        ...(ctx.resumeCheckpoint === undefined ? {} : { resumeCheckpoint: ctx.resumeCheckpoint }),
        childRunner: ctx.childRunner ?? runWorkflow,
        ...(ctx.childWorkflowResolver === undefined
          ? {}
          : { childWorkflowResolver: ctx.childWorkflowResolver }),
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
      const snapshot = writeDerivedSnapshot(runRoot);
      return {
        runRoot,
        result: {
          schema_version: 1,
          run_id: runId,
          workflow_id: workflow.id,
          goal,
          outcome: 'checkpoint_waiting',
          summary: `checkpoint '${result.checkpoint.stepId}' is waiting for an operator choice.`,
          events_observed: events.length,
          manifest_hash: manifestHash,
          checkpoint: {
            step_id: result.checkpoint.stepId,
            request_path: result.checkpoint.requestPath,
            allowed_choices: result.checkpoint.allowedChoices,
          },
        },
        snapshot,
        events,
        dispatchResults,
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
      throw new Error(`runWorkflow: step '${step.id}' missing 'pass' route (WF-I10 violation)`);
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
  const closed: Event = {
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: closedAt,
    run_id: runId,
    kind: 'run.closed',
    outcome: runOutcome,
    ...(closeReason === undefined ? {} : { reason: closeReason }),
  };
  push(closed);

  const terminalVerdict = deriveTerminalVerdict(events, runOutcome);
  const result = writeResult(runRoot, {
    schema_version: 1,
    run_id: runId,
    workflow_id: workflow.id,
    goal,
    outcome: runOutcome,
    summary: buildSummary({ workflow, goal, events }),
    closed_at: closedAt,
    events_observed: events.length,
    manifest_hash: manifestHash,
    // Slice 53 (Codex H1 fold-in / RESULT-I4): mirror the close-event
    // reason onto the user-visible result.json so an aborted run
    // explains itself without requiring the operator to walk the
    // event log.
    ...(closeReason === undefined ? {} : { reason: closeReason }),
    // Sub-run runtime slice (RESULT-I5): expose the run's terminal
    // admitted verdict so a parent sub-run can admit/reject the child
    // against its own gate.pass.
    ...(terminalVerdict === undefined ? {} : { verdict: terminalVerdict }),
  });

  // Final snapshot is whatever the last appendAndDerive produced; re-derive
  // once at close to return the definitive state.
  const finalSnapshot = writeDerivedSnapshot(runRoot);

  return {
    runRoot,
    result,
    snapshot: finalSnapshot,
    events,
    dispatchResults,
  };
}

export async function runWorkflow(inv: WorkflowInvocation): Promise<WorkflowRunResult> {
  return executeWorkflow(inv);
}

export async function resumeWorkflowCheckpoint(
  inv: CheckpointResumeInvocation,
): Promise<WorkflowRunResult> {
  const manifest = verifyManifestSnapshotBytes(inv.runRoot);
  const workflowBytes = Buffer.from(manifest.bytes_base64, 'base64');
  const workflow = workflowFromManifestBytes(workflowBytes);
  if (workflow.id !== manifest.workflow_id) {
    throw new Error(
      `checkpoint resume rejected: manifest workflow_id '${manifest.workflow_id as unknown as string}' does not match workflow bytes '${workflow.id as unknown as string}'`,
    );
  }
  const waiting = findWaitingCheckpoint({
    runRoot: inv.runRoot,
    workflow,
    selection: inv.selection,
  });
  if (waiting.bootstrap.run_id !== manifest.run_id) {
    throw new Error('checkpoint resume rejected: manifest run_id differs from event log');
  }
  if (waiting.bootstrap.workflow_id !== manifest.workflow_id) {
    throw new Error('checkpoint resume rejected: manifest workflow_id differs from event log');
  }
  if (waiting.bootstrap.manifest_hash !== manifest.hash) {
    throw new Error('checkpoint resume rejected: manifest hash differs from event log');
  }

  return executeWorkflow({
    runRoot: inv.runRoot,
    workflow,
    workflowBytes,
    runId: waiting.bootstrap.run_id,
    goal: waiting.bootstrap.goal,
    rigor: waiting.bootstrap.rigor,
    lane: waiting.bootstrap.lane,
    now: inv.now,
    ...(inv.dispatcher === undefined ? {} : { dispatcher: inv.dispatcher }),
    ...(inv.synthesisWriter === undefined ? {} : { synthesisWriter: inv.synthesisWriter }),
    ...(inv.childWorkflowResolver === undefined
      ? {}
      : { childWorkflowResolver: inv.childWorkflowResolver }),
    ...(inv.childRunner === undefined ? {} : { childRunner: inv.childRunner }),
    ...(inv.worktreeRunner === undefined ? {} : { worktreeRunner: inv.worktreeRunner }),
    selectionConfigLayers: waiting.requestContext.selectionConfigLayers,
    ...(waiting.requestContext.projectRoot !== undefined
      ? { projectRoot: waiting.requestContext.projectRoot }
      : {}),
    ...(waiting.bootstrap.invocation_id === undefined
      ? {}
      : { invocationId: waiting.bootstrap.invocation_id }),
    initialEvents: waiting.events,
    startStepId: waiting.stepId,
    resumeCheckpoint: {
      stepId: waiting.stepId,
      attempt: waiting.attempt,
      selection: inv.selection,
      ...(waiting.existingBrief === undefined ? {} : { existingBrief: waiting.existingBrief }),
    },
  });
}

function buildSummary(input: { workflow: Workflow; goal: string; events: Event[] }): string {
  const stepCount = input.events.filter((e) => e.kind === 'step.completed').length;
  return `${input.workflow.id} v${input.workflow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

// RESULT-I5: derive the run's terminal admitted verdict for the user-
// visible result.json. Walks events backward, finds the last
// dispatch.completed (or sub_run.completed) whose corresponding step
// gate.evaluated event had outcome=pass. Returns undefined for runs
// that didn't reach 'complete' or didn't admit any verdict-bearing step
// (synthesis-only / close-with-evidence terminations).
function deriveTerminalVerdict(events: readonly Event[], runOutcome: RunClosedOutcome): string | undefined {
  if (runOutcome !== 'complete') return undefined;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev === undefined) continue;
    if (ev.kind !== 'dispatch.completed' && ev.kind !== 'sub_run.completed') continue;
    const matchingGatePass = events.some(
      (g) =>
        g.kind === 'gate.evaluated' &&
        g.gate_kind === 'result_verdict' &&
        g.outcome === 'pass' &&
        (g.step_id as unknown as string) === (ev.step_id as unknown as string) &&
        g.attempt === ev.attempt,
    );
    if (matchingGatePass) return ev.verdict;
  }
  return undefined;
}

export type { RunId, WorkflowId };
