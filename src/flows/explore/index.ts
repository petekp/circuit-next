// Explore flow package — also the conservative default for routing.

import type { CompiledFlowPackage } from '../types.js';
import {
  exploreComposeShapeHint,
  exploreReviewVerdictShapeHint,
  exploreTournamentProposalShapeHint,
  exploreTournamentReviewShapeHint,
} from './relay-hints.js';
import {
  ExploreCompose,
  ExploreReviewVerdict,
  ExploreTournamentProposal,
  ExploreTournamentReview,
} from './reports.js';
import { exploreAnalysisComposeBuilder } from './writers/analysis.js';
import { exploreBriefComposeBuilder } from './writers/brief.js';
import { exploreCloseBuilder } from './writers/close.js';
import { exploreDecisionOptionsComposeBuilder } from './writers/decision-options.js';
import { exploreDecisionComposeBuilder } from './writers/decision.js';

export const exploreCompiledFlowPackage: CompiledFlowPackage = {
  id: 'explore',
  paths: {
    schematic: 'src/flows/explore/schematic.json',
    command: 'src/flows/explore/command.md',
    contract: 'src/flows/explore/contract.md',
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
  writers: {
    compose: [
      exploreBriefComposeBuilder,
      exploreAnalysisComposeBuilder,
      exploreDecisionOptionsComposeBuilder,
      exploreDecisionComposeBuilder,
    ],
    close: [exploreCloseBuilder],
    verification: [],
    checkpoint: [],
  },
};
