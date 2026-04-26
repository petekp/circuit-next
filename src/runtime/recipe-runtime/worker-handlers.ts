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
  const diagnosisMaybe = ctx.inputs.byBinding.has('diagnosis')
    ? (ctx.inputs.byBinding.get('diagnosis') as { cause_hypothesis: string } | undefined)
    : undefined;
  const planMaybe = ctx.inputs.byBinding.has('plan')
    ? (ctx.inputs.byBinding.get('plan') as { ordered_steps: readonly string[] } | undefined)
    : undefined;
  const rationale =
    diagnosisMaybe !== undefined
      ? `Applied focused change addressing: ${diagnosisMaybe.cause_hypothesis}`
      : planMaybe !== undefined
        ? `Applied focused change executing plan with ${planMaybe.ordered_steps.length} step(s)`
        : `Applied focused change within: ${brief.scope_boundary}`;
  return {
    output: {
      schema_version: 1,
      changed_files: ['demo/file.ts'],
      change_rationale: rationale,
      declared_follow_up_proof: `Run the proof plan declared in: ${brief.scope_boundary}`,
    },
    outcome: 'continue',
    summary: 'Applied focused change to 1 file',
  };
};

const planHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string; proof_plan: string }>(ctx, 'brief');
  const contextMaybe = ctx.inputs.byBinding.has('context')
    ? (ctx.inputs.byBinding.get('context') as { observations: readonly string[] } | undefined)
    : undefined;
  const observationCount = contextMaybe?.observations.length ?? 0;
  return {
    output: {
      schema_version: 1,
      ordered_steps: [
        `Confirm scope: ${brief.scope_boundary}`,
        observationCount > 0
          ? `Address ${observationCount} observation(s) from context`
          : 'Apply minimal change satisfying brief',
        `Verify via: ${brief.proof_plan}`,
      ],
      risk_notes: ['Stub plan handler; risks are demo-grade.'],
      proof_strategy: brief.proof_plan,
    },
    outcome: 'continue',
    summary: 'Drafted plan with 3 steps',
  };
};

const reviewHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string }>(ctx, 'brief');
  const changeMaybe = ctx.inputs.byBinding.has('change')
    ? (ctx.inputs.byBinding.get('change') as { changed_files: readonly string[] } | undefined)
    : undefined;
  const verificationMaybe = ctx.inputs.byBinding.has('verification')
    ? (ctx.inputs.byBinding.get('verification') as { pass_or_fail: 'pass' | 'fail' } | undefined)
    : undefined;
  const verificationPassed = verificationMaybe?.pass_or_fail !== 'fail';
  return {
    output: {
      schema_version: 1,
      verdict: verificationPassed ? 'accept' : 'request-fixes',
      findings: verificationPassed
        ? []
        : ['Verification failed; reviewer flags unresolved gaps before accepting.'],
      confidence: 'medium',
      required_fixes: verificationPassed ? [] : ['Re-run after addressing verification failure.'],
      reviewed_scope: brief.scope_boundary,
      reviewed_change_count: changeMaybe?.changed_files.length ?? 0,
    },
    outcome: 'continue',
    summary: verificationPassed
      ? 'Reviewer accepted the change'
      : 'Reviewer requested fixes after verification failure',
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
    ['plan', planHandler],
    ['act', actHandler],
    ['run-verification', runVerificationHandler],
    ['review', reviewHandler],
  ]);
}
