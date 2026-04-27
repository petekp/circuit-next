// Registry of verification writers, keyed by output schema name.
//
// Builders come from src/workflows/catalog.ts via buildVerificationRegistry.

import { workflowPackages } from '../../workflows/catalog.js';
import { buildVerificationRegistry } from '../catalog-derivations.js';
import type { VerificationBuilder } from './types.js';

const REGISTRY = buildVerificationRegistry(workflowPackages);

export function findVerificationWriter(resultSchemaName: string): VerificationBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
