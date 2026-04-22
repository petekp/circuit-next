/**
 * Type declarations for scripts/audit.mjs — a Node ESM script that also
 * exports small helpers consumed by
 * tests/contracts/artifact-authority.test.ts:
 *   - `schemaExportPresent` (Slice 11, schema-exports existence hardening;
 *     broadened Slice 23 Codex HIGH #6)
 *   - `planeIsValid` (Slice 12, ADR-0004 plane classifier)
 *   - `trustBoundaryHasOriginToken` (Slice 12, ADR-0004 data-plane detail rule)
 *   - `readFrontmatter` (Slice 23, shared frontmatter reader)
 *   - `collectSchemaExports` (Slice 23, schema-export coverage ledger;
 *     `_`-filter tightened Slice 23 Codex MED #8)
 *   - `contractReciprocatesArtifact` (Slice 23, reverse reciprocation)
 *   - `COMPILE_TIME_GUARD_PATTERN` (Slice 23 Codex MED #8 fold-in)
 *   - `SCHEMA_FILE_ALLOWLIST` (Slice 23, schema-file allowlist with
 *     symbol-level known_exports + pending-artifact tracking per Codex
 *     HIGH #4 + MED #9)
 *   - `findAbsoluteSymlinks` (Slice 25a, specs portability guard consumed by
 *     tests/contracts/specs-portability.test.ts)
 *   - governance-reform helpers (Slice 25b) consumed by
 *     tests/contracts/governance-reform.test.ts
 */
export type AuditCheckResult = { level: 'green' | 'yellow' | 'red'; detail: string };

export function schemaExportPresent(schemaSrc: string, name: string): boolean;
export function planeIsValid(plane: unknown): boolean;
export function trustBoundaryHasOriginToken(boundary: unknown): boolean;
export function readFrontmatter(
  absPath: string,
):
  | { ok: true; frontmatter: Record<string, unknown>; error?: undefined }
  | { ok: false; error: string; frontmatter?: undefined };
export function collectSchemaExports(schemaSrc: string): Set<string>;
export function contractReciprocatesArtifact(
  contractFrontmatter: Record<string, unknown> | null | undefined,
  artifactId: string,
): boolean;
export const COMPILE_TIME_GUARD_PATTERN: RegExp;

type SchemaAllowlistSharedPrimitive = {
  category: 'shared-primitive';
  reason: string;
  known_exports: string[];
};

type SchemaAllowlistPendingArtifact = {
  category: 'pending-artifact';
  reason: string;
  known_exports: string[];
  tracking_slice: number;
  tracking_objection: string;
};

export const SCHEMA_FILE_ALLOWLIST: Record<
  string,
  SchemaAllowlistSharedPrimitive | SchemaAllowlistPendingArtifact
>;

export function findAbsoluteSymlinks(
  rootDir: string,
  containmentRoot?: string,
): Array<{ path: string; target: string; reason: 'absolute' | 'escapes-repo' }>;

export function parseMarkdownTable(
  markdown: string,
  requiredColumns: string[],
):
  | { ok: true; columns: string[]; rows: Array<Record<string, string>> }
  | { ok: false; error: string; columns: string[]; rows: [] };

export type ProductGateExemptionRow = {
  phase_id: string;
  slice: string;
  reason: string;
  consumed: boolean;
};

export function parseProductGateExemptionLedger(
  ledgerPath: string,
):
  | { ok: true; issues: []; rows: ProductGateExemptionRow[] }
  | { ok: false; issues: string[]; rows: ProductGateExemptionRow[] };
export function checkProductRealityGateVisibility(rootDir?: string): AuditCheckResult;

export type TierClaimRow = {
  claim_id: string;
  status: string;
  file_paths: string[];
  planned_slice: string;
  rationale: string;
};

export function parseTierClaims(tierPath: string): {
  ok: boolean;
  issues: string[];
  rows: TierClaimRow[];
};
export function checkTierOrphanClaims(rootDir?: string): AuditCheckResult;
export function checkAdversarialYieldLedger(rootDir?: string): AuditCheckResult;

// Slice 26a — ADR-0003 Addendum B persisted-wrapper binding guard.
export type WrapperAggregateEntry = {
  reason: string;
  added_in_slice: string;
  adr_addendum: string;
};
export const WRAPPER_AGGREGATE_EXPORTS: Record<string, WrapperAggregateEntry>;

