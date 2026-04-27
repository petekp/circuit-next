// Synthesis writer registry types.
//
// A synthesis writer turns a recipe's synthesis step into a
// schema-validated artifact. It generalizes the close-writer pattern:
// every workflow's brief, plan, intake, analysis, etc., gets its own
// builder file under src/runtime/synthesis-writers/ and is registered
// by output schema name. The runner dispatches via the registry — it
// does not need to know which schemas exist.
//
// To add a new workflow's synthesis step, an author writes:
//   1. The schema for the output artifact in src/workflows/<wf>/artifacts.ts
//   2. A SynthesisBuilder in src/workflows/<wf>/writers/<schema>.ts
//   3. Register it on the package's `writers.synthesis`
//
// Close-with-evidence has its own registry under
// src/runtime/close-writers/. The two registries are intentionally
// kept separate because close steps have additional contract concerns
// (artifact_pointers, optional reads for mode-conditional inputs)
// that don't apply to upstream synthesis steps.

import type { Workflow } from '../../../schemas/workflow.js';

export type SynthesisStep = Workflow['steps'][number] & {
  readonly kind: 'synthesis';
  readonly writes: { readonly artifact: { readonly schema: string; readonly path: string } };
};

// Declarative description of a typed-artifact read. The runner uses
// this to pre-resolve paths and read JSON before invoking build().
// Builders that need non-standard resolution (e.g., review.result
// reads a dispatch result body, not a typed artifact) can omit
// `reads` and resolve paths themselves inside build().
export interface SynthesisReadDescriptor {
  readonly name: string;
  readonly schema: string;
  readonly required: boolean;
}

export interface SynthesisBuildContext {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly step: SynthesisStep;
  readonly goal: string;
  // Pre-resolved inputs from declared reads (or empty if no reads
  // declared). Builders narrow each via their own Zod schema.
  readonly inputs: Record<string, unknown | undefined>;
}

export interface SynthesisBuilder {
  // Schema name of the artifact this builder produces (e.g.
  // 'build.plan@v1', 'explore.brief@v1'). Acts as the registry key.
  readonly resultSchemaName: string;
  // Optional declarative reads. When omitted, the builder resolves
  // paths itself in build().
  readonly reads?: readonly SynthesisReadDescriptor[];
  // Per-workflow logic. Returns the unvalidated artifact body — the
  // builder is responsible for validating against the registered
  // result schema before returning.
  build(context: SynthesisBuildContext): unknown;
}
