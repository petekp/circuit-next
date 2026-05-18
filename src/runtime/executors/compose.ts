import {
  findCloseBuilder,
  resolveCloseReadPaths,
} from '../../flows/registries/close-writers/registry.js';
import {
  findComposeBuilder,
  resolveComposeReadPaths,
} from '../../flows/registries/compose-writers/registry.js';
import { requireRuntimeIndexedStep } from '../../flows/registries/runtime-index.js';
import type { StepOutcome } from '../domain/step.js';
import type { ComposeStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import {
  type StepExecutionResult,
  stepExecutionFailedFrom,
  stepExecutionOutcome,
  unwrapStepExecutionResult,
} from './result.js';

async function readJsonReport(context: RunContext, path: string): Promise<unknown> {
  return await context.files.readJson(path);
}

async function readOptionalJsonReport(
  context: RunContext,
  path: string,
  required: boolean,
): Promise<unknown> {
  try {
    return await readJsonReport(context, path);
  } catch (error) {
    if (!required && (error as { readonly code?: unknown }).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function writeRegisteredComposeReport(
  step: ComposeStep,
  context: RunContext,
): Promise<boolean> {
  const report = step.writes?.report;
  if (report?.schema === undefined) return false;

  const flow = context.packageIndex.flow;
  const indexedStep = requireRuntimeIndexedStep(context.packageIndex, step.id, 'compose');
  const composeBuilder = findComposeBuilder(report.schema);
  if (composeBuilder !== undefined) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, indexedStep);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : await readJsonReport(context, path);
    }
    const body = composeBuilder.build({
      runFolder: context.runDir,
      flow,
      step: indexedStep,
      goal: context.goal,
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      ...(context.evidencePolicy === undefined ? {} : { evidencePolicy: context.evidencePolicy }),
      inputs,
    });
    await context.files.writeJson(report, body);
    return true;
  }

  const closeBuilder = findCloseBuilder(report.schema);
  if (closeBuilder !== undefined) {
    const readPaths = resolveCloseReadPaths(closeBuilder, flow, indexedStep);
    const inputs: Record<string, unknown | undefined> = {};
    for (const descriptor of closeBuilder.reads) {
      const path = readPaths[descriptor.name];
      inputs[descriptor.name] =
        path === undefined
          ? undefined
          : await readOptionalJsonReport(context, path, descriptor.required);
    }
    const body = closeBuilder.build({
      runFolder: context.runDir,
      flow,
      closeStep: indexedStep,
      goal: context.goal,
      inputs,
    });
    await context.files.writeJson(report, body);
    return true;
  }

  throw new Error(
    `no compose report writer registered for schema '${report.schema}' at compose step '${step.id}'`,
  );
}

export async function executeComposeResult(
  step: ComposeStep,
  context: RunContext,
): Promise<StepExecutionResult> {
  try {
    if (step.writes?.report?.schema !== undefined) {
      await writeRegisteredComposeReport(step, context);
      await context.trace.append({
        run_id: context.runId,
        kind: 'step.report_written',
        step_id: step.id,
        attempt: context.activeStepAttempt ?? 1,
        report_path: step.writes.report.path,
        report_schema: step.writes.report.schema,
      });
      return stepExecutionOutcome({ route: 'pass', details: { writer: step.writer } });
    }

    const body = step.body ?? { stepId: step.id, writer: step.writer };
    const writes = step.writes ?? {};
    await Promise.all(
      Object.values(writes).map((ref) =>
        context.files.writeJson(ref, {
          stepId: step.id,
          writer: step.writer,
          body,
        }),
      ),
    );
    return stepExecutionOutcome({ route: 'pass', details: { writer: step.writer } });
  } catch (error) {
    return stepExecutionFailedFrom(error);
  }
}

export async function executeCompose(step: ComposeStep, context: RunContext): Promise<StepOutcome> {
  return unwrapStepExecutionResult(await executeComposeResult(step, context));
}
