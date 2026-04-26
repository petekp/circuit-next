# HANDOFF

Last updated: 2026-04-26 (orphan primitives exercised, close-with-evidence refactored to a workflow-agnostic registry, schema layer story documented).

## Architectural state of play

After today's session, runner.ts contains zero workflow-specific
knowledge in the close path. Close-with-evidence is the most-repeated
pattern in the substrate — the refactor proves "primitives compose":
adding a new workflow's close means adding a CloseBuilder file and a
registry entry. No edits to runner.ts.

The orphan-primitive exercisers proved the substrate is permissive:
all five unexercised primitives (queue, batch, risk-rollback-check,
human-decision, handoff) compose without runtime code via the
placeholder synthesis fallback. New workflows can compose with
placeholder writers, then upgrade to real CloseBuilders when needed.

The schema layer decision is now codified in
`specs/workflow-recipe-composition.md`: primitive contracts are
nominal, per-workflow schemas are structural, recipe `contract_aliases`
bridge them. Both layers are load-bearing.



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

### Orphan-primitive exercisers (commit `115e28a`)

Exerciser recipes for `queue`, `batch`, `risk-rollback-check`,
`human-decision`, `handoff` — five primitives in the catalog with no
active recipe using them. Each exerciser parses through the recipe
schema, passes catalog-compatibility validation, compiles to a
Workflow, and runs end-to-end through the runtime. All five succeed
via the placeholder synthesis fallback (and `safe_autonomous_choice`
for the human-decision checkpoint). Surfaces a meaningful property of
the substrate: synthesis-kind orphan primitives compose without
runtime code.

### Close-with-evidence refactor (commit `78fbaaa`)

Three close writers (build.result, explore.result, fix.result) lived
inline in runner.ts as if-chains. Now each builder lives in
`src/runtime/close-writers/<wf>.ts` and is registered by result schema
name. runner.ts's close path is workflow-agnostic. Adding a new
workflow's close means adding a CloseBuilder file and a registry
entry — no edits to runner.ts.
`tests/runner/close-builder-registry.test.ts` proves the contract
with a synthetic builder.

### Schema layer documented (this commit)

Two layers are load-bearing: nominal primitive contracts in the
catalog, structural per-workflow schemas in
`src/schemas/artifacts/`, recipe `contract_aliases` bridges. Codified
in `specs/workflow-recipe-composition.md`. The close-writer refactor
confirmed the design: each builder uses workflow-specific schemas and
benefits from their type safety.

`npm run verify` passes: 833 tests (6 skipped), tsc clean, biome
clean, build clean, drift check clean across all 5 emitted Workflows.

## What's next

1. **Compose Sweep and Migrate next**. The strict primitives
   (`queue`, `batch`, `risk-rollback-check`, `close-with-evidence`,
   `handoff`) all exist in the catalog and are exercised.
   The pattern for adding a new workflow:
   - Author per-workflow artifact schemas in
     `src/schemas/artifacts/<workflow>.ts`.
   - Register dispatch-materialized schemas in
     `src/runtime/artifact-schemas.ts` REGISTRY.
   - Add a CloseBuilder in `src/runtime/close-writers/<workflow>.ts`
     and register it in `close-writers/registry.ts`. (No more
     runner.ts edits for close.)
   - For brief/intermediate synthesis writers, still inline in
     runner.ts. Future work: generalize those to the same registry
     pattern as close.
   - Author `<workflow>.recipe.json` in `specs/workflow-recipes/`,
     declare contract aliases.
   - Add the recipe to `RECIPES` in `scripts/emit-workflows.mjs`.
   - `npm run emit-workflows`.
2. **Generalize the synthesis writer registry** beyond just close.
   The pattern works for close because every workflow has exactly one
   close artifact. For brief/plan/intermediate synthesis writers, the
   same registry approach would let workflows compose without runner.ts
   edits at all. Some scaffolding is needed: a CommonInputContext
   beyond just the close-step.
3. **Dispatch envelope split** — verdict-in-artifact stays for now.
   Evaluated and deferred: dispatch steps have a `result_verdict` gate
   by Workflow contract, so the artifact necessarily carries verdict.
   Splitting envelope from body would require introducing a new
   dispatch kind with non-verdict gates — a larger runtime change. The
   current pattern is coherent: verdict on a dispatch artifact is the
   worker's domain answer, used legitimately by close writers (e.g.,
   `FixReview.verdict` for outcome rules,
   `ExploreReviewVerdict.verdict` for verdict_snapshot). Reconsider if
   we hit a real friction point.
4. **Verification-plan contract** is currently an initial-contract
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
