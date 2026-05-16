import { buildRuntimeSurfaceRegistry } from './catalog-derivations.js';
import { flowPackages } from './catalog.js';
import type { CompiledFlowRuntimeSurface } from './types.js';

const RUNTIME_SURFACES = buildRuntimeSurfaceRegistry(flowPackages);

export function findFlowRuntimeSurfaceById(flowId: string): CompiledFlowRuntimeSurface | undefined {
  return RUNTIME_SURFACES.get(flowId);
}

export function requireFlowRuntimeSurfaceById(flowId: string): CompiledFlowRuntimeSurface {
  const surface = findFlowRuntimeSurfaceById(flowId);
  if (surface === undefined) {
    throw new Error(`flow '${flowId}' does not declare runtime surface metadata`);
  }
  return surface;
}
