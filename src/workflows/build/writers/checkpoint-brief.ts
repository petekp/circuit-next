// Build brief checkpoint writer.
//
// Assembles a fresh BuildBrief from the run goal plus the
// policy.build_brief template. The brief is fully populated at first
// write — checkpoint.response_path always points at step.writes.response
// — so no re-stamp happens after operator resolution. This eliminates
// the crash window between a stamped-brief write and the
// checkpoint.resolved event.
//
// Resume-time validator: reads the on-disk brief, verifies its hash
// against the value the checkpoint request stored, parses it through
// the BuildBrief schema, and asserts the brief.checkpoint.* shape
// belongs to the waiting step.

import { readFileSync } from 'node:fs';
import { sha256Hex } from '../../../runtime/adapters/shared.js';
import {
  type CheckpointBriefBuilder,
  type CheckpointBuildContext,
  type CheckpointResumeContext,
  checkpointChoiceIds,
} from '../../../runtime/registries/checkpoint-writers/types.js';
import { resolveRunRelative } from '../../../runtime/run-relative-path.js';
import { BuildBrief } from '../artifacts.js';

export const buildBriefCheckpointBuilder: CheckpointBriefBuilder = {
  resultSchemaName: 'build.brief@v1',
  build(context: CheckpointBuildContext): unknown {
    const template = context.step.policy.build_brief;
    if (template === undefined) {
      throw new Error(
        `checkpoint step '${context.step.id}' writing build.brief@v1 requires policy.build_brief`,
      );
    }
    return BuildBrief.parse({
      objective: context.goal,
      scope: template.scope,
      success_criteria: template.success_criteria,
      verification_command_candidates: template.verification_command_candidates,
      checkpoint: {
        request_path: context.step.writes.request,
        response_path: context.responsePath,
        allowed_choices: checkpointChoiceIds(context.step),
      },
    });
  },
  validateResumeContext(context: CheckpointResumeContext): BuildBrief {
    const artifactAbs = resolveRunRelative(context.runRoot, context.artifactPath);
    const raw = readFileSync(artifactAbs, 'utf8');
    if (context.artifactSha256 === undefined) {
      throw new Error(
        'checkpoint resume rejected: checkpoint request is missing checkpoint_artifact_sha256',
      );
    }
    const observedHash = sha256Hex(raw);
    if (observedHash !== context.artifactSha256) {
      throw new Error('checkpoint resume rejected: waiting Build brief hash differs from request');
    }
    const brief = BuildBrief.parse(JSON.parse(raw));
    const expectedChoices = checkpointChoiceIds(context.step);
    if (
      brief.checkpoint.request_path !== context.step.writes.request ||
      brief.checkpoint.response_path !== context.step.writes.response ||
      brief.checkpoint.allowed_choices.length !== expectedChoices.length ||
      brief.checkpoint.allowed_choices.some((choice, index) => choice !== expectedChoices[index])
    ) {
      throw new Error(
        `checkpoint resume rejected: waiting Build brief does not belong to checkpoint '${context.step.id}'`,
      );
    }
    return brief;
  },
};
