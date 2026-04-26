import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { WorkflowPrimitiveContractRef } from '../../schemas/workflow-primitives.js';
import type { RecipeRunResult, RecipeRunTraceEntry } from './index.js';

export interface PersistedRecipeRunArtifact {
  readonly schema_version: 1;
  readonly recipe_id: string;
  readonly outcome: RecipeRunResult['outcome'];
  readonly trace: readonly PersistedTraceEntry[];
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface PersistedTraceEntry {
  readonly item_id: string;
  readonly uses: string;
  readonly outcome: string;
  readonly next_target: string;
  readonly output_contract: string;
  readonly summary?: string;
}

function trimTraceEntry(entry: RecipeRunTraceEntry): PersistedTraceEntry {
  return {
    item_id: entry.itemId,
    uses: entry.uses,
    outcome: entry.outcome,
    next_target: entry.nextTarget as unknown as string,
    output_contract: entry.outputContract,
    ...(entry.summary === undefined ? {} : { summary: entry.summary }),
  };
}

function evidenceToObject(
  evidence: ReadonlyMap<WorkflowPrimitiveContractRef, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [contract, value] of evidence) {
    out[contract] = value;
  }
  return out;
}

export function recipeRunArtifact(
  recipeId: string,
  result: RecipeRunResult,
): PersistedRecipeRunArtifact {
  return {
    schema_version: 1,
    recipe_id: recipeId,
    outcome: result.outcome,
    trace: result.trace.map(trimTraceEntry),
    evidence: evidenceToObject(result.evidence),
  };
}

export function persistRecipeRun(
  runRoot: string,
  recipeId: string,
  result: RecipeRunResult,
): { readonly artifactPath: string } {
  mkdirSync(runRoot, { recursive: true });
  const artifactPath = join(runRoot, 'recipe-run.json');
  const artifact = recipeRunArtifact(recipeId, result);
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { artifactPath };
}
