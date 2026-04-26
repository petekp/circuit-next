import type { WorkflowPrimitiveId } from '../../schemas/workflow-primitives.js';
import type {
  PrimitiveDispatchContext,
  PrimitiveDispatchResult,
  PrimitiveHandler,
  PrimitiveHandlerRegistry,
} from './index.js';

function readBinding<T>(ctx: PrimitiveDispatchContext, name: string): T {
  if (!ctx.inputs.byBinding.has(name)) {
    throw new Error(
      `${ctx.recipeItem.uses}: required input binding '${name}' is missing on item '${ctx.recipeItem.id}'`,
    );
  }
  return ctx.inputs.byBinding.get(name) as T;
}

const gatherContextHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string }>(ctx, 'brief');
  const request = readBinding<{ targets: readonly string[] }>(ctx, 'request');
  return {
    output: {
      schema_version: 1,
      source_list: request.targets,
      observations: [`Surveyed ${request.targets.length} targets within: ${brief.scope_boundary}`],
      confidence_notes: 'Stub gather-context handler; observations are demo-grade.',
    },
    outcome: 'continue',
    summary: `Gathered context across ${request.targets.length} targets`,
  };
};

const diagnoseHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string }>(ctx, 'brief');
  const context = readBinding<{ observations: readonly string[] }>(ctx, 'context');
  return {
    output: {
      schema_version: 1,
      cause_hypothesis: `Likely cause derived from ${context.observations.length} observations within: ${brief.scope_boundary}`,
      confidence: 'medium',
      reproduction_status: 'reproduced',
      diagnostic_path: ['Reviewed scope', 'Read context observations', 'Formed hypothesis'],
    },
    outcome: 'continue',
    summary: 'Diagnosis produced (medium confidence)',
  };
};

const actHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string }>(ctx, 'brief');
  const diagnosis = readBinding<{ cause_hypothesis: string }>(ctx, 'diagnosis');
  return {
    output: {
      schema_version: 1,
      changed_files: ['demo/file.ts'],
      change_rationale: `Applied focused change addressing: ${diagnosis.cause_hypothesis}`,
      declared_follow_up_proof: `Run the proof plan declared in: ${brief.scope_boundary}`,
    },
    outcome: 'continue',
    summary: 'Applied focused change to 1 file',
  };
};

const runVerificationHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const proof = readBinding<{ commands: readonly string[] }>(ctx, 'proof');
  const change = readBinding<{ changed_files: readonly string[] }>(ctx, 'change');
  return {
    output: {
      schema_version: 1,
      command_list: proof.commands,
      exit_status: proof.commands.map(() => 0),
      bounded_output: proof.commands.map(
        (cmd) => `[stub] ${cmd} ok against ${change.changed_files.length} file(s)`,
      ),
      pass_or_fail: 'pass' as const,
    },
    outcome: 'continue',
    summary: `Ran ${proof.commands.length} proof command(s); all passed`,
  };
};

export function defaultWorkerHandlers(): PrimitiveHandlerRegistry {
  return new Map<WorkflowPrimitiveId, PrimitiveHandler>([
    ['gather-context', gatherContextHandler],
    ['diagnose', diagnoseHandler],
    ['act', actHandler],
    ['run-verification', runVerificationHandler],
  ]);
}
