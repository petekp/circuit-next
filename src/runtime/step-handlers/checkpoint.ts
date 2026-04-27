import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { Rigor } from '../../schemas/rigor.js';
import type { Workflow } from '../../schemas/workflow.js';
import { sha256Hex } from '../adapters/shared.js';
import { findCheckpointBriefBuilder } from '../registries/checkpoint-writers/registry.js';
import { resolveRunRelative } from '../run-relative-path.js';
import { writeDerivedSnapshot } from '../snapshot-writer.js';
import { isRunRelativePathError, writeJsonArtifact } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

export type CheckpointStep = Workflow['steps'][number] & { kind: 'checkpoint' };

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
      readonly autoResolved: boolean;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

export function checkpointChoiceIds(step: CheckpointStep): string[] {
  return step.policy.choices.map((choice) => choice.id);
}

function resolveCheckpoint(step: CheckpointStep, rigor: Rigor): CheckpointResolution {
  if (rigor === 'deep' || rigor === 'tournament') return { kind: 'waiting' };
  if (rigor === 'autonomous') {
    const selection = step.policy.safe_autonomous_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous rigor without a declared safe autonomous choice`,
      };
    }
    return {
      kind: 'resolved',
      selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
    };
  }
  const selection = step.policy.safe_default_choice;
  if (selection === undefined) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot resolve ${rigor} rigor without a declared safe default choice`,
    };
  }
  return {
    kind: 'resolved',
    selection,
    resolutionSource: 'safe-default',
    autoResolved: true,
  };
}

export function checkpointRequestBody(input: {
  readonly step: CheckpointStep;
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointArtifactSha256?: string;
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: input.step.policy.prompt,
    allowed_choices: checkpointChoiceIds(input.step),
    ...(input.step.policy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: input.step.policy.safe_default_choice }),
    ...(input.step.policy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: input.step.policy.safe_autonomous_choice }),
    execution_context: {
      ...(input.projectRoot === undefined ? {} : { project_root: input.projectRoot }),
      selection_config_layers: input.selectionConfigLayers,
      ...(input.checkpointArtifactSha256 === undefined
        ? {}
        : { checkpoint_artifact_sha256: input.checkpointArtifactSha256 }),
    },
  };
}

function checkpointResponseBody(input: {
  readonly step: CheckpointStep;
  readonly selection: string;
  readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    selection: input.selection,
    resolution_source: input.resolutionSource,
  };
}

function checkpointFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `checkpoint step '${stepId}': checkpoint handling failed (${message})`;
}

// Checkpoint artifact writer. Most checkpoints don't write artifacts;
// when they do, a registered CheckpointBriefBuilder owns the workflow-
// specific assembly. Adding a new workflow's checkpoint-with-artifact
// means adding a builder under src/runtime/registries/checkpoint-writers/.
function writeCheckpointOwnedArtifact(input: {
  readonly runRoot: string;
  readonly step: CheckpointStep;
  readonly goal: string;
  readonly responsePath?: string;
  readonly existingArtifact?: unknown;
}): void {
  const artifact = input.step.writes.artifact;
  if (artifact === undefined) return;
  const builder = findCheckpointBriefBuilder(artifact.schema);
  if (builder === undefined) {
    throw new Error(`checkpoint step '${input.step.id}' has unsupported artifact schema`);
  }
  const body = builder.build({
    runRoot: input.runRoot,
    step: input.step,
    goal: input.goal,
    ...(input.responsePath === undefined ? {} : { responsePath: input.responsePath }),
    ...(input.existingArtifact === undefined ? {} : { existingArtifact: input.existingArtifact }),
  });
  writeJsonArtifact(input.runRoot, artifact.path, body);
}

