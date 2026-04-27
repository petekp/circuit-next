// Workflow package — the per-workflow unit the engine consumes.
//
// Each workflow lives in src/workflows/<id>/ and exports a
// WorkflowPackage describing its source files, routing metadata,
// dispatch artifacts, writers, and structural shape hints. The engine
// (router, registries, artifact-schemas, emit script) derives everything
// from the workflowPackages aggregation in src/workflows/catalog.ts —
// it never imports a workflow module directly.
//
// Adding a workflow = create src/workflows/<id>/, export a
// WorkflowPackage, append it to catalog.ts. No edits to the engine.

import type { z } from 'zod';
import type { CheckpointBriefBuilder } from '../runtime/registries/checkpoint-writers/types.js';
import type { CloseBuilder } from '../runtime/registries/close-writers/types.js';
import type { CrossArtifactValidatorEntry } from '../runtime/registries/cross-artifact-validators.js';
import type { StructuralShapeHint } from '../runtime/registries/shape-hints/types.js';
import type { SynthesisBuilder } from '../runtime/registries/synthesis-writers/types.js';
import type { VerificationBuilder } from '../runtime/registries/verification-writers/types.js';

export interface WorkflowSignal {
  readonly label: string;
  readonly pattern: RegExp;
}

export interface WorkflowRoutingMetadata {
  // Lower order = earlier consideration. Review goes first because
  // its signals are unambiguous; build goes last because its signals
  // collide with planning-artifact phrasing. Default workflow uses a
  // sentinel (Number.MAX_SAFE_INTEGER) and is selected only when no
  // other package matches.
  readonly order: number;

  // Positive signals that route a request to this workflow.
  readonly signals: readonly WorkflowSignal[];

  // When true, a positive signal that ALSO mentions a planning
  // artifact (proposal/plan/brief/etc.) is treated as a non-match,
  // letting routing fall through to subsequent packages and ultimately
  // the default. Used by build/fix/migrate. Review skips this.
  readonly skipOnPlanningArtifact?: boolean;

  // Reason string for matched routes. Receives the matched signal so
  // packages can preserve their existing phrasing.
  reasonForMatch(signal: WorkflowSignal): string;

  // When true, this package is the catch-all when no signal matches.
  // Exactly one package may set this.
  readonly isDefault?: boolean;

  // Reason string when this package is selected as the default.
  readonly defaultReason?: string;
}

export interface WorkflowDispatchArtifact {
  // Schema string (e.g. 'build.implementation@v1'). The engine uses
  // this both to look up the Zod validator (artifact-schemas.ts) and
  // to look up the dispatch shape hint (shape-hints/registry.ts).
  readonly schemaName: string;

  // Zod validator the dispatch handler runs against the adapter's
  // result_body before materializing the artifact.
  readonly schema: z.ZodTypeAny;

  // Optional prompt instruction the worker receives describing the
  // exact JSON shape it must emit. Synthesis-only artifacts (written
  // by the orchestrator, not by adapter dispatch) skip this; a few
  // dispatch artifacts also lack a hint and rely on the generic
  // dispatch shape instruction.
  readonly dispatchHint?: string;
}

export interface WorkflowPaths {
  // Recipe path is required — every workflow has a recipe.
  readonly recipe: string;
  // Optional: not every workflow ships a slash command (sweep is
  // sub-run only; migrate is /circuit:run only).
  readonly command?: string;
  // Optional: workflow-specific contract narrative. Not every
  // workflow has one yet.
  readonly contract?: string;
}

// Engine-visible flags a workflow can opt into. Kept narrow on purpose:
// only flags that the engine currently branches on belong here. New
// flags should describe a behavior, not a workflow name.
export interface WorkflowEngineFlags {
  // When true, the dispatch-selection layer threads the run's effective
  // rigor into the per-workflow circuit selection so a worker is
  // chosen based on rigor (Build's pattern). Other workflows resolve
  // selection without an injected rigor layer.
  readonly bindsExecutionRigorToDispatchSelection?: boolean;
}

export interface WorkflowPackage {
  readonly id: string;
  readonly paths: WorkflowPaths;
  readonly routing?: WorkflowRoutingMetadata;
  readonly dispatchArtifacts: readonly WorkflowDispatchArtifact[];
  readonly writers: {
    readonly synthesis: readonly SynthesisBuilder[];
    readonly close: readonly CloseBuilder[];
    readonly verification: readonly VerificationBuilder[];
    readonly checkpoint: readonly CheckpointBriefBuilder[];
  };
  // Structural hints for dispatch steps that don't write a typed
  // artifact (review's standalone audit step is the canonical case).
  readonly structuralHints?: readonly StructuralShapeHint[];
  // Cross-artifact validators run after `parseArtifact` succeeds for
  // a given schema. They enforce constraints that span more than one
  // artifact (e.g. sweep.batch.items[].candidate_id must be a subset
  // of sweep.queue.to_execute) and therefore cannot be expressed in
  // the single-artifact Zod schema. Empty / absent = no cross-
  // artifact constraints for this workflow.
  readonly crossArtifactValidators?: readonly CrossArtifactValidatorEntry[];
  // Optional engine-visible behavior flags. Absent = all defaults.
  readonly engineFlags?: WorkflowEngineFlags;
}
