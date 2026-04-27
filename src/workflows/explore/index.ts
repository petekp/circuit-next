// Explore workflow package — also the conservative default for routing.

import { exploreCloseBuilder } from '../../runtime/close-writers/explore.js';
import {
  exploreReviewVerdictShapeHint,
  exploreSynthesisShapeHint,
} from '../../runtime/shape-hints/explore.js';
import { exploreAnalysisSynthesisBuilder } from '../../runtime/synthesis-writers/explore-analysis.js';
import { exploreBriefSynthesisBuilder } from '../../runtime/synthesis-writers/explore-brief.js';
import { ExploreReviewVerdict, ExploreSynthesis } from '../../schemas/artifacts/explore.js';
import type { WorkflowPackage } from '../types.js';

export const exploreWorkflowPackage: WorkflowPackage = {
  id: 'explore',
  paths: {
    recipe: 'specs/workflow-recipes/explore.recipe.json',
    command: 'commands/explore.md',
    contract: 'specs/contracts/explore.md',
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
