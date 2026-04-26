// Review intake synthesis writer.
//
// Emits a minimal ReviewIntake artifact carrying the run goal as the
// scope. The Review workflow's audit step consumes this for prompt
// composition; real runs may expand this once Review grows operator-
// supplied scope inputs.

import type { SynthesisBuildContext, SynthesisBuilder } from './types.js';

export const reviewIntakeSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'review.intake@v1',
  build(context: SynthesisBuildContext): unknown {
    // The runner used a passthrough write here historically; preserving
    // that minimal shape so existing review fixtures stay byte-stable.
    return { scope: context.goal };
  },
};
