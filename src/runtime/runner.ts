import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Event } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { Workflow } from '../schemas/workflow.js';
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
}

export interface DogfoodRunResult {
  runRoot: string;
  result: RunResult;
  snapshot: Snapshot;
  events: Event[];
}

// Dry-run adapter contract: a dispatch step emits `dispatch.started` +
// `dispatch.completed` without calling any real agent. The verdict is
// synthesized from the dispatch step's gate.pass vocabulary so the
// downstream `gate.evaluated` outcome is deterministic — "ok" when the
// step declares it as a passing verdict, otherwise the first pass token.
function synthesizeDispatchVerdict(step: Workflow['steps'][number]): string {
  if (step.kind !== 'dispatch') {
    throw new Error(`synthesizeDispatchVerdict: step ${step.id} is not a dispatch step`);
  }
  const first = step.gate.pass[0];
  if (first === undefined || first.length === 0) {
    throw new Error(
      `dispatch step ${step.id}: gate.pass must declare at least one passing verdict`,
    );
  }
  return first;
}

// Narrow dogfood-run-0 loop. Walks routes from the single entry_mode;
// for each step, appends the per-kind event trail; emits run.closed
// after the routes graph reaches @complete; writes result.json last.
export function runDogfood(inv: DogfoodInvocation): DogfoodRunResult {
  const { runRoot, workflow, workflowBytes, runId, goal, rigor, lane, now } = inv;

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
      const verdict = synthesizeDispatchVerdict(step);
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'dispatch.started',
        step_id: step.id,
        attempt,
        adapter: { kind: 'builtin', name: 'agent' },
        role: step.role,
        resolved_selection: {
          skills: [],
          invocation_options: {},
        },
        resolved_from: { source: 'default' },
      });
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'dispatch.completed',
        step_id: step.id,
        attempt,
        verdict,
        duration_ms: 0,
        result_path: step.writes.result,
        receipt_path: step.writes.receipt,
      });
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
