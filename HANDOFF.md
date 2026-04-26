# HANDOFF

Last updated: 2026-04-26 (recipe authoring + bridge slice).

## Where we are

Build, Explore, and Review now exist as `WorkflowRecipe` fixtures, and a
parallel substrate entry point can run them end-to-end.

1. Three recipe fixtures landed under `specs/workflow-recipes/`:
   `build.recipe.json` (frame → plan → act → run-verification → review →
   close-with-evidence), `explore.recipe.json` (frame → diagnose → act →
   review → close-with-evidence), and `review.recipe.json`
   (frame → review → close-with-evidence). Each one mirrors the legacy
   `.claude-plugin/skills/<workflow>/circuit.json` fixture using canonical
   recipe primitives. All three validate against the catalog with no
   issues.
2. The primitive catalog gained the alternative input sets these recipes
   need: `plan` can run from just a brief, `review` can audit just a
   brief, and `close-with-evidence` can close on review-only evidence
   (Explore) or brief-only evidence (audit-only Review). All defensible
   shapes that real workflows already use.
3. `defaultWorkerHandlers` gained stub handlers for `plan` and `review`
   so the substrate runs end-to-end without an injected dispatcher.
   `DISPATCH_PRIMITIVES` was widened to include `plan` and `review` so
   `dispatchedWorkerHandlers` covers them when a real dispatcher is
   injected. `close-with-evidence` now treats verification and review as
   optional inputs, blocking only when one is present and reports a
   failure.
4. The bridge entry point lives at
   `src/runtime/recipe-runtime/run-workflow-recipe.ts`:
   `runWorkflowAsRecipe({ workflowId, runRoot, goal, ... })` loads the
   right recipe fixture, builds initial evidence from the invocation,
   walks it through `runRecipe`, and persists `recipe-run.json` under
   the run root. It accepts an optional `RecipeDispatcher` for routing
   `plan`, `act`, and `review` items through a real worker.
5. `npm run verify` is green: 808 tests (+14 new), tsc clean, biome
   clean, build clean.

The substrate stays intentionally parallel to `src/runtime/runner.ts`.
The existing `executeDogfood` loop still owns the event log, manifest
snapshot, and real dispatch for the hardcoded Build / Explore / Review
paths. Nothing in `src/cli/dogfood.ts` calls `runWorkflowAsRecipe` yet.

## What's next

The bridge is in place; the actual cutover — rerouting the CLI / runner
entry points so `npm` invocations of Build / Explore / Review run through
`runWorkflowAsRecipe` instead of `runDogfood` — is the next move and is
the right moment to pull in Codex for adversarial review per AGENTS.md
rule #7.

Concretely the next session should:

1. **Codex pass on the bridge.** Hand the new files
   (`src/runtime/recipe-runtime/run-workflow-recipe.ts` plus the three
   recipe fixtures and the catalog deltas) to Codex via `/codex` with
   the cutover plan. Ask for: contract gaps the recipes hide, edge
   cases the stub handlers paper over, and whether the
   `runWorkflowAsRecipe` invocation shape will hold up once the runner
   actually calls it.
2. **Cut the runner over.** Replace the per-workflow code paths in
   `executeDogfood` (or thread `runWorkflowAsRecipe` into
   `runDogfood` for known recipe ids) so Build / Explore / Review
   actually flow through the substrate. The substrate has no event log
   integration; the cutover either adds that or accepts a
   `recipe-run.json`-only artifact for these workflows.
3. **Bind substrate runs into the run-root event log.** If recipe-driven
   runs become first-class, emit `step.entered`, `dispatch.*`,
   `gate.evaluated`, and `run.closed` events the way `executeDogfood`
   does so the existing reducer / snapshot tooling applies.
4. **Promote `fix-lite` to the full Fix recipe.** Still gated on a
   checkpoint adapter (host primitive) and a handoff writer; separate
   slice.

Codex usage is AGENTS.md rule #7: pull Codex in for impactful,
hard-to-revert decisions and for genuine stuck-after-real-attempts
diagnosis; default off otherwise. The cutover qualifies; this slice did
not.
