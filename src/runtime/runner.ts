import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BuiltInAdapter } from '../schemas/adapter.js';
import type { Event } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { Workflow } from '../schemas/workflow.js';
import type { AgentDispatchInput } from './adapters/agent.js';
import { materializeDispatch } from './adapters/dispatch-materializer.js';
import type { DispatchResult } from './adapters/shared.js';
import { appendEvent, eventLogPath } from './event-writer.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import { writeResult } from './result-writer.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';

// Slice 27c landed the runtime-boundary writer/reducer/manifest surfaces
// below bootstrapRun/appendAndDerive. Slice 27d composes them into the
// dogfood-run-0 execution loop via `runDogfood` — the first executable
// product proof per ADR-0001 Addendum B §Phase 1.5 Close Criteria
// #4/#5/#6/#7/#13.

export interface RunRootInit {
  runRoot: string;
}

export function initRunRoot({ runRoot }: RunRootInit): void {
  mkdirSync(runRoot, { recursive: true });
  mkdirSync(dirname(eventLogPath(runRoot)), { recursive: true });
}

export interface BootstrapInput {
  runRoot: string;
  manifest: ManifestSnapshotInput;
  bootstrapEvent: Event;
}

export interface BootstrapResult {
  manifestSnapshotPath: string;
  eventLogPath: string;
  snapshot: Snapshot;
}

export function bootstrapRun(input: BootstrapInput): BootstrapResult {
  initRunRoot({ runRoot: input.runRoot });
  writeManifestSnapshot(input.runRoot, input.manifest);
  appendEvent(input.runRoot, input.bootstrapEvent);
  const snapshot = writeDerivedSnapshot(input.runRoot);
  return {
    manifestSnapshotPath: manifestSnapshotPath(input.runRoot),
    eventLogPath: eventLogPath(input.runRoot),
    snapshot,
  };
}

export interface AppendResult {
  snapshot: Snapshot;
}

export function appendAndDerive(runRoot: string, event: Event): AppendResult {
  appendEvent(runRoot, event);
  const snapshot = writeDerivedSnapshot(runRoot);
  return { snapshot };
}

// ---------------------------------------------------------------------
// Slice 27d — dogfood-run-0 execution loop
// ---------------------------------------------------------------------

// Slice 45a (P2.6 HIGH 3 fold-in): structured dispatcher descriptor.
// Prior to 45a, `DispatchFn` was a bare function type and the runner's
// materializer call site hardcoded `adapterName: 'agent'`; injecting a
// non-agent dispatcher (e.g. `dispatchCodex`) through
// `DogfoodInvocation.dispatcher` would silently lie on the
// `dispatch.started` event's adapter discriminant. The descriptor binds
// the dispatcher function to its adapter identity at the injection seam,
// so the materializer is parameterized from the descriptor instead of
// from a call-site literal. Codex challenger pass on Slice 45 surfaced
// this as HIGH 3; deferred to this named follow-up slice (plan-file
// reference: `specs/plans/phase-2-implementation.md` §P2.6 "Named
// follow-up slice 45a").
export interface DispatchFn {
  readonly adapterName: BuiltInAdapter;
  readonly dispatch: (input: AgentDispatchInput) => Promise<DispatchResult>;
}

export interface DogfoodInvocation {
  runRoot: string;
  workflow: Workflow;
  workflowBytes: Buffer;
  runId: RunId;
  goal: string;
  rigor: Rigor;
  lane: LaneDeclaration;
  now: () => Date;
  invocationId?: InvocationId;
  // Slice 43b: injection seam for the dispatch adapter. Default is
  // `dispatchAgent` (lazy-imported so tests that don't exercise dispatch
  // don't pull the subprocess module into their graph). Tests that want
  // deterministic transcripts inject a stub returning a pre-baked
  // AgentDispatchResult; the capability-boundary assertion lives in
  // parseAgentStdout and is thus a real-subprocess-only concern —
  // bypassing it at the test layer is a test-surface seam, not a
  // policy seam.
  dispatcher?: DispatchFn;
}

export interface DogfoodRunResult {
  runRoot: string;
  result: RunResult;
  snapshot: Snapshot;
  events: Event[];
}

// Slice 43b: the runtime dispatch branch now routes through dispatchAgent
// + materializeDispatch (per ADR-0007 §Amendment Slice 37 + ADR-0009 §1).
// `dispatchVerdictForStep` is a gate-decision helper that returns the
// verdict emitted on `dispatch.completed` so downstream `gate.evaluated`
// is deterministic at v0 — raw-byte materialization (ADR-0008
// §Decision.3a) does not extract a verdict from model output yet; a
// future slice will swap this out once dispatch artifact schemas become
// enforceable at runtime.
function dispatchVerdictForStep(step: Workflow['steps'][number]): string {
  if (step.kind !== 'dispatch') {
    throw new Error(`dispatchVerdictForStep: step ${step.id} is not a dispatch step`);
  }
  const first = step.gate.pass[0];
  if (first === undefined || first.length === 0) {
    throw new Error(
      `dispatch step ${step.id}: gate.pass must declare at least one passing verdict`,
    );
  }
  return first;
}

