import { defineFlow } from '../flow-definition.js';
import {
  exploreComposeShapeHint,
  exploreReviewVerdictShapeHint,
  exploreTournamentProposalShapeHint,
  exploreTournamentReviewShapeHint,
} from './relay-hints.js';
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
} from './reports.js';
import { exploreAnalysisComposeBuilder } from './writers/analysis.js';
import { exploreBriefComposeBuilder } from './writers/brief.js';
import { exploreCloseBuilder } from './writers/close.js';
import { exploreDecisionOptionsComposeBuilder } from './writers/decision-options.js';
import { exploreDecisionComposeBuilder } from './writers/decision.js';

export const exploreFlowDefinition = defineFlow({
  id: 'explore',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/explore/schematic.json',
    command: 'src/flows/explore/command.md',
    contract: 'src/flows/explore/contract.md',
  },
  schematic: {
    schema_version: '1',
    id: 'explore',
    title: 'Explore Schematic',
    purpose:
      'Explore flow: frame the investigation, analyze the subject, either synthesize and critique findings or run a decision tournament, then close with findings plus evidence. All modes use Frame, Analyze, Plan or Decision, and Close; critique is embedded inside the Plan/Decision stage rather than exposed as a separate canonical Review stage.',
    status: 'active',
    version: '0.1.0',
    starts_at: 'frame-step',
    initial_contracts: ['task.intake@v1', 'route.decision@v1', 'context.packet@v1'],
    contract_aliases: [
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
    entry: {
      signals: {
        include: ['explore', 'investigate', 'research', 'understand'],
        exclude: [],
      },
      intent_prefixes: ['explore', 'investigate', 'decide'],
    },
    entry_modes: [
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
    stage_path_policy: {
      mode: 'partial',
      omits: ['act', 'verify', 'review'],
      rationale:
        'Explore is an investigation and decision flow. Synthesize, critique, and tournament stress review are all embedded inside the canonical Plan/Decision stage. Verify is omitted because Explore output is not executable and uses evidence/seam proof rather than mechanical command verification. See src/flows/explore/contract.md §Canonical stage set for the full rationale.',
    },
    stages: [
      {
        canonical: 'frame',
        id: 'frame-stage',
        title: 'Frame',
      },
      {
        canonical: 'analyze',
        id: 'analyze-stage',
        title: 'Analyze',
      },
      {
        canonical: 'plan',
        id: 'decision-stage',
        title: 'Plan or Decision',
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
        title: 'Frame — produce explore.brief',
        stage: 'frame',
        input: {
          task: 'task.intake@v1',
          route: 'route.decision@v1',
        },
        output: 'explore.brief@v1',
        evidence_requirements: ['scope boundary', 'constraints', 'proof plan'],
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
        routes: {
          continue: 'analyze-step',
          stop: '@stop',
        },
        block: 'frame',
      },
      {
        id: 'analyze-step',
        title: 'Analyze — produce explore.analysis',
        stage: 'analyze',
        input: {
          brief: 'explore.brief@v1',
          context: 'context.packet@v1',
        },
        output: 'explore.analysis@v1',
        evidence_requirements: [
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
        routes: {
          continue: 'synthesize-step',
          retry: 'analyze-step',
          stop: '@stop',
        },
        route_overrides: {
          continue: {
            tournament: 'decision-options-step',
          },
        },
        block: 'diagnose',
      },
      {
        id: 'synthesize-step',
        title: 'Synthesize — produce explore.compose (connector-bound relay)',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          diagnosis: 'explore.analysis@v1',
        },
        output: 'explore.compose@v1',
        evidence_requirements: ['changed files', 'change rationale', 'declared follow-up proof'],
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
        routes: {
          continue: 'review-step',
          retry: 'synthesize-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'review-step',
        title: 'Review — adversarial pass over compose (connector-bound relay)',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          diagnosis: 'explore.analysis@v1',
          change: 'explore.compose@v1',
        },
        output: 'explore.review-verdict@v1',
        evidence_requirements: ['verdict', 'findings', 'confidence', 'required fixes'],
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
        routes: {
          continue: 'close-step',
          retry: 'synthesize-step',
          revise: 'synthesize-step',
          stop: '@stop',
        },
        block: 'review',
      },
      {
        id: 'decision-options-step',
        title: 'Decision — draft tournament options',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          diagnosis: 'explore.analysis@v1',
        },
        output: 'explore.decision-options@v1',
        evidence_requirements: ['ordered steps', 'risk notes', 'proof strategy'],
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
        routes: {
          continue: 'proposal-fanout-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'proposal-fanout-step',
        title: 'Decision — fan out option cases',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          options: 'explore.decision-options@v1',
        },
        output: 'explore.tournament-aggregate@v1',
        evidence_requirements: ['ordered steps', 'risk notes', 'proof strategy'],
        execution: {
          kind: 'fanout',
        },
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
        protocol: 'explore-proposal-fanout@v1',
        writes: {
          report_path: 'reports/tournament-aggregate.json',
          branches_dir_path: 'reports/tournament-branches',
        },
        check: {
          pass: ['accept'],
        },
        routes: {
          continue: 'stress-proposals-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'stress-proposals-step',
        title: 'Decision — stress proposals',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          options: 'explore.decision-options@v1',
          aggregate: 'explore.tournament-aggregate@v1',
        },
        output: 'explore.tournament-review@v1',
        evidence_requirements: ['ordered steps', 'risk notes', 'proof strategy'],
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
        routes: {
          continue: 'tradeoff-checkpoint-step',
          revise: 'decision-options-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'tradeoff-checkpoint-step',
        title: 'Decision — tradeoff checkpoint',
        stage: 'plan',
        input: {
          question: 'explore.tournament-review@v1',
          evidence: 'explore.tournament-aggregate@v1',
        },
        output: 'explore.tradeoff-selection@v1',
        evidence_requirements: [
          'question',
          'available options',
          'selected option',
          'answer source',
        ],
        execution: {
          kind: 'checkpoint',
        },
        checkpoint_policy: {
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
        protocol: 'explore-tradeoff-checkpoint@v1',
        writes: {
          checkpoint_request_path: 'reports/checkpoints/tradeoff-request.json',
          checkpoint_response_path: 'reports/checkpoints/tradeoff-response.json',
        },
        check: {
          allow: ['option-1', 'option-2', 'option-3', 'option-4'],
        },
        routes: {
          continue: 'decision-step',
          stop: '@stop',
        },
        block: 'human-decision',
      },
      {
        id: 'decision-step',
        title: 'Decision — compose final choice',
        stage: 'plan',
        input: {
          brief: 'explore.brief@v1',
          options: 'explore.decision-options@v1',
          aggregate: 'explore.tournament-aggregate@v1',
          review: 'explore.tournament-review@v1',
        },
        output: 'explore.decision@v1',
        evidence_requirements: ['ordered steps', 'risk notes', 'proof strategy'],
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
        routes: {
          continue: 'close-tournament-step',
          stop: '@stop',
        },
        block: 'plan',
      },
      {
        id: 'close-tournament-step',
        title: 'Close — emit tournament result file',
        stage: 'close',
        input: {
          brief: 'explore.brief@v1',
          options: 'explore.decision-options@v1',
          aggregate: 'explore.tournament-aggregate@v1',
          review: 'explore.tournament-review@v1',
          decision: 'explore.decision@v1',
        },
        output: 'explore.result@v1',
        evidence_requirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
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
        routes: {
          complete: '@complete',
          stop: '@stop',
        },
        block: 'close-with-evidence',
      },
      {
        id: 'close-step',
        title: 'Close — emit final result file',
        stage: 'close',
        input: {
          brief: 'explore.brief@v1',
          compose: 'explore.compose@v1',
          review: 'explore.review-verdict@v1',
        },
        output: 'explore.result@v1',
        evidence_requirements: ['outcome', 'evidence pointers', 'residual risks', 'follow-ups'],
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
        routes: {
          complete: '@complete',
          stop: '@stop',
        },
        block: 'close-with-evidence',
      },
    ],
  },
  routing: {
    order: Number.MAX_SAFE_INTEGER,
    signals: [],
    reasonForMatch() {
      throw new Error('explore is the default flow; reasonForMatch should not be called');
    },
    isDefault: true,
    defaultReason: 'no routed flow signal matched; routed to explore as the conservative default',
  },
  relayReports: [
    {
      schemaName: 'explore.compose@v1',
      schema: ExploreCompose,
      relayHint: exploreComposeShapeHint.instruction,
    },
    {
      schemaName: 'explore.review-verdict@v1',
      schema: ExploreReviewVerdict,
      relayHint: exploreReviewVerdictShapeHint.instruction,
    },
    {
      schemaName: 'explore.tournament-proposal@v1',
      schema: ExploreTournamentProposal,
      relayHint: exploreTournamentProposalShapeHint.instruction,
    },
    {
      schemaName: 'explore.tournament-review@v1',
      schema: ExploreTournamentReview,
      relayHint: exploreTournamentReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'explore.brief@v1', schema: ExploreBrief },
    { schemaName: 'explore.analysis@v1', schema: ExploreAnalysis },
    { schemaName: 'explore.decision-options@v1', schema: ExploreDecisionOptions },
    { schemaName: 'explore.tournament-aggregate@v1', schema: ExploreTournamentAggregate },
    { schemaName: 'explore.decision@v1', schema: ExploreDecision },
    { schemaName: 'explore.result@v1', schema: ExploreResult },
  ],
  runtimeSurface: {
    primaryResult: {
      schemaName: 'explore.result@v1',
      path: 'reports/explore-result.json',
      label: 'Explore result',
    },
    progress: {
      steps: [
        { stepId: 'frame-step', taskTitle: 'Frame the work', activeText: 'Framing the work' },
        {
          stepId: 'analyze-step',
          taskTitle: 'Check the context',
          activeText: 'Checking the context',
        },
        {
          stepId: 'synthesize-step',
          taskTitle: 'Draft the recommendation',
          activeText: 'Drafting the recommendation',
          relayRole: 'implementer',
        },
        {
          stepId: 'review-step',
          taskTitle: 'Check the recommendation',
          activeText: 'Checking the recommendation',
          relayRole: 'reviewer',
        },
        {
          stepId: 'decision-options-step',
          taskTitle: 'Draft the options',
          activeText: 'Drafting the options',
        },
        {
          stepId: 'proposal-fanout-step',
          taskTitle: 'Compare the options',
          activeText: 'Comparing the options',
        },
        {
          stepId: 'stress-proposals-step',
          taskTitle: 'Check the options',
          activeText: 'Checking the options',
          relayRole: 'reviewer',
        },
        {
          stepId: 'tradeoff-checkpoint-step',
          taskTitle: 'Compare the options',
          activeText: 'Comparing the options',
        },
        {
          stepId: 'decision-step',
          taskTitle: 'Draft the recommendation',
          activeText: 'Drafting the recommendation',
        },
        { stepId: 'close-tournament-step', taskTitle: 'Wrap up', activeText: 'Wrapping up' },
        { stepId: 'close-step', taskTitle: 'Wrap up', activeText: 'Wrapping up' },
      ],
    },
  },
  writers: {
    compose: [
      exploreBriefComposeBuilder,
      exploreAnalysisComposeBuilder,
      exploreDecisionOptionsComposeBuilder,
      exploreDecisionComposeBuilder,
    ],
    close: [exploreCloseBuilder],
  },
});
