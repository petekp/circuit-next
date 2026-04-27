// Build brief checkpoint writer.
//
// On first invocation: assembles a fresh BuildBrief from the run goal
// plus the policy.build_brief template. On re-stamp invocations
// (after the operator selects a choice): preserves the prior brief
// and updates only the checkpoint.response_path.

import {
  type CheckpointBriefBuilder,
  type CheckpointBuildContext,
  checkpointChoiceIds,
} from '../../../runtime/checkpoint-writers/types.js';
import { BuildBrief } from '../../../schemas/artifacts/build.js';

export const buildBriefCheckpointBuilder: CheckpointBriefBuilder = {
  resultSchemaName: 'build.brief@v1',
  build(context: CheckpointBuildContext): unknown {
    const template = context.step.policy.build_brief;
    if (template === undefined) {
      throw new Error(
        `checkpoint step '${context.step.id}' writing build.brief@v1 requires policy.build_brief`,
      );
    }
    if (context.existingArtifact === undefined) {
      return BuildBrief.parse({
        objective: context.goal,
        scope: template.scope,
        success_criteria: template.success_criteria,
        verification_command_candidates: template.verification_command_candidates,
        checkpoint: {
          request_path: context.step.writes.request,
          ...(context.responsePath === undefined ? {} : { response_path: context.responsePath }),
          allowed_choices: checkpointChoiceIds(context.step),
        },
      });
    }
    const existing = BuildBrief.parse(context.existingArtifact);
    return BuildBrief.parse({
      ...existing,
      checkpoint: {
        ...existing.checkpoint,
        ...(context.responsePath === undefined ? {} : { response_path: context.responsePath }),
      },
    });
  },
};
