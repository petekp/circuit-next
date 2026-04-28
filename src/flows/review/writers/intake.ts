// Review intake compose writer.
//
// Emits a minimal ReviewIntake report carrying the run goal as the
// scope. The Review flow's audit step consumes this for prompt
// composition; real runs may expand this once Review grows operator-
// supplied scope inputs.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../../runtime/registries/compose-writers/types.js';

export const reviewIntakeComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'review.intake@v1',
  build(context: ComposeBuildContext): unknown {
    // The runner used a passthrough write here historically; preserving
    // that minimal shape so existing review fixtures stay byte-stable.
    return { scope: context.goal };
  },
};
