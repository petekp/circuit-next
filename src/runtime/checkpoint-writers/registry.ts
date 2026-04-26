// Registry of checkpoint brief builders, keyed by output schema name.
//
// Adding a new workflow's checkpoint-with-artifact means: implement a
// CheckpointBriefBuilder in this directory, then register it here.
// The runner consults this registry in writeCheckpointOwnedArtifact —
// it does not need to know which schemas exist.
//
// Most checkpoints don't write artifacts and skip this registry
// entirely. The runner only invokes a builder when
// step.writes.artifact is defined.

import { buildBriefCheckpointBuilder } from './build-brief.js';
import type { CheckpointBriefBuilder } from './types.js';

const REGISTRY = new Map<string, CheckpointBriefBuilder>([
  [buildBriefCheckpointBuilder.resultSchemaName, buildBriefCheckpointBuilder],
]);

export function findCheckpointBriefBuilder(
  resultSchemaName: string,
): CheckpointBriefBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
