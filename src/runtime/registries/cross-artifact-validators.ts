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
// No-rule = pass: an unregistered schema returns `ok` because the
// catalog has no cross-artifact constraints declared for it. Registered
// validators are themselves expected to fail-closed when their required
// upstream artifact is missing or malformed — silent omission would
// re-open the gap each validator exists to close.
//
// Co-located on the dispatch artifact: each `WorkflowDispatchArtifact`
// optionally carries its own `crossArtifactValidate`. This makes the
// invariant "validators only fire on dispatch-produced artifacts"
// structural — there is no other place to attach one. The runtime
// composes them into a single keyed registry through the catalog.

import type { Workflow } from '../../schemas/workflow.js';
import { workflowPackages } from '../../workflows/catalog.js';
import { buildCrossArtifactValidatorRegistry } from '../catalog-derivations.js';

export type CrossArtifactResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'fail'; readonly reason: string };

export type CrossArtifactValidator = (
  workflow: Workflow,
  runRoot: string,
  resultBody: string,
) => CrossArtifactResult;

const REGISTRY = buildCrossArtifactValidatorRegistry(workflowPackages);

export function runCrossArtifactValidator(
  schemaName: string,
  workflow: Workflow,
  runRoot: string,
  resultBody: string,
): CrossArtifactResult {
  const validator = REGISTRY.get(schemaName);
  if (validator === undefined) return { kind: 'ok' };
  return validator(workflow, runRoot, resultBody);
}