// v0 prompt composition: name the step, enumerate accepted verdicts, and
// inline every reads-declared artifact (or a clear placeholder if the
// reads artifact hasn't been written yet — in explore, orchestrator-
// synthesis artifacts precede dispatch steps so this degrades gracefully
// at the fixture's current shape).
function composeDispatchPrompt(
  step: Workflow['steps'][number] & { kind: 'dispatch' },
  runRoot: string,
): string {
  const readsBody =
    step.reads.length === 0
      ? '(no reads)'
      : step.reads
          .map((path) => {
            const abs = join(runRoot, path);
            if (!existsSync(abs)) return `[reads unavailable: ${path}]`;
            return `--- ${path} ---\n${readFileSync(abs, 'utf8')}`;
          })
          .join('\n\n');
  return [
    `Step: ${step.id}`,
    `Title: ${step.title}`,
    `Role: ${step.role}`,
    `Accepted verdicts: ${step.gate.pass.join(', ')}`,
    '',
    'Context (from reads):',
    readsBody,
    '',
    'Respond with a JSON object that includes a "verdict" field drawn from the accepted-verdicts list.',
  ].join('\n');
}

async function resolveDispatcher(inv: DogfoodInvocation): Promise<DispatchFn> {
  if (inv.dispatcher !== undefined) return inv.dispatcher;
  // Default dispatcher: the `agent` adapter's function, lifted into the
  // structured descriptor shape so the call site at `runDogfood` below
  // reads `adapterName` uniformly regardless of whether the dispatcher
  // was injected (tests, future codex routing) or resolved as the
  // default. See Slice 45a's `DispatchFn` comment above for rationale.
  const { dispatchAgent } = await import('./adapters/agent.js');
  return { adapterName: 'agent', dispatch: dispatchAgent };
}

