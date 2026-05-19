// Checkpoint executor.
//
// This file owns the runtime side of checkpoint requests: writing the request,
// emitting trace evidence, deciding whether depth waits or auto-resolves, and
// applying an operator resume selection. Resume validation lives in the run
// resume path, not here.
import { findCheckpointBriefBuilder } from '../../flows/registries/checkpoint-writers/registry.js';
import { requireRuntimeIndexedStep } from '../../flows/registries/runtime-index.js';
import type { CheckpointChoiceSource } from '../../schemas/runtime-source.js';
import { sha256Hex } from '../../shared/connector-relay.js';
import {
  type CheckpointChoice,
  resolveCheckpointChoicesSource,
} from '../../shared/runtime-source.js';
import type { StepOutcome } from '../domain/step.js';
import type { CheckpointStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import {
  type StepExecutionResult,
  stepExecutionFailed,
  stepExecutionFailedFrom,
  stepExecutionOutcome,
  unwrapStepExecutionResult,
} from './result.js';

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'operator' | 'safe-default' | 'safe-autonomous';
      readonly autoResolved: boolean;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

function policy(step: CheckpointStep) {
  if (step.policy === undefined || step.policy === null || typeof step.policy !== 'object') {
    throw new Error(`checkpoint step '${step.id}' is missing checkpoint policy`);
  }
  return step.policy as {
    readonly prompt: string;
    readonly safe_default_choice?: string;
    readonly safe_autonomous_choice?: string;
    readonly choices?: readonly CheckpointChoice[];
    readonly choices_from?: CheckpointChoiceSource;
  };
}

async function materializePolicy(
  step: CheckpointStep,
  context: RunContext,
): Promise<{
  readonly prompt: string;
  readonly safe_default_choice?: string;
  readonly safe_autonomous_choice?: string;
  readonly choices: readonly CheckpointChoice[];
}> {
  const stepPolicy = policy(step);
  const choices =
    stepPolicy.choices ??
    (stepPolicy.choices_from === undefined
      ? undefined
      : await resolveCheckpointChoicesSource({
          source: stepPolicy.choices_from,
          files: context.files,
          ...(context.axes === undefined ? {} : { axes: context.axes }),
          owner: `checkpoint step '${step.id}' choices_from`,
        }));
  if (choices === undefined || choices.length === 0) {
    throw new Error(`checkpoint step '${step.id}' has no executable checkpoint choices`);
  }
  return {
    prompt: stepPolicy.prompt,
    choices,
    ...(stepPolicy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: stepPolicy.safe_default_choice }),
    ...(stepPolicy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: stepPolicy.safe_autonomous_choice }),
  };
}

function resolveCheckpoint(
  step: CheckpointStep,
  depth: string | undefined,
  stepPolicy: Awaited<ReturnType<typeof materializePolicy>>,
): CheckpointResolution {
  const effectiveDepth = depth ?? 'standard';
  if (effectiveDepth === 'deep' || effectiveDepth === 'tournament') return { kind: 'waiting' };
  if (effectiveDepth === 'autonomous') {
    const selection = stepPolicy.safe_autonomous_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous depth without a declared safe autonomous choice`,
      };
    }
    return { kind: 'resolved', selection, resolutionSource: 'safe-autonomous', autoResolved: true };
  }
  const selection = stepPolicy.safe_default_choice;
  if (selection === undefined) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot resolve ${effectiveDepth} depth without a declared safe default choice`,
    };
  }
  return { kind: 'resolved', selection, resolutionSource: 'safe-default', autoResolved: true };
}

function checkpointRequestBody(input: {
  readonly step: CheckpointStep;
  readonly context: RunContext;
  readonly stepPolicy: Awaited<ReturnType<typeof materializePolicy>>;
  readonly checkpointReportSha256?: string;
}) {
  const stepPolicy = input.stepPolicy;
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: stepPolicy.prompt,
    allowed_choices: stepPolicy.choices.map((choice) => choice.id),
    ...(stepPolicy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: stepPolicy.safe_default_choice }),
    ...(stepPolicy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: stepPolicy.safe_autonomous_choice }),
    execution_context: {
      ...(input.context.axes === undefined ? {} : { axes: input.context.axes }),
      ...(input.context.projectRoot === undefined
        ? {}
        : { project_root: input.context.projectRoot }),
      selection_config_layers: input.context.selectionConfigLayers ?? [],
      ...(input.checkpointReportSha256 === undefined
        ? {}
        : { checkpoint_report_sha256: input.checkpointReportSha256 }),
    },
  };
}

