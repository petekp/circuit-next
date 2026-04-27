// Sweep brief synthesis writer.
//
// Fabricates a default SweepBrief from the run goal alone. A real Sweep
// run would expect operator-supplied scope + sweep_type at frame time;
// the inline-synthesis fallback here keeps recipe execution honest when
// no operator input is available, defaulting to a cleanup sweep over
// the goal's described scope and an `npm run verify` candidate.

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/registries/synthesis-writers/types.js';
import { SweepBrief } from '../artifacts.js';

const DEFAULT_SWEEP_VERIFICATION_COMMAND = {
  id: 'sweep-proof',
  cwd: '.',
  argv: ['npm', 'run', 'check'],
  timeout_ms: 120_000,
  max_output_bytes: 200_000,
  env: {},
} as const;

export const sweepBriefSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'sweep.brief@v1',
  build(context: SynthesisBuildContext): unknown {
    const goal = context.goal;
    return SweepBrief.parse({
      objective: goal,
      sweep_type: 'cleanup',
      scope: goal,
      success_criteria: [`Demonstrate the sweep addresses: ${goal}`],
      scope_exclusions: [],
      out_of_scope: [],
      high_risk_boundaries: [],
      verification_command_candidates: [DEFAULT_SWEEP_VERIFICATION_COMMAND],
    });
  },
};
