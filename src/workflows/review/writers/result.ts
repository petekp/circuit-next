// Review result synthesis writer.
//
// Reads the upstream reviewer dispatch's result body (NOT a typed
// artifact at a known schema path — this is the dispatch's
// writes.result file) and lifts findings + verdict into the canonical
// ReviewResult artifact. This is the one synthesis writer that does
// not consume a typed artifact via schema-name lookup; it consumes a
// dispatch result, so the path resolver is custom.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../runtime/run-relative-path.js';
import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/synthesis-writers/types.js';
import {
  ReviewDispatchResult,
  ReviewResult,
  computeReviewVerdict,
} from '../../../schemas/artifacts/review.js';
import type { Workflow } from '../../../schemas/workflow.js';

type DispatchStep = Workflow['steps'][number] & { kind: 'dispatch' };

function reviewerDispatchResultPath(
  workflow: Workflow,
  closeStep: SynthesisBuildContext['step'],
): string {
  const closeStepId = closeStep.id as unknown as string;
  const reviewerDispatches = workflow.steps.filter(
    (candidate): candidate is DispatchStep =>
      candidate.kind === 'dispatch' &&
      candidate.role === 'reviewer' &&
      (candidate.routes.pass as unknown as string) === closeStepId,
  );
  if (reviewerDispatches.length !== 1) {
    throw new Error(
      `review.result@v1 requires exactly one reviewer dispatch routing to '${closeStepId}', found ${reviewerDispatches.length}`,
    );
  }
  const resultPath = reviewerDispatches[0]?.writes.result as unknown as string | undefined;
  if (resultPath === undefined || !closeStep.reads.includes(resultPath as never)) {
    throw new Error(
      `review.result@v1 requires close step '${closeStepId}' to read the reviewer dispatch result path '${resultPath ?? '<missing>'}'`,
    );
  }
  return resultPath;
}

export const reviewResultSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'review.result@v1',
  // No declarative reads — the read is a dispatch result body, not a
  // typed artifact at a schema-mapped path. The build function does
  // its own resolution.
  build(context: SynthesisBuildContext): unknown {
    const path = reviewerDispatchResultPath(context.workflow, context.step);
    const dispatchResult = ReviewDispatchResult.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runRoot, path), 'utf8')),
    );
    return ReviewResult.parse({
      scope: context.goal,
      findings: dispatchResult.findings,
      verdict: computeReviewVerdict(dispatchResult.findings),
    });
  },
};
