import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { BuiltInAdapter, DispatchResolutionSource } from '../schemas/adapter.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../schemas/artifacts/build.js';
import {
  ExploreAnalysis,
  ExploreBrief,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreSynthesis,
} from '../schemas/artifacts/explore.js';
import {
  ReviewDispatchResult,
  ReviewResult,
  computeReviewVerdict,
} from '../schemas/artifacts/review.js';
import { LayeredConfig, type LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Event, RunClosedOutcome } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { Snapshot } from '../schemas/snapshot.js';
import { Workflow } from '../schemas/workflow.js';
import { materializeDispatch } from './adapters/dispatch-materializer.js';
import { type AdapterDispatchInput, type DispatchResult, sha256Hex } from './adapters/shared.js';
import { parseArtifact } from './artifact-schemas.js';
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

type ArtifactWritingStep = Workflow['steps'][number] & {
  readonly writes: { readonly artifact: { readonly schema: string; readonly path: string } };
};

export type SynthesisWriterFn = (input: SynthesisWriterInput) => void;

export interface DogfoodInvocation {
  runRoot: string;
  workflow: Workflow;
  workflowBytes: Buffer;
  projectRoot?: string;
  runId: RunId;
  goal: string;
  rigor?: Rigor;
  entryModeName?: string;
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
  selectionConfigLayers?: readonly LayeredConfigValue[];
}

export interface CheckpointResumeInvocation {
  runRoot: string;
  selection: string;
  projectRoot?: string;
  now: () => Date;
  dispatcher?: DispatchFn;
  synthesisWriter?: SynthesisWriterFn;
  selectionConfigLayers?: readonly LayeredConfigValue[];
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

export interface CheckpointWaitingResult {
  readonly schema_version: 1;
  readonly run_id: RunId;
  readonly workflow_id: WorkflowId;
  readonly goal: string;
  readonly outcome: 'checkpoint_waiting';
  readonly summary: string;
  readonly events_observed: number;
  readonly manifest_hash: string;
  readonly checkpoint: {
    readonly step_id: string;
    readonly request_path: string;
    readonly allowed_choices: readonly string[];
  };
  readonly reason?: string;
}

export interface DogfoodRunResult {
  runRoot: string;
  result: RunResult | CheckpointWaitingResult;
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
    dispatchResponseInstruction(step),
  ].join('\n');
}

function dispatchResponseInstruction(
  step: Workflow['steps'][number] & { kind: 'dispatch' },
): string {
  if (step.writes.artifact?.schema === 'explore.synthesis@v1') {
    return [
      'Respond with a single raw JSON object whose top-level shape is exactly:',
      '{ "verdict": "<one-of-accepted-verdicts>", "subject": "<subject investigated>", "recommendation": "<primary conclusion or recommendation>", "success_condition_alignment": "<how the recommendation satisfies the brief success condition>", "supporting_aspects": [{ "aspect": "<analysis aspect name>", "contribution": "<how this aspect supports the recommendation>" }] }',
      'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
      'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against explore.synthesis@v1 before writing artifacts/synthesis.json.',
    ].join(' ');
  }

  if (step.writes.artifact?.schema === 'explore.review-verdict@v1') {
    return [
      'Respond with a single raw JSON object whose top-level shape is exactly:',
      '{ "verdict": "<one-of-accepted-verdicts>", "overall_assessment": "<review summary>", "objections": ["<blocking or follow-up objection>"], "missed_angles": ["<important angle not covered>"] }',
      'Use empty arrays when there are no objections or missed angles. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
      'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against explore.review-verdict@v1 before writing artifacts/review-verdict.json.',
    ].join(' ');
  }

  if (step.writes.artifact?.schema === 'build.implementation@v1') {
    return [
      'Respond with a single raw JSON object whose top-level shape is exactly:',
      '{ "verdict": "accept", "summary": "<what changed>", "changed_files": ["<project-relative path>"], "evidence": ["<verification or implementation evidence>"] }',
      'Use an empty changed_files array only when no file changed. Evidence must contain at least one item. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
      'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against build.implementation@v1 before writing artifacts/build/implementation.json.',
    ].join(' ');
  }

  if (step.writes.artifact?.schema === 'build.review@v1') {
    return [
      'Respond with a single raw JSON object whose top-level shape is exactly:',
      '{ "verdict": "<accept|accept-with-fixes|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
      'Use an empty findings array only with verdict "accept". Verdicts "accept-with-fixes" and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
      'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against build.review@v1 before writing artifacts/build/review.json.',
    ].join(' ');
  }

  if (
    step.role === 'reviewer' &&
    step.gate.pass.includes('NO_ISSUES_FOUND') &&
    step.gate.pass.includes('ISSUES_FOUND')
  ) {
    return [
      'Respond with a single raw JSON object whose top-level shape is exactly:',
      '{ "verdict": "<one-of-accepted-verdicts>", "findings": [{ "severity": "<critical|high|low>", "id": "<stable finding id>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
      'Use an empty findings array when there are no issues: { "verdict": "NO_ISSUES_FOUND", "findings": [] }.',
      'Use an empty file_refs array when a finding has no file-specific reference.',
      'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
      'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and the close step validates findings before writing artifacts/review-result.json.',
    ].join(' ');
  }

  return 'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.';
}

