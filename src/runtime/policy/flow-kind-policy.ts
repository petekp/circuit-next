export {
  EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS,
  type CompiledFlowKindPolicyCheckResult,
  type ValidateCompiledFlowKindPolicyResult,
  validateCompiledFlowKindPolicy,
} from '../../shared/flow-kind-policy.js';

// Runtime compatibility surface. Flow-kind policy is generated-surface and
// fixture policy, not runtime execution; neutral ownership lives in
// `src/shared/flow-kind-policy.ts`.