export type WrapperBindingViolation = {
  wrapper_export: string;
  reason: string;
  backing_paths: string[];
};
export function detectWrapperAggregateBinding(artifact: unknown): WrapperBindingViolation | null;
export function checkPersistedWrapperBinding(rootDir?: string): AuditCheckResult;

// Slice 26b — status-epoch alignment, status-docs-current, and pinned ratchet floor.
export const SLICE_ID_PATTERN: RegExp;
export function isValidSliceId(value: unknown): boolean;

export const CURRENT_SLICE_MARKER_PATTERN: RegExp;
export function extractCurrentSliceMarker(text: unknown): string | null;
export function checkStatusEpochAlignment(rootDir?: string): AuditCheckResult;

export const SLICE_COMMIT_SUBJECT_PATTERN: RegExp;
export function extractSliceIdFromCommitSubject(subject: unknown): string | null;
export function checkStatusDocsCurrent(rootDir?: string): AuditCheckResult;

export type PinnedRatchetFloorData = {
  schema_version: number;
  floors: { contract_test_count: number } & Record<string, number>;
  last_advanced_at: string;
  last_advanced_in_slice: string;
  notes?: string;
};
export function readPinnedRatchetFloor(rootDir?: string): PinnedRatchetFloorData | null;
export function validatePinnedRatchetFloorData(floorData: unknown): string[];
export function checkPinnedRatchetFloor(
  rootDir?: string,
  headCountInput?: number,
): AuditCheckResult;

// Slice 25d — ADR-0001 Addendum B phase-graph authority ratchet. Phase 1.5
// semantics live in the ADR; decision.md / README / PROJECT_STATE mirror.
export function checkPhaseAuthoritySemantics(rootDir?: string): AuditCheckResult;

// Slice 31a — CC#14 retarget presence (ADR-0006). When any authority surface
// claims Phase 2 open, the 14a operator product-direction check + 14b
// Delegation acknowledgment citing ADR-0006 + ADR-0006 file must all exist.
export function checkCc14RetargetPresence(rootDir?: string): AuditCheckResult;

// Slice 32 (P2.1) — Phase 2 slice isolation citation (ADR-0007 CC#P2-7 interim
// enforcement). For every Phase 2 slice commit touching isolation-protected
// paths (specs/, tests/, .github/, .claude-plugin/, .claude/hooks/, src/,
// scripts/), require explicit isolation posture in the commit body or
// Break-Glass lane.
export function checkPhase2SliceIsolationCitation(
  disciplinedCommits: ReadonlyArray<{
    hash: string;
    short: string;
    subject: string;
    body: string;
  }>,
): AuditCheckResult;

// Slice 33 (P2.2) — Plugin command closure (ADR-0007 CC#P2-3 enforcement).
// Verifies closure between .claude-plugin/plugin.json `commands` array and
// .claude-plugin/commands/*.md files, plus required anchor commands
// (`circuit:run`, `circuit:explore`) presence.
export function checkPluginCommandClosure(rootDir?: string): AuditCheckResult;

// Slice 34 (P2.3) — Spine coverage (ADR-0007 CC#P2-6 + EXPLORE-I1 enforcement).
// Verifies every known-kind workflow fixture under
// .claude-plugin/skills/<kind>/circuit.json declares the expected canonical
// phase set for its workflow-kind. Known kinds at P2.3 landing: `explore`.
// Unknown kinds pass through information-only; `dogfood-run-0` is exempt.
//
// Slice 43a (HIGH 5 retargeting, P2.5) refactored Check 24 to delegate
// the canonical-phase-set check to scripts/policy/workflow-kind-policy.mjs;
// the re-exports here let existing test imports continue to pull these
// constants through audit.mjs at their original paths.
export function checkSpineCoverage(rootDir?: string): AuditCheckResult;

export type WorkflowKindCanonicalSetsEntry = {
  readonly canonicals: readonly string[];
  readonly omits: readonly string[];
  readonly title: string;
  readonly authority: string;
};
export const WORKFLOW_KIND_CANONICAL_SETS: Record<string, WorkflowKindCanonicalSetsEntry>;
export const EXEMPT_WORKFLOW_IDS: ReadonlySet<string>;

