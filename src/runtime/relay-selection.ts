import type { CompiledFlow } from '../schemas/compiled-flow.js';
import type { ConnectorReference, LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type {
  ConnectorCapabilities,
  CustomConnectorDescriptor,
  EnabledConnector,
  RelayResolutionSource,
  ResolvedConnector,
} from '../schemas/connector.js';
import { BUILTIN_CONNECTOR_CAPABILITIES } from '../schemas/connector.js';
import type { RelayRole } from '../schemas/step.js';
import type { RelayFn } from './runner-types.js';
export {
  bindsExecutionDepthToRelaySelection,
  deriveResolvedSelection,
  type RelayerInvocationConfig,
  selectionConfigLayersWithExecutionDepth,
} from '../shared/relay-selection.js';

type RelayConfigValue = LayeredConfigValue['config']['relay'];

interface RelayDecisionInput {
  readonly explicitRelayer?: RelayFn;
  readonly configLayers?: readonly LayeredConfigValue[];
  readonly flow: CompiledFlow;
  readonly step: CompiledFlow['steps'][number] & { kind: 'relay' };
}

export interface RelayDecision {
  readonly relayer: RelayFn;
  readonly resolvedFrom: RelayResolutionSource;
}

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

async function relayerForBuiltin(name: EnabledConnector): Promise<RelayFn> {
  const connector = { kind: 'builtin' as const, name };
  if (name === 'claude-code') {
    const { relayClaudeCode } = await import('./connectors/claude-code.js');
    return { connectorName: 'claude-code', connector, relay: relayClaudeCode };
  }
  if (name === 'codex') {
    const { relayCodex } = await import('./connectors/codex.js');
    return { connectorName: 'codex', connector, relay: relayCodex };
  }
  const exhaustive: never = name;
  throw new Error(`unsupported built-in connector '${exhaustive}'`);
}

function capabilitiesFor(connector: ResolvedConnector): ConnectorCapabilities {
  if (connector.kind === 'builtin') {
    return BUILTIN_CONNECTOR_CAPABILITIES[connector.name];
  }
  return connector.capabilities;
}

function assertConnectorCanRunRole(connector: ResolvedConnector, role: RelayRole): void {
  const capabilities = capabilitiesFor(connector);
  if (role === 'implementer' && capabilities.filesystem === 'read-only') {
    const name = connector.name;
    throw new Error(
      `relay connector '${name}' is read-only and cannot run implementer step role '${role}'; use 'claude-code' for trusted same-workspace writes or wait for isolated writable connectors`,
    );
  }
}

async function relayerForCustom(descriptor: CustomConnectorDescriptor): Promise<RelayFn> {
  const { relayCustom } = await import('./connectors/custom.js');
  return {
    connectorName: descriptor.name,
    connector: descriptor,
    relay: (input) => relayCustom({ ...input, descriptor }),
  };
}

async function relayerForResolvedConnector(connector: ResolvedConnector): Promise<RelayFn> {
  if (connector.kind === 'builtin') {
    return relayerForBuiltin(connector.name);
  }
  return relayerForCustom(connector);
}

function resolvedConnectorFromReference(
  ref: ConnectorReference,
  relay: RelayConfigValue,
): ResolvedConnector {
  if (ref.kind === 'builtin') {
    return ref;
  }
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

async function decideRelayer(connector: ResolvedConnector, role: RelayRole): Promise<RelayFn> {
  assertConnectorCanRunRole(connector, role);
  return relayerForResolvedConnector(connector);
}

export async function resolveRelayDecision(input: RelayDecisionInput): Promise<RelayDecision> {
  if (input.explicitRelayer !== undefined) {
    return { relayer: input.explicitRelayer, resolvedFrom: { source: 'explicit' } };
  }

  const relay = mergedRelayConfig(input.configLayers);
  const roleRef = relay.roles[input.step.role];
  if (roleRef !== undefined) {
    const connector = resolvedConnectorFromReference(roleRef, relay);
    return {
      relayer: await decideRelayer(connector, input.step.role),
      resolvedFrom: { source: 'role', role: input.step.role },
    };
  }

  const flowRef = relay.circuits[input.flow.id];
  if (flowRef !== undefined) {
    const connector = resolvedConnectorFromReference(flowRef, relay);
    return {
      relayer: await decideRelayer(connector, input.step.role),
      resolvedFrom: { source: 'circuit', flow_id: input.flow.id },
    };
  }

  if (relay.default !== 'auto') {
    const connector = resolvedConnectorFromDefault(relay.default, relay);
    return {
      relayer: await decideRelayer(connector, input.step.role),
      resolvedFrom: { source: 'default' },
    };
  }

  const connector: ResolvedConnector = { kind: 'builtin', name: 'claude-code' };
  return {
    relayer: await decideRelayer(connector, input.step.role),
    resolvedFrom: { source: 'auto' },
  };
}
