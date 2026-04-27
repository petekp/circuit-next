// Explore brief synthesis writer.
//
// Fabricates a default ExploreBrief from the run goal alone. A real
// explore run would expect operator-supplied subject/task at frame
// time; the inline-synthesis fallback here keeps recipe execution
// honest when no operator input is available.

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/registries/synthesis-writers/types.js';
import { ExploreBrief } from '../artifacts.js';

export const exploreBriefSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'explore.brief@v1',
  build(context: SynthesisBuildContext): unknown {
    return ExploreBrief.parse({
      subject: context.goal,
      task: context.goal,
      success_condition: `Produce a useful explore result for: ${context.goal}`,
    });
  },
};
