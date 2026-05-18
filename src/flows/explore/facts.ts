import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const exploreFacts = defineDeclarativeFlowFacts({
  id: 'explore',
  title: 'Explore Schematic',
  purpose:
    'Explore flow: frame the investigation, analyze the subject, either synthesize and critique findings or run a decision tournament, then close with findings plus evidence. All modes use Frame, Analyze, Plan or Decision, and Close; critique is embedded inside the Plan/Decision stage rather than exposed as a separate canonical Review stage.',
  status: 'active',
  version: '0.1.0',
  visibility: 'public',
  startsAt: 'frame-step',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['act', 'verify', 'review'],
    rationale:
      'Explore is an investigation and decision flow. Synthesize, critique, and tournament stress review are all embedded inside the canonical Plan/Decision stage. Verify is omitted because Explore output is not executable and uses evidence/seam proof rather than mechanical command verification. See src/flows/explore/contract.md §Canonical stage set for the full rationale.',
  },
  canonicalStagePolicy: {
    enforcement: 'enforce',
    title: 'Frame → Analyze → Plan or Decision → Close',
    authority: 'src/flows/explore/contract.md §Canonical stage set',
  },
  paths: {
    schematic: 'src/flows/explore/schematic.json',
    command: 'src/flows/explore/command.md',
    contract: 'src/flows/explore/contract.md',
  },
  entry: {
    include: ['explore', 'investigate', 'research', 'understand'],
    exclude: [],
    intentPrefixes: ['explore', 'investigate', 'decide'],
  },
  modes: [
    {
      name: 'default',
      depth: 'standard',
      description: 'Default explore entry mode — seeds the run at Frame at standard depth.',
    },
    {
      name: 'lite',
      depth: 'lite',
      description:
        'Lite Explore entry mode — frames, analyzes, and closes with a compact Plan/Decision pass.',
    },
    {
      name: 'deep',
      depth: 'deep',
      description:
        'Deep Explore entry mode — frames, analyzes, and spends more effort on Plan/Decision evidence and seam proof.',
    },
    {
      name: 'tournament',
      depth: 'tournament',
      description:
        'Decision tournament entry mode — frames and analyzes the question, fans out option cases, pauses for a bounded tradeoff choice, then closes with the selected decision.',
    },
    {
      name: 'autonomous',
      depth: 'autonomous',
      description:
        'Autonomous Explore entry mode — carries ambiguity forward when no safe checkpoint answer is available.',
    },
  ],
  initialContracts: ['task.intake@v1', 'route.decision@v1', 'context.packet@v1'],
  contractAliases: [
    {
      generic: 'flow.brief@v1',
      actual: 'explore.brief@v1',
    },
    {
      generic: 'diagnosis.result@v1',
      actual: 'explore.analysis@v1',
    },
    {
      generic: 'change.evidence@v1',
      actual: 'explore.compose@v1',
    },
    {
      generic: 'review.verdict@v1',
      actual: 'explore.review-verdict@v1',
    },
    {
      generic: 'plan.strategy@v1',
      actual: 'explore.decision-options@v1',
    },
    {
      generic: 'plan.strategy@v1',
      actual: 'explore.tournament-aggregate@v1',
    },
    {
      generic: 'plan.strategy@v1',
      actual: 'explore.tournament-review@v1',
    },
    {
      generic: 'plan.strategy@v1',
      actual: 'explore.decision@v1',
    },
    {
      generic: 'flow.question@v1',
      actual: 'explore.tournament-review@v1',
    },
    {
      generic: 'flow.evidence@v1',
      actual: 'explore.tournament-aggregate@v1',
    },
    {
      generic: 'decision.answer@v1',
      actual: 'explore.tradeoff-selection@v1',
    },
    {
      generic: 'flow.result@v1',
      actual: 'explore.result@v1',
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
      stageId: 'decision-stage',
      canonical: 'plan',
      title: 'Plan or Decision',
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
      title: 'Frame — produce explore.brief',
      stage: 'frame',
      block: 'frame',
      input: {
        task: 'task.intake@v1',
        route: 'route.decision@v1',
      },
      output: 'explore.brief@v1',
      evidenceRequirements: ['scope boundary', 'constraints', 'proof plan'],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-frame@v1',
      writes: {
        report_path: 'reports/brief.json',
      },
      check: {
        required: ['subject', 'success_condition'],
      },
      skillSlots: [],
      routes: {
        continue: 'analyze-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Frame the work',
        activeText: 'Framing the work',
      },
    },
    {
      id: 'analyze-step',
      title: 'Analyze — produce explore.analysis',
      stage: 'analyze',
      block: 'diagnose',
      input: {
        brief: 'explore.brief@v1',
        context: 'context.packet@v1',
      },
      output: 'explore.analysis@v1',
      evidenceRequirements: [
        'cause hypothesis',
        'confidence',
        'reproduction status',
        'diagnostic path',
      ],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-analyze@v1',
      writes: {
        report_path: 'reports/analysis.json',
      },
      check: {
        required: ['aspects'],
      },
      skillSlots: [],
      routes: {
        continue: {
          to: 'synthesize-step',
          modeOverrides: {
            tournament: 'decision-options-step',
          },
        },
        retry: 'analyze-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the context',
        activeText: 'Checking the context',
      },
    },
    {
      id: 'synthesize-step',
      title: 'Synthesize — produce explore.compose (connector-bound relay)',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'explore.brief@v1',
        diagnosis: 'explore.analysis@v1',
      },
      output: 'explore.compose@v1',
      evidenceRequirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: {
        kind: 'relay',
        role: 'implementer',
      },
      protocol: 'explore-synthesize@v1',
      writes: {
        report_path: 'reports/compose.json',
        request_path: 'reports/relay/synthesize.request.json',
        receipt_path: 'reports/relay/synthesize.receipt.txt',
        result_path: 'reports/relay/synthesize.result.json',
      },
      check: {
        pass: ['accept'],
      },
      skillSlots: [],
      routes: {
        continue: 'review-step',
        retry: 'synthesize-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Draft the recommendation',
        activeText: 'Drafting the recommendation',
        relayRole: 'implementer',
      },
    },
    {
      id: 'review-step',
      title: 'Review — adversarial pass over compose (connector-bound relay)',
      stage: 'plan',
      block: 'review',
      input: {
        brief: 'explore.brief@v1',
        diagnosis: 'explore.analysis@v1',
        change: 'explore.compose@v1',
      },
      output: 'explore.review-verdict@v1',
      evidenceRequirements: ['verdict', 'findings', 'confidence', 'required fixes'],
      execution: {
        kind: 'relay',
        role: 'reviewer',
      },
      protocol: 'explore-review@v1',
      writes: {
        report_path: 'reports/review-verdict.json',
        request_path: 'reports/relay/review.request.json',
        receipt_path: 'reports/relay/review.receipt.txt',
        result_path: 'reports/relay/review.result.json',
      },
      check: {
        pass: ['accept', 'accept-with-fold-ins'],
      },
      skillSlots: [],
      routes: {
        continue: 'close-step',
        retry: 'synthesize-step',
        revise: 'synthesize-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the recommendation',
        activeText: 'Checking the recommendation',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'decision-options-step',
      title: 'Decision — draft tournament options',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'explore.brief@v1',
        diagnosis: 'explore.analysis@v1',
      },
      output: 'explore.decision-options@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-decision-options@v1',
      writes: {
        report_path: 'reports/decision-options.json',
      },
      check: {
        required: ['decision_question', 'options'],
      },
      skillSlots: [],
      routes: {
        continue: 'proposal-fanout-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Draft the options',
        activeText: 'Drafting the options',
      },
    },
    {
      id: 'proposal-fanout-step',
      title: 'Decision — fan out option cases',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'explore.brief@v1',
        options: 'explore.decision-options@v1',
      },
      output: 'explore.tournament-aggregate@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'fanout',
      },
      protocol: 'explore-proposal-fanout@v1',
      writes: {
        report_path: 'reports/tournament-aggregate.json',
        branches_dir_path: 'reports/tournament-branches',
      },
      check: {
        pass: ['accept'],
      },
      skillSlots: [],
      fanout: {
        branches: {
          kind: 'dynamic',
          source_report: 'reports/decision-options.json',
          items_path: 'options',
          template: {
            branch_id: '$item.id',
            execution: {
              kind: 'relay',
              role: 'researcher',
              goal: '$item.best_case_prompt',
              report_schema: 'explore.tournament-proposal@v1',
              provenance_field: 'option_id',
            },
          },
          max_branches: 4,
        },
        concurrency: {
          kind: 'bounded',
          max: 2,
        },
        on_child_failure: 'abort-all',
        join: {
          policy: 'aggregate-only',
        },
      },
      routes: {
        continue: 'stress-proposals-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Compare the options',
        activeText: 'Comparing the options',
      },
    },
    {
      id: 'stress-proposals-step',
      title: 'Decision — stress proposals',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'explore.brief@v1',
        options: 'explore.decision-options@v1',
        aggregate: 'explore.tournament-aggregate@v1',
      },
      output: 'explore.tournament-review@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'relay',
        role: 'reviewer',
      },
      protocol: 'explore-stress-proposals@v1',
      writes: {
        report_path: 'reports/tournament-review.json',
        request_path: 'reports/relay/tournament-review.request.json',
        receipt_path: 'reports/relay/tournament-review.receipt.txt',
        result_path: 'reports/relay/tournament-review.result.json',
      },
      check: {
        pass: ['recommend', 'no-clear-winner', 'needs-operator'],
      },
      skillSlots: [],
      routes: {
        continue: 'tradeoff-checkpoint-step',
        revise: 'decision-options-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Check the options',
        activeText: 'Checking the options',
        relayRole: 'reviewer',
      },
    },
    {
      id: 'tradeoff-checkpoint-step',
      title: 'Decision — tradeoff checkpoint',
      stage: 'plan',
      block: 'human-decision',
      input: {
        question: 'explore.tournament-review@v1',
        evidence: 'explore.tournament-aggregate@v1',
      },
      output: 'explore.tradeoff-selection@v1',
      evidenceRequirements: ['question', 'available options', 'selected option', 'answer source'],
      execution: {
        kind: 'checkpoint',
      },
      protocol: 'explore-tradeoff-checkpoint@v1',
      writes: {
        checkpoint_request_path: 'reports/checkpoints/tradeoff-request.json',
        checkpoint_response_path: 'reports/checkpoints/tradeoff-response.json',
      },
      check: {
        allow: ['option-1', 'option-2', 'option-3', 'option-4'],
      },
      skillSlots: [],
      checkpointPolicy: {
        prompt:
          'Choose the option Circuit should close with. This checkpoint only supports final option choices; ask-for-more-evidence and stop routes are intentionally not encoded until the runtime has executable route semantics for them.',
        choices: [
          {
            id: 'option-1',
            label: 'Option 1',
            description: 'Close with the first drafted option.',
          },
          {
            id: 'option-2',
            label: 'Option 2',
            description: 'Close with the second drafted option.',
          },
          {
            id: 'option-3',
            label: 'Option 3',
            description: 'Close with the third drafted option.',
          },
          {
            id: 'option-4',
            label: 'Option 4',
            description: 'Close with the fourth drafted option.',
          },
        ],
        safe_default_choice: 'option-1',
      },
      routes: {
        continue: 'decision-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Compare the options',
        activeText: 'Comparing the options',
      },
    },
    {
      id: 'decision-step',
      title: 'Decision — compose final choice',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'explore.brief@v1',
        options: 'explore.decision-options@v1',
        aggregate: 'explore.tournament-aggregate@v1',
        review: 'explore.tournament-review@v1',
      },
      output: 'explore.decision@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-decision@v1',
      writes: {
        report_path: 'reports/decision.json',
      },
      check: {
        required: ['decision', 'selected_option_id', 'rationale'],
      },
      skillSlots: [],
      routes: {
        continue: 'close-tournament-step',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Draft the recommendation',
        activeText: 'Drafting the recommendation',
      },
    },
    {
      id: 'close-tournament-step',
      title: 'Close — emit tournament result file',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'explore.brief@v1',
        options: 'explore.decision-options@v1',
        aggregate: 'explore.tournament-aggregate@v1',
        review: 'explore.tournament-review@v1',
        decision: 'explore.decision@v1',
      },
      output: 'explore.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-close-tournament@v1',
      writes: {
        report_path: 'reports/explore-result.json',
      },
      check: {
        required: ['summary', 'verdict_snapshot'],
      },
      skillSlots: [],
      routes: {
        complete: '@complete',
        stop: '@stop',
      },
      progress: {
        taskTitle: 'Wrap up',
        activeText: 'Wrapping up',
      },
    },
    {
      id: 'close-step',
      title: 'Close — emit final result file',
      stage: 'close',
      block: 'close-with-evidence',
      input: {
        brief: 'explore.brief@v1',
        compose: 'explore.compose@v1',
        review: 'explore.review-verdict@v1',
      },
      output: 'explore.result@v1',
      evidenceRequirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
      execution: {
        kind: 'compose',
      },
      protocol: 'explore-close@v1',
      writes: {
        report_path: 'reports/explore-result.json',
      },
      check: {
        required: ['summary', 'verdict_snapshot'],
      },
      skillSlots: [],
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
      schemaName: 'explore.compose@v1',
      channel: 'relay',
    },
    {
      schemaName: 'explore.review-verdict@v1',
      channel: 'relay',
    },
    {
      schemaName: 'explore.tournament-proposal@v1',
      channel: 'relay',
    },
    {
      schemaName: 'explore.tournament-review@v1',
      channel: 'relay',
    },
    {
      schemaName: 'explore.brief@v1',
      channel: 'report',
    },
    {
      schemaName: 'explore.analysis@v1',
      channel: 'report',
    },
    {
      schemaName: 'explore.decision-options@v1',
      channel: 'report',
    },
    {
      schemaName: 'explore.tournament-aggregate@v1',
      channel: 'report',
    },
    {
      schemaName: 'explore.decision@v1',
      channel: 'report',
    },
    {
      schemaName: 'explore.result@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: [
      'explore.brief@v1',
      'explore.analysis@v1',
      'explore.decision-options@v1',
      'explore.decision@v1',
    ],
    close: ['explore.result@v1'],
  },
  primaryResult: {
    schemaName: 'explore.result@v1',
    path: 'reports/explore-result.json',
    label: 'Explore result',
  },
}) satisfies readonly FlowFact[];
