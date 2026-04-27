// Shape-hint registry types.
//
// A shape hint tells a worker what JSON shape its dispatch response
// must produce so the runner can parse + validate the result against
// the step's typed artifact schema. Without a hint, workers receive
// only a generic "respond with a verdict" instruction and produce
// acknowledgment-style responses that fail schema validation at the
// step gate.
//
// Two hint kinds live in the registry:
//   - 'schema'     — keyed by `step.writes.artifact.schema`. The
//                    common case: each per-workflow dispatch step
//                    that writes a typed artifact contributes one.
//   - 'structural' — keyed by a step-shape predicate (role + gate).
//                    For dispatch steps that emit a structured result
//                    body but do not register a typed artifact under
//                    `writes.artifact` (e.g. the standalone review
//                    workflow's audit step).
//
// To add a new workflow's dispatch shape hint, an author writes:
//   1. The schema for the artifact body in src/schemas/artifacts/
//   2. A ShapeHint export in src/runtime/shape-hints/<workflow>.ts
//   3. A registry entry in src/runtime/shape-hints/registry.ts

import type { Workflow } from '../../schemas/workflow.js';

export type DispatchStep = Workflow['steps'][number] & { readonly kind: 'dispatch' };

export interface SchemaShapeHint {
  readonly kind: 'schema';
  readonly schema: string;
  readonly instruction: string;
}

export interface StructuralShapeHint {
  readonly kind: 'structural';
  readonly id: string;
  match(step: DispatchStep): boolean;
  readonly instruction: string;
}

export type ShapeHint = SchemaShapeHint | StructuralShapeHint;
