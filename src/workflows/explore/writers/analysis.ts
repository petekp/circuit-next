// Explore analysis synthesis writer.
//
// Reads the explore brief and emits a minimal initial-framing analysis.
// The analysis is the input to the synthesize-step's worker dispatch;
// real runs would have a worker fill out aspects/evidence in detail.

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/synthesis-writers/types.js';
import { ExploreAnalysis, ExploreBrief } from '../../../schemas/artifacts/explore.js';

export const exploreAnalysisSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'explore.analysis@v1',
  reads: [{ name: 'brief', schema: 'explore.brief@v1', required: true }],
  build(context: SynthesisBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    // The brief read uses the schema-name resolver, so this lookup
    // matches whatever path the workflow's explore-brief step writes.
    const briefPath = context.step.reads.find((path) => path.endsWith('brief.json'));
    if (briefPath === undefined) {
      throw new Error(
        `explore.analysis@v1 requires step '${context.step.id}' to read the brief artifact`,
      );
    }
    return ExploreAnalysis.parse({
      subject: brief.subject,
      aspects: [
        {
          name: 'task-framing',
          summary: `Initial analysis for: ${brief.task}`,
          evidence: [
            {
              source: briefPath as unknown as string,
              summary: brief.success_condition,
            },
          ],
        },
      ],
    });
  },
};
