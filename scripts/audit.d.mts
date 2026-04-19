/**
 * Type declarations for scripts/audit.mjs — a Node ESM script that also
 * exports a small helper (`schemaExportPresent`) consumed by
 * tests/contracts/artifact-authority.test.ts for Slice 11 schema-exports
 * existence hardening.
 */
export function schemaExportPresent(schemaSrc: string, name: string): boolean;
