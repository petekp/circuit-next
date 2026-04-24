import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { BuiltInAdapter, DispatchResolutionSource } from '../schemas/adapter.js';
import { ExploreAnalysis, ExploreBrief } from '../schemas/artifacts/explore.js';
import {
  ReviewDispatchResult,
  ReviewResult,
  computeReviewVerdict,
} from '../schemas/artifacts/review.js';
import type { LayeredConfig } from '../schemas/config.js';
import type { Event, RunClosedOutcome } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { Workflow } from '../schemas/workflow.js';
import { materializeDispatch } from './adapters/dispatch-materializer.js';
import { type AdapterDispatchInput, type DispatchResult, sha256Hex } from './adapters/shared.js';
import { parseArtifact } from './artifact-schemas.js';
import { appendEvent, eventLogPath } from './event-writer.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import { writeResult } from './result-writer.js';
import { resolveRunRelative } from './run-relative-path.js';
import { resolveSelectionForDispatch } from './selection-resolver.js';
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

const RUN_ROOT_CLAIM_FILE = '.run-root.claim';

export interface FreshRunRootClaim {
  readonly runRoot: string;
  readonly path: string;
}

function runRootReuseError(runRoot: string, detail: string): Error {
  return new Error(
    `run-root reuse rejected for ${runRoot}: ${detail}; resume mode does not exist yet`,
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
  readonly dispatch: (input: DispatchInput) => Promise<DispatchResult>;
}

export interface DispatchInput extends AdapterDispatchInput {
  readonly resolvedSelection?: ResolvedSelection;
}

export interface SynthesisWriterInput {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly step: Workflow['steps'][number] & { kind: 'synthesis' };
  readonly goal: string;
}

export type SynthesisWriterFn = (input: SynthesisWriterInput) => void;

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
  // Test seam for deterministic synthesis fixtures. Production invocations
  // omit this and use the registered writer below, which now has a narrow
  // review.result implementation plus the existing placeholder fallback.
  synthesisWriter?: SynthesisWriterFn;
  // Parsed config layers are supplied by callers that have already handled
  // discovery/loading. The product CLI discovers user-global and project
  // layers at v0; direct runtime callers can still inject already-parsed
  // layers, including default/invocation seams for tests and future entry
  // points.
  selectionConfigLayers?: readonly LayeredConfig[];
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
            const abs = resolveRunRelative(runRoot, path);
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
// Adapter provenance remains separate from model/effort selection: the
// selection resolver now owns the `resolved_selection` surface, while this
// helper names only how the adapter itself was chosen.
function deriveResolvedFrom(invocation: DogfoodInvocation): DispatchResolutionSource {
  return invocation.dispatcher !== undefined ? { source: 'explicit' } : { source: 'default' };
}

function deriveResolvedSelection(
  inv: DogfoodInvocation,
  workflow: Workflow,
  step: Workflow['steps'][number] & { kind: 'dispatch' },
): ResolvedSelection {
  return resolveSelectionForDispatch({
    workflow,
    step,
    ...(inv.selectionConfigLayers !== undefined ? { configLayers: inv.selectionConfigLayers } : {}),
  }).resolved;
}

function adapterFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `dispatch step '${stepId}': adapter invocation failed (${message})`;
}

function synthesisFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `synthesis step '${stepId}': artifact writer failed (${message})`;
}

function isRunRelativePathError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('run-relative path rejected');
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

// Slice 43c: orchestrator-synthesis steps land an artifact file at
// `runRoot/step.writes.artifact.path` before their `step.artifact_written`
// event fires. At v0 the body is a minimal deterministic JSON stub with
// one string placeholder per `step.gate.required` section — sufficient to
// (a) let downstream steps' `reads[]` find the file (prompt composition +
// final close-step reads), (b) let the close-step's artifact
// (`artifacts/explore-result.json` in explore) land deterministically so
// a byte-shape golden can hash it, and (c) keep the close-step at the end
// of the run idempotent for repeat invocations against the same fixture.
// Slice 83 adds the first per-workflow registration for review.intake@v1
// and review.result@v1; other synthesis schemas keep the placeholder
// fallback until their own schema-specific writers land.
function writeJsonArtifact(runRoot: string, path: string, body: unknown): void {
  const abs = resolveRunRelative(runRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function readJsonArtifact(runRoot: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runRoot, path), 'utf8')) as unknown;
}

type DispatchWorkflowStep = Workflow['steps'][number] & { kind: 'dispatch' };