type DispatcherInvocationConfig = {
  readonly dispatcher?: DispatchFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
};

async function resolveDispatcher(inv: DispatcherInvocationConfig): Promise<DispatchFn> {
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
function deriveResolvedFrom(invocation: DispatcherInvocationConfig): DispatchResolutionSource {
  return invocation.dispatcher !== undefined ? { source: 'explicit' } : { source: 'default' };
}

function deriveResolvedSelection(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  step: Workflow['steps'][number] & { kind: 'dispatch' },
  rigor: Rigor,
): ResolvedSelection {
  return resolveSelectionForDispatch({
    workflow,
    step,
    configLayers: selectionConfigLayersForDispatch(inv, workflow, rigor),
  }).resolved;
}

function bindsExecutionRigorToDispatchSelection(workflow: Workflow): boolean {
  return (workflow.id as unknown as string) === 'build';
}

function selectionConfigLayersForDispatch(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  rigor: Rigor,
): readonly LayeredConfigValue[] {
  if (!bindsExecutionRigorToDispatchSelection(workflow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return selectionConfigLayersWithExecutionRigor(inv, workflow, rigor);
}

function selectionConfigLayersWithExecutionRigor(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  rigor: Rigor,
): readonly LayeredConfigValue[] {
  const layers = [...(inv.selectionConfigLayers ?? [])];
  const workflowId = workflow.id;
  const existingIndex = layers.findIndex((layer) => layer.layer === 'invocation');
  const existing = existingIndex === -1 ? undefined : layers[existingIndex];
  const baseConfig = existing?.config ?? {
    schema_version: 1,
    dispatch: {
      default: 'auto',
      roles: {},
      circuits: {},
      adapters: {},
    },
    circuits: {},
    defaults: {},
  };
  const existingCircuit = baseConfig.circuits[workflowId] ?? {};
  const selection = {
    ...(existingCircuit.selection ?? {}),
    rigor,
  };
  const invocationLayer = LayeredConfig.parse({
    layer: 'invocation',
    ...(existing?.source_path === undefined ? {} : { source_path: existing.source_path }),
    config: {
      ...baseConfig,
      circuits: {
        ...baseConfig.circuits,
        [workflowId]: {
          ...existingCircuit,
          selection,
        },
      },
    },
  });
  if (existingIndex === -1) {
    layers.push(invocationLayer);
  } else {
    layers[existingIndex] = invocationLayer;
  }
  return layers;
}

function adapterFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `dispatch step '${stepId}': adapter invocation failed (${message})`;
}

function synthesisFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `synthesis step '${stepId}': artifact writer failed (${message})`;
}

function verificationFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `verification step '${stepId}': artifact writer failed (${message})`;
}

function checkpointFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `checkpoint step '${stepId}': checkpoint handling failed (${message})`;
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
// event fires. The fallback body is a minimal deterministic JSON stub with
// one string placeholder per `step.gate.required` section, while registered
// schema-specific writers replace that fallback for stricter workflow
// artifacts. The deterministic close artifact is still hashable after test
// normalization, and repeat invocations against the same fixture remain
// idempotent.
// Slice 83 adds the first per-workflow registration for review.intake@v1
// and review.result@v1; Slices 89-93 add the explore-specific writers.
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

