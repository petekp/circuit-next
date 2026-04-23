import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BuiltInAdapter, DispatchResolutionSource } from '../schemas/adapter.js';
import type { Event, RunClosedOutcome } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { ResolvedSelection, SkillOverride } from '../schemas/selection-policy.js';
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

// Slice 47a Codex HIGH 2 fold-in — surface per-dispatch metadata
// (`adapterName`, `cli_version`, `stepId`) so the AGENT_SMOKE
// fingerprint writer can bind `cli_version` to the actual subprocess
// init event rather than reading it from a side-channel env var. The
// runner already has `DispatchResult.cli_version` in scope at the
// dispatch loop; this exposes it on `DogfoodRunResult` without
// forcing a schema change to the dispatch event union (the latter
// would be P2-MODEL-EFFORT scope).
export interface DispatchResultMetadata {
  readonly stepId: string;
  readonly adapterName: BuiltInAdapter;
  readonly cli_version: string;
}

export interface DogfoodRunResult {
  runRoot: string;
  result: RunResult;
  snapshot: Snapshot;
  events: Event[];
  dispatchResults: readonly DispatchResultMetadata[];
}

// Slice 53 (Codex H14 fold-in) — parse adapter result_body for the
// gate verdict and evaluate against `step.gate.pass`. Pre-Slice-53
// (Slice 43b authoring) `dispatchVerdictForStep` returned
// `step.gate.pass[0]` unconditionally without consulting adapter
// output, and the runner emitted `gate.evaluated` with `outcome: 'pass'`
// regardless of what the model said — so dispatch steps advanced by
// construction. Slice 43b's own comment block named this slice as the
// swap-out point ("a future slice will swap this out once dispatch
// artifact schemas become enforceable at runtime"); Codex H14 in the
// 2026-04-22 project-holistic critical review surfaced the dishonesty
// for fold-in.
//
// Result shape: a discriminated union the runner consumes downstream.
// On 'pass' the runner uses the parsed verdict on `dispatch.completed`
// and emits `gate.evaluated` with `outcome: 'pass'`. On 'fail' the
// runner emits `gate.evaluated` with `outcome: 'fail'` + the reason,
// then `step.aborted`, then `run.closed` with `outcome: 'aborted'`.
// The dispatch-completed verdict on fail carries the observed verdict
// when one was present (e.g., a parseable body with a verdict not in
// pass), so the durable transcript reflects what the adapter said even
// on rejection. When no verdict was observable (unparseable / no
// verdict field), `dispatch.completed.verdict` carries the
// `'<no-verdict>'` sentinel — `DispatchCompletedEvent.verdict` is
// `z.string().min(1)` so the slot must hold a non-empty string.
//
// Parsing rule at v0: `JSON.parse(result_body)`, then require a
// top-level `verdict` field that is a non-empty string. The minimal
// shape `{ verdict: string }` is the closure of H14 without expanding
// the contract surface to a typed adapter-output schema (rejected
// alternate framing: add `gate.schema` to `ResultVerdictGate`); a
// future slice can widen if a verdict-with-payload pattern emerges.
type GateEvaluation =
  | { readonly kind: 'pass'; readonly verdict: string }
  | { readonly kind: 'fail'; readonly reason: string; readonly observedVerdict?: string };

const NO_VERDICT_SENTINEL = '<no-verdict>';

function evaluateDispatchGate(
  step: Workflow['steps'][number] & { kind: 'dispatch' },
  resultBody: string,
): GateEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body did not parse as JSON (${msg})`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body parsed but is not a JSON object (got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }
  const verdictRaw = (parsed as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body lacks a non-empty string 'verdict' field (got ${typeof verdictRaw === 'string' ? 'empty string' : typeof verdictRaw})`,
    };
  }
  if (!step.gate.pass.includes(verdictRaw)) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter declared verdict '${verdictRaw}' which is not in gate.pass [${step.gate.pass.join(', ')}]`,
      observedVerdict: verdictRaw,
    };
  }
  return { kind: 'pass', verdict: verdictRaw };
}

// v0 prompt composition: name the step, enumerate accepted verdicts, and
// inline every reads-declared artifact (or a clear placeholder if the
// reads artifact hasn't been written yet — in explore, orchestrator-
// synthesis artifacts precede dispatch steps so this degrades gracefully
// at the fixture's current shape).
//
// Slice 53 (Codex MED 4 fold-in): tighten the response contract so the
// runner's `JSON.parse(result_body)` evaluator does not abort on real
// `claude` / `codex` adapter output that wraps the JSON in a Markdown
// fence or prose. Without this, every AGENT_SMOKE / CODEX_SMOKE run
// risks aborting at the first dispatch on a parse error — a live trap.
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
    'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.',
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

// Slice 47a (CONVERGENT HIGH A fold-in): compute the dispatch-event
// provenance honestly from the runner's actual decision path, instead
// of letting the materializer fabricate `{ source: 'default' }` on
// every event. Two cases at v0:
//   - The caller injected a dispatcher (tests, future role-keyed
//     routing) → `source: 'explicit'`. The DogfoodInvocation surface
//     does not yet name a registry, so we cannot honestly claim
//     `'role'` or `'circuit'` here — those become reachable when
//     P2.8 router introduces a workflow-keyed adapter registry.
//   - The runner picked the default → `source: 'default'`.
// A future P2-MODEL-EFFORT slice replaces this helper with a real
// resolver that honors precedence (`default → user-global → project →
// workflow → phase → step → invocation` per
// `src/schemas/selection-policy.ts SELECTION_PRECEDENCE`); the
// type contract at `materializeDispatch` does not change.
function deriveResolvedFrom(invocation: DogfoodInvocation): DispatchResolutionSource {
  return invocation.dispatcher !== undefined ? { source: 'explicit' } : { source: 'default' };
}

