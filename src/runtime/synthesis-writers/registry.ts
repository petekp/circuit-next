// Registry of synthesis writers, keyed by output schema name.
//
// Builders come from src/workflows/catalog.ts via buildSynthesisRegistry.

import type { Workflow } from '../../schemas/workflow.js';
import { workflowPackages } from '../../workflows/catalog.js';
import { buildSynthesisRegistry } from '../catalog-derivations.js';
import { artifactPathForSchemaInWorkflow } from '../close-writers/shared.js';
import type { SynthesisBuilder, SynthesisStep } from './types.js';

const REGISTRY = buildSynthesisRegistry(workflowPackages);

export function findSynthesisBuilder(resultSchemaName: string): SynthesisBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}

// Resolve declared reads to run-relative paths and check that each
// required read is actually present in the synthesis step's reads
// list. Required-but-missing throws with the same phrasing the
// runner used historically so error message stability is preserved.
// Builders that omit `reads` get an empty inputs map and resolve
// paths themselves inside build().
export function resolveSynthesisReadPaths(
  builder: SynthesisBuilder,
  workflow: Workflow,
  step: SynthesisStep,
): Record<string, string | undefined> {
  const paths: Record<string, string | undefined> = {};
  if (builder.reads === undefined) return paths;
  for (const descriptor of builder.reads) {
    const path = artifactPathForSchemaInWorkflow(workflow, descriptor.schema);
    if (descriptor.required && !step.reads.includes(path as never)) {
      throw new Error(`${step.writes.artifact.schema} requires step '${step.id}' to read ${path}`);
    }
    paths[descriptor.name] = step.reads.includes(path as never) ? path : undefined;
  }
  return paths;
}