function isInsideOrSame(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

function resolveProjectRelativeCwd(projectRoot: string, cwd: string): string {
  const rootAbs = resolve(projectRoot);
  const targetAbs = resolve(rootAbs, cwd);
  if (!isInsideOrSame(rootAbs, targetAbs)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes project root`);
  }
  if (!existsSync(rootAbs)) {
    throw new Error(`verification project root rejected: ${rootAbs} does not exist`);
  }
  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of cwd.split('/')) {
    if (segment === '.') continue;
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} does not exist`);
    }
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} crosses symlink ${JSON.stringify(cursor)}`,
      );
    }
    const cursorReal = realpathSync.native(cursor);
    if (!isInsideOrSame(rootReal, cursorReal)) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root through ${JSON.stringify(cursor)}`,
      );
    }
  }
  const targetReal = realpathSync.native(targetAbs);
  if (!isInsideOrSame(rootReal, targetReal)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root`);
  }
  return targetReal;
}

const VERIFICATION_ENV_INHERIT_ALLOWLIST = [
  'PATH',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'WINDIR',
] as const;

function verificationEnvironment(commandEnv: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of VERIFICATION_ENV_INHERIT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...commandEnv };
}

function summarizeOutput(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes) return value;
  return bytes.subarray(0, maxBytes).toString('utf8');
}

type CheckpointWorkflowStep = Workflow['steps'][number] & { kind: 'checkpoint' };

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
      readonly autoResolved: boolean;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

function checkpointChoiceIds(step: CheckpointWorkflowStep): string[] {
  return step.policy.choices.map((choice) => choice.id);
}

function resolveCheckpoint(step: CheckpointWorkflowStep, rigor: Rigor): CheckpointResolution {
  if (rigor === 'deep' || rigor === 'tournament') return { kind: 'waiting' };
  if (rigor === 'autonomous') {
    const selection = step.policy.safe_autonomous_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous rigor without a declared safe autonomous choice`,
      };
    }
    return {
      kind: 'resolved',
      selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
    };
  }
  const selection = step.policy.safe_default_choice;
  if (selection === undefined) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot resolve ${rigor} rigor without a declared safe default choice`,
    };
  }
  return {
    kind: 'resolved',
    selection,
    resolutionSource: 'safe-default',
    autoResolved: true,
  };
}

function checkpointRequestBody(input: {
  readonly step: CheckpointWorkflowStep;
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly buildBriefSha256?: string;
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: input.step.policy.prompt,
    allowed_choices: checkpointChoiceIds(input.step),
    ...(input.step.policy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: input.step.policy.safe_default_choice }),
    ...(input.step.policy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: input.step.policy.safe_autonomous_choice }),
    execution_context: {
      ...(input.projectRoot === undefined ? {} : { project_root: input.projectRoot }),
      selection_config_layers: input.selectionConfigLayers,
      ...(input.buildBriefSha256 === undefined
        ? {}
        : { build_brief_sha256: input.buildBriefSha256 }),
    },
  };
}

function checkpointResponseBody(input: {
  readonly step: CheckpointWorkflowStep;
  readonly selection: string;
  readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    selection: input.selection,
    resolution_source: input.resolutionSource,
  };
}

function workflowFromManifestBytes(bytes: Buffer): Workflow {
  return Workflow.parse(JSON.parse(bytes.toString('utf8')));
}

interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly buildBriefSha256?: string;
}

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

const EXPLORE_BRIEF_ARTIFACT_PATH = 'artifacts/brief.json';
const BUILD_RESULT_ARTIFACT_POINTERS = [
  { artifact_id: 'build.brief', schema: 'build.brief@v1' },
  { artifact_id: 'build.plan', schema: 'build.plan@v1' },
  {
    artifact_id: 'build.implementation',
    schema: 'build.implementation@v1',
  },
  {
    artifact_id: 'build.verification',
    schema: 'build.verification@v1',
  },
  { artifact_id: 'build.review', schema: 'build.review@v1' },
] as const;
const EXPLORE_ARTIFACT_POINTERS = [
  { artifact_id: 'explore.brief', schema: 'explore.brief@v1' },
  { artifact_id: 'explore.analysis', schema: 'explore.analysis@v1' },
  { artifact_id: 'explore.synthesis', schema: 'explore.synthesis@v1' },
  { artifact_id: 'explore.review-verdict', schema: 'explore.review-verdict@v1' },
] as const;

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

function artifactPathForSchema(workflow: Workflow, schemaName: string): string {
  const matches = workflow.steps.filter(
    (candidate) => candidate.writes.artifact?.schema === schemaName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `artifact schema '${schemaName}' must be written by exactly one workflow step, found ${matches.length}`,
    );
  }
  const match = matches[0];
  if (match === undefined) {
    throw new Error(`artifact schema '${schemaName}' matched no workflow step`);
  }
  const artifact = match.writes.artifact;
  if (artifact === undefined) {
    throw new Error(`artifact schema '${schemaName}' matched a step without an artifact writer`);
  }
  return artifact.path as unknown as string;
}

function requiredCloseReadForSchema(
  workflow: Workflow,
  closeStep: ArtifactWritingStep,
  schemaName: string,
): string {
  return requiredReadForSchema(workflow, closeStep, schemaName, 'close step');
}

function requiredReadForSchema(
  workflow: Workflow,
  step: ArtifactWritingStep,
  schemaName: string,
  stepLabel = 'step',
): string {
  const path = artifactPathForSchema(workflow, schemaName);
  if (!step.reads.includes(path as never)) {
    throw new Error(
      `${step.writes.artifact.schema} requires ${stepLabel} '${step.id}' to read ${path}`,
    );
  }
  return path;
}

function tryWriteRegisteredSynthesisArtifact(input: SynthesisWriterInput): boolean {
  const { runRoot, workflow, step, goal } = input;
  const schemaName = step.writes.artifact.schema;

  if (schemaName === 'build.plan@v1') {
    const briefPath = requiredReadForSchema(workflow, step, 'build.brief@v1');
    const brief = BuildBrief.parse(readJsonArtifact(runRoot, briefPath));
    const artifact = BuildPlan.parse({
      objective: brief.objective,
      approach: `Make the smallest safe change inside scope: ${brief.scope}`,
      slices: brief.success_criteria.map((criterion) => `Satisfy: ${criterion}`),
      verification: {
        commands: brief.verification_command_candidates,
      },
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  if (schemaName === 'build.result@v1') {
    const briefPath = requiredCloseReadForSchema(workflow, step, 'build.brief@v1');
    const planPath = requiredCloseReadForSchema(workflow, step, 'build.plan@v1');
    const implementationPath = requiredCloseReadForSchema(
      workflow,
      step,
      'build.implementation@v1',
    );
    const verificationPath = requiredCloseReadForSchema(workflow, step, 'build.verification@v1');
    const reviewPath = requiredCloseReadForSchema(workflow, step, 'build.review@v1');
    const brief = BuildBrief.parse(readJsonArtifact(runRoot, briefPath));
    BuildPlan.parse(readJsonArtifact(runRoot, planPath));
    const implementation = BuildImplementation.parse(readJsonArtifact(runRoot, implementationPath));
    const verification = BuildVerification.parse(readJsonArtifact(runRoot, verificationPath));
    const review = BuildReview.parse(readJsonArtifact(runRoot, reviewPath));
    const artifact = BuildResult.parse({
      summary: `Build result for ${brief.objective}: ${implementation.summary}`,
      outcome:
        verification.overall_status === 'passed' && review.verdict !== 'reject'
          ? 'complete'
          : 'failed',
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      artifact_pointers: BUILD_RESULT_ARTIFACT_POINTERS.map((pointer) => ({
        ...pointer,
        path: artifactPathForSchema(workflow, pointer.schema),
      })),
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

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

  if (schemaName === 'explore.result@v1') {
    const synthesisPath = requiredCloseReadForSchema(workflow, step, 'explore.synthesis@v1');
    const reviewVerdictPath = requiredCloseReadForSchema(
      workflow,
      step,
      'explore.review-verdict@v1',
    );
    const synthesis = ExploreSynthesis.parse(readJsonArtifact(runRoot, synthesisPath));
    const reviewVerdict = ExploreReviewVerdict.parse(readJsonArtifact(runRoot, reviewVerdictPath));
    const artifact = ExploreResult.parse({
      summary: `Explore recommendation: ${synthesis.recommendation}`,
      verdict_snapshot: {
        synthesis_verdict: synthesis.verdict,
        review_verdict: reviewVerdict.verdict,
        objection_count: reviewVerdict.objections.length,
        missed_angle_count: reviewVerdict.missed_angles.length,
      },
      artifact_pointers: EXPLORE_ARTIFACT_POINTERS.map((pointer) => ({
        ...pointer,
        path: artifactPathForSchema(workflow, pointer.schema),
      })),
    });
    writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
    return true;
  }

  return false;
}

function writeVerificationArtifact(input: {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly step: Workflow['steps'][number] & { kind: 'verification' };
  readonly projectRoot: string;
}): BuildVerification {
  const { runRoot, workflow, step, projectRoot } = input;
  if (step.writes.artifact.schema !== 'build.verification@v1') {
    throw new Error(`verification step '${step.id}' has unsupported artifact schema`);
  }
  const planPath = requiredReadForSchema(workflow, step, 'build.plan@v1');
  const plan = BuildPlan.parse(readJsonArtifact(runRoot, planPath));
  const commandResults = plan.verification.commands.map((command) => {
    const started = Date.now();
    const result = spawnSync(command.argv[0] as string, command.argv.slice(1), {
      cwd: resolveProjectRelativeCwd(projectRoot, command.cwd),
      env: verificationEnvironment(command.env),
      encoding: 'utf8',
      maxBuffer: command.max_output_bytes,
      shell: false,
      timeout: command.timeout_ms,
    });
    const durationMs = Math.max(0, Date.now() - started);
    const exitCode =
      typeof result.status === 'number' && result.error === undefined ? result.status : 1;
    const status = exitCode === 0 ? 'passed' : 'failed';
    const stderrParts = [
      typeof result.stderr === 'string' ? result.stderr : '',
      result.error === undefined ? '' : result.error.message,
      result.signal === null ? '' : `signal: ${result.signal}`,
    ].filter((part) => part.length > 0);
    return {
      command_id: command.id,
      argv: command.argv,
      cwd: command.cwd,
      exit_code: exitCode,
      status,
      duration_ms: durationMs,
      stdout_summary: summarizeOutput(
        typeof result.stdout === 'string' ? result.stdout : '',
        command.max_output_bytes,
      ),
      stderr_summary: summarizeOutput(stderrParts.join('\n'), command.max_output_bytes),
    };
  });
  const artifact = BuildVerification.parse({
    overall_status: commandResults.some((command) => command.status === 'failed')
      ? 'failed'
      : 'passed',
    commands: commandResults,
  });
  writeJsonArtifact(runRoot, step.writes.artifact.path, artifact);
  return artifact;
}

function writeCheckpointOwnedArtifact(input: {
  readonly runRoot: string;
  readonly step: CheckpointWorkflowStep;
  readonly goal: string;
  readonly responsePath?: string;
  readonly existingBrief?: BuildBrief;
}): void {
  const artifact = input.step.writes.artifact;
  if (artifact === undefined) return;
  if (artifact.schema !== 'build.brief@v1') {
    throw new Error(`checkpoint step '${input.step.id}' has unsupported artifact schema`);
  }
  const template = input.step.policy.build_brief;
  if (template === undefined) {
    throw new Error(
      `checkpoint step '${input.step.id}' writing build.brief@v1 requires policy.build_brief`,
    );
  }
  const body =
    input.existingBrief === undefined
      ? BuildBrief.parse({
          objective: input.goal,
          scope: template.scope,
          success_criteria: template.success_criteria,
          verification_command_candidates: template.verification_command_candidates,
          checkpoint: {
            request_path: input.step.writes.request,
            ...(input.responsePath === undefined ? {} : { response_path: input.responsePath }),
            allowed_choices: checkpointChoiceIds(input.step),
          },
        })
      : BuildBrief.parse({
          ...input.existingBrief,
          checkpoint: {
            ...input.existingBrief.checkpoint,
            ...(input.responsePath === undefined ? {} : { response_path: input.responsePath }),
          },
        });
  writeJsonArtifact(input.runRoot, artifact.path, body);
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

interface ResumeCheckpointState {
  readonly stepId: string;
  readonly attempt: number;
  readonly selection: string;
  readonly existingBrief?: BuildBrief;
}

interface DogfoodExecutionContext {
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

function selectEntryMode(
  workflow: Workflow,
  entryModeName: string | undefined,
): Workflow['entry_modes'][number] {
  if (workflow.entry_modes.length === 0) {
    throw new Error(`runDogfood: workflow ${workflow.id} declares no entry_modes`);
  }
  if (entryModeName === undefined) {
    const entry = workflow.entry_modes[0];
    if (entry === undefined) {
      throw new Error(`runDogfood: workflow ${workflow.id} entry_modes[0] unreadable`);
    }
    return entry;
  }
  const entry = workflow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) {
    throw new Error(
      `runDogfood: workflow ${workflow.id} declares no entry_mode named '${entryModeName}'`,
    );
  }
  return entry;
}

// Narrow dogfood-run-0 loop. Walks routes from the selected entry_mode;
// for each step, appends the per-kind event trail; emits run.closed
// after the pass route reaches a terminal label; writes result.json last.
//
// Slice 43b: async so the dispatch branch can `await` the real adapter
// (or an injected stub). The signature is a breaking change for external
// callers — this is internal to Phase 1.5 / Phase 2 only (no external
// users yet).
async function executeDogfood(ctx: DogfoodExecutionContext): Promise<DogfoodRunResult> {
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
  let sequence = events.length;
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
    const isResumedCheckpoint = ctx.resumeCheckpoint?.stepId === currentStepId;
    const attempt = isResumedCheckpoint ? ctx.resumeCheckpoint.attempt : 1;

    if (!isResumedCheckpoint) {
      push({
        schema_version: 1,
        sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.entered',
        step_id: step.id,
        attempt,
      });
    }

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
    } else if (step.kind === 'verification') {
      let verification: BuildVerification;
      try {
        if (ctx.projectRoot === undefined) {
          throw new Error(
            `verification step '${step.id}' requires DogfoodInvocation.projectRoot for project-relative cwd resolution`,
          );
        }
        verification = writeVerificationArtifact({
          runRoot,
          workflow,
          step,
          projectRoot: ctx.projectRoot,
        });
      } catch (err) {
        if (isRunRelativePathError(err)) throw err;
        const reason = verificationFailureReason(step.id as unknown as string, err);
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
      if (verification.overall_status === 'passed') {
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
      } else {
        const reason = `verification step '${step.id}' failed one or more commands`;
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
    } else if (step.kind === 'checkpoint') {
      try {
        const requestAbs = resolveRunRelative(runRoot, step.writes.request);
        if (!isResumedCheckpoint) {
          writeCheckpointOwnedArtifact({ runRoot, step, goal });
          const buildBriefSha256 =
            step.writes.artifact?.schema === 'build.brief@v1'
              ? sha256Hex(
                  readFileSync(resolveRunRelative(runRoot, step.writes.artifact.path), 'utf8'),
                )
              : undefined;
          const requestText = `${JSON.stringify(
            checkpointRequestBody({
              step,
              ...(ctx.projectRoot === undefined ? {} : { projectRoot: ctx.projectRoot }),
              selectionConfigLayers: executionSelectionConfigLayers,
              ...(buildBriefSha256 === undefined ? {} : { buildBriefSha256 }),
            }),
            null,
            2,
          )}\n`;
          mkdirSync(dirname(requestAbs), { recursive: true });
          writeFileSync(requestAbs, requestText);
          push({
            schema_version: 1,
            sequence,
            recorded_at: recordedAt(),
            run_id: runId,
            kind: 'checkpoint.requested',
            step_id: step.id,
            attempt,
            options: checkpointChoiceIds(step),
            request_path: step.writes.request,
            request_artifact_hash: sha256Hex(requestText),
          });
          if (step.writes.artifact !== undefined) {
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
          }
        }

        const resolution: CheckpointResolution =
          isResumedCheckpoint && ctx.resumeCheckpoint !== undefined
            ? {
                kind: 'resolved',
                selection: ctx.resumeCheckpoint.selection,
                resolutionSource: 'operator',
                autoResolved: false,
              }
            : resolveCheckpoint(step, rigor);
        if (resolution.kind === 'waiting') {
          const snapshot = writeDerivedSnapshot(runRoot);
          return {
            runRoot,
            result: {
              schema_version: 1,
              run_id: runId,
              workflow_id: workflow.id,
              goal,
              outcome: 'checkpoint_waiting',
              summary: `checkpoint '${step.id}' is waiting for an operator choice.`,
              events_observed: events.length,
              manifest_hash: manifestHash,
              checkpoint: {
                step_id: step.id as unknown as string,
                request_path: requestAbs,
                allowed_choices: checkpointChoiceIds(step),
              },
            },
            snapshot,
            events,
            dispatchResults,
          };
        }

        if (resolution.kind === 'failed') {
          push({
            schema_version: 1,
            sequence,
            recorded_at: recordedAt(),
            run_id: runId,
            kind: 'gate.evaluated',
            step_id: step.id,
            attempt,
            gate_kind: 'checkpoint_selection',
            outcome: 'fail',
            reason: resolution.reason,
          });
          push({
            schema_version: 1,
            sequence,
            recorded_at: recordedAt(),
            run_id: runId,
            kind: 'step.aborted',
            step_id: step.id,
            attempt,
            reason: resolution.reason,
          });
          runOutcome = 'aborted';
          closeReason = resolution.reason;
          currentStepId = undefined;
          break;
        }

        if (!step.gate.allow.includes(resolution.selection)) {
          throw new Error(
            `checkpoint step '${step.id}' selected '${resolution.selection}' but gate.allow is [${step.gate.allow.join(', ')}]`,
          );
        }
        writeJsonArtifact(
          runRoot,
          step.writes.response,
          checkpointResponseBody({
            step,
            selection: resolution.selection,
            resolutionSource: resolution.resolutionSource,
          }),
        );
        writeCheckpointOwnedArtifact({
          runRoot,
          step,
          goal,
          responsePath: step.writes.response,
          ...(ctx.resumeCheckpoint?.existingBrief === undefined
            ? {}
            : { existingBrief: ctx.resumeCheckpoint.existingBrief }),
        });
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'checkpoint.resolved',
          step_id: step.id,
          attempt,
          selection: resolution.selection,
          auto_resolved: resolution.autoResolved,
          resolution_source: resolution.resolutionSource,
          response_path: step.writes.response,
        });
        if (step.writes.artifact !== undefined) {
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
        }
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'gate.evaluated',
          step_id: step.id,
          attempt,
          gate_kind: 'checkpoint_selection',
          outcome: 'pass',
        });
      } catch (err) {
        if (isRunRelativePathError(err)) throw err;
        const reason = checkpointFailureReason(step.id as unknown as string, err);
        push({
          schema_version: 1,
          sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'gate.evaluated',
          step_id: step.id,
          attempt,
          gate_kind: 'checkpoint_selection',
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
    } else if (step.kind === 'dispatch') {
      const prompt = composeDispatchPrompt(step, runRoot);
      const resolvedSelection = deriveResolvedSelection(ctx, workflow, step, rigor);
      const dispatchInput: DispatchInput = { prompt, resolvedSelection };
      if (step.budgets?.wall_clock_ms !== undefined) {
        dispatchInput.timeoutMs = step.budgets.wall_clock_ms;
      }
      const resolvedFrom = deriveResolvedFrom(ctx);
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

export async function runDogfood(inv: DogfoodInvocation): Promise<DogfoodRunResult> {
  return executeDogfood(inv);
}

export async function resumeDogfoodCheckpoint(
  inv: CheckpointResumeInvocation,
): Promise<DogfoodRunResult> {
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

  return executeDogfood({
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

function buildSummary(input: {
  workflow: Workflow;
  goal: string;
  events: Event[];
}): string {
  const stepCount = input.events.filter((e) => e.kind === 'step.completed').length;
  return `dogfood-run-0: ${input.workflow.id} v${input.workflow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

export type { RunId, WorkflowId };