// Slice 43c: orchestrator-synthesis steps land an artifact file at
// `runRoot/step.writes.artifact.path` before their `step.artifact_written`
// event fires. At v0 the body is a minimal deterministic JSON stub with
// one string placeholder per `step.gate.required` section — sufficient to
// (a) let downstream steps' `reads[]` find the file (prompt composition +
// final close-step reads), (b) let the close-step's artifact
// (`artifacts/explore-result.json` in explore) land deterministically so
// a byte-shape golden can hash it, and (c) keep the close-step at the end
// of the run idempotent for repeat invocations against the same fixture.
// A future slice (P2.10 — artifact schema set + orchestrator-synthesis
// integration) replaces the stub with real orchestrator output; the seam
// is this single helper.
function writeSynthesisArtifact(
  runRoot: string,
  step: Workflow['steps'][number] & { kind: 'synthesis' },
): void {
  const abs = join(runRoot, step.writes.artifact.path);
  mkdirSync(dirname(abs), { recursive: true });
  const body: Record<string, string> = {};
  for (const section of step.gate.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

// Narrow dogfood-run-0 loop. Walks routes from the single entry_mode;
// for each step, appends the per-kind event trail; emits run.closed
// after the routes graph reaches @complete; writes result.json last.
//
// Slice 43b: async so the dispatch branch can `await` the real adapter
// (or an injected stub). The signature is a breaking change for external
// callers — this is internal to Phase 1.5 / Phase 2 only (no external
// users yet).
export async function runDogfood(inv: DogfoodInvocation): Promise<DogfoodRunResult> {
  const { runRoot, workflow, workflowBytes, runId, goal, rigor, lane, now } = inv;
  const dispatcher = await resolveDispatcher(inv);

  if (workflow.entry_modes.length === 0) {
    throw new Error(`runDogfood: workflow ${workflow.id} declares no entry_modes`);
  }
  const entry = workflow.entry_modes[0];
  if (entry === undefined) {
    throw new Error(`runDogfood: workflow ${workflow.id} entry_modes[0] unreadable`);
  }

  const manifestHash = computeManifestHash(workflowBytes);
  const bootstrapTs = now().toISOString();
  const bootstrapEvent: Event = {
    schema_version: 1,
    sequence: 0,
    recorded_at: bootstrapTs,
    run_id: runId,
    kind: 'run.bootstrapped',
    workflow_id: workflow.id as WorkflowId,
    ...(inv.invocationId === undefined ? {} : { invocation_id: inv.invocationId }),
    rigor,
    goal,
    lane,
    manifest_hash: manifestHash,
  };

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

  const events: Event[] = [bootstrapEvent];
  let sequence = 1;
  const recordedAt = () => now().toISOString();
  const push = (ev: Event): void => {
    events.push(ev);
    appendAndDerive(runRoot, ev);
    sequence += 1;
  };

  // Walk the routes graph from entry.start_at. Terminate when a step's
  // route resolves to @complete (the only terminal dogfood-run-0
  // exercises; @stop/@escalate/@handoff are Phase 2 scope).
  const stepsById = new Map(workflow.steps.map((s) => [s.id as unknown as string, s] as const));
  let currentStepId: string | undefined = entry.start_at as unknown as string;
  const outcome = 'complete' as const;
  let closeReason: string | undefined;

  while (currentStepId !== undefined) {
    const step = stepsById.get(currentStepId);
    if (step === undefined) {
      throw new Error(
        `runDogfood: route target '${currentStepId}' is not a known step id (fixture/reduction mismatch)`,
      );
    }
    const attempt = 1;

    push({
      schema_version: 1,
      sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.entered',
      step_id: step.id,
      attempt,
    });

    if (step.kind === 'synthesis') {
      writeSynthesisArtifact(runRoot, step);
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.artifact_written',
        step_id: step.id,
        attempt,
        artifact_path: step.writes.artifact.path,
        artifact_schema: step.writes.artifact.schema,
      });
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'gate.evaluated',
        step_id: step.id,
        attempt,
        gate_kind: 'schema_sections',
        outcome: 'pass',
      });
    } else if (step.kind === 'dispatch') {
      const prompt = composeDispatchPrompt(step, runRoot);
      const dispatchInput: AgentDispatchInput = { prompt };
      if (step.budgets?.wall_clock_ms !== undefined) {
        dispatchInput.timeoutMs = step.budgets.wall_clock_ms;
      }
      const dispatchResult = await dispatcher.dispatch(dispatchInput);
      const verdict = dispatchVerdictForStep(step);
      const materialized = materializeDispatch({
        runId,
        stepId: step.id,
        attempt,
        role: step.role,
        startingSequence: sequence,
        runRoot,
        writes: {
          request: step.writes.request,
          receipt: step.writes.receipt,
          result: step.writes.result,
          ...(step.writes.artifact === undefined ? {} : { artifact: step.writes.artifact }),
        },
        // Slice 45a (P2.6 HIGH 3 fold-in): adapter identity is pulled
        // from the structured `DispatchFn` descriptor rather than from
        // a call-site literal. Future P2.7+ slices that route a second
        // adapter into `runDogfood` do so by injecting a dispatcher
        // with the matching `adapterName`; no further edit to this
        // site is required.
        adapterName: dispatcher.adapterName,
        dispatchResult,
        verdict,
        now,
      });
      for (const ev of materialized.events) {
        events.push(ev);
        appendAndDerive(runRoot, ev);
      }
      sequence = materialized.sequenceAfter;
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'gate.evaluated',
        step_id: step.id,
        attempt,
        gate_kind: 'result_verdict',
        outcome: 'pass',
      });
    } else {
      // Checkpoint steps — dogfood-run-0 fixture does not exercise this
      // arm, and narrowing the loop keeps the Phase 1.5 proof focused.
      throw new Error(
        `runDogfood: step kind '${(step as { kind: string }).kind}' is not exercised by dogfood-run-0 v0.1`,
      );
    }

    const passRoute = step.routes.pass;
    if (passRoute === undefined) {
      throw new Error(`runDogfood: step '${step.id}' missing 'pass' route (WF-I10 violation)`);
    }

    push({
      schema_version: 1,
      sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.completed',
      step_id: step.id,
      attempt,
      route_taken: 'pass',
    });

    if (passRoute === '@complete') {
      currentStepId = undefined;
    } else if (passRoute === '@stop' || passRoute === '@escalate' || passRoute === '@handoff') {
      // Non-complete terminals are schema-valid routes but not
      // exercised by dogfood-run-0 v0.1.
      currentStepId = undefined;
      closeReason = `terminal route ${passRoute} not exercised in Alpha Proof; treating as complete`;
    } else {
      currentStepId = passRoute;
    }
  }

  const closedAt = recordedAt();
  const closed: Event = {
    schema_version: 1,
    sequence,
    recorded_at: closedAt,
    run_id: runId,
    kind: 'run.closed',
    outcome,
    ...(closeReason === undefined ? {} : { reason: closeReason }),
  };
  push(closed);

  const result = writeResult(runRoot, {
    schema_version: 1,
    run_id: runId,
    workflow_id: workflow.id,
    goal,
    outcome,
    summary: buildSummary({ workflow, goal, events }),
    closed_at: closedAt,
    events_observed: events.length,
    manifest_hash: manifestHash,
  });

  // Final snapshot is whatever the last appendAndDerive produced; re-derive
  // once at close to return the definitive state.
  const finalSnapshot = writeDerivedSnapshot(runRoot);

  return {
    runRoot,
    result,
    snapshot: finalSnapshot,
    events,
  };
}

function buildSummary(input: {
  workflow: Workflow;
  goal: string;
  events: Event[];
}): string {
  const stepCount = input.events.filter((e) => e.kind === 'step.completed').length;
  return `dogfood-run-0: ${input.workflow.id} v${input.workflow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

export type { RunId, WorkflowId };
