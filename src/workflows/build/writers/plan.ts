// Build plan synthesis writer.
//
// Reads the build brief and lifts its verification command candidates
// into a deliberate, gate-able plan. The plan is the artifact that
// build's verification step consumes (via build.plan@v1 → commands).

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/synthesis-writers/types.js';
import { BuildBrief, BuildPlan } from '../../../schemas/artifacts/build.js';

export const buildPlanSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'build.plan@v1',
  reads: [{ name: 'brief', schema: 'build.brief@v1', required: true }],
  build(context: SynthesisBuildContext): unknown {
    const brief = BuildBrief.parse(context.inputs.brief);
    return BuildPlan.parse({
      objective: brief.objective,
      approach: `Make the smallest safe change inside scope: ${brief.scope}`,
      slices: brief.success_criteria.map((criterion) => `Satisfy: ${criterion}`),
      verification: {
        commands: brief.verification_command_candidates,
      },
    });
  },
};
