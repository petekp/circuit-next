# HANDOFF

Last updated: 2026-04-25 (post-strip cleanup session).

## Where we are

Heavy methodology stripped: ADRs, plan-lint, audit machinery, slice
ceremony, challenger loops, plan-of-plans recursion, the chronicle, the
per-arc review folder, and the auto-firing handoff hooks. Plugin product
intact — workflow recipes, schemas, runtime, the working Build and
Explore workflows, the wired Review workflow.

`npm run verify` is green: 783 tests, lint clean, tsc clean, build clean.

The workflow primitive layer is built on paper but not wired into the
runtime. The primitive catalog, the recipe schema with route-aware
availability and per-rigor draft compilation, and a design-only Fix
recipe are all in place. The runner does not yet consume
`WorkflowRecipe` — `src/runtime/runner.ts` still hardcodes
Build/Explore/Review.

A short cleanup pass is in flight to remove dead ADR/review pointers
from spec frontmatter and a couple of legacy lines in
`specs/artifacts.json` and `specs/domain.md`. Runtime files keep their
slice-numbered comments for now; that's a separate, more invasive sweep.

## What's next

The decided next slice is the recipe runtime substrate: teach the
runner to consume a `WorkflowRecipeDraft` and dispatch its primitive
items. Build, Explore, and Review become first consumers of that
substrate by being expressed as recipes; Fix becomes the first new
workflow that ships through it. That work pays off for every later
recipe and is the productive use of the primitive design that's already
authored.

Codex usage is now AGENTS.md rule #7: pull Codex in for impactful,
hard-to-revert decisions and for genuine stuck-after-real-attempts
diagnosis; default off otherwise. No challenger passes on plans.