// Slice 35 (pre-P2.4 fold-in #1) — artifact registry backing-path integrity
// check. Walks specs/artifacts.json and flags any two distinct artifacts whose
// normalized backing_paths collide. Template-prefix synonyms (e.g.
// <circuit-next-run-root> vs <run-root>) are normalized before comparison.
// Tracked collisions are downgraded to yellow with a closing-slice reference;
// untracked collisions are red.
export const ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS: Readonly<Record<string, string>>;

export type ArtifactBackingPathContainerEntry = {
  readonly rationale: string;
  readonly allowed_artifact_ids: ReadonlySet<string>;
};

export const ARTIFACT_BACKING_PATH_CONTAINER_PATHS: Map<string, ArtifactBackingPathContainerEntry>;

export type ArtifactBackingPathKnownCollision = {
  readonly normalized: string;
  readonly artifact_ids: readonly string[];
  readonly closing_slice: number;
  readonly reason: string;
};
export const ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS: ReadonlyArray<ArtifactBackingPathKnownCollision>;
export function normalizeArtifactBackingPath(raw: unknown): string | null;
export type CheckArtifactBackingPathIntegrityOptions = {
  /** Enables stale-allowlist detection. Default: true when rootDir is the
   * live repo root, false for test fixtures (to avoid the global allowlist
   * spuriously tripping on unrelated fixtures). */
  strictAllowlist?: boolean;
  /** Optional override of the module-level
   * ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS constant. Added at Slice 39 so
   * tests can inject synthetic tracked-collision entries after the founding
   * entry was deleted (HIGH 4 fold-in). Defaults to the module constant. */
  knownCollisions?: ReadonlyArray<ArtifactBackingPathKnownCollision>;
};
export function checkArtifactBackingPathIntegrity(
  rootDir?: string,
  opts?: CheckArtifactBackingPathIntegrityOptions,
): AuditCheckResult;

// Slice 35 fold-in (Codex challenger HIGH 4) — arc-close composition-review
// presence gate for the pre-P2.4 fold-in arc specifically. Fires red when
// current_slice has advanced past the arc's last slice but no arc-close
// composition review file exists under specs/reviews/ with an ACCEPT or
// ACCEPT-WITH-FOLD-INS closing verdict.
export const PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE: number;
export const PHASE_2_P2_4_P2_5_ARC_LAST_SLICE: number;
export const ARC_CLOSE_GATES: ReadonlyArray<{
  readonly arc_id: string;
  readonly description: string;
  readonly ceremony_slice: number;
  readonly plan_path: string;
  readonly review_file_regex: RegExp;
}>;
export function checkArcCloseCompositionReviewPresence(rootDir?: string): AuditCheckResult;

// Slice 38 — adapter-binding coverage gate (ADR-0008 §Decision.4 +
// §Decision.3a). For every workflow fixture under
// `.claude-plugin/skills/<kind>/circuit.json` whose `id` is registered in
// WORKFLOW_KIND_CANONICAL_SETS (scheduled for P2.5+ enforcement under
// CC#P2-1), enforces three rules:
//   (1) at least one step with `kind: "dispatch"`;
//   (2) kind-specific dispatch step-id binding (from
//       WORKFLOW_KIND_DISPATCH_POLICY) — required step ids MUST exist
//       and have kind=dispatch;
//   (3) require_writes_artifact_on_dispatch — every dispatch step
//       declares writes.artifact alongside writes.result so the
//       materialization rule at §Decision.3a has a target.
// Red on any rule violation. Exempt fixtures pass through green; unknown
// workflow kinds produce yellow findings (Codex Slice 38 MED 2 fold-in).
export type WorkflowKindDispatchPolicy = {
  readonly require_dispatch_step_ids: readonly string[];
  readonly require_writes_artifact_on_dispatch: boolean;
  readonly authority: string;
};
export const WORKFLOW_KIND_DISPATCH_POLICY: Readonly<Record<string, WorkflowKindDispatchPolicy>>;
export function checkAdapterBindingCoverage(rootDir?: string): AuditCheckResult;

