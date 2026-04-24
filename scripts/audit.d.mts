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

// Slice 47d (Codex HIGH 5 fold-in) — canonical slice-id comparator over
// {number, suffix}. Returns negative / zero / positive per sort semantics.
// Throws if either argument does not match SLICE_ID_PATTERN.
export function compareSliceId(a: string, b: string): number;

export const CURRENT_SLICE_MARKER_PATTERN: RegExp;
export function extractCurrentSliceMarker(text: unknown): string | null;
export function checkStatusEpochAlignment(rootDir?: string): AuditCheckResult;

// Slice 67 (methodology-trim-arc LIVE-STATE-HELPER) — parses the `## §0 Live
// state` section added to PROJECT_STATE.md alongside the existing
// `<!-- current_slice: N -->` HTML-comment marker. Returns the trimmed
// section content (string, possibly empty). Returns null when the section
// is absent, malformed, or the file cannot be read. Compat-shim: no
// existing consumer is rewired in Slice 67 — the helper adds capability
// for future consumers.
export function readLiveStateSection(markdownPath: string): string | null;

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
// Slice 47d (Codex HIGH 5 fold-in) — string-form ceremony_slice for the
// slice-47 hardening fold-in arc. Uses the canonical letter-suffix form
// so compareSliceId orders 47c < 47d correctly.
export const SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE: string;
// Slice 55 (Clean-Clone Reality Tranche arc-close composition review
// convergent HIGH 1 fold-in) — numeric ceremony_slice for the
// Clean-Clone Reality Tranche. Uses the numeric back-compat branch of
// evaluateArcCloseGate (same as slices 40 + 44).
export const CLEAN_CLONE_REALITY_TRANCHE_ARC_CEREMONY_SLICE: number;
// Slice 62 (Planning-Readiness Meta-Arc arc-close composition review
// Codex HIGH-1 fold-in) — numeric ceremony_slice for the meta-arc.
export const PLANNING_READINESS_META_ARC_CEREMONY_SLICE: number;
// Slice 68 (methodology-trim-arc arc-close ceremony) — numeric
// ceremony_slice for the methodology-trim arc. Uses the numeric
// back-compat branch of evaluateArcCloseGate (same as slices 55 + 62).
export const METHODOLOGY_TRIM_ARC_CEREMONY_SLICE: number;
// Slice 75 (Runtime Safety Floor arc-close ceremony) — numeric
// ceremony_slice for the runtime-safety-floor arc. Uses the numeric
// back-compat branch of evaluateArcCloseGate.
export const RUNTIME_SAFETY_FLOOR_ARC_CEREMONY_SLICE: number;
export const ARC_CLOSE_GATES: ReadonlyArray<{
  readonly arc_id: string;
  readonly description: string;
  // Slice 47d (Codex HIGH 5 fold-in): ceremony_slice accepts either
  // numeric (back-compat for slices 40 + 44) or string canonical slice-id
  // form (e.g. "47d") with letter-suffix ordering.
  readonly ceremony_slice: number | string;
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

// Slice 47a (Codex HIGH 4 fold-in) — symmetric agent adapter source
// path constant + hash helper. Used by Check 30 to detect adapter
// surface drift against a recorded fingerprint's
// adapter_source_sha256 field once the agent fingerprint is promoted
// to schema_version 2.
export const AGENT_ADAPTER_SOURCE_PATHS: readonly string[];
export function computeAgentAdapterSourceSha256(rootDir?: string): string;

// Slice 46 (P2.7a, ADR-0007 §Decision.1 CC#P2-4 first-half binding) —
// session-hook surface presence. Verifies project-local SessionStart and
// SessionEnd hook scripts exist + executable + reference circuit-engine
// continuity, and `.claude/settings.json` declares both events with the
// SessionStart matcher covering startup|resume|clear|compact.
export function checkSessionHooksPresent(rootDir?: string): AuditCheckResult;

// Slice 47c (Codex Slice 47a comprehensive review HIGH 6 fold-in) —
// ADR-0007 §3 forbidden scalar-progress firewall. Scans curated live-
// state surface files for the close-progress wording the ADR rejects
// (e.g. "N/8", "substantially complete", "aggregate green"). Citation
// contexts (lines mentioning "forbidden", "ADR-0007", "Slice 47c",
// "firewall") are exempted as legitimate self-references.
export const ADR_0007_FORBIDDEN_PROGRESS_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly label: string;
}[];
export const FORBIDDEN_PROGRESS_SCAN_FILES: readonly string[];