function isDispatchStep(step: Workflow['steps'][number]): step is DispatchWorkflowStep {
  return step.kind === 'dispatch';
}

const EXPLORE_BRIEF_ARTIFACT_PATH = 'artifacts/brief.json';

function reviewAnalyzeResultPath(
  workflow: Workflow,
  closeStep: SynthesisWriterInput['step'],
): string {
  const closeStepId = closeStep.id as unknown as string;
  const reviewerDispatches = workflow.steps.filter(
    (candidate): candidate is DispatchWorkflowStep =>
      isDispatchStep(candidate) &&
      candidate.role === 'reviewer' &&
      (candidate.routes.pass as unknown as string) === closeStepId,
  );
  if (reviewerDispatches.length !== 1) {
    throw new Error(
      `review.result@v1 requires exactly one reviewer dispatch routing to '${closeStepId}', found ${reviewerDispatches.length}`,
    );
  }
  const resultPath = reviewerDispatches[0]?.writes.result as unknown as string | undefined;
  if (resultPath === undefined || !closeStep.reads.includes(resultPath as never)) {
    throw new Error(
      `review.result@v1 requires close step '${closeStepId}' to read the reviewer dispatch result path '${resultPath ?? '<missing>'}'`,
    );
  }
  return resultPath;
}

function tryWriteRegisteredSynthesisArtifact(input: SynthesisWriterInput): boolean {
  const { runRoot, workflow, step, goal } = input;
  const schemaName = step.writes.artifact.schema;

  if (schemaName === 'explore.brief@v1') {
    const artifact = ExploreBrief.parse({
      subject: goal,
      task: goal,
      success_condition: `Produce a useful explore result for: ${goal}`,
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  if (schemaName === 'explore.analysis@v1') {
    const briefPath = step.reads.find((path) => path === EXPLORE_BRIEF_ARTIFACT_PATH) as
      | string
      | undefined;
    if (briefPath === undefined) {
      throw new Error(
        `explore.analysis@v1 requires step '${step.id}' to read ${EXPLORE_BRIEF_ARTIFACT_PATH}`,
      );
    }
    const brief = ExploreBrief.parse(readJsonArtifact(runRoot, briefPath));
    const artifact = ExploreAnalysis.parse({
      subject: brief.subject,
      aspects: [
        {
          name: 'task-framing',
          summary: `Initial analysis for: ${brief.task}`,
          evidence: [
            {
              source: briefPath,
              summary: brief.success_condition,
            },
          ],
        },
      ],
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  if (schemaName === 'review.intake@v1') {
    writeJsonArtifact(runRoot, step.writes.artifact.path, { scope: goal });
    return true;
  }

  if (schemaName === 'review.result@v1') {
    const dispatchResult = ReviewDispatchResult.parse(
      readJsonArtifact(runRoot, reviewAnalyzeResultPath(workflow, step)),
    );
    const artifact = ReviewResult.parse({
      scope: goal,
      findings: dispatchResult.findings,
      verdict: computeReviewVerdict(dispatchResult.findings),
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  return false;
}

function writeSynthesisArtifact(input: SynthesisWriterInput): void {
  const { runRoot, step } = input;
  if (tryWriteRegisteredSynthesisArtifact(input)) return;
  const body: Record<string, string> = {};
  for (const section of step.gate.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeJsonArtifact(runRoot, step.writes.artifact.path, body);
}

// Narrow dogfood-run-0 loop. Walks routes from the single entry_mode;
// for each step, appends the per-kind event trail; emits run.closed
// after the pass route reaches a terminal label; writes result.json last.
//
// Slice 43b: async so the dispatch branch can `await` the real adapter
// (or an injected stub). The signature is a breaking change for external
// callers — this is internal to Phase 1.5 / Phase 2 only (no external
// users yet).
export async function runDogfood(inv: DogfoodInvocation): Promise<DogfoodRunResult> {
  const { runRoot, workflow, workflowBytes, runId, goal, rigor, lane, now } = inv;
  const dispatcher = await resolveDispatcher(inv);
  const synthesisWriter = inv.synthesisWriter ?? writeSynthesisArtifact;

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
  // pass route resolves to one of the terminal route labels, or when a
  // dispatch gate fails (Slice 53 Codex H14 fold-in — `runOutcome`
  // mutates to `'aborted'` and the loop breaks before the route is
  // taken; the close-step still emits `run.closed` carrying the
  // aborted outcome and a reason that names the failing step).
  const stepsById = new Map(workflow.steps.map((s) => [s.id as unknown as string, s] as const));
  const executedStepIds = new Set<string>();
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
    if (executedStepIds.has(currentStepId)) {
      runOutcome = 'aborted';
      closeReason = `pass-route cycle detected at step '${currentStepId}'; aborting run before re-entering an already executed step`;
      currentStepId = undefined;
      break;
    }
    executedStepIds.add(currentStepId);
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
      try {
        synthesisWriter({ runRoot, workflow, step, goal });
      } catch (err) {
        if (isRunRelativePathError(err)) throw err;
        const reason = synthesisFailureReason(step.id as unknown as string, err);
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'gate.evaluated',
          step_id: step.id,
          attempt,
          gate_kind: 'schema_sections',
          outcome: 'fail',
          reason,
        });
        push({
          schema_version: 1,
          sequence,
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
      const resolvedSelection = deriveResolvedSelection(inv, workflow, step);
      const dispatchInput: DispatchInput = { prompt, resolvedSelection };
      if (step.budgets?.wall_clock_ms !== undefined) {
        dispatchInput.timeoutMs = step.budgets.wall_clock_ms;
      }
      const resolvedFrom = deriveResolvedFrom(inv);
      const requestAbs = resolveRunRelative(runRoot, step.writes.request);
      mkdirSync(dirname(requestAbs), { recursive: true });
      writeFileSync(requestAbs, prompt);
      const requestPayloadHash = sha256Hex(prompt);
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'dispatch.started',
        step_id: step.id,
        attempt,
        adapter: { kind: 'builtin', name: dispatcher.adapterName },
        role: step.role,
        resolved_selection: resolvedSelection,
        resolved_from: resolvedFrom,
      });
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'dispatch.request',
        step_id: step.id,
        attempt,
        request_payload_hash: requestPayloadHash,
      });

      let dispatchResult: DispatchResult;
      try {
        dispatchResult = await dispatcher.dispatch(dispatchInput);
      } catch (err) {
        const reason = adapterFailureReason(step.id as unknown as string, err);
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'dispatch.failed',
          step_id: step.id,
          attempt,
          adapter: { kind: 'builtin', name: dispatcher.adapterName },
          role: step.role,
          resolved_selection: resolvedSelection,
          resolved_from: resolvedFrom,
          request_payload_hash: requestPayloadHash,
          reason,
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
          outcome: 'fail',
          reason,
        });
        push({
          schema_version: 1,
          sequence,
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
      //
      // Slice 54 (Codex H15 fold-in): when the Slice 53 gate admits
      // a verdict AND the step declares `writes.artifact`, schema-
      // parse `dispatchResult.result_body` against
      // `writes.artifact.schema` via `src/runtime/artifact-schemas.ts`.
      // A parse failure coerces the evaluation to `kind: 'fail'` with
      // the parse reason — mirroring the Slice 53 reject-on-bad-
      // verdict shape so the content/schema failure-path event surface
      // stays uniform. It does not emit `dispatch.failed`; that event is
      // reserved for adapter invocation exceptions where no adapter
      // result exists. Artifact write requires BOTH gate pass (Slice 53)
      // AND schema parse pass (Slice 54); failure on either path leaves
      // `writes.artifact.path` absent on disk. Fail-closed on
      // unknown schema names per contract MUST.
      const gateEvaluation = evaluateDispatchGate(step, dispatchResult.result_body);
      let evaluation: GateEvaluation = gateEvaluation;
      if (gateEvaluation.kind === 'pass' && step.writes.artifact !== undefined) {
        const parseResult = parseArtifact(step.writes.artifact.schema, dispatchResult.result_body);
        if (parseResult.kind === 'fail') {
          evaluation = {
            kind: 'fail',
            reason: `dispatch step '${step.id}': ${parseResult.reason}`,
            observedVerdict: gateEvaluation.verdict,
          };
        }
      }
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
        // are derived from real inputs rather than hardcoded by the
        // materializer. Slice 85 replaced the temporary workflow/step
        // selection helper with the full SEL-precedence resolver; adapter
        // provenance remains separate because it describes how the
        // dispatcher itself was chosen.
        resolvedSelection,
        resolvedFrom,
        dispatchResult,
        verdict: dispatchCompletedVerdict,
        now,
        priorStart: { requestPayloadHash },
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
    const terminalOutcome = terminalOutcomeForRoute(passRoute);

    if (terminalOutcome === undefined && executedStepIds.has(passRoute)) {
      const reason = `pass-route cycle detected: step '${step.id}' routes to already executed step '${passRoute}'`;
      push({
        schema_version: 1,
        sequence,
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
      sequence,
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
