import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const pursueFacts = defineDeclarativeFlowFacts({
  id: 'pursue',
  title: 'Pursue Schematic',
  purpose:
    'Pursue flow: turn one or more rough operator ideas into pursuit contracts, coordinate their order, execute code-changing work serially, verify, review for interference, and close with evidence.',
  status: 'active',
  version: '0.1.0',
  visibility: 'public',
  startsAt: 'contract-step',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['analyze'],
    rationale:
      'Pursuits V1 folds read-only discovery policy into the coordination graph before acting; a separate Analyze stage can be added when dynamic discovery fanout lands.',
  },
  paths: {
    schematic: 'src/flows/pursue/schematic.json',
  },
  entry: {
    include: ['pursue', 'pursuit', 'coordinate pursuits', 'multiple autonomous goals'],
    exclude: [],
    intentPrefixes: ['pursue'],
  },
  modes: [
    {
      name: 'default',
      depth: 'standard',
      description: 'Default Pursue entry mode.',
    },
    {
      name: 'autonomous',
      depth: 'autonomous',
      description: 'Autonomous Pursue entry mode with the same serial-write safety policy.',
    },
  ],
  initialContracts: ['task.intake@v1', 'route.decision@v1', 'verification.plan@v1'],
  contractAliases: {
    'flow.brief@v1': 'pursuit.contract@v1',
    'plan.strategy@v1': 'pursuit.wave-plan@v1',
    'work.queue@v1': 'pursuit.graph@v1',
    'batch.result@v1': 'pursuit.batch@v1',
    'change.evidence@v1': 'pursuit.batch@v1',
    'verification.result@v1': 'pursuit.verification@v1',
    'review.verdict@v1': 'pursuit.review@v1',
    'flow.result@v1': 'pursuit.result@v1',
  },
  stages: [
    {
      stageId: 'frame-stage',
      canonical: 'frame',
      title: 'Frame',
    },
    {
      stageId: 'plan-stage',
      canonical: 'plan',
      title: 'Coordinate',
    },
    {
      stageId: 'act-stage',
      canonical: 'act',
      title: 'Execute',
    },
    {
      stageId: 'verify-stage',
      canonical: 'verify',
      title: 'Verify',
    },
    {
      stageId: 'review-stage',
      canonical: 'review',
      title: 'Review',
    },
    {
      stageId: 'close-stage',
      canonical: 'close',
      title: 'Close',
    },
  ],
  steps: [
    {
      id: 'contract-step',
      title: 'Frame - create pursuit contract',
      stage: 'frame',
      block: 'pursue',
      input: {
        intake: 'task.intake@v1',
        route: 'route.decision@v1',
      },
      output: 'pursuit.contract@v1',
      evidenceRequirements: [
        'ownership contract',
        'estimated touch set',
        'proof plan',
        'check-in triggers',
      ],
      execution: {
        kind: 'compose',
      },
      protocol: 'pursuit-contract@v1',
      writes: {
        report_path: 'reports/pursuit/contract.json',
      },
      check: {
        required: ['objective', 'pursuits', 'verification_command_candidates'],
      },
      routes: {
        continue: 'graph-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Frame the work',
        activeText: 'Framing the work',
      },
    },
    {
      id: 'graph-step',
      title: 'Coordinate - build pursuit graph',
      stage: 'plan',
      block: 'coordinate-pursuits',
      input: {
        contract: 'pursuit.contract@v1',
      },
      output: 'pursuit.graph@v1',
      evidenceRequirements: [
        'dependency graph',
        'conflict analysis',
        'serial groups',
        'parallel read-only groups',
      ],
      execution: {
        kind: 'compose',
      },
      protocol: 'pursuit-graph@v1',
      writes: {
        report_path: 'reports/pursuit/graph.json',
      },
      check: {
        required: ['nodes', 'serial_groups', 'parallel_read_only_groups'],
      },
      routes: {
        continue: 'wave-plan-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Coordinate the work',
        activeText: 'Coordinating the work',
      },
    },
    {
      id: 'wave-plan-step',
      title: 'Plan - order execution waves',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'pursuit.contract@v1',
        context: 'pursuit.graph@v1',
      },
      output: 'pursuit.wave-plan@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'compose',
      },
      protocol: 'pursuit-wave-plan@v1',
      writes: {
        report_path: 'reports/pursuit/wave-plan.json',
      },
      check: {
        required: ['waves', 'no_parallel_writes_reason'],
      },
      routes: {
        continue: 'batch-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Plan the work',
        activeText: 'Planning the work',
      },
    },
    {
      id: 'batch-step',
      title: 'Execute - run serialized pursuit batch',
      stage: 'act',
      block: 'batch',
      input: {
        queue: 'pursuit.graph@v1',
        brief: 'pursuit.contract@v1',
        plan: 'pursuit.wave-plan@v1',
      },
      output: 'pursuit.batch@v1',
      evidenceRequirements: ['completed items', 'skipped items', 'blocked items', 'failed items'],
      execution: {
        kind: 'relay',
        role: 'implementer',
      },
      protocol: 'pursuit-batch@v1',
      writes: {
        report_path: 'reports/pursuit/batch.json',
        request_path: 'reports/relay/pursuit-batch.request.json',
        receipt_path: 'reports/relay/pursuit-batch.receipt.txt',
        result_path: 'reports/relay/pursuit-batch.result.json',
      },
      check: {
        pass: ['accept', 'partial'],
      },
      routes: {
        continue: 'verify-step',
        retry: 'batch-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Make the change',
        activeText: 'Making the change',
        relayRole: 'implementer',
      },
    },
    {
      id: 'verify-step',
      title: 'Verify - run Pursue proof commands',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        brief: 'pursuit.contract@v1',
        change: 'pursuit.batch@v1',
      },
      output: 'pursuit.verification@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'pursuit-verify@v1',
      writes: {
        report_path: 'reports/pursuit/verification.json',
      },
      check: {
        required: ['overall_status', 'commands'],
      },
      routes: {
        continue: 'review-step',
        retry: 'batch-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'review-step',
      title: 'Review - check pursuit coordination',
      stage: 'review',
      block: 'review',
      input: {
        brief: 'pursuit.contract@v1',
        change: 'pursuit.batch@v1',
        verification: 'pursuit.verification@v1',
      },
      output: 'pursuit.review@v1',
      evidenceRequirements: ['verdict', 'findings', 'confidence', 'required fixes'],
      execution: {
        kind: 'relay',
        role: 'reviewer',
      },
      protocol: 'pursuit-review@v1',
      writes: {
        report_path: 'reports/pursuit/review.json',
        request_path: 'reports/relay/pursuit-review.request.json',
        receipt_path: 'reports/relay/pursuit-review.receipt.txt',
        result_path: 'reports/relay/pursuit-review.result.json',
      },
      check: {
        pass: ['clean', 'needs-followup'],
      },
      routes: {
        continue: 'close-step',
        retry: 'batch-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the result',
        activeText: 'Checking the result',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'close-step',
      title: 'Close - summarize pursuit result',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'pursuit.contract@v1',
        graph: 'pursuit.graph@v1',
        plan: 'pursuit.wave-plan@v1',
        verification: 'pursuit.verification@v1',
        review: 'pursuit.review@v1',
        batch: 'pursuit.batch@v1',
      },
      output: 'pursuit.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'pursuit-close@v1',
      writes: {
        report_path: 'reports/pursuit-result.json',
      },
      check: {
        required: ['summary', 'outcome', 'evidence_links'],
      },
      routes: {
        complete: '@complete',
        stop: '@stop',
        handoff: '@handoff',
        escalate: '@escalate',
      },
      progress: {
        taskTitle: 'Wrap up',
        activeText: 'Wrapping up',
      },
    },
  ],
  reports: [
    {
      schemaName: 'pursuit.batch@v1',
      channel: 'relay',
    },
    {
      schemaName: 'pursuit.review@v1',
      channel: 'relay',
    },
    {
      schemaName: 'pursuit.contract@v1',
      channel: 'report',
    },
    {
      schemaName: 'pursuit.graph@v1',
      channel: 'report',
    },
    {
      schemaName: 'pursuit.wave-plan@v1',
      channel: 'report',
    },
    {
      schemaName: 'pursuit.verification@v1',
      channel: 'report',
    },
    {
      schemaName: 'pursuit.result@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: ['pursuit.contract@v1', 'pursuit.graph@v1', 'pursuit.wave-plan@v1'],
    close: ['pursuit.result@v1'],
    verification: ['pursuit.verification@v1'],
  },
  primaryResult: {
    schemaName: 'pursuit.result@v1',
    path: 'reports/pursuit-result.json',
    label: 'Pursuit result',
  },
}) satisfies readonly FlowFact[];
