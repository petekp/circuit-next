// Relay selection derivation.
//
// Most flows resolve relay model and effort from config and step metadata only.
// A flow must opt into `bindsExecutionDepthToRelaySelection` before the run
// depth is layered into relay selection.
import { findCompiledFlowPackageById } from '../flows/catalog.js';
import type {
  RuntimeIndexedFlow,
  RuntimeIndexedRelayStep,
} from '../flows/registries/runtime-index.js';
import {
  Config,
  LayeredConfig,
  type LayeredConfig as LayeredConfigValue,
} from '../schemas/config.js';
import type { Depth } from '../schemas/depth.js';
import type { CompiledFlowId } from '../schemas/ids.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { RelayFn } from './relay-runtime-types.js';
import { resolveSelectionForRelay } from './selection-resolver.js';

export type RelayerInvocationConfig = {
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
};

export function bindsExecutionDepthToRelaySelection(flow: RuntimeIndexedFlow): boolean {
  const pkg = findCompiledFlowPackageById(flow.id as unknown as string);
  return pkg?.engineFlags?.bindsExecutionDepthToRelaySelection === true;
}

export function selectionConfigLayersWithExecutionDepth(
  inv: RelayerInvocationConfig,
  flow: RuntimeIndexedFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  const layers = [...(inv.selectionConfigLayers ?? [])];
  const flowId = flow.id as CompiledFlowId;
  const existingIndex = layers.findIndex((layer) => layer.layer === 'invocation');
  const existing = existingIndex === -1 ? undefined : layers[existingIndex];
  const baseConfig = existing?.config ?? Config.parse({ schema_version: 1 });
  const existingCircuit = baseConfig.circuits[flowId];
  const selection = {
    ...(existingCircuit?.selection ?? {}),
    depth,
  };
  const invocationLayer = LayeredConfig.parse({
    layer: 'invocation',
    ...(existing?.source_path === undefined ? {} : { source_path: existing.source_path }),
    config: {
      ...baseConfig,
      circuits: {
        ...baseConfig.circuits,
        [flowId]: {
          ...(existingCircuit ?? {}),
          selection,
        },
      },
    },
  });
  if (existingIndex === -1) {
    layers.push(invocationLayer);
  } else {
    layers[existingIndex] = invocationLayer;
  }
  return layers;
}

function selectionConfigLayersForRelay(
  inv: RelayerInvocationConfig,
  flow: RuntimeIndexedFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  if (!bindsExecutionDepthToRelaySelection(flow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return selectionConfigLayersWithExecutionDepth(inv, flow, depth);
}

export function deriveResolvedSelection(
  inv: RelayerInvocationConfig,
  flow: RuntimeIndexedFlow,
  step: RuntimeIndexedRelayStep,
  depth: Depth,
): ResolvedSelection {
  return resolveSelectionForRelay({
    flow,
    step,
    configLayers: selectionConfigLayersForRelay(inv, flow, depth),
  }).resolved;
}
