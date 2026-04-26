# HANDOFF

Last updated: 2026-04-25 (overnight recipe runtime substrate session).

## Where we are

The recipe runtime substrate landed in three commits this session:

1. `feat: recipe runtime substrate v0 + fix-lite end-to-end demo`
   (`src/runtime/recipe-runtime/`). The substrate runs a `WorkflowRecipe`
   plus a per-rigor `WorkflowRecipeDraft` end-to-end: walk items from
   `starts_at`, look up a registered primitive handler, thread typed
   evidence between items via a contract-keyed ledger, follow the
   draft's resolved per-outcome edges, and stop on the four terminal
   targets (`@complete`, `@stop`, `@handoff`, `@escalate`). Default
   handlers cover all eight Fix-shape primitives. A demo Fix-Lite
   recipe at `tests/fixtures/recipe-runtime/fix-lite.recipe.json` runs
   eight primitives end-to-end (`intake → route → frame → gather-context
   → diagnose → act → run-verification → close-with-evidence →
   @complete`).
2. `feat: recipe runtime dispatcher injection seam`. Adds
   `RecipeDispatcher`, `dispatchHandler`, and `dispatchedWorkerHandlers`
   so dispatch-kind primitive items can be routed through a pluggable
   worker (the next consumer is the existing agent / codex adapter).
3. `feat: persist recipe runs as recipe-run.json under run root`. Adds
   `persistRecipeRun(runRoot, recipeId, result)` and the
   `recipeRunArtifact` serializer. The substrate stays pure / in-memory;
   persistence is a separate helper.

The substrate is intentionally parallel to `src/runtime/runner.ts`, not
inside it. The existing `executeDogfood` loop still owns the event-log,
manifest-snapshot, and real-dispatch machinery for the hardcoded Build,
Explore, and Review paths. The substrate has no event log and no real
dispatch yet — that's deliberate so we can iterate on its shape before
paying integration costs.

`npm run verify` is green: 794 tests (11 new in `tests/unit/recipe-
runtime/`), lint clean, tsc clean, build clean.

## What's next

The substrate now has enough surface area for a real review. The next
choice is architectural — pick one direction and commit to it.

1. **Bridge the dispatcher seam to the existing agent / codex adapter.**
   The `RecipeDispatcher` interface is in place; what's missing is a
   small adapter that takes a `RecipeDispatcherInput`, composes a
   prompt from the recipe item's input bindings, calls the existing
   `DispatchFn`, parses the response body as the typed output, and
   maps the verdict to a `WorkflowPrimitiveRoute`. After this,
   `gather-context`, `diagnose`, and `act` can run real LLM dispatches
   inside a recipe.
2. **Express Build, Explore, Review as recipes.** Each is currently
   hardcoded in `runner.ts`. Authoring them as `WorkflowRecipe`
   fixtures and routing the runner's entry points through the
   substrate retires the per-workflow code paths in `executeDogfood`.
   This is the larger architectural win and should land after #1 so
   the dispatch path is real.
3. **Promote `fix-lite` to the full Fix recipe.** The real Fix lives
   at `specs/workflow-recipes/fix-candidate.recipe.json` and includes
   the human-decision branch and the handoff branch. Wiring it through
   the substrate needs a checkpoint adapter (host primitive) and a
   handoff writer.
4. **Bind substrate runs into the run-root event log.** Persistence
   today writes a single `recipe-run.json`; the existing `runner.ts`
   pipeline writes a typed event log. If recipes graduate to first-
   class runs, the substrate should emit `step.entered`, `dispatch.*`,
   `gate.evaluated`, `run.closed` events the same way `executeDogfood`
   does, so the same reducer / snapshot tooling applies.

Codex usage is AGENTS.md rule #7: pull Codex in for impactful, hard-to-
revert decisions and for genuine stuck-after-real-attempts diagnosis;
default off otherwise. No challenger passes on plans.
