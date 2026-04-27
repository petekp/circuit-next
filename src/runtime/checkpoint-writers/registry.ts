// Registry of checkpoint brief builders, keyed by output schema name.
//
// Builders come from src/workflows/catalog.ts — each WorkflowPackage
// contributes its writers.checkpoint array. Most checkpoints don't
// write artifacts and skip this registry entirely; the runner only
// invokes a builder when step.writes.artifact is defined.

import { workflowPackages } from '../../workflows/catalog.js';
import type { CheckpointBriefBuilder } from './types.js';

const REGISTRY: ReadonlyMap<string, CheckpointBriefBuilder> = (() => {
  const map = new Map<string, CheckpointBriefBuilder>();
  for (const pkg of workflowPackages) {
    for (const builder of pkg.writers.checkpoint) {
      if (map.has(builder.resultSchemaName)) {
        throw new Error(
          `duplicate checkpoint builder registered for schema '${builder.resultSchemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(builder.resultSchemaName, builder);
    }
  }
  return map;
})();

export function findCheckpointBriefBuilder(
  resultSchemaName: string,
): CheckpointBriefBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