export async function executeCheckpointResult(
  step: CheckpointStep,
  context: RunContext,
): Promise<StepExecutionResult> {
  const attempt = context.activeStepAttempt ?? 1;
  try {
    const request = step.writes?.request;
    const response = step.writes?.response;
    if (request === undefined || response === undefined) {
      return stepExecutionFailed(
        `checkpoint step '${step.id}' requires writes.request and writes.response`,
      );
    }
    const indexedStep = requireRuntimeIndexedStep(context.packageIndex, step.id, 'checkpoint');
    const stepPolicy = await materializePolicy(step, context);

    let checkpointReportSha256: string | undefined;
    const report = step.writes?.report;
    const resumedSelection =
      context.resumeCheckpoint?.stepId === step.id ? context.resumeCheckpoint.selection : undefined;
    const resolution = resolveCheckpoint(step, context.depth, stepPolicy);
    if (resumedSelection === undefined) {
      if (report !== undefined) {
        const builder =
          report.schema === undefined ? undefined : findCheckpointBriefBuilder(report.schema);
        if (builder === undefined || report.schema === undefined) {
          return stepExecutionFailed(`checkpoint step '${step.id}' has unsupported report schema`);
        }
        const body = builder.build({
          runFolder: context.runDir,
          step: indexedStep,
          goal: context.goal,
          ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
          responsePath: response.path,
        });
        await context.files.writeJson(report, body);
        checkpointReportSha256 = sha256Hex(await context.files.readText(report));
        await context.trace.append({
          run_id: context.runId,
          kind: 'step.report_written',
          step_id: step.id,
          attempt,
          report_path: report.path,
          report_schema: report.schema,
        });
      }

      const requestBody = checkpointRequestBody({
        step,
        context,
        stepPolicy,
        ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
      });
      await context.files.writeJson(request, requestBody);
      const requestText = await context.files.readText(request);
      await context.trace.append({
        run_id: context.runId,
        kind: 'checkpoint.requested',
        step_id: step.id,
        attempt,
        request_path: request.path,
        request_report_hash: sha256Hex(requestText),
        options: stepPolicy.choices.map((choice) => choice.id),
        auto_resolved: resolution.kind === 'resolved' ? resolution.autoResolved : false,
      });
    }

    const effectiveResolution: CheckpointResolution =
      resumedSelection === undefined
        ? resolution
        : {
            kind: 'resolved',
            selection: resumedSelection,
            resolutionSource: 'operator',
            autoResolved: false,
          };
    if (effectiveResolution.kind === 'waiting') {
      return stepExecutionOutcome({
        kind: 'waiting_checkpoint',
        checkpoint: {
          stepId: step.id,
          attempt,
          requestPath: context.files.resolve(request),
          allowedChoices: stepPolicy.choices.map((choice) => choice.id),
        },
      });
    }
    if (effectiveResolution.kind === 'failed') {
      await context.trace.append({
        run_id: context.runId,
        kind: 'check.evaluated',
        step_id: step.id,
        attempt,
        check_kind: 'checkpoint_selection',
        outcome: 'fail',
        reason: effectiveResolution.reason,
      });
      return stepExecutionFailed(effectiveResolution.reason);
    }

    const allowed = (step.check as { readonly allow?: unknown }).allow;
    const effectiveAllowed = Array.isArray(allowed)
      ? allowed
      : stepPolicy.choices.map((choice) => choice.id);
    if (!effectiveAllowed.includes(effectiveResolution.selection)) {
      return stepExecutionFailed(
        `checkpoint step '${step.id}' selected '${effectiveResolution.selection}' but check.allow is [${effectiveAllowed.join(', ')}]`,
      );
    }
    await context.files.writeJson(response, {
      schema_version: 1,
      step_id: step.id,
      selection: effectiveResolution.selection,
      resolution_source: effectiveResolution.resolutionSource,
    });
    await context.trace.append({
      run_id: context.runId,
      kind: 'checkpoint.resolved',
      step_id: step.id,
      attempt,
      selection: effectiveResolution.selection,
      auto_resolved: effectiveResolution.autoResolved,
      resolution_source: effectiveResolution.resolutionSource,
      response_path: response.path,
    });
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'checkpoint_selection',
      outcome: 'pass',
    });

    return stepExecutionOutcome({
      route: Object.hasOwn(step.routes, effectiveResolution.selection)
        ? effectiveResolution.selection
        : 'pass',
      details: { selection: effectiveResolution.selection },
    });
  } catch (error) {
    return stepExecutionFailedFrom(error);
  }
}

export async function executeCheckpoint(
  step: CheckpointStep,
  context: RunContext,
): Promise<StepOutcome> {
  return unwrapStepExecutionResult(await executeCheckpointResult(step, context));
}
