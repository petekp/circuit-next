import {
  type CompiledFlowKindPolicyCheckResult,
  EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS,
  checkCompiledFlowKindCanonicalPolicy,
} from '../../../scripts/policy/flow-kind-policy.mjs';
import { CompiledFlow } from '../../schemas/compiled-flow.js';

// Runtime-level validateCompiledFlowKindPolicy helper. Wraps the shared JS
// canonical-set check at scripts/policy/flow-kind-policy.mjs with a
// Zod-driven CompiledFlow.safeParse pre-check, so CLI fixture loading
// (src/cli/circuit.ts:loadFixture) can reject structurally-invalid OR
// policy-invalid fixtures with a single call.
//
// Design note: the canonical-set table lives in JS (shared source of
// truth with audit.mjs Check 24) to prevent drift. This TS layer adds
// the structural check via CompiledFlow.safeParse — audit.mjs has no Zod
// path, so it runs the table check only; runtime has both checks.
//
// CLI fixture loading lives at src/cli/circuit.ts:loadFixture.

export { FLOW_KIND_CANONICAL_SETS, EXEMPT_FLOW_IDS };
export type { CompiledFlowKindPolicyCheckResult };

export type ValidateCompiledFlowKindPolicyResult =
  | { ok: true; kind: 'green' | 'exempt' | 'pass_through'; detail: string }
  | { ok: false; reason: string };

/**
 * Runtime-level helper: validates that an unknown input is a valid
 * CompiledFlow (Zod safeParse) AND that its declared flow kind satisfies
 * the canonical stage-set policy.
 *
 * Called by src/cli/circuit.ts after CompiledFlow.parse() succeeds (already
 * structurally valid at that point); the safeParse here is belt-and-
 * braces for direct callers that haven't run the schema yet. Returns
 * ok:false with a human-readable reason string — callers throw.
 */
export function validateCompiledFlowKindPolicy(
  flow: unknown,
): ValidateCompiledFlowKindPolicyResult {
  const parsed = CompiledFlow.safeParse(flow);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    const more =
      parsed.error.issues.length > 5 ? `\n  ... +${parsed.error.issues.length - 5} more` : '';
    return {
      ok: false,
      reason: `CompiledFlow.safeParse failed:\n${issueSummary}${more}`,
    };
  }

  const policyResult = checkCompiledFlowKindCanonicalPolicy(parsed.data);
  if (policyResult.kind === 'red') {
    return {
      ok: false,
      reason: `flow-kind canonical policy violation: ${policyResult.detail}`,
    };
  }
  return {
    ok: true,
    kind: policyResult.kind,
    detail: policyResult.detail,
  };
}
