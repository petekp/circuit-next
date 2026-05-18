import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const buildFacts = defineDeclarativeFlowFacts({
  id: 'build',
  title: 'Build Schematic',
  purpose:
    'Build flow. Circuit frames a requested change, plans it, relays implementation to a worker, runs verification, relays review to a separate worker, and closes with a Build result file plus evidence.',
  status: 'active',
  version: '0.1.0',
  visibility: 'public',
  startsAt: 'frame-step',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['analyze'],
    rationale:
      'Build follows Frame, Plan, Act, Verify, Review, Close. The Analyze stage is omitted because analysis is folded into Frame and Plan for this flow.',
  },
  canonicalStagePolicy: {
    enforcement: 'enforce',
    title: 'Frame → Plan → Act → Verify → Review → Close',
    authority: 'src/flows/build/contract.md §Build Flow Contract',
  },
  paths: {
    schematic: 'src/flows/build/schematic.json',
    command: 'src/flows/build/command.md',
    contract: 'src/flows/build/contract.md',
  },
  entry: {
    include: ['build', 'implement', 'develop', 'change', 'fix', 'add'],
    exclude: [],
    intentPrefixes: ['build', 'implement', 'develop'],
  },
  modes: [
    {
      name: 'default',
      depth: 'standard',
      description: 'Default Build entry mode.',
    },
    {
      name: 'lite',
      depth: 'lite',
      description: 'Lite Build entry mode.',
    },
    {
      name: 'deep',
      depth: 'deep',
      description: 'Deep Build entry mode.',
    },
    {
      name: 'autonomous',
      depth: 'autonomous',
      description: 'Autonomous Build entry mode.',
    },
  ],
  initialContracts: ['task.intake@v1', 'route.decision@v1', 'verification.plan@v1'],
  contractAliases: {
    'flow.brief@v1': 'build.brief@v1',
    'plan.strategy@v1': 'build.plan@v1',
    'change.evidence@v1': 'build.implementation@v1',
    'verification.result@v1': 'build.verification@v1',
    'review.verdict@v1': 'build.review@v1',
    'flow.result@v1': 'build.result@v1',
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
      title: 'Plan',
    },
    {
      stageId: 'act-stage',
      canonical: 'act',
      title: 'Act',
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
      id: 'frame-step',
      title: 'Frame - confirm Build brief',
      stage: 'frame',
      block: 'frame',
      input: {
        task: 'task.intake@v1',
        route: 'route.decision@v1',
      },
      output: 'build.brief@v1',
      evidenceRequirements: ['scope boundary', 'constraints', 'proof plan'],
      execution: {
        kind: 'checkpoint',
      },
      protocol: 'build-frame@v1',
      writes: {
        report_path: 'reports/build/brief.json',
        checkpoint_request_path: 'reports/checkpoints/frame-step-request.json',
        checkpoint_response_path: 'reports/checkpoints/frame-step-response.json',
      },
      check: {
        allow: ['continue'],
      },
      checkpointPolicy: {
        prompt: 'Confirm the Build brief before implementation starts.',
        choices: [
          {
            id: 'continue',
            label: 'Continue',
          },
        ],
        safe_default_choice: 'continue',
        safe_autonomous_choice: 'continue',
        report_template: {
          scope: 'Make the smallest safe change that satisfies the requested goal.',
          success_criteria: [
            'The requested behavior is implemented',
            'Verification passes',
            'Review completes without a blocking issue',
          ],
        },
      },
      routes: {
        continue: 'plan-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Frame the work',
        activeText: 'Framing the work',
      },
    },
    {
      id: 'plan-step',
      title: 'Plan - produce Build plan',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'build.brief@v1',
      },
      output: 'build.plan@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'compose',
      },
      protocol: 'build-plan@v1',
      writes: {
        report_path: 'reports/build/plan.json',
      },
      check: {
        required: ['objective', 'verification'],
      },
      routes: {
        continue: 'act-step',
        revise: 'plan-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Plan the work',
        activeText: 'Planning the work',
      },
    },
    {
      id: 'act-step',
      title: 'Act - implementation relay',
      stage: 'act',
      block: 'act',
      input: {
        brief: 'build.brief@v1',
        plan: 'build.plan@v1',
      },
      output: 'build.implementation@v1',
      evidenceRequirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: {
        kind: 'relay',
        role: 'implementer',
      },
      protocol: 'build-act@v1',
      writes: {
        report_path: 'reports/build/implementation.json',
        request_path: 'reports/relay/build-act.request.json',
        receipt_path: 'reports/relay/build-act.receipt.txt',
        result_path: 'reports/relay/build-act.result.json',
      },
      check: {
        pass: ['accept'],
      },
      routes: {
        continue: 'verify-step',
        retry: 'act-step',
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
      title: 'Verify - run Build verification',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        plan: 'build.plan@v1',
        change: 'build.implementation@v1',
      },
      output: 'build.verification@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'build-verify@v1',
      writes: {
        report_path: 'reports/build/verification.json',
      },
      check: {
        required: ['overall_status', 'commands'],
      },
      routes: {
        continue: 'review-step',
        retry: 'act-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'review-step',
      title: 'Review - implementation review relay',
      stage: 'review',
      block: 'review',
      input: {
        brief: 'build.brief@v1',
        plan: 'build.plan@v1',
        change: 'build.implementation@v1',
        verification: 'build.verification@v1',
      },
      output: 'build.review@v1',
      evidenceRequirements: ['verdict', 'findings', 'confidence', 'required fixes'],
      execution: {
        kind: 'relay',
        role: 'reviewer',
      },
      protocol: 'build-review@v1',
      writes: {
        report_path: 'reports/build/review.json',
        request_path: 'reports/relay/build-review.request.json',
        receipt_path: 'reports/relay/build-review.receipt.txt',
        result_path: 'reports/relay/build-review.result.json',
      },
      check: {
        pass: ['accept', 'accept-with-fixes'],
      },
      routes: {
        continue: 'close-step',
        retry: 'act-step',
        revise: 'act-step',
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
      title: 'Close - emit Build result',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'build.brief@v1',
        plan: 'build.plan@v1',
        implementation: 'build.implementation@v1',
        verification: 'build.verification@v1',
        review: 'build.review@v1',
      },
      output: 'build.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'build-close@v1',
      writes: {
        report_path: 'reports/build-result.json',
      },
      check: {
        required: ['summary', 'outcome', 'evidence_links'],
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
      schemaName: 'build.implementation@v1',
      channel: 'relay',
    },
    {
      schemaName: 'build.review@v1',
      channel: 'relay',
    },
    {
      schemaName: 'build.brief@v1',
      channel: 'report',
    },
    {
      schemaName: 'build.plan@v1',
      channel: 'report',
    },
    {
      schemaName: 'build.verification@v1',
      channel: 'report',
    },
    {
      schemaName: 'build.result@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: ['build.plan@v1'],
    close: ['build.result@v1'],
    verification: ['build.verification@v1'],
    checkpoint: ['build.brief@v1'],
  },
  primaryResult: {
    schemaName: 'build.result@v1',
    path: 'reports/build-result.json',
    label: 'Build result',
  },
  engineFlags: {
    bindsExecutionDepthToRelaySelection: true,
  },
}) satisfies readonly FlowFact[];
