// Explore workflow package — also the conservative default for routing.

import { ExploreReviewVerdict, ExploreSynthesis } from './artifacts.js';
import type { WorkflowPackage } from '../types.js';
import { exploreReviewVerdictShapeHint, exploreSynthesisShapeHint } from './dispatch-hints.js';
import { exploreAnalysisSynthesisBuilder } from './writers/analysis.js';
import { exploreBriefSynthesisBuilder } from './writers/brief.js';
import { exploreCloseBuilder } from './writers/close.js';

export const exploreWorkflowPackage: WorkflowPackage = {
  id: 'explore',
  paths: {
    recipe: 'src/workflows/explore/recipe.json',
    command: 'src/workflows/explore/command.md',
    contract: 'src/workflows/explore/contract.md',
  },
  routing: {
    order: Number.MAX_SAFE_INTEGER,
    signals: [],
    reasonForMatch() {
      throw new Error('explore is the default workflow; reasonForMatch should not be called');
    },
    isDefault: true,
    defaultReason: 'no review/audit signal matched; routed to explore as the conservative default',
  },
  dispatchArtifacts: [
    {
      schemaName: 'explore.synthesis@v1',
      schema: ExploreSynthesis,
      dispatchHint: exploreSynthesisShapeHint.instruction,
    },
    {
      schemaName: 'explore.review-verdict@v1',
      schema: ExploreReviewVerdict,
      dispatchHint: exploreReviewVerdictShapeHint.instruction,
    },
  ],
  writers: {
    synthesis: [exploreBriefSynthesisBuilder, exploreAnalysisSynthesisBuilder],
    close: [exploreCloseBuilder],
    verification: [],
    checkpoint: [],
  },
};