// Slice 41 — ADR-0009 adapter invocation discipline. package.json MUST NOT
// declare any forbidden-SDK dep identifier; v0 invocation pattern is
// subprocess-per-adapter. The forbidden list is extensible via ADR-0009
// reopen (Options A / B2 / C / D in §3).
export const FORBIDDEN_ADAPTER_SDK_DEPS: readonly string[];
export type CheckAdapterInvocationDisciplineOptions = {
  /** Optional override of the package.json path for test fixtures. */
  packageJsonPath?: string;
  /** Optional override of the forbidden-dep allowlist for test fixtures. */
  forbiddenDeps?: readonly string[];
};
export function checkAdapterInvocationDiscipline(
  rootDir?: string,
  opts?: CheckAdapterInvocationDisciplineOptions,
): AuditCheckResult;

// Slice 42 (P2.4) — ADR-0009 §4 Slice 42 binding + Codex Slice 41 HIGH 2
// fold-in. Import-level scan over src/runtime/adapters/** that rejects any
// import/require specifier matching FORBIDDEN_ADAPTER_SDK_DEPS (exact or
// `<id>/…` subpath). Complements Check 28 (dep-level) by catching
// transitively-installed SDK imports that the package.json-only check
// cannot see.
export type CheckAdapterImportDisciplineOptions = {
  /** Optional override of the adapters directory for test fixtures. */
  adaptersDir?: string;
  /** Optional override of the forbidden-dep allowlist for test fixtures. */
  forbiddenDeps?: readonly string[];
};
export function checkAdapterImportDiscipline(
  rootDir?: string,
  opts?: CheckAdapterImportDisciplineOptions,
): AuditCheckResult;
export function extractImportSpecifiers(content: string): string[];

// Slice 43c (P2.5 CC#P2-1 + CC#P2-2) — AGENT_SMOKE fingerprint
// commit-ancestor audit. When `tests/fixtures/agent-smoke/last-run.json`
// exists, verifies the fingerprint's `commit_sha` resolves in-repo and
// is an ancestor of HEAD. Missing file is yellow (ADR-0007 CC#P2-2
// CI-skip semantics — local AGENT_SMOKE runs are opt-in until Phase 2
// close); malformed JSON or non-ancestor SHA is red.
export type CheckAgentSmokeFingerprintOptions = {
  /** Optional override of the fingerprint file path for test fixtures. */
  fingerprintPath?: string;
};
export function checkAgentSmokeFingerprint(
  rootDir?: string,
  opts?: CheckAgentSmokeFingerprintOptions,
): AuditCheckResult;

// Slice 45 (P2.6 CC#P2-2 second-adapter evidence) — CODEX_SMOKE
// fingerprint audit. Base validation delegates to
// `checkAgentSmokeFingerprint`; layers adapter-surface drift detection
// per Codex Slice 45 HIGH 4 fold-in. Defaults to
// `tests/fixtures/codex-smoke/last-run.json`.
export function checkCodexSmokeFingerprint(
  rootDir?: string,
  opts?: CheckAgentSmokeFingerprintOptions,
): AuditCheckResult;

export const CODEX_ADAPTER_SOURCE_PATHS: readonly string[];

/**
 * Compute sha256 over the concatenation of the codex adapter-layer
 * source files. Used by Check 32 to detect adapter surface drift
 * against a recorded fingerprint's adapter_source_sha256 field.
 */
export function computeCodexAdapterSourceSha256(rootDir?: string): string;

// Slice 46 (P2.7a, ADR-0007 §Decision.1 CC#P2-4 first-half binding) —
// session-hook surface presence. Verifies project-local SessionStart and
// SessionEnd hook scripts exist + executable + reference circuit-engine
// continuity, and `.claude/settings.json` declares both events with the
// SessionStart matcher covering startup|resume|clear|compact.
export function checkSessionHooksPresent(rootDir?: string): AuditCheckResult;

// Slice 30 — DOG+2 slice:doctor reuses the lane and framing literals enforced
// by the audit so the operator briefing script cannot drift from the gate.
export const LANES: readonly [
  'Ratchet-Advance',
  'Equivalence Refactor',
  'Migration Escrow',
  'Discovery',
  'Disposable',
  'Break-Glass',
];

export const FRAMING_LITERALS: {
  readonly failureMode: 'Failure mode:';
  readonly acceptanceEvidence: 'Acceptance evidence:';
  readonly alternateFraming: 'Alternate framing:';
};
