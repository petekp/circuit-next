import { defineFlow } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { migrateInventoryShapeHint, migrateReviewShapeHint } from './relay-hints.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from './reports.js';
import { migrateBriefComposeBuilder } from './writers/brief.js';
import { migrateCloseBuilder } from './writers/close.js';
import { migrateCoexistenceComposeBuilder } from './writers/coexistence.js';
import { migrateVerificationWriter } from './writers/verification.js';

const MIGRATE_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'migrate prefix', pattern: /^\s*migrate\s*:/i },
  {
    label: 'migrate request',
    pattern:
      /^\s*(?:please\s+)?(?:migrate|port|swap|replace|rewrite|transition)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|all\s+|our\s+)?\S+/i,
  },
  {
    label: 'framework swap signal',
    pattern: /\b(?:framework|library|dependency|stack)\s+(?:swap|replacement|migration)\b/i,
  },
];

export const migrateFlowDefinition = defineFlow({
  id: 'migrate',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/migrate/schematic.json',
  },
  schematic: {
    schema_version: '1',
    id: 'migrate',
    title: 'Migrate Schematic',
    purpose:
      'Migrate flow: frame the source and target, inventory what needs to move, plan the coexistence window and rollback path, execute the migration through a child Build flow, verify nothing regressed, run a release review, and close with evidence. The first version runs one batch; broader batch orchestration can land once worktree support is ready.',
    status: 'active',
    version: '0.1.0',
    starts_at: 'frame-step',
    initial_contracts: [
      'task.intake@v1',
      'route.decision@v1',
      'context.packet@v1',
      'verification.plan@v1',
    ],
    contract_aliases: [
      {
        generic: 'flow.brief@v1',
        actual: 'migrate.brief@v1',
      },
      {
        generic: 'diagnosis.result@v1',
        actual: 'migrate.inventory@v1',
      },
      {
        generic: 'work.queue@v1',
        actual: 'migrate.inventory@v1',
      },
      {
        generic: 'plan.strategy@v1',
        actual: 'migrate.coexistence@v1',
      },
      {
        generic: 'change.evidence@v1',
        actual: 'migrate.batch@v1',
      },
      {
        generic: 'batch.result@v1',
        actual: 'migrate.batch@v1',
      },
      {
        generic: 'verification.result@v1',
        actual: 'migrate.verification@v1',
      },
      {
        generic: 'review.verdict@v1',
        actual: 'migrate.review@v1',
      },
      {
        generic: 'flow.result@v1',
        actual: 'migrate.result@v1',
      },
    ],
    entry: {
      signals: {
        include: [
          'migrate',
          'migration',
          'framework-swap',
          'rewrite',
          'dependency-replacement',
          'architecture-transition',
        ],
        exclude: [],
      },
      intent_prefixes: ['migrate', 'rewrite'],
    },
    entry_modes: [
      {
        name: 'default',
        depth: 'standard',
        description: 'Default Migrate entry mode.',
      },
      {
        name: 'deep',
        depth: 'deep',
        description: 'Deep Migrate entry mode.',
      },
      {
        name: 'autonomous',
        depth: 'autonomous',
        description: 'Autonomous Migrate entry mode.',
      },
    ],
    stage_path_policy: {
      mode: 'strict',
    },
    stages: [
      {
        canonical: 'frame',
        id: 'frame-stage',
        title: 'Frame',
      },
      {
        canonical: 'analyze',
        id: 'inventory-stage',
        title: 'Inventory',
      },
      {
        canonical: 'plan',
        id: 'coexistence-stage',
        title: 'Coexistence Plan',
      },
      {
        canonical: 'act',
        id: 'execute-stage',
        title: 'Batch Execution',
      },
      {
        canonical: 'verify',
        id: 'verify-stage',
        title: 'Verify',
      },
      {
        canonical: 'review',
        id: 'review-stage',
        title: 'Release Review',
      },
      {
        canonical: 'close',
        id: 'close-stage',
        title: 'Close',
      },
    ],
    items: [
      {
        id: 'frame-step',
        title: 'Frame - produce Migrate brief',
        stage: 'frame',
        input: {
          task: 'task.intake@v1',
          route: 'route.decision@v1',
        },
        output: 'migrate.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
        execution: {
          kind: 'compose',
        },
        protocol: 'migrate-frame@v1',
        writes: {
          report_path: 'reports/migrate/brief.json',
        },
        check: {
          required: ['objective', 'source', 'target'],
        },
        routes: {
          continue: 'inventory-step',
          stop: '@stop',
        },
        block: 'frame',
      },
      {
        id: 'inventory-step',
        title: 'Inventory - enumerate migration targets and group into batches',
        stage: 'analyze',
        input: {
          brief: 'migrate.brief@v1',
          context: 'context.packet@v1',
        },
        output: 'migrate.inventory@v1',
        evidence_requirements: [
          'cause hypothesis',
          'confidence',
          'reproduction status',
          'diagnostic path',
        ],
        execution: {
          kind: 'relay',
          role: 'implementer',
        },
        protocol: 'migrate-inventory@v1',
        writes: {
          report_path: 'reports/migrate/inventory.json',
          request_path: 'reports/relay/migrate-inventory.request.json',
          receipt_path: 'reports/relay/migrate-inventory.receipt.txt',
          result_path: 'reports/relay/migrate-inventory.result.json',
        },
        check: {
          pass: ['accept'],
        },
        routes: {
          continue: 'coexistence-step',
          stop: '@stop',
        },
        block: 'diagnose',
      },
      {
        id: 'coexistence-step',
        title: 'Coexistence Plan - source/target side-by-side strategy and rollback path',
        stage: 'plan',
        input: {
          brief: 'migrate.brief@v1',
          inventory: 'migrate.inventory@v1',
        },
        output: 'migrate.coexistence@v1',
        evidence_requirements: ['ordered steps', 'risk notes', 'proof strategy'],
        execution: {
          kind: 'compose',
        },
        protocol: 'migrate-coexistence@v1',
        writes: {
          report_path: 'reports/migrate/coexistence.json',
        },
        check: {
          required: ['strategy', 'switchover_criteria', 'rollback_path'],
        },
        routes: {
          continue: 'coexistence-checkpoint-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'coexistence-checkpoint-step',
        title: 'Coexistence Plan - confirm migration path',
        stage: 'plan',
        input: {
          plan: 'migrate.coexistence@v1',
        },
        output: 'migrate.coexistence-checkpoint@v1',
        evidence_requirements: ['selected path', 'answer source', 'resume route'],
        execution: {
          kind: 'checkpoint',
        },
        protocol: 'migrate-coexistence-checkpoint@v1',
        writes: {
          checkpoint_request_path: 'reports/checkpoints/migrate-coexistence-request.json',
          checkpoint_response_path: 'reports/checkpoints/migrate-coexistence-response.json',
        },
        check: {
          allow: ['continue', 'revise', 'stop'],
        },
        checkpoint_policy: {
          prompt: 'Confirm the coexistence plan before migration batch execution.',
          choices: [
            {
              id: 'continue',
              label: 'Continue with the plan',
            },
            {
              id: 'revise',
              label: 'Revise the coexistence plan',
            },
            {
              id: 'stop',
              label: 'Stop before migration execution',
            },
          ],
          safe_default_choice: 'continue',
          safe_autonomous_choice: 'continue',
        },
        routes: {
          continue: 'batch-step',
          revise: 'coexistence-step',
          stop: '@stop',
        },
        block: 'human-decision',
      },
      {
        id: 'batch-step',
        title: 'Batch Execution - delegate the migration changes to a Build sub-run',
        stage: 'act',
        input: {
          brief: 'migrate.brief@v1',
          queue: 'migrate.inventory@v1',
        },
        output: 'migrate.batch@v1',
        evidence_requirements: [
          'completed items',
          'skipped items',
          'blocked items',
          'failed items',
        ],
        execution: {
          kind: 'sub-run',
          flow_ref: {
            flow_id: 'build',
            entry_mode: 'default',
          },
          goal: 'Migrate the inventoried targets per migrate.coexistence@v1 batch plan',
          depth: 'standard',
        },
        protocol: 'migrate-batch@v1',
        writes: {
          result_path: 'reports/migrate/batch-result.json',
        },
        check: {
          pass: ['accept', 'accept-with-fixes'],
        },
        routes: {
          continue: 'verify-step',
          stop: '@stop',
        },
        block: 'batch',
      },
      {
        id: 'verify-step',
        title: 'Verify - run Migrate verification commands',
        stage: 'verify',
        input: {
          proof: 'verification.plan@v1',
          brief: 'migrate.brief@v1',
          change: 'migrate.batch@v1',
        },
        output: 'migrate.verification@v1',
        evidence_requirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
        execution: {
          kind: 'verification',
        },
        protocol: 'migrate-verify@v1',
        writes: {
          report_path: 'reports/migrate/verification.json',
        },
        check: {
          required: ['overall_status', 'commands'],
        },
        routes: {
          continue: 'review-step',
          stop: '@stop',
        },
        block: 'run-verification',
      },
      {
        id: 'review-step',
        title: 'Release Review - independent audit of the migration release',
        stage: 'review',
        input: {
          brief: 'migrate.brief@v1',
          change: 'migrate.batch@v1',
          verification: 'migrate.verification@v1',
        },
        output: 'migrate.review@v1',
        evidence_requirements: ['verdict', 'findings', 'confidence', 'required fixes'],
        execution: {
          kind: 'relay',
          role: 'reviewer',
        },
        protocol: 'migrate-review@v1',
        writes: {
          report_path: 'reports/migrate/review.json',
          request_path: 'reports/relay/migrate-review.request.json',
          receipt_path: 'reports/relay/migrate-review.receipt.txt',
          result_path: 'reports/relay/migrate-review.result.json',
        },
        check: {
          pass: ['release-approved', 'release-with-followups'],
        },
        routes: {
          continue: 'close-step',
          stop: 'close-step',
        },
        block: 'review',
      },
      {
        id: 'close-step',
        title: 'Close - emit Migrate result',
        stage: 'close',
        input: {
          brief: 'migrate.brief@v1',
          inventory: 'migrate.inventory@v1',
          coexistence: 'migrate.coexistence@v1',
          batch: 'migrate.batch@v1',
          verification: 'migrate.verification@v1',
          review: 'migrate.review@v1',
        },
        output: 'migrate.result@v1',
        evidence_requirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
        execution: {
          kind: 'compose',
        },
        protocol: 'migrate-close@v1',
        writes: {
          report_path: 'reports/migrate-result.json',
        },
        check: {
          required: ['summary', 'outcome', 'evidence_links'],
        },
        routes: {
          complete: '@complete',
          stop: '@stop',
        },
        block: 'close-with-evidence',
      },
    ],
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'migrate.inventory@v1',
      schema: MigrateInventory,
      relayHint: migrateInventoryShapeHint.instruction,
    },
    {
      schemaName: 'migrate.review@v1',
      schema: MigrateReview,
      relayHint: migrateReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'migrate.brief@v1', schema: MigrateBrief },
    { schemaName: 'migrate.coexistence@v1', schema: MigrateCoexistence },
    { schemaName: 'migrate.batch@v1', schema: MigrateBatch },
    { schemaName: 'migrate.verification@v1', schema: MigrateVerification },
    { schemaName: 'migrate.result@v1', schema: MigrateResult },
  ],
  runtimeSurface: {
    primaryResult: {
      schemaName: 'migrate.result@v1',
      path: 'reports/migrate-result.json',
      label: 'Migrate result',
    },
    progress: {
      steps: [
        { stepId: 'frame-step', taskTitle: 'Frame the work', activeText: 'Framing the work' },
        {
          stepId: 'inventory-step',
          taskTitle: 'Check the context',
          activeText: 'Checking the context',
          relayRole: 'implementer',
        },
        {
          stepId: 'coexistence-step',
          taskTitle: 'Plan the work',
          activeText: 'Planning the work',
        },
        {
          stepId: 'coexistence-checkpoint-step',
          taskTitle: 'Plan the work',
          activeText: 'Planning the work',
        },
        { stepId: 'batch-step', taskTitle: 'Make the change', activeText: 'Making the change' },
        { stepId: 'verify-step', taskTitle: 'Check the work', activeText: 'Checking the work' },
        {
          stepId: 'review-step',
          taskTitle: 'Check the result',
          activeText: 'Checking the result',
          relayRole: 'reviewer',
        },
        { stepId: 'close-step', taskTitle: 'Wrap up', activeText: 'Wrapping up' },
      ],
    },
  },
  writers: {
    compose: [migrateBriefComposeBuilder, migrateCoexistenceComposeBuilder],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
  },
});
