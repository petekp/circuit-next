import type { WorkflowPrimitiveId } from '../../schemas/workflow-primitives.js';
import type {
  PrimitiveDispatchContext,
  PrimitiveDispatchResult,
  PrimitiveHandler,
  PrimitiveHandlerRegistry,
} from './index.js';

function readBinding<T>(ctx: PrimitiveDispatchContext, name: string, fallback?: T): T {
  if (!ctx.inputs.byBinding.has(name)) {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `${ctx.recipeItem.uses}: required input binding '${name}' is missing on item '${ctx.recipeItem.id}'`,
    );
  }
  return ctx.inputs.byBinding.get(name) as T;
}

const intakeHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const goal = readBinding<string>(ctx, 'goal');
  return {
    output: {
      schema_version: 1,
      normalized_goal: goal.trim(),
      requested_workflow: null,
      operator_constraints: [],
    },
    outcome: 'continue',
    summary: `Captured goal (${goal.length} chars)`,
  };
};

const routeHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const task = readBinding<{ normalized_goal: string; requested_workflow: string | null }>(
    ctx,
    'task',
  );
  const catalog = readBinding<readonly string[]>(ctx, 'catalog');
  const requested = task.requested_workflow;
  const selected = requested && catalog.includes(requested) ? requested : (catalog[0] ?? 'fix');
  return {
    output: {
      schema_version: 1,
      selected_workflow: selected,
      selection_reason:
        requested && requested === selected
          ? `Operator requested '${selected}' and it is in the catalog`
          : `Selected '${selected}' as the conservative default`,
      fallback_reason:
        requested && requested !== selected
          ? `Operator requested '${requested}' but only [${catalog.join(', ')}] are available`
          : null,
    },
    outcome: 'continue',
    summary: `Selected workflow: ${selected}`,
  };
};

const frameHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const task = readBinding<{ normalized_goal: string }>(ctx, 'task');
  const route = readBinding<{ selected_workflow: string }>(ctx, 'route');
  return {
    output: {
      schema_version: 1,
      scope_boundary: `Work limited to addressing: ${task.normalized_goal}`,
      constraints: ['Stay within the declared scope', 'Capture proof before closing'],
      proof_plan: `Run the ${route.selected_workflow} workflow's standard verification`,
    },
    outcome: 'continue',
    summary: `Framed work for ${route.selected_workflow}`,
  };
};

const closeWithEvidenceHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const brief = readBinding<{ scope_boundary: string }>(ctx, 'brief');
  const verificationMaybe = ctx.inputs.byBinding.has('verification')
    ? (ctx.inputs.byBinding.get('verification') as { pass_or_fail: 'pass' | 'fail' } | undefined)
    : undefined;
  const reviewMaybe = ctx.inputs.byBinding.has('review')
    ? (ctx.inputs.byBinding.get('review') as { verdict: string } | undefined)
    : undefined;
  const verificationPassed =
    verificationMaybe === undefined ? true : verificationMaybe.pass_or_fail === 'pass';
  const reviewBlocked = reviewMaybe?.verdict === 'request-fixes';
  const passed = verificationPassed && !reviewBlocked;
  const evidencePointers: string[] = ['brief'];
  if (verificationMaybe !== undefined) evidencePointers.push('verification');
  if (reviewMaybe !== undefined) evidencePointers.push('review');
  const residualRisks: string[] = [];
  if (!verificationPassed) residualRisks.push('Verification failed; revisit before reuse');
  if (reviewBlocked) residualRisks.push('Reviewer requested fixes; revisit before reuse');
  return {
    output: {
      schema_version: 1,
      outcome: passed ? 'completed' : 'blocked',
      evidence_pointers: evidencePointers,
      residual_risks: residualRisks,
      follow_ups: [],
      brief_scope: brief.scope_boundary,
      review_verdict: reviewMaybe?.verdict ?? null,
    },
    outcome: passed ? 'complete' : 'stop',
    summary: passed ? 'Closed as complete with evidence' : 'Closed as blocked',
  };
};

const handoffHandler: PrimitiveHandler = (ctx): PrimitiveDispatchResult => {
  const state = readBinding<{ goal: string; completed_moves: readonly string[] }>(ctx, 'state');
  return {
    output: {
      schema_version: 1,
      goal: state.goal,
      completed_moves: state.completed_moves,
      pending_evidence: [],
      next_action: 'Resume from the next pending move',
      known_debt: [],
    },
    outcome: 'complete',
    summary: 'Recorded continuity record',
  };
};

export function defaultOrchestratorHandlers(): PrimitiveHandlerRegistry {
  return new Map<WorkflowPrimitiveId, PrimitiveHandler>([
    ['intake', intakeHandler],
    ['route', routeHandler],
    ['frame', frameHandler],
    ['close-with-evidence', closeWithEvidenceHandler],
    ['handoff', handoffHandler],
  ]);
}
