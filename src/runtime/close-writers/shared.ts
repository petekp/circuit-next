// Shared helpers for close-with-evidence builders.
//
// `artifactPathForSchemaInWorkflow` mirrors runner.ts's internal lookup
// so close builders can populate `artifact_pointers` paths without
// depending on the runner's private API surface. The lookup resolves
// the unique workflow step that writes a given schema and returns its
// path — it's intentionally strict (exactly one writer required) so
// recipe shape errors surface here instead of producing ambiguous
// pointers in the result artifact.

import type { Workflow } from '../../schemas/workflow.js';

export function artifactPathForSchemaInWorkflow(workflow: Workflow, schemaName: string): string {
  const matches = workflow.steps.filter(
    (candidate) => candidate.writes.artifact?.schema === schemaName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `artifact schema '${schemaName}' must be written by exactly one workflow step, found ${matches.length}`,
    );
  }
  const match = matches[0];
  if (match === undefined) {
    throw new Error(`artifact schema '${schemaName}' matched no workflow step`);
  }
  const artifact = match.writes.artifact;
  if (artifact === undefined) {
    throw new Error(`artifact schema '${schemaName}' matched a step without an artifact writer`);
  }
  return artifact.path as unknown as string;
}

export function workflowHasArtifactSchemaInWorkflow(
  workflow: Workflow,
  schemaName: string,
): boolean {
  return workflow.steps.some((candidate) => candidate.writes.artifact?.schema === schemaName);
}
