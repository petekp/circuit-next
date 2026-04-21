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
