import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExecutorRegistryV2 } from '../../src/core-v2/executors/index.js';
import type { RelayConnectorV2 } from '../../src/core-v2/executors/relay.js';
import type { ExecutableStepV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { projectStatusFromTraceV2 } from '../../src/core-v2/projections/status.js';
import type {
  ChildCompiledFlowResolverV2,
  CompiledFlowRunnerV2,
  WorktreeRunnerV2,
} from '../../src/core-v2/run/child-runner.js';
import { runCompiledFlowV2 } from '../../src/core-v2/run/compiled-flow-runner.js';
import type { RunContextV2 } from '../../src/core-v2/run/run-context.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../../src/flows/build/reports.js';
import {
  ExploreAnalysis,
  ExploreBrief,
  ExploreCompose,
  ExploreDecision,
  ExploreDecisionOptions,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreTournamentAggregate,
  ExploreTournamentProposal,
  ExploreTournamentReview,
} from '../../src/flows/explore/reports.js';
import {
  FixBrief,
  FixChange,
  FixContext,
  FixDiagnosis,
  FixResult,
  FixReview,
  FixVerification,
} from '../../src/flows/fix/reports.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from '../../src/flows/migrate/reports.js';
import { ReviewIntake, ReviewRelayResult, ReviewResult } from '../../src/flows/review/reports.js';
import {
  SweepAnalysis,
  SweepBatch,
  SweepBrief,
  SweepQueue,
  SweepResult,
  SweepReview,
  SweepVerification,
} from '../../src/flows/sweep/reports.js';
import {
  type CompiledFlow,
  CompiledFlow as CompiledFlowSchema,
} from '../../src/schemas/compiled-flow.js';
import { computeManifestHash } from '../../src/schemas/manifest.js';

export interface CompiledFlowFixture {
  readonly flow: CompiledFlow;
  readonly bytes: Buffer;
  readonly manifestHash: string;
}

const TERMINAL_TARGETS = new Set(['@complete', '@stop', '@handoff', '@escalate']);

const commandSpec = {
  id: 'core-v2-parity-check',
  cwd: '.',
  argv: [process.execPath, '-e', 'process.exit(0)'],
  timeout_ms: 30_000,
  max_output_bytes: 200_000,
  env: {},
};

const commandResult = {
  command_id: commandSpec.id,
  cwd: commandSpec.cwd,
  argv: commandSpec.argv,
  exit_code: 0,
  status: 'passed' as const,
  duration_ms: 0,
  stdout_summary: '',
  stderr_summary: '',
};

const fixCommandResult = {
  ...commandResult,
  timeout_ms: commandSpec.timeout_ms,
  max_output_bytes: commandSpec.max_output_bytes,
  env: commandSpec.env,
};

export async function withTempRun<T>(fn: (runDir: string) => Promise<T>): Promise<T> {
  const runDir = await mkdtemp(join(tmpdir(), 'circuit-core-v2-parity-'));
  try {
    return await fn(runDir);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

export async function loadCompiledFlowFixture(flowId: string): Promise<CompiledFlowFixture> {
  const bytes = await readFile(join(process.cwd(), 'generated', 'flows', flowId, 'circuit.json'));
  const raw = JSON.parse(bytes.toString('utf8'));
  return {
    flow: CompiledFlowSchema.parse(raw),
    bytes,
    manifestHash: computeManifestHash(bytes),
  };
}

export function expectedPassStepIds(
  flow: CompiledFlow,
  entryModeName = flow.entry_modes[0]?.name,
): string[] {
  const entry = flow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) throw new Error(`missing entry mode ${String(entryModeName)}`);
  const stepsById = new Map(flow.steps.map((step) => [step.id as string, step]));
  const seen = new Set<string>();
  const stepIds: string[] = [];
  let current: string | undefined = entry.start_at;

  while (current !== undefined) {
    if (seen.has(current)) throw new Error(`pass route cycle at ${current}`);
    seen.add(current);
    stepIds.push(current);
    const step = stepsById.get(current);
    if (step === undefined) throw new Error(`missing step ${current}`);
    const target = step.routes.pass;
    if (target === undefined) throw new Error(`missing pass route for ${current}`);
    if (TERMINAL_TARGETS.has(target)) return stepIds;
    current = target;
  }

  throw new Error('pass route walk ended without a terminal target');
}

export async function runSimpleCompiledFlowV2(options: {
  readonly flowBytes: Uint8Array;
  readonly runDir: string;
  readonly runId: string;
  readonly goal: string;
  readonly entryModeName?: string;
  readonly failStepId?: string;
  readonly routeByStepId?: Readonly<Record<string, string>>;
  readonly executors?: Partial<ExecutorRegistryV2>;
  readonly childExecutors?: Partial<ExecutorRegistryV2>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolverV2;
  readonly childRunner?: CompiledFlowRunnerV2;
  readonly projectRoot?: string;
  readonly worktreeRunner?: WorktreeRunnerV2;
  readonly relayConnector?: RelayConnectorV2;
}) {
  return await runCompiledFlowV2({
    flowBytes: options.flowBytes,
    runDir: options.runDir,
    runId: options.runId,
    goal: options.goal,
    ...(options.entryModeName === undefined ? {} : { entryModeName: options.entryModeName }),
    now: () => new Date('2026-05-02T12:00:00.000Z'),
    executors: {
      ...createSimpleParityExecutors({
        ...(options.failStepId === undefined ? {} : { failStepId: options.failStepId }),
        ...(options.routeByStepId === undefined ? {} : { routeByStepId: options.routeByStepId }),
      }),
      ...options.executors,
    },
    ...(options.childExecutors === undefined ? {} : { childExecutors: options.childExecutors }),
    ...(options.childCompiledFlowResolver === undefined
      ? {}
      : { childCompiledFlowResolver: options.childCompiledFlowResolver }),
    ...(options.childRunner === undefined ? {} : { childRunner: options.childRunner }),
    ...(options.projectRoot === undefined ? {} : { projectRoot: options.projectRoot }),
    ...(options.worktreeRunner === undefined ? {} : { worktreeRunner: options.worktreeRunner }),
    ...(options.relayConnector === undefined ? {} : { relayConnector: options.relayConnector }),
  });
}

export async function readTrace(runDir: string) {
  const trace = new TraceStore(runDir);
  return await trace.load();
}

export async function completedStepIds(runDir: string): Promise<string[]> {
  const entries = await readTrace(runDir);
  return entries
    .filter((entry) => entry.kind === 'step.completed')
    .map((entry) => entry.step_id)
    .filter((stepId): stepId is string => stepId !== undefined);
}

export async function runFileExists(runDir: string, runFilePath: string): Promise<boolean> {
  try {
    await access(join(runDir, runFilePath));
    return true;
  } catch {
    return false;
  }
}

export async function expectCompleteTrace(runDir: string): Promise<void> {
  const entries = await readTrace(runDir);
  if (entries[0]?.kind !== 'run.bootstrapped') {
    throw new Error('trace did not bootstrap');
  }
  if (entries.at(-1)?.kind !== 'run.closed') {
    throw new Error('trace did not close');
  }
  if (projectStatusFromTraceV2(entries) !== 'complete') {
    throw new Error('status projection did not derive complete');
  }
  if (entries.some((entry) => entry.kind === 'step.aborted')) {
    throw new Error('trace contains an aborted step');
  }
}

function reviewEvidenceSummary() {
  return {
    kind: 'unavailable' as const,
    message: 'core-v2 parity fixture',
  };
}

function reportBody(
  step: ExecutableStepV2,
  context: RunContextV2,
  schema: string | undefined,
): unknown {
  const goal = context.goal || 'core-v2 parity goal';
  switch (schema) {
    case 'review.intake@v1':
      return ReviewIntake.parse({
        scope: goal,
        evidence: { kind: 'unavailable', reason: 'core-v2 parity fixture' },
        evidence_warnings: [],
      });
    case 'review.result@v1':
      return ReviewResult.parse({
        scope: goal,
        findings: [],
        verdict: 'CLEAN',
        evidence_summary: reviewEvidenceSummary(),
        evidence_warnings: [],
      });
    case 'fix.brief@v1':
      return FixBrief.parse({
        problem_statement: goal,
        expected_behavior: 'The requested behavior works.',
        observed_behavior: 'The current behavior needs correction.',
        scope: 'core-v2 parity scope',
        regression_contract: {
          expected_behavior: 'The requested behavior works.',
          actual_behavior: 'The current behavior needs correction.',
          repro: { kind: 'command', command: commandSpec },
          regression_test: { status: 'failing-before-fix', command: commandSpec },
        },
        success_criteria: ['The run reaches the close step.'],
        verification_command_candidates: [commandSpec],
      });
    case 'fix.context@v1':
      return FixContext.parse({
        verdict: 'accept',
        sources: [
          { kind: 'file', ref: 'generated/flows/fix/circuit.json', summary: 'Parsed fixture' },
        ],
        observations: ['The v2 adapter preserves the current fix path.'],
        open_questions: [],
      });
    case 'fix.diagnosis@v1':
      return FixDiagnosis.parse({
        verdict: 'accept',
        reproduction_status: 'reproduced',
        cause_summary: 'The parity fixture provides a deterministic diagnosis.',
        confidence: 'high',
        evidence: ['The pass route reaches the act step.'],
        residual_uncertainty: [],
      });
    case 'fix.change@v1':
      return FixChange.parse({
        verdict: 'accept',
        summary: 'Applied the parity fixture change.',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/example.ts'],
        evidence: ['The v2 run reached the change report.'],
      });
    case 'fix.verification@v1':
      return FixVerification.parse({
        overall_status: 'passed',
        commands: [fixCommandResult],
      });
    case 'fix.review@v1':
      return FixReview.parse({
        verdict: 'accept',
        summary: 'No blocking findings in the parity fixture.',
        findings: [],
      });
    case 'fix.result@v1':
      return FixResult.parse({
        summary: 'The fix flow completed in v2.',
        outcome: 'fixed',
        verification_status: 'passed',
        regression_status: 'proved',
        review_status: 'completed',
        review_verdict: 'accept',
        residual_risks: [],
        evidence_links: [
          { report_id: 'fix.brief', path: 'reports/fix/brief.json', schema: 'fix.brief@v1' },
          { report_id: 'fix.context', path: 'reports/fix/context.json', schema: 'fix.context@v1' },
          {
            report_id: 'fix.diagnosis',
            path: 'reports/fix/diagnosis.json',
            schema: 'fix.diagnosis@v1',
          },
          { report_id: 'fix.change', path: 'reports/fix/change.json', schema: 'fix.change@v1' },
          {
            report_id: 'fix.verification',
            path: 'reports/fix/verification.json',
            schema: 'fix.verification@v1',
          },
          { report_id: 'fix.review', path: 'reports/fix/review.json', schema: 'fix.review@v1' },
        ],
      });
    case 'build.brief@v1':
      return BuildBrief.parse({
        objective: goal,
        scope: 'core-v2 parity scope',
        success_criteria: ['The run reaches the close step.'],
        verification_command_candidates: [commandSpec],
        checkpoint: {
          request_path: step.writes?.request?.path ?? 'reports/checkpoints/request.json',
          response_path: step.writes?.response?.path,
          allowed_choices: step.kind === 'checkpoint' ? [...step.choices] : ['continue'],
        },
      });
    case 'build.plan@v1':
      return BuildPlan.parse({
        objective: goal,
        approach: 'Use the converted v1 manifest.',
        slices: ['Run the simple path.'],
        verification: { commands: [commandSpec] },
      });
    case 'build.implementation@v1':
      return BuildImplementation.parse({
        verdict: 'accept',
        summary: 'Applied the parity fixture implementation.',
        changed_files: ['src/example.ts'],
        evidence: ['The v2 run reached the implementation report.'],
      });
    case 'build.verification@v1':
      return BuildVerification.parse({
        overall_status: 'passed',
        commands: [commandResult],
      });
    case 'build.review@v1':
      return BuildReview.parse({
        verdict: 'accept',
        summary: 'No blocking findings in the parity fixture.',
        findings: [],
      });
    case 'build.result@v1':
      return BuildResult.parse({
        summary: 'The build flow completed in v2.',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        evidence_links: [
          { report_id: 'build.brief', path: 'reports/build/brief.json', schema: 'build.brief@v1' },
          { report_id: 'build.plan', path: 'reports/build/plan.json', schema: 'build.plan@v1' },
          {
            report_id: 'build.implementation',
            path: 'reports/build/implementation.json',
            schema: 'build.implementation@v1',
          },
          {
            report_id: 'build.verification',
            path: 'reports/build/verification.json',
            schema: 'build.verification@v1',
          },
          {
            report_id: 'build.review',
            path: 'reports/build/review.json',
            schema: 'build.review@v1',
          },
        ],
      });
    case 'explore.brief@v1':
      return ExploreBrief.parse({
        subject: goal,
        task: 'Understand the subject through the v2 parity path.',
        success_condition: 'The run reaches the close step.',
      });
    case 'explore.analysis@v1':
      return ExploreAnalysis.parse({
        subject: goal,
        aspects: [
          {
            name: 'parity',
            summary: 'The generated manifest converts and executes through v2.',
            evidence: [
              { source: 'generated fixture', summary: 'The pass route is deterministic.' },
            ],
          },
        ],
      });
    case 'explore.compose@v1':
      return ExploreCompose.parse({
        verdict: 'accept',
        subject: goal,
        recommendation: 'Proceed with the current migration slice.',
        success_condition_alignment: 'The simple path reaches the close step.',
        supporting_aspects: [
          {
            aspect: 'parity',
            contribution: 'The fixture preserves route behavior.',
            evidence_refs: ['generated fixture'],
          },
        ],
      });
    case 'explore.review-verdict@v1':
      return ExploreReviewVerdict.parse({
        verdict: 'accept',
        overall_assessment: 'No blocking concerns in the parity fixture.',
        objections: [],
        missed_angles: [],
      });
    case 'explore.decision-options@v1':
      return ExploreDecisionOptions.parse({
        decision_question: 'Which v2 path should proceed?',
        options: [
          {
            id: 'option-1',
            label: 'Proceed',
            summary: 'Continue the migration slice.',
            best_case_prompt: 'Argue for proceeding.',
            evidence_refs: ['generated fixture'],
            tradeoffs: ['Keeps the migration moving.'],
          },
          {
            id: 'option-2',
            label: 'Pause',
            summary: 'Pause for more review.',
            best_case_prompt: 'Argue for pausing.',
            evidence_refs: ['generated fixture'],
            tradeoffs: ['Adds caution.'],
          },
        ],
        recommendation_basis: 'The fixture is deterministic.',
      });
    case 'explore.tournament-proposal@v1':
      return ExploreTournamentProposal.parse({
        verdict: 'accept',
        option_id: step.id.includes('option-2') ? 'option-2' : 'option-1',
        option_label: step.id.includes('option-2') ? 'Pause' : 'Proceed',
        case_summary: 'The parity fixture admits this option.',
        assumptions: [],
        evidence_refs: ['generated fixture'],
        risks: [],
        next_action: 'Continue the run.',
      });
    case 'explore.tournament-aggregate@v1':
      return ExploreTournamentAggregate.parse({
        schema_version: 1,
        join_policy: 'aggregate-only',
        branch_count: 2,
        branches: [
          {
            branch_id: 'option-1',
            child_run_id: 'option-1-run',
            child_outcome: 'complete',
            verdict: 'accept',
            admitted: true,
            result_path: 'reports/branches/option-1/report.json',
            duration_ms: 0,
            result_body: reportBody(
              { ...step, id: 'option-1' },
              context,
              'explore.tournament-proposal@v1',
            ),
          },
          {
            branch_id: 'option-2',
            child_run_id: 'option-2-run',
            child_outcome: 'complete',
            verdict: 'accept',
            admitted: true,
            result_path: 'reports/branches/option-2/report.json',
            duration_ms: 0,
            result_body: reportBody(
              { ...step, id: 'option-2' },
              context,
              'explore.tournament-proposal@v1',
            ),
          },
        ],
      });
    case 'explore.tournament-review@v1':
      return ExploreTournamentReview.parse({
        verdict: 'recommend',
        recommended_option_id: 'option-1',
        comparison: 'Proceed has the clearer migration path.',
        objections: [],
        missing_evidence: [],
        tradeoff_question: 'Is another review needed before proceeding?',
        confidence: 'high',
      });
    case 'explore.decision@v1':
      return ExploreDecision.parse({
        verdict: 'decided',
        decision_question: 'Which v2 path should proceed?',
        selected_option_id: 'option-1',
        selected_option_label: 'Proceed',
        decision: 'Continue the migration slice.',
        rationale: 'The parity fixture passed its checks.',
        rejected_options: [{ option_id: 'option-2', reason: 'More review is not needed here.' }],
        evidence_links: ['reports/tournament-aggregate.json'],
        assumptions: [],
        residual_risks: [],
        next_action: 'Continue with production readiness.',
        follow_up_workflow: 'build',
      });
    case 'explore.result@v1': {
      const isTournament = step.reads?.some((ref) => ref.path.includes('decision')) ?? false;
      return ExploreResult.parse(
        isTournament
          ? {
              summary: 'The explore tournament completed in v2.',
              verdict_snapshot: {
                decision_verdict: 'decided',
                tournament_review_verdict: 'recommend',
                selected_option_id: 'option-1',
                objection_count: 0,
                missing_evidence_count: 0,
              },
              evidence_links: [
                {
                  report_id: 'explore.brief',
                  path: 'reports/brief.json',
                  schema: 'explore.brief@v1',
                },
                {
                  report_id: 'explore.analysis',
                  path: 'reports/analysis.json',
                  schema: 'explore.analysis@v1',
                },
                {
                  report_id: 'explore.decision-options',
                  path: 'reports/decision-options.json',
                  schema: 'explore.decision-options@v1',
                },
                {
                  report_id: 'explore.tournament-aggregate',
                  path: 'reports/tournament-aggregate.json',
                  schema: 'explore.tournament-aggregate@v1',
                },
                {
                  report_id: 'explore.tournament-review',
                  path: 'reports/tournament-review.json',
                  schema: 'explore.tournament-review@v1',
                },
                {
                  report_id: 'explore.decision',
                  path: 'reports/decision.json',
                  schema: 'explore.decision@v1',
                },
              ],
            }
          : {
              summary: 'The explore flow completed in v2.',
              verdict_snapshot: {
                compose_verdict: 'accept',
                review_verdict: 'accept',
                objection_count: 0,
                missed_angle_count: 0,
              },
              evidence_links: [
                {
                  report_id: 'explore.brief',
                  path: 'reports/brief.json',
                  schema: 'explore.brief@v1',
                },
                {
                  report_id: 'explore.analysis',
                  path: 'reports/analysis.json',
                  schema: 'explore.analysis@v1',
                },
                {
                  report_id: 'explore.compose',
                  path: 'reports/compose.json',
                  schema: 'explore.compose@v1',
                },
                {
                  report_id: 'explore.review-verdict',
                  path: 'reports/review-verdict.json',
                  schema: 'explore.review-verdict@v1',
                },
              ],
            },
      );
    }
    case 'migrate.brief@v1':
      return MigrateBrief.parse({
        objective: goal,
        source: 'old system',
        target: 'new system',
        scope: 'core-v2 parity scope',
        success_criteria: ['The run reaches the close step.'],
        coexistence_appetite: 'short-window',
        rollback_plan: 'Use the existing runtime path.',
        verification_command_candidates: [commandSpec],
      });
    case 'migrate.inventory@v1':
      return MigrateInventory.parse({
        verdict: 'accept',
        summary: 'Inventory is small for the parity fixture.',
        items: [
          {
            id: 'item-1',
            path: 'src/example.ts',
            category: 'code',
            description: 'Example migration target.',
          },
        ],
        batches: [
          {
            id: 'batch-1',
            title: 'Example batch',
            item_ids: ['item-1'],
            rationale: 'Single deterministic parity batch.',
          },
        ],
      });
    case 'migrate.coexistence@v1':
      return MigrateCoexistence.parse({
        strategy: 'Keep old and new paths available until validation passes.',
        switchover_criteria: ['Validation passes.'],
        health_signals: ['Tests are green.'],
        rollback_path: 'Route back to the old runtime.',
        risks: [],
      });
    case 'migrate.batch@v1':
      return MigrateBatch.parse({
        schema_version: 1,
        run_id: 'migrate-child-run',
        flow_id: 'build',
        goal,
        outcome: 'complete',
        summary: 'Child build batch completed.',
        closed_at: new Date(0).toISOString(),
        trace_entries_observed: 1,
        manifest_hash: 'child-manifest-hash',
        verdict: 'accept',
      });
    case 'migrate.verification@v1':
      return MigrateVerification.parse({
        overall_status: 'passed',
        commands: [commandResult],
      });
    case 'migrate.review@v1':
      return MigrateReview.parse({
        verdict: 'cutover-approved',
        summary: 'No blocking migration issues.',
        findings: [],
      });
    case 'migrate.result@v1':
      return MigrateResult.parse({
        summary: 'The migrate flow completed in v2.',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'cutover-approved',
        batch_count: 1,
        evidence_links: [
          {
            report_id: 'migrate.brief',
            path: 'reports/migrate/brief.json',
            schema: 'migrate.brief@v1',
          },
          {
            report_id: 'migrate.inventory',
            path: 'reports/migrate/inventory.json',
            schema: 'migrate.inventory@v1',
          },
          {
            report_id: 'migrate.coexistence',
            path: 'reports/migrate/coexistence.json',
            schema: 'migrate.coexistence@v1',
          },
          {
            report_id: 'migrate.batch',
            path: 'reports/migrate/batch-result.json',
            schema: 'migrate.batch@v1',
          },
          {
            report_id: 'migrate.verification',
            path: 'reports/migrate/verification.json',
            schema: 'migrate.verification@v1',
          },
          {
            report_id: 'migrate.review',
            path: 'reports/migrate/review.json',
            schema: 'migrate.review@v1',
          },
        ],
      });
    case 'sweep.brief@v1':
      return SweepBrief.parse({
        objective: goal,
        sweep_type: 'cleanup',
        scope: 'core-v2 parity scope',
        success_criteria: ['The run reaches the close step.'],
        scope_exclusions: [],
        out_of_scope: [],
        high_risk_boundaries: [],
        verification_command_candidates: [commandSpec],
      });
    case 'sweep.analysis@v1':
      return SweepAnalysis.parse({
        verdict: 'accept',
        summary: 'One candidate is available for the parity fixture.',
        candidates: [
          {
            id: 'candidate-1',
            category: 'cleanup',
            path: 'src/example.ts',
            description: 'Example cleanup target.',
            confidence: 'high',
            risk: 'low',
          },
        ],
      });
    case 'sweep.queue@v1':
      return SweepQueue.parse({
        classified: [
          { candidate_id: 'candidate-1', action: 'act', rationale: 'Safe deterministic item.' },
        ],
        to_execute: ['candidate-1'],
        deferred: [],
      });
    case 'sweep.batch@v1':
      return SweepBatch.parse({
        verdict: 'accept',
        summary: 'Applied the sweep fixture batch.',
        changed_files: ['src/example.ts'],
        items: [{ candidate_id: 'candidate-1', status: 'acted', evidence: 'Updated example.' }],
      });
    case 'sweep.verification@v1':
      return SweepVerification.parse({
        overall_status: 'passed',
        commands: [commandResult],
      });
    case 'sweep.review@v1':
      return SweepReview.parse({
        verdict: 'clean',
        summary: 'No injected issues.',
        findings: [],
      });
    case 'sweep.result@v1':
      return SweepResult.parse({
        summary: 'The sweep flow completed in v2.',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        deferred_count: 0,
        evidence_links: [
          { report_id: 'sweep.brief', path: 'reports/sweep/brief.json', schema: 'sweep.brief@v1' },
          {
            report_id: 'sweep.analysis',
            path: 'reports/sweep/analysis.json',
            schema: 'sweep.analysis@v1',
          },
          { report_id: 'sweep.queue', path: 'reports/sweep/queue.json', schema: 'sweep.queue@v1' },
          { report_id: 'sweep.batch', path: 'reports/sweep/batch.json', schema: 'sweep.batch@v1' },
          {
            report_id: 'sweep.verification',
            path: 'reports/sweep/verification.json',
            schema: 'sweep.verification@v1',
          },
          {
            report_id: 'sweep.review',
            path: 'reports/sweep/review.json',
            schema: 'sweep.review@v1',
          },
        ],
      });
    default:
      return { step_id: step.id, schema: schema ?? 'none', ok: true };
  }
}

async function writeText(context: RunContextV2, path: string, value: string): Promise<void> {
  const fullPath = context.files.resolve(path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, value, 'utf8');
}

async function writeReport(step: ExecutableStepV2, context: RunContextV2): Promise<void> {
  const report = step.writes?.report;
  if (report !== undefined) {
    await context.files.writeJson(report, reportBody(step, context, report.schema));
  }
}

async function writeRelayFiles(step: ExecutableStepV2, context: RunContextV2): Promise<void> {
  if (step.writes?.request !== undefined) {
    await context.files.writeJson(step.writes.request, {
      step_id: step.id,
      goal: context.goal,
    });
  }
  if (step.writes?.receipt !== undefined) {
    await writeText(context, step.writes.receipt.path, `stub receipt for ${step.id}\n`);
  }
  if (step.writes?.result !== undefined) {
    const body =
      step.id === 'audit-step'
        ? ReviewRelayResult.parse({ verdict: 'NO_ISSUES_FOUND', findings: [] })
        : reportBody(step, context, step.writes.report?.schema);
    await context.files.writeJson(step.writes.result, body);
  }
}

function checkpointChoice(step: ExecutableStepV2): string {
  if (step.kind !== 'checkpoint') throw new Error('expected checkpoint step');
  const policy = step.policy as
    | { readonly safe_default_choice?: unknown; readonly safe_autonomous_choice?: unknown }
    | undefined;
  const candidates = [
    policy?.safe_default_choice,
    policy?.safe_autonomous_choice,
    ...step.choices,
    'pass',
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && step.routes[candidate] !== undefined) return candidate;
  }
  throw new Error(`checkpoint step '${step.id}' has no usable route`);
}

export function createSimpleParityExecutors(
  options: {
    readonly failStepId?: string;
    readonly routeByStepId?: Readonly<Record<string, string>>;
  } = {},
): Partial<ExecutorRegistryV2> {
  return {
    compose: async (step, context) => {
      if (step.kind !== 'compose') throw new Error('expected compose step');
      if (step.id === options.failStepId) throw new Error(`forced failure at ${step.id}`);
      await writeReport(step, context);
      return {
        route: options.routeByStepId?.[step.id] ?? 'pass',
        details: { report: step.writes?.report?.path },
      };
    },
    relay: async (step, context) => {
      if (step.kind !== 'relay') throw new Error('expected relay step');
      if (step.id === options.failStepId) throw new Error(`forced failure at ${step.id}`);
      await writeRelayFiles(step, context);
      await writeReport(step, context);
      return { route: options.routeByStepId?.[step.id] ?? 'pass', details: { role: step.role } };
    },
    verification: async (step, context) => {
      if (step.kind !== 'verification') throw new Error('expected verification step');
      if (step.id === options.failStepId) throw new Error(`forced failure at ${step.id}`);
      await writeReport(step, context);
      return {
        route: options.routeByStepId?.[step.id] ?? 'pass',
        details: { report: step.writes?.report?.path },
      };
    },
    checkpoint: async (step, context) => {
      if (step.kind !== 'checkpoint') throw new Error('expected checkpoint step');
      if (step.id === options.failStepId) throw new Error(`forced failure at ${step.id}`);
      const choice = options.routeByStepId?.[step.id] ?? checkpointChoice(step);
      if (step.writes?.request !== undefined) {
        await context.files.writeJson(step.writes.request, {
          step_id: step.id,
          prompt: (step.policy as { readonly prompt?: unknown } | undefined)?.prompt,
          choices: step.choices,
        });
      }
      if (step.writes?.response !== undefined) {
        await context.files.writeJson(step.writes.response, {
          step_id: step.id,
          selected_choice: choice,
          answered_by: 'mode-default',
          rationale: 'core-v2 parity fixture',
        });
      }
      await writeReport(step, context);
      return { route: choice, details: { selected_choice: choice } };
    },
  };
}
