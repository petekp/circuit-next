import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const reviewFacts = defineDeclarativeFlowFacts({
  id: 'review',
  title: 'Review Schematic',
  purpose:
    'Review flow: frame the audit scope, relay independent review to a reviewer, and close with a verdict report. The schematic uses a compact Intake, Independent Audit, and Verdict shape because Review is audit-only and does not implement or verify a change.',
  status: 'active',
  version: '0.1.0',
  visibility: 'public',
  startsAt: 'intake-step',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['plan', 'act', 'verify', 'review'],
    rationale:
      'Review is an audit-only flow: Intake frames the scope, Independent Audit performs the reviewer relay, and Verdict aggregates findings. There is no planning stage, no implementation/action stage, no verification rerun, and no nested review stage in this narrowed variant.',
  },
  canonicalStagePolicy: {
    enforcement: 'enforce',
    title: 'Intake → Independent Audit → Verdict',
    authority: 'src/flows/review/contract.md §Canonical stage policy',
  },
  paths: {
    schematic: 'src/flows/review/schematic.json',
    command: 'src/flows/review/command.md',
    contract: 'src/flows/review/contract.md',
  },
  entry: {
    include: ['review', 'audit', 'check'],
    exclude: [],
    intentPrefixes: ['review'],
  },
  modes: [
    {
      name: 'default',
      depth: 'standard',
      description:
        'Default review entry mode — resolves the review scope, relays an independent audit, then writes the verdict report.',
    },
  ],
  initialContracts: ['task.intake@v1', 'route.decision@v1'],
  contractAliases: {
    'flow.brief@v1': 'review.intake@v1',
    'review.verdict@v1': 'review.verdict@v1',
    'flow.result@v1': 'review.result@v1',
  },
  stages: [
    {
      stageId: 'intake-stage',
      canonical: 'frame',
      title: 'Intake',
    },
    {
      stageId: 'audit-stage',
      canonical: 'analyze',
      title: 'Independent Audit',
    },
    {
      stageId: 'verdict-stage',
      canonical: 'close',
      title: 'Verdict',
    },
  ],
  steps: [
    {
      id: 'intake-step',
      title: 'Intake — resolve review scope',
      stage: 'frame',
      block: 'frame',
      input: {
        task: 'task.intake@v1',
        route: 'route.decision@v1',
      },
      output: 'review.intake@v1',
      evidenceRequirements: ['scope boundary', 'working tree status', 'diff or unavailable reason'],
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
      progress: {
        taskTitle: 'Frame the work',
        activeText: 'Framing the work',
      },
    },
    {
      id: 'audit-step',
      title: 'Independent Audit — reviewer relay',
      stage: 'analyze',
      block: 'review',
      input: {
        brief: 'review.intake@v1',
      },
      output: 'review.verdict@v1',
      evidenceRequirements: ['verdict', 'findings', 'confidence', 'required fixes'],
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
      progress: {
        taskTitle: 'Check the result',
        activeText: 'Checking the result',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'verdict-step',
      title: 'Verdict — emit review.result',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'review.intake@v1',
        review: 'review.verdict@v1',
      },
      output: 'review.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
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
      progress: {
        taskTitle: 'Wrap up',
        activeText: 'Wrapping up',
      },
    },
  ],
  reports: [
    {
      schemaName: 'review.intake@v1',
      channel: 'report',
    },
    {
      schemaName: 'review.result@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: ['review.intake@v1', 'review.result@v1'],
  },
  structuralHints: [{ hintId: 'review.relay-result@structural' }],
  primaryResult: {
    schemaName: 'review.result@v1',
    path: 'reports/review-result.json',
    label: 'Review result',
  },
}) satisfies readonly FlowFact[];
