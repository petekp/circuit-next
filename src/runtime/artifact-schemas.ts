import { z } from 'zod';
import { BuildImplementation, BuildReview } from '../schemas/artifacts/build.js';
import { ExploreReviewVerdict, ExploreSynthesis } from '../schemas/artifacts/explore.js';
import { FixChange, FixContext, FixDiagnosis, FixReview } from '../schemas/artifacts/fix.js';

// Slice 54 (Codex H15 fold-in) — dispatch-artifact schema registry +
// parse helper. Closes the artifact-shape half of the ADR-0008
// §Decision.3a materialization rule. The contract MUST at
// specs/contracts/explore.md names schema parsing as a prerequisite
// for writing the canonical artifact at `writes.artifact.path`:
// Slice 53 closed the verdict-admissibility half (gate.pass
// membership); this module closes the symmetric artifact-shape
// half.
//
// Fail-closed default. When `writes.artifact.schema` names a schema
// that is NOT present in the registry below, `parseArtifact` returns
// a fail result and the runner aborts the step. The contract MUST
// does not admit a "schema unknown → pass" path; a future slice that
// lands a schema authoring surface MUST keep fail-closed as the
// default for unknown schema names.
//
// Event-surface uniformity. This content/schema-failure path does
// NOT emit `dispatch.failed`; that event is reserved for adapter
// invocation exceptions, where no adapter result exists. A parse
// failure is surfaced through the Slice 53 reject-on-bad-verdict
// sequence:
//   gate.evaluated outcome=fail (reason=the parse error)
//   → step.aborted (reason byte-identical)
//   → run.closed outcome=aborted (reason byte-identical)
//   → RunResult.reason mirrors the close reason.
// This keeps the failure-path event surface uniform across both
// halves of the ADR-0008 §Decision.3a gate.
//
// Schema shape after P2.10. Dispatch-produced explore artifacts are parsed
// here because they materialize adapter result bodies. The orchestrator-
// produced explore.brief / analysis / result schemas intentionally stay OUT
// of this dispatch-materializer registry: the explore contract binds them to
// registered synthesis writers in runner.ts. Slice 90 promotes
// explore.synthesis to its strict payload schema; Slice 91 does the same for
// explore.review-verdict; Slice 93 handles explore.result in the close writer.
//
// `dogfood-strict@v1` is a test-only strict shape used by
// `tests/runner/materializer-schema-parse.test.ts` case (a)/(b) to
// exercise the gate-pass + schema-fail independent failure mode
// (a shape Slice 53's gate does not reject).

const MinimalVerdictShape = z.object({ verdict: z.string().min(1) }).passthrough();

const StrictPayloadShape = z
  .object({
    verdict: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const REGISTRY: Readonly<Record<string, z.ZodType<unknown>>> = Object.freeze({
  'dogfood-canonical@v1': MinimalVerdictShape,
  'build.implementation@v1': BuildImplementation,
  'build.review@v1': BuildReview,
  'explore.synthesis@v1': ExploreSynthesis,
  'explore.review-verdict@v1': ExploreReviewVerdict,
  'fix.context@v1': FixContext,
  'fix.diagnosis@v1': FixDiagnosis,
  'fix.change@v1': FixChange,
  'fix.review@v1': FixReview,
  'dogfood-strict@v1': StrictPayloadShape,
});

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