export function runCheckpointStep(
  ctx: StepHandlerContext & { readonly step: CheckpointStep },
): StepHandlerResult {
  const {
    runRoot,
    step,
    goal,
    runId,
    rigor,
    attempt,
    recordedAt,
    push,
    state,
    isResumedCheckpoint,
    resumeCheckpoint,
    projectRoot,
    executionSelectionConfigLayers,
  } = ctx;

  try {
    const requestAbs = resolveRunRelative(runRoot, step.writes.request);
    if (!isResumedCheckpoint) {
      writeCheckpointOwnedArtifact({ runRoot, step, goal });
      const checkpointArtifactSha256 =
        step.writes.artifact !== undefined &&
        findCheckpointBriefBuilder(step.writes.artifact.schema) !== undefined
          ? sha256Hex(readFileSync(resolveRunRelative(runRoot, step.writes.artifact.path), 'utf8'))
          : undefined;
      const requestText = `${JSON.stringify(
        checkpointRequestBody({
          step,
          ...(projectRoot === undefined ? {} : { projectRoot }),
          selectionConfigLayers: executionSelectionConfigLayers,
          ...(checkpointArtifactSha256 === undefined ? {} : { checkpointArtifactSha256 }),
        }),
        null,
        2,
      )}\n`;
      mkdirSync(dirname(requestAbs), { recursive: true });
      writeFileSync(requestAbs, requestText);
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'checkpoint.requested',
        step_id: step.id,
        attempt,
        options: checkpointChoiceIds(step),
        request_path: step.writes.request,
        request_artifact_hash: sha256Hex(requestText),
      });
      if (step.writes.artifact !== undefined) {
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'step.artifact_written',
          step_id: step.id,
          attempt,
          artifact_path: step.writes.artifact.path,
          artifact_schema: step.writes.artifact.schema,
        });
      }
    }

    const resolution: CheckpointResolution =
      isResumedCheckpoint && resumeCheckpoint !== undefined
        ? {
            kind: 'resolved',
            selection: resumeCheckpoint.selection,
            resolutionSource: 'operator',
            autoResolved: false,
          }
        : resolveCheckpoint(step, rigor);

    if (resolution.kind === 'waiting') {
      // Snapshot is derived for the waiting result; coordinator owns the
      // CheckpointWaitingResult assembly. Re-deriving here so the
      // snapshot file on disk reflects the most recent events.
      writeDerivedSnapshot(runRoot);
      return {
        kind: 'waiting_checkpoint',
        checkpoint: {
          stepId: step.id as unknown as string,
          requestPath: requestAbs,
          allowedChoices: checkpointChoiceIds(step),
        },
      };
    }

    if (resolution.kind === 'failed') {
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'gate.evaluated',
        step_id: step.id,
        attempt,
        gate_kind: 'checkpoint_selection',
        outcome: 'fail',
        reason: resolution.reason,
      });
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason: resolution.reason,
      });
      return { kind: 'aborted', reason: resolution.reason };
    }

    if (!step.gate.allow.includes(resolution.selection)) {
      throw new Error(
        `checkpoint step '${step.id}' selected '${resolution.selection}' but gate.allow is [${step.gate.allow.join(', ')}]`,
      );
    }
    writeJsonArtifact(
      runRoot,
      step.writes.response,
      checkpointResponseBody({
        step,
        selection: resolution.selection,
        resolutionSource: resolution.resolutionSource,
      }),
    );
    writeCheckpointOwnedArtifact({
      runRoot,
      step,
      goal,
      responsePath: step.writes.response,
      ...(resumeCheckpoint?.existingArtifact === undefined
        ? {}
        : { existingArtifact: resumeCheckpoint.existingArtifact }),
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'checkpoint.resolved',
      step_id: step.id,
      attempt,
      selection: resolution.selection,
      auto_resolved: resolution.autoResolved,
      resolution_source: resolution.resolutionSource,
      response_path: step.writes.response,
    });
    if (step.writes.artifact !== undefined) {
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.artifact_written',
        step_id: step.id,
        attempt,
        artifact_path: step.writes.artifact.path,
        artifact_schema: step.writes.artifact.schema,
      });
    }
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'checkpoint_selection',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const reason = checkpointFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'checkpoint_selection',
      outcome: 'fail',
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.aborted',
      step_id: step.id,
      attempt,
      reason,
    });
    return { kind: 'aborted', reason };
  }
}
