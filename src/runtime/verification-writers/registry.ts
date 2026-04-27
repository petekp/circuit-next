// Registry of verification writers, keyed by output schema name.
//
// Builders come from src/workflows/catalog.ts — each WorkflowPackage
// contributes its writers.verification array.

import { workflowPackages } from '../../workflows/catalog.js';
import type { VerificationBuilder } from './types.js';

const REGISTRY: ReadonlyMap<string, VerificationBuilder> = (() => {
  const map = new Map<string, VerificationBuilder>();
  for (const pkg of workflowPackages) {
    for (const builder of pkg.writers.verification) {
      if (map.has(builder.resultSchemaName)) {
        throw new Error(
          `duplicate verification builder registered for schema '${builder.resultSchemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(builder.resultSchemaName, builder);
    }
  }
  return map;
})();

export function findVerificationWriter(resultSchemaName: string): VerificationBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
