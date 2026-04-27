// Registry of dispatch shape hints, keyed by output schema name.
//
// Adding a new workflow's dispatch step means: write the hint module
// in this directory, then register it here. The runner consults this
// registry in dispatchResponseInstruction — it does not need to know
// which workflows or schemas exist.
//
// Schema-keyed hints are looked up first via a Map<schema, instruction>.
// Structural hints (e.g. the standalone review audit step which writes
// no typed artifact) are tried in registration order only when the
// schema lookup misses.

import { buildImplementationShapeHint, buildReviewShapeHint } from './build.js';
import { exploreReviewVerdictShapeHint, exploreSynthesisShapeHint } from './explore.js';
import { reviewDispatchShapeHint } from './review.js';
import {
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
} from './sweep.js';
import type { DispatchStep, SchemaShapeHint, ShapeHint, StructuralShapeHint } from './types.js';

const HINTS: readonly ShapeHint[] = [
  exploreSynthesisShapeHint,
  exploreReviewVerdictShapeHint,
  buildImplementationShapeHint,
  buildReviewShapeHint,
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
  reviewDispatchShapeHint,
];

const SCHEMA_HINTS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const hint of HINTS) {
    if (hint.kind !== 'schema') continue;
    if (map.has(hint.schema)) {
      throw new Error(`duplicate shape hint registered for schema '${hint.schema}'`);
    }
    map.set(hint.schema, hint.instruction);
  }
  return map;
})();

const STRUCTURAL_HINTS: readonly StructuralShapeHint[] = (() => {
  const list: StructuralShapeHint[] = [];
  const seen = new Set<string>();
  for (const hint of HINTS) {
    if (hint.kind !== 'structural') continue;
    if (seen.has(hint.id)) {
      throw new Error(`duplicate structural shape hint id '${hint.id}'`);
    }
    seen.add(hint.id);
    list.push(hint);
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
  return HINTS.filter((hint): hint is SchemaShapeHint => hint.kind === 'schema');
}

export function listRegisteredStructuralHints(): readonly StructuralShapeHint[] {
  return STRUCTURAL_HINTS;
}
