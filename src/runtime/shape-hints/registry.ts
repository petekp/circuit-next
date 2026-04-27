// Registry of dispatch shape hints, keyed by output schema name.
//
// Hints come from src/workflows/catalog.ts:
//   - Schema hints: each WorkflowPackage's dispatchArtifacts entries
//     with a `dispatchHint` string contribute one schema-keyed hint.
//   - Structural hints: each WorkflowPackage's `structuralHints` array
//     (currently only review's standalone audit step) contributes
//     step-shape-matched hints tried in registration order when the
//     schema lookup misses.

import { workflowPackages } from '../../workflows/catalog.js';
import type { DispatchStep, SchemaShapeHint, StructuralShapeHint } from './types.js';

const SCHEMA_HINTS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const pkg of workflowPackages) {
    for (const artifact of pkg.dispatchArtifacts) {
      if (artifact.dispatchHint === undefined) continue;
      if (map.has(artifact.schemaName)) {
        throw new Error(
          `duplicate shape hint registered for schema '${artifact.schemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(artifact.schemaName, artifact.dispatchHint);
    }
  }
  return map;
})();

const STRUCTURAL_HINTS: readonly StructuralShapeHint[] = (() => {
  const list: StructuralShapeHint[] = [];
  const seen = new Set<string>();
  for (const pkg of workflowPackages) {
    if (pkg.structuralHints === undefined) continue;
    for (const hint of pkg.structuralHints) {
      if (seen.has(hint.id)) {
        throw new Error(`duplicate structural shape hint id '${hint.id}' (workflow ${pkg.id})`);
      }
      seen.add(hint.id);
      list.push(hint);
    }
  }
  return list;
})();

export function findDispatchShapeHint(step: DispatchStep): string | undefined {
  const schema = step.writes.artifact?.schema;
  if (schema !== undefined) {
    const bySchema = SCHEMA_HINTS.get(schema);
    if (bySchema !== undefined) return bySchema;
  }
  for (const hint of STRUCTURAL_HINTS) {
    if (hint.match(step)) return hint.instruction;
  }
  return undefined;
}

export function listRegisteredSchemaHints(): readonly SchemaShapeHint[] {
  const out: SchemaShapeHint[] = [];
  for (const [schema, instruction] of SCHEMA_HINTS) {
    out.push({ kind: 'schema', schema, instruction });
  }
  return out;
}

export function listRegisteredStructuralHints(): readonly StructuralShapeHint[] {
  return STRUCTURAL_HINTS;
}
