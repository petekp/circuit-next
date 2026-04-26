// Registry of verification writers, keyed by output schema name.
//
// Adding a new workflow's verification step means: implement a
// VerificationBuilder in this directory, then register it here. The
// runner consults this registry in writeVerificationArtifact — it
// does not need to know which schemas exist.

import { buildVerificationWriter } from './build-verification.js';
import { fixVerificationWriter } from './fix-verification.js';
import { sweepVerificationWriter } from './sweep-verification.js';
import type { VerificationBuilder } from './types.js';

const REGISTRY = new Map<string, VerificationBuilder>([
  [buildVerificationWriter.resultSchemaName, buildVerificationWriter],
  [fixVerificationWriter.resultSchemaName, fixVerificationWriter],
  [sweepVerificationWriter.resultSchemaName, sweepVerificationWriter],
]);

export function findVerificationWriter(resultSchemaName: string): VerificationBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
