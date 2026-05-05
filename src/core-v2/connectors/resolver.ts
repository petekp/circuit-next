import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { ConnectorReference } from '../../schemas/config.js';
import type {
  ConnectorCapabilities,
  RelayResolutionSource,
  ResolvedConnector,
} from '../../schemas/connector.js';
import { BUILTIN_CONNECTOR_CAPABILITIES } from '../../schemas/connector.js';
import type { CompiledFlowId } from '../../schemas/ids.js';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';
import type { RelayRole } from '../../schemas/step.js';
import type { ResolvedConnectorDecisionV2 } from './connector.js';

type RelayConfigValue = LayeredConfigValue['config']['relay'];

export const CLAUDE_CODE_SUPPORTED_EFFORTS_V2 = ['low', 'medium', 'high', 'xhigh'] as const;
export const CODEX_SUPPORTED_EFFORTS_V2 = ['low', 'medium', 'high', 'xhigh'] as const;

function mergedRelayConfig(layers: readonly LayeredConfigValue[] | undefined): RelayConfigValue {
  const merged: RelayConfigValue = {
    default: 'auto',
    roles: {},
    circuits: {},
    connectors: {},
  };
  for (const layer of layers ?? []) {
    if (layer.config.relay.default !== 'auto' || merged.default === 'auto') {
      merged.default = layer.config.relay.default;
    }
    merged.roles = { ...merged.roles, ...layer.config.relay.roles };
    merged.circuits = { ...merged.circuits, ...layer.config.relay.circuits };
    merged.connectors = { ...merged.connectors, ...layer.config.relay.connectors };
  }
  return merged;
}

export function connectorCapabilitiesV2(connector: ResolvedConnector): ConnectorCapabilities {
  if (connector.kind === 'builtin') return BUILTIN_CONNECTOR_CAPABILITIES[connector.name];
  return connector.capabilities;
}

export function assertConnectorCanRunRoleV2(connector: ResolvedConnector, role: RelayRole): void {
  const capabilities = connectorCapabilitiesV2(connector);
  if (role === 'implementer' && capabilities.filesystem === 'read-only') {
    throw new Error(
      `relay connector '${connector.name}' is read-only and cannot run implementer step role '${role}'`,
    );
  }
}

function resolvedConnectorFromReference(
  ref: ConnectorReference,
  relay: RelayConfigValue,
): ResolvedConnector {
  if (ref.kind === 'builtin') return ref;
  const descriptor = relay.connectors[ref.name];
  if (descriptor === undefined) {
    throw new Error(`relay connector '${ref.name}' is referenced but not declared`);
  }
  return descriptor;
}

function resolvedConnectorFromDefault(
  defaultRef: RelayConfigValue['default'],
  relay: RelayConfigValue,
): ResolvedConnector {
  if (defaultRef === 'claude-code' || defaultRef === 'codex') {
    return { kind: 'builtin', name: defaultRef };
  }
  const descriptor = relay.connectors[defaultRef];
  if (descriptor === undefined) {
    throw new Error(`relay default connector '${defaultRef}' is referenced but not declared`);
  }
  return descriptor;
}

function decision(
  connector: ResolvedConnector,
  resolvedFrom: RelayResolutionSource,
  role: RelayRole,
): ResolvedConnectorDecisionV2 {
  assertConnectorCanRunRoleV2(connector, role);
  return {
    connectorName: connector.name,
    connector,
    resolvedFrom,
  };
}

export function resolveConnectorForRelayV2(input: {
  readonly flowId: string;
  readonly role: RelayRole;
  readonly configLayers?: readonly LayeredConfigValue[];
  readonly explicitConnector?: ResolvedConnector;
}): ResolvedConnectorDecisionV2 {
  if (input.explicitConnector !== undefined) {
    return decision(input.explicitConnector, { source: 'explicit' }, input.role);
  }

  const relay = mergedRelayConfig(input.configLayers);
  const roleRef = relay.roles[input.role];
  if (roleRef !== undefined) {
    return decision(
      resolvedConnectorFromReference(roleRef, relay),
      {
        source: 'role',
        role: input.role,
      },
      input.role,
    );
  }

  const flowId = input.flowId as CompiledFlowId;
  const flowRef = relay.circuits[flowId];
  if (flowRef !== undefined) {
    return decision(
      resolvedConnectorFromReference(flowRef, relay),
      {
        source: 'circuit',
        flow_id: flowId,
      },
      input.role,
    );
  }

  if (relay.default !== 'auto') {
    return decision(
      resolvedConnectorFromDefault(relay.default, relay),
      { source: 'default' },
      input.role,
    );
  }

  return decision({ kind: 'builtin', name: 'claude-code' }, { source: 'auto' }, input.role);
}

function expectedProvider(connectorName: string): 'anthropic' | 'openai' | undefined {
  if (connectorName === 'claude-code') return 'anthropic';
  if (connectorName === 'codex') return 'openai';
  return undefined;
}

export function assertConnectorSelectionCompatibleV2(
  connectorName: string,
  selection: ResolvedSelection | undefined,
): void {
  const expected = expectedProvider(connectorName);
  const model = selection?.model;
  if (expected !== undefined && model !== undefined && model.provider !== expected) {
    throw new Error(
      `${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expected}'`,
    );
  }
  const effort = selection?.effort;
  if (effort === undefined) return;
  const supported =
    connectorName === 'claude-code'
      ? CLAUDE_CODE_SUPPORTED_EFFORTS_V2
      : connectorName === 'codex'
        ? CODEX_SUPPORTED_EFFORTS_V2
        : undefined;
  if (supported !== undefined && !(supported as readonly string[]).includes(effort)) {
    throw new Error(
      `${connectorName} connector cannot honor effort '${effort}'; supported efforts: ${supported.join(', ')}`,
    );
  }
}
