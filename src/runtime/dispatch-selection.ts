import type { DispatchResolutionSource } from '../schemas/adapter.js';
import { LayeredConfig, type LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Rigor } from '../schemas/rigor.js';
import type { Workflow } from '../schemas/workflow.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { DispatchFn } from './runner-types.js';
import { resolveSelectionForDispatch } from './selection-resolver.js';

export type DispatcherInvocationConfig = {
  readonly dispatcher?: DispatchFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
};

export function bindsExecutionRigorToDispatchSelection(workflow: Workflow): boolean {
  return (workflow.id as unknown as string) === 'build';
}

export function selectionConfigLayersWithExecutionRigor(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  rigor: Rigor,
): readonly LayeredConfigValue[] {
  const layers = [...(inv.selectionConfigLayers ?? [])];
  const workflowId = workflow.id;
  const existingIndex = layers.findIndex((layer) => layer.layer === 'invocation');
  const existing = existingIndex === -1 ? undefined : layers[existingIndex];
  const baseConfig = existing?.config ?? {
    schema_version: 1,
    dispatch: {
      default: 'auto',
      roles: {},
      circuits: {},
      adapters: {},
    },
    circuits: {},
    defaults: {},
  };
  const existingCircuit = baseConfig.circuits[workflowId] ?? {};
  const selection = {
    ...(existingCircuit.selection ?? {}),
    rigor,
  };
  const invocationLayer = LayeredConfig.parse({
    layer: 'invocation',
    ...(existing?.source_path === undefined ? {} : { source_path: existing.source_path }),
    config: {
      ...baseConfig,
      circuits: {
        ...baseConfig.circuits,
        [workflowId]: {
          ...existingCircuit,
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

function selectionConfigLayersForDispatch(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  rigor: Rigor,
): readonly LayeredConfigValue[] {
  if (!bindsExecutionRigorToDispatchSelection(workflow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return selectionConfigLayersWithExecutionRigor(inv, workflow, rigor);
}

// Slice 47a (CONVERGENT HIGH A fold-in): compute the dispatch-event
// provenance honestly from the runner's actual decision path, instead
// of letting the materializer fabricate `{ source: 'default' }` on
// every event. Two cases at v0:
//   - The caller injected a dispatcher (tests, future role-keyed
//     routing) → `source: 'explicit'`.
//   - The runner picked the default → `source: 'default'`.
export function deriveResolvedFrom(
  invocation: DispatcherInvocationConfig,
): DispatchResolutionSource {
  return invocation.dispatcher !== undefined ? { source: 'explicit' } : { source: 'default' };
}

export function deriveResolvedSelection(
  inv: DispatcherInvocationConfig,
  workflow: Workflow,
  step: Workflow['steps'][number] & { kind: 'dispatch' },
  rigor: Rigor,
): ResolvedSelection {
  return resolveSelectionForDispatch({
    workflow,
    step,
    configLayers: selectionConfigLayersForDispatch(inv, workflow, rigor),
  }).resolved;
}
