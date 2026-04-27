// Sweep's cross-artifact validator.
//
// `sweep.batch@v1` carries a list of items to migrate; the upstream
// `sweep.queue@v1` carries the prescribed `to_execute` set. This
// validator ensures the batch only contains candidate ids the queue
// authorized — without it, the batch could go off-prescription
// silently.
//
// Why this lives in the workflow package: it's specific to sweep's
// artifact pair and depends on sweep's Zod schemas. Generic engine
// code stays free of workflow-specific knowledge; the validator is
// attached to the `sweep.batch@v1` dispatch artifact in `index.ts`.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  artifactPathForSchemaInWorkflow,
  workflowHasArtifactSchemaInWorkflow,
} from '../../runtime/registries/close-writers/shared.js';
import type { CrossArtifactResult } from '../../runtime/registries/cross-artifact-validators.js';
import type { Workflow } from '../../schemas/workflow.js';
import { SweepBatch, SweepQueue } from './artifacts.js';

export function validateSweepBatchAgainstQueue(
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
      reason:
        'sweep.batch body did not validate against SweepBatch schema (cross-artifact validator)',
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
