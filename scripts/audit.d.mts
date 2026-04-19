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
 */
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
