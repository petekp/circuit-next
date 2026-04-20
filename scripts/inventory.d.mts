/**
 * Type declarations for scripts/inventory.mjs (Slice 27b).
 *
 * The script is a Node ESM module. Its detector helpers + the
 * buildInventory / renderReport entrypoints are consumed by
 * tests/contracts/product-surface-inventory.test.ts.
 */

export type PresenceResult = { present: boolean; reason: string };

export type InventorySurface = {
  id: string;
  category: string;
  description: string;
  expected_evidence: string;
  planned_slice: string | null;
  present: boolean;
  evidence_summary: string;
};

export type InventorySummary = {
  total: number;
  present: number;
  absent: number;
};

export type InventoryResult = {
  surfaces: InventorySurface[];
  summary: InventorySummary;
};

export type InventoryReport = {
  schema_version: string;
  slice: string;
  baseline: true;
  metadata: { generated_at: string; head_commit: string | null };
  summary: InventorySummary;
  surfaces: InventorySurface[];
};

export const REPORT_SCHEMA_VERSION: string;
export const REPORT_SLICE: string;

export function buildInventory(options?: {
  pkg?: unknown;
  artifacts?: unknown;
}): InventoryResult;

export function renderReport(input: {
  surfaces: InventorySurface[];
  summary: InventorySummary;
  metadata: { generated_at: string; head_commit: string | null };
}): InventoryReport;

export function renderMarkdown(report: InventoryReport): string;

export function checkPackageScript(pkg: unknown, name: string): PresenceResult;
export function checkPluginManifest(): PresenceResult;
export function checkDogfoodWorkflowFixture(): PresenceResult;
export function checkRuntimeEntrypoint(): PresenceResult;
export function checkArtifactRow(
  artifacts: unknown,
  idPattern: RegExp,
  label: string,
): PresenceResult;
export function checkTestByFilename(filenamePattern: RegExp, label: string): PresenceResult;
export function checkStatusAlignment(): PresenceResult;