// Slice 67a (Codex MED-1 fold-in) — the subset of
// FORBIDDEN_PROGRESS_SCAN_FILES that are enumerated but whose scoped
// text helper returns '' by design (content-exempt). Today this set
// contains only PROJECT_STATE-chronicle.md; the scan inventory still
// lists the file for drift-visibility, but the firewall's status
// string explicitly distinguishes content-scanned from content-exempt
// so "15 scanned" no longer overstates coverage.
export const FORBIDDEN_PROGRESS_CONTENT_EXEMPT_FILES: ReadonlySet<string>;
// Slice 47d (Codex HIGH 3 fold-in): glob-matched scan additions for
// arc-close composition review files. Composed with FORBIDDEN_PROGRESS_SCAN_FILES
// at enumeration time.
export const FORBIDDEN_PROGRESS_SCAN_GLOBS: readonly RegExp[];
export function checkForbiddenScalarProgressPhrases(rootDir?: string): AuditCheckResult;

// Slice 47d (Codex HIGH 2 + Claude HIGH 2 fold-in) — Check 35 mechanical
// enforcement of CLAUDE.md §Hard invariant #6 literal rule at the
// commit-body layer. When HEAD declares `Codex challenger: REQUIRED`,
// requires either a matching per-slice review file OR an
// `arc-subsumption: <path>` field in the commit body. Retroactive
// grandfather list covers commits `1c4a5b1` (47b-retro) and `73c729c`
// (47c-partial-retro) whose co-landed per-slice review records predate
// this check.
export const CODEX_CHALLENGER_REQUIRED_DECLARATION_PATTERN: RegExp;
export const ARC_SUBSUMPTION_FIELD_PATTERN: RegExp;
export const CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS: Readonly<Record<string, string>>;
// Slice 68 ARC-CLOSE fold-in (Codex HIGH-1) — tightened arc-subsumption
// validator surface. ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN pins
// shape (i) (ceremony commits; arc-.+-composition-review-{claude,codex}.md).
// PER_SLICE_REVIEW_FILENAME_PATTERN pins shape (ii) (fold-in continuation
// commits; arc-slice-<N>-codex.md; capture group [1] is the numeric slice
// id). ACCEPT_CLOSING_VERDICT_PATTERN matches `closing_verdict:` frontmatter
// lines carrying ACCEPT or ACCEPT-WITH-FOLD-INS (quoted or bare; REJECT-*
// verdicts rejected). validateArcSubsumptionEvidence returns an object with
// `ok` (boolean), `shape` (`'arc-close'|'per-slice'|null`), and `detail`
// (one-line human summary).
export const ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN: RegExp;
export const PER_SLICE_REVIEW_FILENAME_PATTERN: RegExp;
export const ACCEPT_CLOSING_VERDICT_PATTERN: RegExp;
export function validateArcSubsumptionEvidence(
  rootDir: string,
  subsumptionPath: string,
  subjectSliceId: string,
): {
  readonly ok: boolean;
  readonly shape: 'arc-close' | 'per-slice' | null;
  readonly detail: string;
};
export function checkCodexChallengerRequiredDeclaration(rootDir?: string): AuditCheckResult;

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
  readonly whyThisNotAdjacent: 'Why this not adjacent:';
};
