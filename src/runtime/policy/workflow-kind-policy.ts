import {
  EXEMPT_WORKFLOW_IDS,
  WORKFLOW_KIND_CANONICAL_SETS,
  type WorkflowKindPolicyCheckResult,
  checkWorkflowKindCanonicalPolicy,
} from '../../../scripts/policy/workflow-kind-policy.mjs';
import { Workflow } from '../../schemas/workflow.js';

// Slice 43a — runtime-level validateWorkflowKindPolicy helper (HIGH 5
// retargeting per Slice 40 → P2.5). Wraps the shared JS canonical-set
// check at scripts/policy/workflow-kind-policy.mjs with a Zod-driven
// Workflow.safeParse pre-check, so CLI fixture loading (src/cli/
// circuit.ts:loadFixture) can reject structurally-invalid OR
// policy-invalid fixtures with a single call.
//
// Design note: the canonical-set table lives in JS (shared source of
// truth with audit.mjs Check 24) to prevent drift. This TS layer adds
// the structural gate via Workflow.safeParse — audit.mjs has no Zod
// path, so it runs the table check only; runtime has both gates.
//
// CLI fixture loading lives at src/cli/circuit.ts:loadFixture.

export { WORKFLOW_KIND_CANONICAL_SETS, EXEMPT_WORKFLOW_IDS };
export type { WorkflowKindPolicyCheckResult };

export type ValidateWorkflowKindPolicyResult =
  | { ok: true; kind: 'green' | 'exempt' | 'pass_through'; detail: string }
  | { ok: false; reason: string };

/**
 * Runtime-level helper: validates that an unknown input is a valid
 * Workflow (Zod safeParse) AND that its declared workflow kind satisfies
 * the canonical phase-set policy.
 *
 * Called by src/cli/circuit.ts after Workflow.parse() succeeds (already
 * structurally valid at that point); the safeParse here is belt-and-
 * braces for direct callers that haven't run the schema yet. Returns
 * ok:false with a human-readable reason string — callers throw.
 */
export function validateWorkflowKindPolicy(workflow: unknown): ValidateWorkflowKindPolicyResult {
  const parsed = Workflow.safeParse(workflow);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    const more =
      parsed.error.issues.length > 5 ? `\n  ... +${parsed.error.issues.length - 5} more` : '';
    return {
      ok: false,
      reason: `Workflow.safeParse failed:\n${issueSummary}${more}`,
    };
  }

  const policyResult = checkWorkflowKindCanonicalPolicy(parsed.data);
  if (policyResult.kind === 'red') {
    return {
      ok: false,
      reason: `workflow-kind canonical policy violation: ${policyResult.detail}`,
    };
  }
  return {
    ok: true,
    kind: policyResult.kind,
    detail: policyResult.detail,
  };
}
