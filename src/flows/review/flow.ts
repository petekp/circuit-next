import { defineFlow } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { reviewRelayShapeHint } from './relay-hints.js';
import { ReviewIntake, ReviewResult } from './reports.js';
import { reviewIntakeComposeBuilder } from './writers/intake.js';
import { reviewResultComposeBuilder } from './writers/result.js';

const REVIEW_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'code review', pattern: /\bcode\s+review\b/i },
  {
    label: 'change review request',
    pattern:
      /\breview\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:[\w-]+\s+){0,8}(?:changes?|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
  },
  { label: 'audit request', pattern: /\baudit\b/i },
  { label: 'critique request', pattern: /\bcritique\b/i },
  {
    label: 'change inspection request',
    pattern:
      /\binspect\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
  },
  {
    label: 'change-check request',
    pattern: /\bcheck\s+(?:this\s+)?(?:change|diff|patch|commit|pr|pull\s+request)\b/i,
  },
  {
    label: 'issue-finding request',
    pattern:
      /\b(?:find|surface|identify|spot|detect|look\s+for)\s+(?:an?\s+|any\s+)?(?:(?:issue|issues)(?!\s*(?:#|\d))|bug|bugs|defect|defects|problem|problems|regression|regressions|risk|risks)\b/i,
  },
  {
    label: 'risk-hunt request',
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i,
  },
];

export const reviewFlowDefinition = defineFlow({
  id: 'review',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/review/schematic.json',
    command: 'src/flows/review/command.md',
    contract: 'src/flows/review/contract.md',
  },
  schematic: {
    schema_version: '1',
    id: 'review',
    title: 'Review Schematic',
    purpose:
      'Review flow: frame the audit scope, relay independent review to a reviewer, and close with a verdict report. The schematic uses a compact Intake, Independent Audit, and Verdict shape because Review is audit-only and does not implement or verify a change.',
    status: 'active',
    version: '0.1.0',
    starts_at: 'intake-step',
    initial_contracts: ['task.intake@v1', 'route.decision@v1'],
    contract_aliases: [
      {
        generic: 'flow.brief@v1',
        actual: 'review.intake@v1',
      },
      {
        generic: 'review.verdict@v1',
        actual: 'review.verdict@v1',
      },
      {
        generic: 'flow.result@v1',
        actual: 'review.result@v1',
      },
    ],
    entry: {
      signals: {
        include: ['review', 'audit', 'check'],
        exclude: [],
      },
      intent_prefixes: ['review'],
    },
    entry_modes: [
      {
        name: 'default',
        depth: 'standard',
        description:
          'Default review entry mode \u2014 resolves the review scope, relays an independent audit, then writes the verdict report.',
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['plan', 'act', 'verify', 'review'],
      rationale:
        'Review is an audit-only flow: Intake frames the scope, Independent Audit performs the reviewer relay, and Verdict aggregates findings. There is no planning stage, no implementation/action stage, no verification rerun, and no nested review stage in this narrowed variant.',
    },
    stages: [
      {
        canonical: 'frame',
        id: 'intake-stage',
        title: 'Intake',
      },
      {
        canonical: 'analyze',
        id: 'audit-stage',
        title: 'Independent Audit',
      },
      {
        canonical: 'close',
        id: 'verdict-stage',
        title: 'Verdict',
      },
    ],
    items: [
      {
        id: 'intake-step',
        title: 'Intake \u2014 resolve review scope',
        stage: 'frame',
        input: {
          task: 'task.intake@v1',
          route: 'route.decision@v1',
        },
        output: 'review.intake@v1',
        evidence_requirements: [
          'scope boundary',
          'working tree status',
          'diff or unavailable reason',
        ],
        execution: {
          kind: 'compose',
        },
        protocol: 'review-intake@v1',
        writes: {
          report_path: 'reports/review-intake.json',
        },
        check: {
          required: ['scope', 'evidence'],
        },
        routes: {
          continue: 'audit-step',
          stop: '@stop',
        },
        block: 'frame',
      },
      {
        id: 'audit-step',
        title: 'Independent Audit \u2014 reviewer relay',
        stage: 'analyze',
        input: {
          brief: 'review.intake@v1',
        },
        output: 'review.verdict@v1',
        evidence_requirements: ['verdict', 'findings', 'confidence', 'required fixes'],
        execution: {
          kind: 'relay',
          role: 'reviewer',
        },
        protocol: 'review-audit@v1',
        writes: {
          request_path: 'reports/relay/review.request.json',
          receipt_path: 'reports/relay/review.receipt.txt',
          result_path: 'stages/analyze/review-raw-findings.json',
        },
        check: {
          pass: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'],
        },
        routes: {
          continue: 'verdict-step',
          retry: 'audit-step',
          stop: '@stop',
        },
        block: 'review',
      },
      {
        id: 'verdict-step',
        title: 'Verdict \u2014 emit review.result',
        stage: 'close',
        input: {
          brief: 'review.intake@v1',
          review: 'review.verdict@v1',
        },
        output: 'review.result@v1',
        evidence_requirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
        execution: {
          kind: 'compose',
        },
        protocol: 'review-verdict@v1',
        writes: {
          report_path: 'reports/review-result.json',
        },
        check: {
          required: ['scope', 'findings', 'verdict'],
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
    order: 0,
    signals: REVIEW_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to audit-only review flow`;
    },
  },
  reportSchemas: [
    { schemaName: 'review.intake@v1', schema: ReviewIntake },
    { schemaName: 'review.result@v1', schema: ReviewResult },
  ],
  runtimeSurface: {
    primaryResult: {
      schemaName: 'review.result@v1',
      path: 'reports/review-result.json',
      label: 'Review result',
    },
    progress: {
      steps: [
        { stepId: 'intake-step', taskTitle: 'Frame the work', activeText: 'Framing the work' },
        {
          stepId: 'audit-step',
          taskTitle: 'Check the result',
          activeText: 'Checking the result',
          relayRole: 'reviewer',
        },
        { stepId: 'verdict-step', taskTitle: 'Wrap up', activeText: 'Wrapping up' },
      ],
    },
  },
  writers: {
    compose: [reviewIntakeComposeBuilder, reviewResultComposeBuilder],
  },
  structuralHints: [reviewRelayShapeHint],
});
