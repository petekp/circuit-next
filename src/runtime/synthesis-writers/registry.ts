// Registry of synthesis writers, keyed by output schema name.
//
// Adding a new workflow's synthesis step means: implement a
// SynthesisBuilder in this directory, then register it here. The
// runner consults this registry in tryWriteRegisteredSynthesisArtifact
// — it does not need to know which schemas exist.

import type { Workflow } from '../../schemas/workflow.js';
import { artifactPathForSchemaInWorkflow } from '../close-writers/shared.js';
import { buildPlanSynthesisBuilder } from './build-plan.js';
import { exploreAnalysisSynthesisBuilder } from './explore-analysis.js';
import { exploreBriefSynthesisBuilder } from './explore-brief.js';
import { fixBriefSynthesisBuilder } from './fix-brief.js';
import { migrateBriefSynthesisBuilder } from './migrate-brief.js';
import { migrateCoexistenceSynthesisBuilder } from './migrate-coexistence.js';
import { migrateInventorySynthesisBuilder } from './migrate-inventory.js';
import { reviewIntakeSynthesisBuilder } from './review-intake.js';
import { reviewResultSynthesisBuilder } from './review-result.js';
import { sweepBriefSynthesisBuilder } from './sweep-brief.js';
import { sweepQueueSynthesisBuilder } from './sweep-queue.js';
import type { SynthesisBuilder, SynthesisStep } from './types.js';

const REGISTRY = new Map<string, SynthesisBuilder>([
  [buildPlanSynthesisBuilder.resultSchemaName, buildPlanSynthesisBuilder],
  [exploreBriefSynthesisBuilder.resultSchemaName, exploreBriefSynthesisBuilder],
  [exploreAnalysisSynthesisBuilder.resultSchemaName, exploreAnalysisSynthesisBuilder],
  [reviewIntakeSynthesisBuilder.resultSchemaName, reviewIntakeSynthesisBuilder],
  [reviewResultSynthesisBuilder.resultSchemaName, reviewResultSynthesisBuilder],
  [fixBriefSynthesisBuilder.resultSchemaName, fixBriefSynthesisBuilder],
  [migrateBriefSynthesisBuilder.resultSchemaName, migrateBriefSynthesisBuilder],
  [migrateInventorySynthesisBuilder.resultSchemaName, migrateInventorySynthesisBuilder],
  [migrateCoexistenceSynthesisBuilder.resultSchemaName, migrateCoexistenceSynthesisBuilder],
  [sweepBriefSynthesisBuilder.resultSchemaName, sweepBriefSynthesisBuilder],
  [sweepQueueSynthesisBuilder.resultSchemaName, sweepQueueSynthesisBuilder],
]);

export function findSynthesisBuilder(resultSchemaName: string): SynthesisBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}

// Resolve declared reads to run-relative paths and check that each
// required read is actually present in the synthesis step's reads
// list. Required-but-missing throws with the same phrasing the
// runner used historically so error message stability is preserved.
// Builders that omit `reads` get an empty inputs map and resolve
// paths themselves inside build().
export function resolveSynthesisReadPaths(
  builder: SynthesisBuilder,
  workflow: Workflow,
  step: SynthesisStep,
): Record<string, string | undefined> {
  const paths: Record<string, string | undefined> = {};
  if (builder.reads === undefined) return paths;
  for (const descriptor of builder.reads) {
    const path = artifactPathForSchemaInWorkflow(workflow, descriptor.schema);
    if (descriptor.required && !step.reads.includes(path as never)) {
      throw new Error(`${step.writes.artifact.schema} requires step '${step.id}' to read ${path}`);
    }
    paths[descriptor.name] = step.reads.includes(path as never) ? path : undefined;
  }
  return paths;
}
