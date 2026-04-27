// Registry of checkpoint brief builders, keyed by output schema name.
//
// Builders come from src/workflows/catalog.ts via buildCheckpointRegistry.
// Most checkpoints don't write artifacts and skip this registry entirely;
// the runner only invokes a builder when step.writes.artifact is defined.

import { workflowPackages } from '../../workflows/catalog.js';
import { buildCheckpointRegistry } from '../catalog-derivations.js';
import type { CheckpointBriefBuilder } from './types.js';

const REGISTRY = buildCheckpointRegistry(workflowPackages);

export function findCheckpointBriefBuilder(
  resultSchemaName: string,
): CheckpointBriefBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
