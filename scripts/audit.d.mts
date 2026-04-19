/**
 * Type declarations for scripts/audit.mjs — a Node ESM script that also
 * exports small helpers consumed by
 * tests/contracts/artifact-authority.test.ts:
 *   - `schemaExportPresent` (Slice 11, schema-exports existence hardening)
 *   - `planeIsValid` (Slice 12, ADR-0004 plane classifier)
 *   - `trustBoundaryHasOriginToken` (Slice 12, ADR-0004 data-plane detail rule)
 */
export function schemaExportPresent(schemaSrc: string, name: string): boolean;
export function planeIsValid(plane: unknown): boolean;
export function trustBoundaryHasOriginToken(boundary: unknown): boolean;
