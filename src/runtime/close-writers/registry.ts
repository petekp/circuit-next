// Registry of close-with-evidence builders, keyed by result schema name.
//
// Adding a new workflow's close means: implement a CloseBuilder in this
// directory, then register it here. The runner consults this registry
// in tryWriteRegisteredSynthesisArtifact — it does not need to know
// which workflows exist.

import type { Workflow } from '../../schemas/workflow.js';
import { buildCloseBuilder } from './build.js';
import { exploreCloseBuilder } from './explore.js';
import { fixCloseBuilder } from './fix.js';
import { artifactPathForSchemaInWorkflow, workflowHasArtifactSchemaInWorkflow } from './shared.js';
import { sweepCloseBuilder } from './sweep.js';
import type { CloseBuildContext, CloseBuilder } from './types.js';

const REGISTRY = new Map<string, CloseBuilder>([
  [buildCloseBuilder.resultSchemaName, buildCloseBuilder],
  [exploreCloseBuilder.resultSchemaName, exploreCloseBuilder],
  [fixCloseBuilder.resultSchemaName, fixCloseBuilder],
  [sweepCloseBuilder.resultSchemaName, sweepCloseBuilder],
]);

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
