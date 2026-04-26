# HANDOFF

Last updated: 2026-04-25 (recipe runtime substrate v0 session).

## Where we are

The recipe runtime substrate v0 is in place at
`src/runtime/recipe-runtime/`. It runs a `WorkflowRecipe` plus a per-rigor
`WorkflowRecipeDraft` end-to-end: it walks items from `starts_at`,
consults the draft's resolved edges per outcome, looks up a registered
primitive handler, threads typed evidence between items via a contract-
keyed ledger, and stops cleanly on the four terminal targets
(`@complete`, `@stop`, `@handoff`, `@escalate`).

A demo Fix-Lite recipe at `tests/fixtures/recipe-runtime/fix-lite.recipe.json`
composes eight primitives end-to-end through the substrate: `intake →
route → frame → gather-context → diagnose → act → run-verification →
close-with-evidence → @complete`. Default orchestrator and worker
handler registries cover those eight primitives with deterministic
synthesis-grade outputs (the worker handlers are stubs — they do not
spawn a real adapter yet). The substrate contract test exercises both
the smaller demo recipe and the fix-lite recipe and asserts trace order,
evidence propagation, missing-input rejection, unknown-outcome
rejection, and recipe/draft id mismatch rejection.

The substrate is intentionally parallel to `src/runtime/runner.ts`, not
inside it. The existing `executeDogfood` loop still owns the
event-log/manifest/dispatch-adapter machinery for Build, Explore, and
Review. The substrate has no event log, no manifest snapshot, and no
real dispatch — that's deliberate so we can iterate on the substrate's
shape before paying integration costs.

`npm run verify` is green: 790 tests, lint clean, tsc clean, build
clean.

## What's next

The substrate is at its useful minimum. The next round of work has a
few independent directions; pick based on what the operator wants to
prove.

1. **Wire a real dispatcher into worker handlers.** Right now `gather-
   context`, `diagnose`, `act` synthesize their outputs in process.
   Add a `DispatchWorker` injection seam so a recipe item with
   `execution.kind === 'dispatch'` can call the existing `dispatch-
   materializer` / `agent` adapter and parse the typed result through
   the substrate's evidence ledger.
2. **Express Build/Explore/Review as recipes.** Each is currently
   hardcoded in `runner.ts`. Authoring them as `WorkflowRecipe`
   fixtures and routing the runner's entry points through the
   substrate is the larger win — it retires the per-workflow code
   paths in `executeDogfood`. This should land after #1 so the dispatch
   path is real.
3. **Promote `fix-lite` to a real Fix recipe.** Today's fix-lite is a
   demo over stub handlers. The real Fix recipe lives at
   `specs/workflow-recipes/fix-candidate.recipe.json` and includes the
   human-decision and handoff branches. Wiring it through the substrate
   needs a checkpoint adapter (host primitive) and a handoff writer.
4. **Persistence.** The substrate keeps the evidence ledger and trace
   in memory only. For real workflow runs, both should land on disk in
   the run-root so the result is durable across processes. The simplest
   first cut is to write each item's typed output as
   `<run-root>/recipe/<item-id>.json` and a final `recipe-trace.json`.

Codex usage is AGENTS.md rule #7: pull Codex in for impactful, hard-to-
revert decisions and for genuine stuck-after-real-attempts diagnosis;
default off otherwise. No challenger passes on plans.
