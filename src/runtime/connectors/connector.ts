import type {
  ConnectorCapabilities as ConnectorCapabilitiesValue,
  CustomConnectorDescriptor as CustomConnectorDescriptorValue,
  EnabledConnector,
  RelayResolutionSource,
  ResolvedConnector,
} from '../../schemas/connector.js';

export type ConnectorName = EnabledConnector | CustomConnectorDescriptorValue['name'];

export interface ResolvedConnectorDecision {
  readonly connectorName: ConnectorName;
  readonly connector: ResolvedConnector;
  readonly resolvedFrom: RelayResolutionSource;
}

export type ConnectorCapabilities = ConnectorCapabilitiesValue;
export type CustomConnectorDescriptor = CustomConnectorDescriptorValue;
export type ResolvedConnectorRuntime = ResolvedConnector;
