import type {
  ConnectorCapabilities,
  CustomConnectorDescriptor,
  EnabledConnector,
  RelayResolutionSource,
  ResolvedConnector,
} from '../../schemas/connector.js';

export type ConnectorNameV2 = EnabledConnector | CustomConnectorDescriptor['name'];

export interface ResolvedConnectorDecisionV2 {
  readonly connectorName: ConnectorNameV2;
  readonly connector: ResolvedConnector;
  readonly resolvedFrom: RelayResolutionSource;
}

export type ConnectorCapabilitiesV2 = ConnectorCapabilities;
export type CustomConnectorDescriptorV2 = CustomConnectorDescriptor;
export type ResolvedConnectorV2 = ResolvedConnector;
