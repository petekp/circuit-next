import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SweepBatch, SweepQueue } from '../schemas/artifacts/sweep.js';
import type { Workflow } from '../schemas/workflow.js';
import {
  artifactPathForSchemaInWorkflow,
  workflowHasArtifactSchemaInWorkflow,
} from './close-writers/shared.js';

// Cross-artifact validators run after `parseArtifact` succeeds for a
// given schema. They enforce constraints that span more than one
// artifact and therefore cannot be expressed in the single-artifact Zod
// schema — e.g., `sweep.batch.items[].candidate_id` must be a subset of
// the upstream `sweep.queue.to_execute`.
//
// Why a separate registry rather than a Zod superRefine: superRefine
// only sees the artifact under validation, not other artifacts on disk.
// The validator gets `workflow` (to resolve canonical artifact paths)
// and `runRoot` (to read previously-written artifacts).
//
// Fail-closed default: an unregistered schema returns `ok` (the schema
// has no cross-artifact constraints to check). A registered validator
// that cannot find its required upstream artifact returns `fail` —
// silent omission would re-open the gap the validator exists to close.

export type CrossArtifactResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'fail'; readonly reason: string };

export type CrossArtifactValidator = (
  workflow: Workflow,
  runRoot: string,
  resultBody: string,
) => CrossArtifactResult;

const REGISTRY: Readonly<Record<string, CrossArtifactValidator>> = Object.freeze({
  'sweep.batch@v1': validateSweepBatchAgainstQueue,
});

export function runCrossArtifactValidator(
  schemaName: string,
  workflow: Workflow,
  runRoot: string,
  resultBody: string,
): CrossArtifactResult {
  const validator = REGISTRY[schemaName];
  if (validator === undefined) return { kind: 'ok' };
  return validator(workflow, runRoot, resultBody);
}

function validateSweepBatchAgainstQueue(
  workflow: Workflow,
  runRoot: string,
  resultBody: string,
): CrossArtifactResult {
  // Skip if the workflow doesn't include sweep.queue. A non-sweep
  // workflow that reused sweep.batch would have nothing to check
  // against; falling through to ok is correct under this contract.
  if (!workflowHasArtifactSchemaInWorkflow(workflow, 'sweep.queue@v1')) {
    return { kind: 'ok' };
  }

  const queueRel = artifactPathForSchemaInWorkflow(workflow, 'sweep.queue@v1');
  const queueAbs = resolve(runRoot, queueRel);
  if (!existsSync(queueAbs)) {
    return {
      kind: 'fail',
      reason: `sweep.batch validation requires sweep.queue at '${queueRel}' but file is missing`,
    };
  }

  let queueRaw: string;
  try {
    queueRaw = readFileSync(queueAbs, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: 'fail', reason: `cannot read sweep.queue at '${queueRel}': ${msg}` };
  }

  let queueJson: unknown;
  try {
    queueJson = JSON.parse(queueRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: 'fail', reason: `sweep.queue at '${queueRel}' is not valid JSON: ${msg}` };
  }

  const queueParse = SweepQueue.safeParse(queueJson);
  if (!queueParse.success) {
    const issues = queueParse.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    return {
      kind: 'fail',
      reason: `sweep.queue at '${queueRel}' failed schema validation (${issues})`,
    };
  }
  const queue = queueParse.data;

  // resultBody has already passed SweepBatch shape validation upstream
  // in `parseArtifact`, but this validator may be unit-tested directly
  // so re-parse defensively.
  let batchJson: unknown;
  try {
    batchJson = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: 'fail', reason: `sweep.batch body is not valid JSON: ${msg}` };
  }
  const batchParse = SweepBatch.safeParse(batchJson);
  if (!batchParse.success) {
    return {
      kind: 'fail',
      reason: 'sweep.batch body did not validate against SweepBatch schema (cross-artifact validator)',
    };
  }
  const batch = batchParse.data;

  const allowed = new Set(queue.to_execute);
  const offPrescription = batch.items
    .map((item) => item.candidate_id)
    .filter((id) => !allowed.has(id));
  if (offPrescription.length > 0) {
    return {
      kind: 'fail',
      reason: `sweep.batch.items contains candidate_id(s) not in queue.to_execute: [${offPrescription.join(', ')}]; queue.to_execute=[${queue.to_execute.join(', ')}]`,
    };
  }

  return { kind: 'ok' };
}