// Slice 47a (CONVERGENT HIGH A fold-in) + Codex challenger Slice 47a
// HIGH 1 fold-in: compose the effective `ResolvedSelection` from
// `workflow.default_selection` and `step.selection` per the SEL-I3
// `SkillOverride` operations and the SEL precedence chain.
//
//   - `workflow.default_selection` is consumed as the base layer.
//   - `step.selection` overlays right-biased per SEL precedence
//     (`workflow < step` per
//     `src/schemas/selection-policy.ts SELECTION_PRECEDENCE`).
//   - `SkillOverride` modes are folded as the contract requires
//     (`specs/contracts/selection.md §SEL-I3`):
//       * `inherit` — no-op (base unchanged).
//       * `replace` — base discarded, overlay's skills become the
//         new base for downstream layers.
//       * `append` — set-union of overlay skills with base.
//       * `remove` — set-difference (overlay skills removed from
//         base).
//     The original Slice 47a draft collapsed this to "pick the more-
//     specific layer's skills" which silently produced wrong sets
//     for legal `append` / `remove` overrides (Codex Slice 47a HIGH
//     1).
//   - `invocation_options` shallow-merges right-biased.
// Returns the canonical empty selection when neither layer declares
// anything, which is the same shape the materializer used to fabricate
// pre-Slice-47a — the difference is that pre-Slice-47a the empty was
// fabricated regardless of inputs, and post-Slice-47a it is derived
// from inputs that were genuinely empty.
function applySkillOp(base: readonly string[], op: SkillOverride | undefined): readonly string[] {
  if (op === undefined || op.mode === 'inherit') return base;
  if (op.mode === 'replace') return op.skills as readonly string[];
  if (op.mode === 'append') {
    const seen = new Set<string>(base);
    const out = [...base];
    for (const s of op.skills) {
      const key = s as unknown as string;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
    return out;
  }
  // mode === 'remove'
  const removeSet = new Set<string>(op.skills as ReadonlyArray<string>);
  return base.filter((s) => !removeSet.has(s));
}

function deriveResolvedSelection(
  workflow: Workflow,
  step: Workflow['steps'][number] & { kind: 'dispatch' },
): ResolvedSelection {
  const wf = workflow.default_selection;
  const st = step.selection;

  if (wf === undefined && st === undefined) {
    return { skills: [], invocation_options: {} };
  }

  // SEL-I3 fold: base = [] → workflow → step. Each `applySkillOp` is
  // the closed-form interpretation of the layer's `SkillOverride`
  // mode against the prior base.
  const afterWorkflow = applySkillOp([], wf?.skills);
  const afterStep = applySkillOp(afterWorkflow, st?.skills);
  const skills = afterStep as ResolvedSelection['skills'];

  const model = st?.model ?? wf?.model;
  const effort = st?.effort ?? wf?.effort;
  const rigor = st?.rigor ?? wf?.rigor;
  const invocation_options = {
    ...(wf?.invocation_options ?? {}),
    ...(st?.invocation_options ?? {}),
  };

  return {
    ...(model !== undefined ? { model } : {}),
    ...(effort !== undefined ? { effort } : {}),
    skills,
    ...(rigor !== undefined ? { rigor } : {}),
    invocation_options,
  };
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
  // Slice 47a Codex HIGH 2 fold-in — capture per-dispatch metadata
  // for AGENT_SMOKE / CODEX_SMOKE fingerprint binding to cli_version
  // without forcing a dispatch event schema bump.
  const dispatchResults: DispatchResultMetadata[] = [];
  let sequence = 1;
  const recordedAt = () => now().toISOString();
  const push = (ev: Event): void => {
    events.push(ev);
    appendAndDerive(runRoot, ev);
    sequence += 1;
  };

  // Walk the routes graph from entry.start_at. Terminate when a step's
  // route resolves to @complete (the only terminal dogfood-run-0
  // exercises; @stop/@escalate/@handoff are Phase 2 scope) or when a
  // dispatch gate fails (Slice 53 Codex H14 fold-in — `runOutcome`
  // mutates to `'aborted'` and the loop breaks before the route is
  // taken; the close-step still emits `run.closed` carrying the
  // aborted outcome and a reason that names the failing step).
  const stepsById = new Map(workflow.steps.map((s) => [s.id as unknown as string, s] as const));
  let currentStepId: string | undefined = entry.start_at as unknown as string;
  let runOutcome: RunClosedOutcome = 'complete';
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
      dispatchResults.push({
        stepId: step.id as unknown as string,
        adapterName: dispatcher.adapterName,
        cli_version: dispatchResult.cli_version,
      });
      // Slice 53 (Codex H14 fold-in): evaluate the gate against the
      // adapter's actual result_body BEFORE materializing, so the
      // verdict written into `dispatch.completed` reflects what the
      // adapter declared (or a sentinel on unparseable / no-verdict
      // cases). The transcript still materializes either way — the
      // dispatch happened, and the request/receipt/result bytes are
      // durable evidence of the call regardless of admission.
      const evaluation = evaluateDispatchGate(step, dispatchResult.result_body);
      const dispatchCompletedVerdict =
        evaluation.kind === 'pass'
          ? evaluation.verdict
          : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);
      // Slice 53 (Codex H2 fold-in): gate the canonical artifact write
      // on `evaluation.kind === 'pass'` per ADR-0008 §Decision.3a — the
      // canonical downstream-readable artifact at `writes.artifact.path`
      // is materialized ONLY after the verdict gate passes. The
      // transcript slots (request / receipt / result) remain durable
      // evidence on either path. Slice 54 (materializer schema-parse)
      // adds the symmetric schema-parse condition: artifact write
      // requires both verdict gate pass AND schema parse success.
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
          ...(step.writes.artifact === undefined || evaluation.kind !== 'pass'
            ? {}
            : { artifact: step.writes.artifact }),
        },
        // Slice 45a (P2.6 HIGH 3 fold-in): adapter identity is pulled
        // from the structured `DispatchFn` descriptor rather than from
        // a call-site literal. Future P2.7+ slices that route a second
        // adapter into `runDogfood` do so by injecting a dispatcher
        // with the matching `adapterName`; no further edit to this
        // site is required.
        adapterName: dispatcher.adapterName,
        // Slice 47a (CONVERGENT HIGH A fold-in): selection + provenance
        // are now derived from real inputs (workflow.default_selection
        // + step.selection right-biased; explicit-vs-default dispatcher
        // provenance) rather than hardcoded by the materializer. The
        // derivation helpers live above in this module so the runner is
        // the single owner of resolution at v0; P2-MODEL-EFFORT replaces
        // them with the full SEL-precedence resolver.
        resolvedSelection: deriveResolvedSelection(workflow, step),
        resolvedFrom: deriveResolvedFrom(inv),
        dispatchResult,
        verdict: dispatchCompletedVerdict,
        now,
      });
      for (const ev of materialized.events) {
        events.push(ev);
        appendAndDerive(runRoot, ev);
      }
      sequence = materialized.sequenceAfter;

      if (evaluation.kind === 'pass') {
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
        // Slice 53 (Codex H14 fold-in): gate-fail termination path.
        // Emit gate.evaluated with outcome=fail + reason, then
        // step.aborted with the same reason, then break out of the
        // loop. The post-loop run.closed emission picks up
        // `runOutcome='aborted'` and `closeReason` to record the
        // termination cause.
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'gate.evaluated',
          step_id: step.id,
          attempt,
          gate_kind: 'result_verdict',
          outcome: 'fail',
          reason: evaluation.reason,
        });
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'step.aborted',
          step_id: step.id,
          attempt,
          reason: evaluation.reason,
        });
        runOutcome = 'aborted';
        closeReason = evaluation.reason;
        currentStepId = undefined;
        break;
      }
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
    outcome: runOutcome,
    ...(closeReason === undefined ? {} : { reason: closeReason }),
  };
  push(closed);

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

function buildSummary(input: {
  workflow: Workflow;
  goal: string;
  events: Event[];
}): string {
  const stepCount = input.events.filter((e) => e.kind === 'step.completed').length;
  return `dogfood-run-0: ${input.workflow.id} v${input.workflow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

export type { RunId, WorkflowId };
