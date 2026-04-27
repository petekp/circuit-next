// Dispatch-artifact schema registry + parse helper.
//
// REGISTRY is derived from src/workflows/catalog.ts: each
// WorkflowPackage contributes its dispatchArtifacts. Test-only
// fixtures (`dogfood-canonical@v1`, `dogfood-strict@v1`) are added
// inline because they are not real workflows.
//
// Fail-closed default. When `writes.artifact.schema` names a schema
// that is NOT present in the registry below, `parseArtifact` returns
// a fail result and the runner aborts the step. The contract MUST
// at specs/contracts/explore.md does not admit a "schema unknown →
// pass" path; a future slice that lands a schema authoring surface
// MUST keep fail-closed as the default for unknown schema names.
//
// Event-surface uniformity. This content/schema-failure path does
// NOT emit `dispatch.failed`; that event is reserved for adapter
// invocation exceptions, where no adapter result exists. A parse
// failure is surfaced through the reject-on-bad-verdict sequence:
//   gate.evaluated outcome=fail (reason=the parse error)
//   → step.aborted (reason byte-identical)
//   → run.closed outcome=aborted (reason byte-identical)
//   → RunResult.reason mirrors the close reason.

import { z } from 'zod';
import { workflowPackages } from '../workflows/catalog.js';

const MinimalVerdictShape = z.object({ verdict: z.string().min(1) }).passthrough();

const StrictPayloadShape = z
  .object({
    verdict: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

// Test-only fixtures live inline because they are not part of any
// real workflow. `dogfood-canonical@v1` is the minimal-shape positive
// case; `dogfood-strict@v1` is used by tests/runner/materializer-
// schema-parse.test.ts to exercise the gate-pass + schema-fail mode.
const TEST_FIXTURE_SCHEMAS: Readonly<Record<string, z.ZodType<unknown>>> = Object.freeze({
  'dogfood-canonical@v1': MinimalVerdictShape,
  'dogfood-strict@v1': StrictPayloadShape,
});

const REGISTRY: Readonly<Record<string, z.ZodType<unknown>>> = (() => {
  const out: Record<string, z.ZodType<unknown>> = { ...TEST_FIXTURE_SCHEMAS };
  for (const pkg of workflowPackages) {
    for (const artifact of pkg.dispatchArtifacts) {
      if (Object.hasOwn(out, artifact.schemaName)) {
        throw new Error(
          `duplicate dispatch artifact schema '${artifact.schemaName}' registered (workflow ${pkg.id})`,
        );
      }
      out[artifact.schemaName] = artifact.schema;
    }
  }
  return Object.freeze(out);
})();

export type ArtifactParseResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'fail'; readonly reason: string };

export function parseArtifact(schemaName: string, resultBody: string): ArtifactParseResult {
  if (!Object.hasOwn(REGISTRY, schemaName)) {
    return {
      kind: 'fail',
      reason: `artifact schema '${schemaName}' is not registered in the artifact-schema registry (fail-closed default)`,
    };
  }
  const schema = REGISTRY[schemaName] as z.ZodType<unknown>;

  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'fail',
      reason: `artifact body did not parse as JSON against schema '${schemaName}' (${msg})`,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    return {
      kind: 'fail',
      reason: `artifact body did not validate against schema '${schemaName}' (${issueSummary})`,
    };
  }
  return { kind: 'ok' };
}
