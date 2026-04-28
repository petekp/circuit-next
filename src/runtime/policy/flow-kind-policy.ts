import {
  type CompiledFlowKindPolicyCheckResult,
  EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS,
  checkCompiledFlowKindCanonicalPolicy,
} from '../../../scripts/policy/flow-kind-policy.mjs';
import { CompiledFlow } from '../../schemas/compiled-flow.js';

// Wraps the canonical-set check from scripts/policy/flow-kind-policy.mjs
// with a Zod CompiledFlow.safeParse pre-check, so CLI fixture loading
// (src/cli/circuit.ts:loadFixture) rejects structurally-invalid or
// policy-invalid fixtures with a single call.

export { FLOW_KIND_CANONICAL_SETS, EXEMPT_FLOW_IDS };
export type { CompiledFlowKindPolicyCheckResult };

export type ValidateCompiledFlowKindPolicyResult =
  | { ok: true; kind: 'green' | 'exempt' | 'pass_through'; detail: string }
  | { ok: false; reason: string };

/**
 * Validates that an unknown input is a valid CompiledFlow (Zod safeParse)
 * AND that its declared flow kind satisfies the canonical stage-set policy.
 *
 * Called by src/cli/circuit.ts after CompiledFlow.parse() succeeds; the
 * safeParse here is defensive for direct callers who haven't run the schema
 * yet. Returns ok:false with a human-readable reason string — callers throw.
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
