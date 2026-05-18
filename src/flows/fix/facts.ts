import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const fixFacts = defineDeclarativeFlowFacts({
  id: 'fix',
  title: 'Fix Schematic',
  purpose:
    'Fix flow: capture problem boundary, prove the pre-fix regression before any specialist relay can edit the checkout, gather context, diagnose, apply a focused change, verify, review (in standard depth), and close with evidence. If the standard reviewer connector is unavailable after proof passes, Fix closes with the proof artifacts and marks review skipped. Lite mode skips the review relay and closes immediately after verification via the fix-verify route_overrides.continue.lite override. fix-no-repro-decision and fix-handoff remain in the schematic as authoring intent for future ask/handoff routing in the runtime; they are unreachable at compile and do not appear in the emitted compiled flows.',
  status: 'active',
  version: '0.1.0',
  visibility: 'public',
  startsAt: 'fix-frame',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['plan'],
    rationale:
      "Fix follows Frame, Analyze, Act, Verify, Review, Close. The Plan stage is omitted because Fix's planning is folded into Diagnose during the Analyze stage — there is no separate plan-of-attack report distinct from the diagnosis.",
  },
  canonicalStagePolicy: {
    enforcement: 'enforce',
    title: 'Frame → Diagnose → Fix → Verify → Review → Close',
    authority: 'docs/flows/authoring-model.md §Fix As The Proving Shape',
    optionalCanonicals: ['review'],
  },
  paths: {
    schematic: 'src/flows/fix/schematic.json',
    command: 'src/flows/fix/command.md',
    contract: 'src/flows/fix/contract.md',
  },
  entry: {
    include: ['fix', 'bug', 'broken', 'regression', 'incident', 'outage', 'diagnose'],
    exclude: [],
    intentPrefixes: ['fix', 'diagnose'],
  },
  modes: [
    {
      name: 'default',
      depth: 'standard',
      description: 'Default Fix entry mode — standard depth with full review pass.',
    },
    {
      name: 'lite',
      depth: 'lite',
      description:
        'Lite Fix entry mode — skips the review relay and closes immediately after verification.',
    },
    {
      name: 'deep',
      depth: 'deep',
      description:
        'Deep Fix entry mode — standard graph at deep depth (more thorough analysis and review).',
    },
    {
      name: 'autonomous',
      depth: 'autonomous',
      description:
        'Autonomous Fix entry mode — standard graph at autonomous depth; safe-default checkpoint choices apply.',
    },
  ],
  initialContracts: [
    'task.intake@v1',
    'route.decision@v1',
    'context.request@v1',
    'flow.question@v1',
    'verification.plan@v1',
    'flow.state@v1',
  ],
  contractAliases: [
    {
      generic: 'flow.brief@v1',
      actual: 'fix.brief@v1',
    },
    {
      generic: 'context.packet@v1',
      actual: 'fix.context@v1',
    },
    {
      generic: 'diagnosis.result@v1',
      actual: 'fix.diagnosis@v1',
    },
    {
      generic: 'decision.answer@v1',
      actual: 'fix.no-repro-decision@v1',
    },
    {
      generic: 'flow.evidence@v1',
      actual: 'fix.diagnosis@v1',
    },
    {
      generic: 'change.evidence@v1',
      actual: 'fix.change@v1',
    },
    {
      generic: 'verification.result@v1',
      actual: 'fix.verification@v1',
    },
    {
      generic: 'verification.result@v1',
      actual: 'fix.regression-proof@v1',
    },
    {
      generic: 'verification.result@v1',
      actual: 'fix.baseline-snapshot@v1',
    },
    {
      generic: 'verification.result@v1',
      actual: 'fix.regression-rerun@v1',
    },
    {
      generic: 'verification.result@v1',
      actual: 'fix.change-set@v1',
    },
    {
      generic: 'review.verdict@v1',
      actual: 'fix.review@v1',
    },
    {
      generic: 'flow.result@v1',
      actual: 'fix.result@v1',
    },
  ],
  stages: [
    {
      stageId: 'frame-stage',
      canonical: 'frame',
      title: 'Frame',
    },
    {
      stageId: 'analyze-stage',
      canonical: 'analyze',
      title: 'Analyze',
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
      id: 'fix-frame',
      title: 'Frame — confirm Fix brief',
      stage: 'frame',
      block: 'frame',
      input: {
        task: 'task.intake@v1',
        route: 'route.decision@v1',
      },
      output: 'fix.brief@v1',
      evidenceRequirements: ['scope boundary', 'constraints', 'proof plan'],
      execution: {
        kind: 'compose',
      },
      protocol: 'fix-frame@v1',
      writes: {
        report_path: 'reports/fix/brief.json',
      },
      check: {
        required: ['problem_statement', 'scope', 'regression_contract', 'success_criteria'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-regression-baseline',
        revise: 'fix-frame',
        ask: '@stop',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Frame the work',
        activeText: 'Framing the work',
      },
    },
    {
      id: 'fix-gather-context',
      title: 'Analyze — gather problem context',
      stage: 'analyze',
      block: 'gather-context',
      input: {
        brief: 'fix.brief@v1',
        request: 'context.request@v1',
      },
      output: 'fix.context@v1',
      evidenceRequirements: ['source list', 'observations', 'confidence notes'],
      execution: {
        kind: 'relay',
        role: 'researcher',
      },
      protocol: 'fix-gather-context@v1',
      writes: {
        report_path: 'reports/fix/context.json',
        request_path: 'reports/relay/fix-gather-context.request.json',
        receipt_path: 'reports/relay/fix-gather-context.receipt.txt',
        result_path: 'reports/relay/fix-gather-context.result.json',
      },
      check: {
        pass: ['accept'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-diagnose',
        retry: 'fix-gather-context',
        ask: '@stop',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the context',
        activeText: 'Checking the context',
        relayRole: 'implementer',
      },
    },
    {
      id: 'fix-diagnose',
      title: 'Analyze — diagnose problem',
      stage: 'analyze',
      block: 'diagnose',
      input: {
        brief: 'fix.brief@v1',
        context: 'fix.context@v1',
      },
      output: 'fix.diagnosis@v1',
      evidenceRequirements: [
        'cause hypothesis',
        'confidence',
        'reproduction status',
        'diagnostic path',
      ],
      execution: {
        kind: 'relay',
        role: 'researcher',
      },
      protocol: 'fix-diagnose@v1',
      writes: {
        report_path: 'reports/fix/diagnosis.json',
        request_path: 'reports/relay/fix-diagnose.request.json',
        receipt_path: 'reports/relay/fix-diagnose.receipt.txt',
        result_path: 'reports/relay/fix-diagnose.result.json',
      },
      check: {
        pass: ['accept'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-act',
        retry: 'fix-gather-context',
        ask: 'fix-no-repro-decision',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the context',
        activeText: 'Checking the context',
        relayRole: 'implementer',
      },
    },
    {
      id: 'fix-no-repro-decision',
      title: 'Analyze — choose path forward when reproduction is uncertain',
      stage: 'analyze',
      block: 'human-decision',
      input: {
        question: 'flow.question@v1',
        evidence: 'fix.diagnosis@v1',
      },
      output: 'fix.no-repro-decision@v1',
      evidenceRequirements: ['question', 'available options', 'selected option', 'answer source'],
      execution: {
        kind: 'checkpoint',
      },
      protocol: 'fix-no-repro-decision@v1',
      writes: {
        checkpoint_request_path: 'reports/checkpoints/fix-no-repro-decision-request.json',
        checkpoint_response_path: 'reports/checkpoints/fix-no-repro-decision-response.json',
      },
      check: {
        allow: ['continue'],
      },
      skillSlots: [],
      checkpointPolicy: {
        prompt: 'Diagnosis did not cleanly reproduce the bug. Choose how to proceed.',
        choices: [
          {
            id: 'continue',
            label: 'Continue with a focused fix anyway',
          },
        ],
        safe_default_choice: 'continue',
        safe_autonomous_choice: 'continue',
      },
      routes: {
        continue: 'fix-act',
        revise: 'fix-diagnose',
        stop: '@stop',
        handoff: 'fix-handoff',
        escalate: '@escalate',
      },
      progress: {
        taskTitle: 'Check the context',
        activeText: 'Checking the context',
      },
    },
    {
      id: 'fix-regression-baseline',
      title: 'Verify — capture regression baseline',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        brief: 'fix.brief@v1',
      },
      output: 'fix.regression-proof@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'fix-regression-baseline@v1',
      writes: {
        report_path: 'reports/fix/regression-proof.json',
      },
      check: {
        required: ['status', 'overall_status'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-baseline-snapshot',
        retry: 'fix-frame',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'fix-baseline-snapshot',
      title: 'Verify — snapshot pre-fix git state',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
      },
      output: 'fix.baseline-snapshot@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'fix-baseline-snapshot@v1',
      writes: {
        report_path: 'reports/fix/baseline-snapshot.json',
      },
      check: {
        required: ['overall_status', 'head_sha'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-gather-context',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'fix-act',
      title: 'Act — apply focused fix',
      stage: 'act',
      block: 'act',
      input: {
        brief: 'fix.brief@v1',
        diagnosis: 'fix.diagnosis@v1',
      },
      output: 'fix.change@v1',
      evidenceRequirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: {
        kind: 'relay',
        role: 'implementer',
      },
      protocol: 'fix-act@v1',
      writes: {
        report_path: 'reports/fix/change.json',
        request_path: 'reports/relay/fix-act.request.json',
        receipt_path: 'reports/relay/fix-act.receipt.txt',
        result_path: 'reports/relay/fix-act.result.json',
      },
      check: {
        pass: ['accept'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-verify',
        retry: 'fix-act',
        ask: 'fix-no-repro-decision',
        stop: '@stop',
        handoff: 'fix-handoff',
      },
      progress: {
        taskTitle: 'Make the change',
        activeText: 'Making the change',
        relayRole: 'implementer',
      },
    },
    {
      id: 'fix-verify',
      title: 'Verify — run Fix proof',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        brief: 'fix.brief@v1',
        change: 'fix.change@v1',
      },
      output: 'fix.verification@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'fix-verify@v1',
      writes: {
        report_path: 'reports/fix/verification.json',
      },
      check: {
        required: ['overall_status', 'commands'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-change-set',
        retry: 'fix-act',
        ask: 'fix-no-repro-decision',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'fix-change-set',
      title: 'Verify — compute fix change-set',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        baseline: 'fix.baseline-snapshot@v1',
        change: 'fix.change@v1',
      },
      output: 'fix.change-set@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'fix-change-set@v1',
      writes: {
        report_path: 'reports/fix/change-set.json',
      },
      check: {
        required: ['status', 'overall_status'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-regression-rerun',
        retry: 'fix-act',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'fix-regression-rerun',
      title: 'Verify — rerun regression command after fix',
      stage: 'verify',
      block: 'run-verification',
      input: {
        proof: 'verification.plan@v1',
        brief: 'fix.brief@v1',
      },
      output: 'fix.regression-rerun@v1',
      evidenceRequirements: ['command list', 'exit status', 'bounded output', 'pass or fail'],
      execution: {
        kind: 'verification',
      },
      protocol: 'fix-regression-rerun@v1',
      writes: {
        report_path: 'reports/fix/regression-rerun.json',
      },
      check: {
        required: ['status', 'overall_status'],
      },
      skillSlots: [],
      routes: {
        continue: {
          to: 'fix-review',
          modeOverrides: {
            lite: 'fix-close-lite',
          },
        },
        retry: 'fix-act',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the work',
        activeText: 'Checking the work',
      },
    },
    {
      id: 'fix-review',
      title: 'Review — independent audit of Fix change',
      stage: 'review',
      block: 'review',
      input: {
        brief: 'fix.brief@v1',
        change: 'fix.change@v1',
        verification: 'fix.verification@v1',
      },
      output: 'fix.review@v1',
      evidenceRequirements: ['verdict', 'findings', 'confidence', 'required fixes'],
      execution: {
        kind: 'relay',
        role: 'reviewer',
      },
      protocol: 'fix-review@v1',
      writes: {
        report_path: 'reports/fix/review.json',
        request_path: 'reports/relay/fix-review.request.json',
        receipt_path: 'reports/relay/fix-review.receipt.txt',
        result_path: 'reports/relay/fix-review.result.json',
      },
      check: {
        pass: ['accept', 'accept-with-fixes'],
      },
      skillSlots: [],
      routes: {
        continue: 'fix-close',
        'connector-failed': 'fix-close',
        retry: 'fix-act',
        revise: 'fix-act',
        ask: 'fix-no-repro-decision',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the result',
        activeText: 'Checking the result',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'fix-close-lite',
      title: 'Close (lite) — emit Fix result without review',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'fix.brief@v1',
        context: 'fix.context@v1',
        diagnosis: 'fix.diagnosis@v1',
        regression: 'fix.regression-proof@v1',
        baseline_snapshot: 'fix.baseline-snapshot@v1',
        change: 'fix.change@v1',
        verification: 'fix.verification@v1',
        regression_rerun: 'fix.regression-rerun@v1',
        change_set: 'fix.change-set@v1',
      },
      output: 'fix.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'fix-close-lite@v1',
      writes: {
        report_path: 'reports/fix-result.json',
      },
      check: {
        required: [
          'summary',
          'outcome',
          'verification_status',
          'regression_status',
          'change_set_status',
          'review_status',
          'evidence_links',
        ],
      },
      skillSlots: [],
      routes: {
        complete: '@complete',
        stop: '@stop',
        handoff: 'fix-handoff',
        escalate: '@escalate',
      },
      progress: {
        taskTitle: 'Wrap up',
        activeText: 'Wrapping up',
      },
    },
    {
      id: 'fix-close',
      title: 'Close — emit Fix result',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'fix.brief@v1',
        context: 'fix.context@v1',
        diagnosis: 'fix.diagnosis@v1',
        regression: 'fix.regression-proof@v1',
        baseline_snapshot: 'fix.baseline-snapshot@v1',
        change: 'fix.change@v1',
        verification: 'fix.verification@v1',
        regression_rerun: 'fix.regression-rerun@v1',
        change_set: 'fix.change-set@v1',
        review: 'fix.review@v1',
      },
      output: 'fix.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'fix-close@v1',
      writes: {
        report_path: 'reports/fix-result.json',
      },
      check: {
        required: [
          'summary',
          'outcome',
          'verification_status',
          'regression_status',
          'change_set_status',
          'review_status',
          'evidence_links',
        ],
      },
      skillSlots: [],
      routes: {
        complete: '@complete',
        stop: '@stop',
        handoff: 'fix-handoff',
        escalate: '@escalate',
      },
      progress: {
        taskTitle: 'Wrap up',
        activeText: 'Wrapping up',
      },
    },
    {
      id: 'fix-handoff',
      title: 'Persist Fix handoff',
      stage: 'close',
      block: 'handoff',
      input: {
        state: 'flow.state@v1',
        brief: 'fix.brief@v1',
      },
      output: 'continuity.record@v1',
      evidenceRequirements: [
        'goal',
        'completed moves',
        'pending evidence',
        'next action',
        'known debt',
      ],
      execution: {
        kind: 'compose',
      },
      protocol: 'fix-handoff@v1',
      writes: {
        report_path: 'reports/fix/handoff.json',
      },
      check: {
        required: ['goal', 'next_action'],
      },
      skillSlots: [],
      routes: {
        complete: '@handoff',
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
      schemaName: 'fix.context@v1',
      channel: 'relay',
    },
    {
      schemaName: 'fix.diagnosis@v1',
      channel: 'relay',
    },
    {
      schemaName: 'fix.change@v1',
      channel: 'relay',
    },
    {
      schemaName: 'fix.review@v1',
      channel: 'relay',
    },
    {
      schemaName: 'fix.brief@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.no-repro-decision@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.regression-proof@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.baseline-snapshot@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.verification@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.regression-rerun@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.change-set@v1',
      channel: 'report',
    },
    {
      schemaName: 'fix.result@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: ['fix.brief@v1'],
    close: ['fix.result@v1'],
    verification: [
      'fix.regression-proof@v1',
      'fix.baseline-snapshot@v1',
      'fix.verification@v1',
      'fix.regression-rerun@v1',
      'fix.change-set@v1',
    ],
  },
  primaryResult: {
    schemaName: 'fix.result@v1',
    path: 'reports/fix-result.json',
    label: 'Fix result',
  },
}) satisfies readonly FlowFact[];
