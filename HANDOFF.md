# HANDOFF

Last updated: 2026-04-27 — workflow catalog reorganization complete (13 commits this session).

## Where we are

Each workflow now lives in its own folder under `src/workflows/<id>/`,
and the engine has no per-workflow code. Adding a workflow means
creating a folder and adding it to one catalog file — the runtime
discovers everything through that catalog.

Before this session, the same Build workflow had pieces in seven
places: a recipe under `specs/workflow-recipes/`, a slash command in
`commands/`, a contract in `specs/contracts/`, four writer files
spread across `src/runtime/{synthesis,close,verification,checkpoint}-writers/`,
a dispatch shape hint in `src/runtime/shape-hints/`, plus router and
artifact-schema entries hardcoded inside the runtime. After this
session, all of that lives in `src/workflows/build/`, and the runtime
loads it generically through `src/workflows/catalog.ts`. The same is
true for Explore, Fix, Migrate, Review, and Sweep.

The cleanup also moved the engine-wide contract docs from
`specs/contracts/` to `docs/contracts/` and the workflow design notes
from `specs/workflow-*.md` to `docs/workflows/`. `commands/build.md`,
`explore.md`, `fix.md`, and `review.md` are now generated copies of
the source files in each workflow folder; the emit script drift-checks
them on every `npm run verify`. `commands/run.md` stays hand-authored
because it's the CLI router entry, not a workflow — there's a comment
at the top of the file noting that.

## Tests

918 tests pass (up from 884 at session start), 6 skipped. Verify is
green: tsc clean, biome clean, drift check byte-identical for every
generated file.

New tests added during the session:
- `tests/runner/catalog-derivations.test.ts` — 21 tests covering every
  catalog throw path plus a runtime-parity check that walks every
  WorkflowPackage's writers and confirms each resolves through the
  live registry.
- `tests/runner/router-routing-invariants.test.ts` — 6 tests
  isolating routing.order precedence, isDefault selection, and
  skipOnPlanningArtifact suppression against synthetic mini-catalogs.
- `tests/contracts/engine-workflow-boundary.test.ts` — 4 tests
  enforcing that nothing under `src/runtime/` imports a per-workflow
  module other than the catalog or shared types. Catches dynamic
  imports, side-effect imports, and re-exports — a direct future
  workflow-coupling regression flips this red.
- `tests/runner/handler-throw-recovery.test.ts` — added a second case
  for synthesis-handler-local error recovery (alongside the existing
  unsupported-kind case for the runStepHandler wrap).
- `tests/runner/fanout-runtime.test.ts` — added two cases for the
  fanout `continue-others` and `abort-all` failure paths, including
  multi-branch worktree cleanup pinning.

Test sharpening:
- `tests/runner/dispatch-shape-hint-registry.test.ts` — expected hint
  set is now derived from the catalog (with a non-zero floor so it
  can't pass vacuously).
- `tests/contracts/workflow-router.test.ts` — set-membership
  comparison instead of brittle insertion order.
- 4 pre-existing biome lint errors fixed so `npm run verify` is
  cleanly green.

## What's next

Picking from this menu (operator choice):

1. **Continue substrate work**. The pre-session continuity menu listed
   four substrate slices — push (done), WorktreeRunner CLI wiring,
   real Inventory dispatcher, nested checkpoint sub-run resume. These
   are now cheaper to land on the catalog-clean ground.

2. **Deferred-but-flagged test work** that didn't fit overnight scope:
   - `plugin-command-invocation.test.ts` collapse (19 doc-shape pins
     down to 1 shell-injection safety pin + a smoke). Deferred because
     dropping assertions is the kind of decision that benefits from
     explicit operator approval.
   - Build test consolidation — 4 files, ~2435 lines for one workflow.
   - `contracts/schema-parity.test.ts` split — 4159 lines in one file
     is a maintenance liability.
   - Real-recursion sub-run/fanout test — every parent test stubs the
     `childRunner`. Replacing one stub with the actual `runWorkflow`
     would prove the recursion path; this is substrate-shaped work,
     not test-audit work.

3. **Generalize BuildBrief-specific resume validation**. The runner
   still has a hardcoded `'build.brief@v1'` check inside
   `readCheckpointBuildBrief` because the resume-context validator is
   BuildBrief-specific. Generalizing would extend `CheckpointBriefBuilder`
   with a `validateResumeContext?` method. Tracked because the catalog
   refactor closed every other engine→workflow leak; this one is the
   last residue.

## Notes

- Six adversarial subagent reviews ran during the session (one per
  phase). Findings were triaged inline; CRITICAL/HIGH always addressed
  before the next phase. The Phase-4 review caught two CRITICAL test-
  framing issues (a "wrap" test that didn't exercise the wrap; a
  fanout test that never asserted the parent outcome) and three HIGH
  vacuous-pass risks — all fixed in the f43b93b follow-up commit.
- The methodology-strip alignment (slice vocabulary off the test
  surface) is partial: the two filename renames are done, the
  vocabulary is gone from those two files, but adjacent test files
  (codex-dispatch-roundtrip, agent-dispatch-roundtrip,
  runtime-smoke, runner-dispatch-adapter-identity, etc.) still carry
  some "Slice N" references. Easy follow-up sweep.
- specs/ is now mostly the engine-wide ledgers (artifacts.json,
  invariants.json, domain.md), behavioral notes, and legacy-circuit
  reference. Workflow-specific material, generic engine contracts,
  and workflow design notes all moved out.
