# HANDOFF

Last updated: 2026-04-26 (drift trust gaps closed, Fix close primitives shipped, lite Fix runs end-to-end).

## Where we are

Three Codex post-migration findings closed, and Fix can now actually close
end-to-end (the runtime had been able to load and route lite Fix but had no
synthesis writers for `fix.brief@v1` or `fix.result@v1`, and the dispatch
artifact registry didn't know `fix.context`/`fix.diagnosis`/`fix.change`/
`fix.review`). Concretely:

### Hardening (commit `ef65a9a`)

1. **Drift-check stale-sibling guard** in `scripts/emit-workflows.mjs`:
   `--check` now fails on unexpected `*.json` siblings under
   `.claude-plugin/skills/<id>/`, and emit removes them. Closes the gap
   where a stale `<old-mode>.json` from a renamed/collapsed entry mode
   could silently drive runtime via the CLI loader while
   `npm run verify` stayed green. Test:
   `tests/unit/emit-workflows-drift.test.ts`.
2. **Explore close-step read alignment**: the runtime explore close
   writer now consumes `brief` in addition to `synthesis` and
   `review-verdict`, matching the close-with-evidence primitive
   contract that already mandates brief in every alternative input set.
   The summary references `brief.subject` so `explore.result` is
   self-contained. The compiled reads now match what the writer
   actually reads — no more "intended vs. accidental" trust gap there.
3. **fix-verify schema label reconciled**: the runner's verification
   writer now supports both `build.verification@v1` (commands sourced
   from `build.plan@v1`) and `fix.verification@v1` (commands sourced
   from `fix.brief@v1`'s `verification_command_candidates`). The Fix
   recipe declares `fix.verification@v1` as the canonical Fix
   verification artifact, matching `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`
   in `src/schemas/artifacts/fix.ts`. Same physical file, consistent
   label.

### Fix close primitives (commit `0277531`)

1. **fix.brief synthesis writer** in `runner.ts`: fabricates a
   schema-valid `FixBrief` from the run goal alone. Conservative
   defaults — `repro: not-reproducible (deferred)` and
   `regression_test: deferred` — so future operator-supplied evidence
   can override without schema conflicts. Default verification command
   is `npm run verify`.
2. **fix.result close writer** in `runner.ts`: aggregates the typed
   evidence chain (brief + context + diagnosis + change + verification +
   optional review) into a `FixResult`. Detects review presence by
   checking `workflow.steps` for `fix.review@v1` AND verifying the
   close-step lists the review path in its reads. Lite mode skips
   review via `route_overrides`; the writer emits
   `review_status: 'skipped'` with a default skip reason. Outcome is
   pinned to verification + regression + review state per the FixResult
   superRefine constraints.
3. **Dispatch artifact registry** in `src/runtime/artifact-schemas.ts`
   now includes `fix.context@v1`, `fix.diagnosis@v1`, `fix.change@v1`,
   `fix.review@v1` so dispatch-result materialization succeeds.
4. **Helpers** `workflowHasArtifactSchema` and
   `optionalCloseReadForSchema` let close writers conditionally consume
   schemas that may not be wired in every mode (lite skips review).

### Fix end-to-end runtime proof (commit `368e901`)

`FixContext`, `FixDiagnosis`, and `FixChange` schemas now require
`verdict: literal('accept')`, matching the `BuildImplementation`
pattern. The Fix dispatch steps' `result_verdict` gate parses verdict
from the result body, and the artifact-schema registry validates the
same body strictly — having both contracts share the verdict field is
what lets dispatch outputs flow through both gates without splitting
the body or loosening the artifact schema. With the schemas aligned,
`tests/runner/fix-runtime-wiring.test.ts` runs the lite Fix Workflow
end-to-end via `runDogfood`: stubbed dispatchers feed
context/diagnose/act, the `fix-frame` synthesisWriter is overridden
in the test to produce a brief with a no-op verification command,
`fix-verify` executes that command, and `fix-close-lite` emits a real
FixResult with `review_status='skipped'`.

`npm run verify` passes: 810 tests (6 skipped), tsc clean, biome
clean, build clean, drift check clean across all 5 emitted Workflows.

## What's next

1. **Compose Sweep and Migrate next**. The strict primitives
   (`queue`, `batch`, `risk-rollback-check`, `close-with-evidence`,
   `handoff`) all exist in the catalog. The pattern for adding a new
   workflow is now established by Fix:
   - Author per-workflow artifact schemas in
     `src/schemas/artifacts/<workflow>.ts`.
   - Register dispatch-materialized schemas in
     `src/runtime/artifact-schemas.ts` REGISTRY.
   - Add a synthesis writer for the workflow's brief + result schemas
     in `tryWriteRegisteredSynthesisArtifact` (runner.ts).
   - Author `<workflow>.recipe.json` in `specs/workflow-recipes/` per
     the recipe schema; declare contract aliases so generic primitive
     contracts (`workflow.brief@v1`, `verification.result@v1`, etc.)
     resolve to per-workflow schema names.
   - Add the recipe to `RECIPES` in `scripts/emit-workflows.mjs`.
   - Run `npm run emit-workflows` to produce the compiled
     `circuit.json` (and `<mode>.json` siblings if the recipe uses
     `route_overrides`).
2. **Generic close-with-evidence writer** would be a meaningful
   refactor: instead of a per-workflow close writer in runner.ts, drive
   close artifact assembly from a recipe-supplied template (list of
   source schemas + output template). Not blocking — the per-workflow
   writer pattern works for now — but worth considering before Sweep
   and Migrate land their own close writers, otherwise we'll be writing
   the same shape three times.
3. **Verification-plan contract** is currently an initial-contract
   placeholder. The Fix recipe declares
   `proof: verification.plan@v1` to satisfy the run-verification
   primitive contract, but the runtime sources commands from
   `fix.brief@v1` directly. If Migrate or Sweep want their own
   verification, decide whether each gets its own brief-derived path
   (Fix pattern) or whether `verification.plan@v1` becomes a real
   typed artifact produced by an upstream plan step (Build pattern).
   Both work; consistency matters more than which.

## Notes

- The drift check now treats unexpected JSON siblings under any
  recipe-managed `<id>/` dir as drift. `dogfood-run-0/` is its own
  skill (not in `RECIPES`) and remains untouched.
- `optional_canonicals` in workflow-kind-policy is the pattern that
  let Fix declare `[review]` as optional so lite mode satisfies the
  policy without review. Future workflows that want similar mode-
  specific phase skipping should follow this pattern.
- No Codex pass was needed for the harden + primitive-fill work; each
  change was self-contained and `npm run verify` gave strong evidence
  at every step.
