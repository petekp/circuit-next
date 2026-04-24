/**
 * Type declarations for scripts/policy/workflow-kind-policy.mjs — the
 * shared JS module that holds the single source of truth for workflow-
 * kind canonical phase-set policy. Consumed by:
 *   - scripts/audit.mjs Check 24 (checkSpineCoverage) — audit-level.
 *   - src/runtime/policy/workflow-kind-policy.ts — runtime-level
 *     (adds Workflow.safeParse wrapper on top of this module's exports).
 */

export type WorkflowKindPolicyEntry = {
  readonly canonicals: readonly string[];
  readonly omits: readonly string[];
  readonly title: string;
  readonly authority: string;
};

export const WORKFLOW_KIND_CANONICAL_SETS: Record<string, WorkflowKindPolicyEntry>;

export const EXEMPT_WORKFLOW_IDS: ReadonlySet<string>;

export type WorkflowKindPolicyCheckResult =
  | { kind: 'green'; detail: string }
  | { kind: 'exempt'; detail: string }
  | { kind: 'pass_through'; detail: string }
  | { kind: 'red'; detail: string };

export type ReviewIdentitySeparationPolicyResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

export function checkReviewIdentitySeparationPolicy(
  fixture: unknown,
): ReviewIdentitySeparationPolicyResult;

export function checkWorkflowKindCanonicalPolicy(fixture: unknown): WorkflowKindPolicyCheckResult;
