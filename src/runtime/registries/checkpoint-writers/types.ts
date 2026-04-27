// Checkpoint writer registry types.
//
// A checkpoint step optionally writes a typed artifact alongside its
// request/response files. Build's frame step is the canonical example:
// the policy carries a `build_brief` template, the runner assembles a
// BuildBrief at first invocation and re-stamps the response_path
// after operator selection. Future workflows would add their own
// policy templates + builders.
//
// To add a new workflow's checkpoint-with-artifact:
//   1. Extend CheckpointPolicy in src/schemas/step.ts with the new
//      template field (or evolve the policy to a generic
//      template-by-schema map).
//   2. Define a CheckpointBriefBuilder in the workflow package
//      (src/workflows/<id>/writers/checkpoint-*.ts).
//   3. Register it on the WorkflowPackage's `writers.checkpoint`.
//
// Most checkpoints don't write artifacts at all — those skip this
// path entirely (the runner only invokes a builder when
// step.writes.artifact is defined).

import type { DispatchRole } from '../../../schemas/step.js';
import type { Workflow } from '../../../schemas/workflow.js';

export type CheckpointStep = Workflow['steps'][number] & {
  readonly kind: 'checkpoint';
};

export interface CheckpointBuildContext {
  readonly runRoot: string;
  readonly step: CheckpointStep;
  readonly goal: string;
  readonly responsePath?: string;
  // First-invocation flag: when undefined, the builder constructs a
  // fresh artifact from goal + policy template; when defined, the
  // builder re-stamps the existing artifact with the resolved
  // response_path. Build uses this to keep the first-write request_path
  // and the post-resolve response_path consistent on the same brief.
  readonly existingArtifact?: unknown;
}

// Resume-context input the runner passes to the builder when it finds
// a waiting checkpoint with a typed artifact. The builder owns hash
// verification + workflow-specific shape checks (e.g. Build's brief
// must match the step's choice ids and request_path). Returns the
// validated artifact body as `unknown` — only the same builder will
// later consume it via `existingArtifact` on re-stamp.
export interface CheckpointResumeContext {
  readonly runRoot: string;
  readonly step: CheckpointStep;
  readonly artifactPath: string;
  readonly artifactSha256?: string;
}

export interface CheckpointBriefBuilder {
  // Schema name of the artifact this builder produces (e.g.
  // 'build.brief@v1'). Acts as the registry key.
  readonly resultSchemaName: string;
  // Workflow-specific assembly. Returns the unvalidated artifact —
  // the builder is responsible for validating against the registered
  // result schema before returning.
  build(context: CheckpointBuildContext): unknown;
  // Optional resume-time validator. Reads the previously-written
  // artifact from disk, verifies the request hash matches what the
  // checkpoint request stored, and runs workflow-specific shape
  // checks. Returns the validated artifact body so the runner can
  // thread it back through the re-stamp path. Builders that don't
  // need resume validation may omit this method (the runner treats
  // a missing validator as 'no resume context to validate').
  validateResumeContext?(context: CheckpointResumeContext): unknown;
}

// Helper used by checkpoint builders to read the choice ids the
// runner accepts for this step. Lives here (not in registry.ts) so
// builders can import it without a registry round-trip.
export function checkpointChoiceIds(step: CheckpointStep): string[] {
  return step.policy.choices.map((choice) => choice.id);
}

// Re-export for builder convenience.
export type { DispatchRole };
