# HANDOFF

Last updated: 2026-04-26 (Fix recipe shipped, route_overrides honored at compile).

## Where we are

The recipe → Workflow compiler now honors `route_overrides`, and the Fix
recipe is active. Concretely:

1. `src/runtime/compile-recipe-to-workflow.ts` returns a discriminated
   `CompileResult`:
   - `kind: 'single'` when no item declares `route_overrides` (all entry
     modes share one graph; emitted to one `circuit.json`). build, explore,
     and review all hit this branch and produce the same byte-equivalent
     output as before.
   - `kind: 'per-mode'` when at least one item declares `route_overrides`
     (one Workflow per entry mode, with reachability + dead-step
     elimination + auto-omitted canonicals applied). Fix hits this branch.
2. `scripts/emit-workflows.mjs` groups per-mode Workflows by graph identity
   (everything except `entry_modes`). The largest group goes to
   `circuit.json` with merged entry_modes; remaining modes get their own
   `<mode-name>.json`. For Fix: default/deep/autonomous share the standard
   graph and live in `circuit.json`; lite skips review and lives in
   `lite.json`.
3. `src/cli/dogfood.ts` `resolveFixturePath` is mode-aware: when the CLI
   is invoked with `--entry-mode <X>` and `<id>/<X>.json` exists, the
   loader prefers it over `<id>/circuit.json`. Single-file workflows
   (build/explore/review) are unaffected.
4. `specs/workflow-recipes/fix.recipe.json` is the active Fix recipe
   (status: active). It takes `task.intake@v1` and `route.decision@v1` as
   initial contracts (matching build/explore), starts at `fix-frame`, and
   declares `route_overrides.continue.lite = fix-close-lite` on
   `fix-verify`. `fix-no-repro-decision` and `fix-handoff` remain in the
   recipe as authoring intent for future ask/handoff routing in the
   runtime; they are unreachable at compile and do not appear in the
   emitted Workflows.
5. The legacy projection helpers (`projectWorkflowRecipeForCompiler`,
   `compileWorkflowRecipeDraft`, and the `WorkflowRecipeProjected*` /
   `WorkflowRecipeDraft*` types) and the fix-candidate snapshot fixture
   are deleted. The contract test for the Fix recipe at
   `tests/contracts/workflow-recipe.test.ts` exercises the schema
   directly.
6. `tests/contracts/compile-recipe-to-workflow.test.ts` covers the
   single-mode byte-equivalence for build/explore/review.
   `tests/unit/compile-recipe-per-mode.test.ts` covers per-mode
   reachability, override application, auto-omit, and the
   handoff/escalate dropped-outcome handling against synthetic recipes.

`npm run verify` passes: 795 tests (6 skipped), tsc clean, biome clean,
build clean, drift check clean across all 5 emitted files
(build/explore/review/fix circuit.json + fix lite.json).

## What's next

1. **Hook up `/circuit:fix` in the slash-command router and skill index.**
   The recipe and committed Workflows exist; the CLI loader handles per-
   mode files. The router/skill registration that exposes `/circuit:fix`
   to users still needs a pass — confirm the workflow shows up under
   `/circuit:run` classification and that `/circuit:fix --entry-mode lite`
   resolves to `lite.json`.
2. **Verification artifact label mismatch.** `fix-verify` writes
   `build.verification@v1` (the only schema the runner's verification
   writer supports), but `fix.result.artifact_pointers` labels it as
   `fix.verification@v1` per `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`. Both
   point at the same physical file with structurally identical contents,
   but the labels disagree. Either generalize the runner's verification
   writer to handle `fix.verification@v1` directly, or drop the
   `fix.verification` entry from the result schema and standardize on the
   build label.
3. **Recipe authoring docs refresh** at
   `specs/workflow-recipe-composition.md` got a partial pass (removed the
   projection-helper paragraphs, updated the Fix shape, pointed at the
   real recipe and compiler). The "What This Means For Fix" list should
   probably be promoted into a fuller "Authoring an active recipe"
   walkthrough now that Fix exists as a worked example.
4. **Other workflows that might want `route_overrides`.** Build-lite
   could plausibly skip its review step; same call as Fix. If/when other
   workflows want this pattern, just add the override to the recipe — the
   compiler and emit pipeline now handle it generically.

No Codex pass was needed this session — the change was self-contained and
`npm run verify` gave strong evidence at every step.
