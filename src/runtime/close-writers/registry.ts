// Registry of close-with-evidence builders, keyed by result schema name.
//
// Builders come from src/workflows/catalog.ts — each WorkflowPackage
// contributes its writers.close array. The runner consults this
// registry and never sees workflow names directly.

import type { Workflow } from '../../schemas/workflow.js';
import { workflowPackages } from '../../workflows/catalog.js';
import { artifactPathForSchemaInWorkflow, workflowHasArtifactSchemaInWorkflow } from './shared.js';
import type { CloseBuildContext, CloseBuilder } from './types.js';

const REGISTRY: ReadonlyMap<string, CloseBuilder> = (() => {
  const map = new Map<string, CloseBuilder>();
  for (const pkg of workflowPackages) {
    for (const builder of pkg.writers.close) {
      if (map.has(builder.resultSchemaName)) {
        throw new Error(
          `duplicate close builder registered for schema '${builder.resultSchemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(builder.resultSchemaName, builder);
    }
  }
  return map;
})();

export function findCloseBuilder(resultSchemaName: string): CloseBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}

// Resolve the read paths for a builder against a specific Workflow +
// close step. Required reads must be in the close step's reads list;
// optional reads are returned only when both the workflow declares a
// step that writes the schema AND the close step lists the path.
// Required-but-missing throws with a clear "<schema> requires close
// step '<id>' to read <path>" message that matches the runner's
// existing requiredCloseReadForSchema phrasing.
export function resolveCloseReadPaths(
  builder: CloseBuilder,
  workflow: Workflow,
  closeStep: CloseBuildContext['closeStep'],
): Record<string, string | undefined> {
  const paths: Record<string, string | undefined> = {};
  for (const descriptor of builder.reads) {
    if (descriptor.required) {
      const path = artifactPathForSchemaInWorkflow(workflow, descriptor.schema);
      if (!closeStep.reads.includes(path as never)) {
        throw new Error(
          `${closeStep.writes.artifact.schema} requires close step '${closeStep.id}' to read ${path}`,
        );
      }
      paths[descriptor.name] = path;
    } else {
      if (!workflowHasArtifactSchemaInWorkflow(workflow, descriptor.schema)) {
        paths[descriptor.name] = undefined;
        continue;
      }
      const path = artifactPathForSchemaInWorkflow(workflow, descriptor.schema);
      paths[descriptor.name] = closeStep.reads.includes(path as never) ? path : undefined;
    }
  }
  return paths;
}
