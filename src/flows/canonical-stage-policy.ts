import { flowDefinitions } from './catalog.js';
import type { FlowDefinitionCanonicalStagePolicy } from './flow-definition.js';

export type FlowCanonicalStagePolicyEntry = Omit<
  Extract<FlowDefinitionCanonicalStagePolicy, { readonly kind: 'enforce' }>,
  'kind'
>;

const canonicalStagePolicyById: Record<string, FlowCanonicalStagePolicyEntry> = {};
const canonicalStagePolicyExemptIds = new Set<string>();

for (const definition of flowDefinitions) {
  const policy = definition.canonicalStagePolicy;
  if (policy === undefined) continue;
  if (policy.kind === 'exempt') {
    canonicalStagePolicyExemptIds.add(definition.id);
    continue;
  }
  const { kind: _kind, ...entry } = policy;
  canonicalStagePolicyById[definition.id] = entry;
}

export const FLOW_CANONICAL_STAGE_POLICY_BY_ID: Readonly<
  Record<string, FlowCanonicalStagePolicyEntry>
> = canonicalStagePolicyById;

export const FLOW_CANONICAL_STAGE_POLICY_EXEMPT_IDS: ReadonlySet<string> =
  canonicalStagePolicyExemptIds;
