// Registry of dispatch shape hints, keyed by output schema name.
//
// Hints come from src/workflows/catalog.ts via buildSchemaHintMap and
// buildStructuralHintList. Schema lookup runs first; structural hints
// are tried in registration order only when the schema lookup misses.

import { workflowPackages } from '../../workflows/catalog.js';
import { buildSchemaHintMap, buildStructuralHintList } from '../catalog-derivations.js';
import type { DispatchStep, SchemaShapeHint, StructuralShapeHint } from './types.js';

const SCHEMA_HINTS = buildSchemaHintMap(workflowPackages);
const STRUCTURAL_HINTS = buildStructuralHintList(workflowPackages);

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
