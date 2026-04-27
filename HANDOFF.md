# HANDOFF

Last updated: 2026-04-27 — workflow catalog reorganization complete (13 commits prior session) + workflow-package boundary cleanup (4 commits, latest `bf36335`).

## Where we are

Each workflow now lives in its own folder under `src/workflows/<id>/`,
and the engine has no per-workflow code. Adding a workflow means
creating a folder and adding it to one catalog file — the runtime
discovers everything through that catalog.

Before this session, the same Build workflow had pieces in seven
places: a recipe under `specs/workflow-recipes/`, a slash command in
`commands/`, a contract in `specs/contracts/`, four writer files
spread across `src/runtime/registries/{synthesis,close,verification,checkpoint}-writers/`,
a dispatch shape hint in `src/runtime/registries/shape-hints/`, plus router and
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

929 tests pass, 6 skipped (was 918 at end of catalog-reorg session;
the four boundary-cleanup commits added 11 net tests minus the one
tautological catalog-completeness assertion deleted in `bf36335`).
tsc clean, drift clean. **Lint is red** — 47 pre-existing biome
errors on origin/main (mostly formatting/import-organization). Treat
`npm run verify` as red until that's tackled. See "Test quality
follow-ups" below for the prioritized work.

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

2. **Test quality follow-ups** — see the "Test quality follow-ups"
   section below for the full prioritized list. Two external LLM
   reviews surfaced ~10 concrete items; the highest-leverage ones are
   the lint cleanup (P0), the stale invariant ledger bindings (P0/P1,
   15 broken refs in `specs/invariants.json`), and adding a CI
   workflow.

3. **Generalize BuildBrief-specific resume validation**. The runner
   still has a hardcoded `'build.brief@v1'` check inside
   `readCheckpointBuildBrief` because the resume-context validator is
   BuildBrief-specific. Generalizing would extend `CheckpointBriefBuilder`
   with a `validateResumeContext?` method. Tracked because the catalog
   refactor closed every other engine→workflow leak; this one is the
   last residue.

## Test quality follow-ups

Captured 2026-04-27 from two external LLM reviews of the test suite.
Multi-session backlog; pick any item, ship, mark done. Effort
estimates assume an LLM-paced session.

### P0 — quality-signal-blocking

**FU-T01. Lint cleanup — restore `npm run verify` to green.**
- State: open. 47 biome errors on origin/main, mostly formatting +
  import-organization. None introduced by recent work; pre-existing
  baseline.
- Fix: `npx biome check --write` (auto-fix) for the safe class, then
  manual pass on residual. Single commit.
- Why it matters: a red canonical gate trains agents to ignore the
  signal. This is the single highest-leverage move for agent
  effectiveness.
- Effort: ~30 min.

**FU-T02. Stale invariant ledger bindings.**
- State: open. `specs/invariants.json` has 15 `test-enforced`
  bindings pointing at non-existent test files (per Reviewer #2's run
  of the suite). Named offenders include
  `tests/contracts/cross-model-challenger.test.ts`,
  `tests/contracts/session-hygiene.test.ts`,
  `tests/contracts/prose-yaml-parity.test.ts`,
  `tests/contracts/artifact-authority.test.ts`,
  `tests/contracts/spine-coverage.test.ts`. Verify the count before
  acting — claim was made against a slightly older snapshot.
- Fix: (a) Add a meta-test that fails when any
  `binding_refs[].path` doesn't exist on disk. (b) For each broken
  binding, either create the missing test or downgrade the invariant
  to the correct enforcement state.
- Why it matters: the ledger is supposed to be agent truth.
  Lying-by-omission about test-enforcement is the worst class of
  spec drift in an agent-driven codebase.
- Effort: ~1-2 hours (mostly the meta-test + spec edits; new tests
  may stretch this).

**FU-T03. Add CI workflow.**
- State: open. No `.github/workflows/` exists today.
- Fix: minimal `verify.yml` running `npm ci && npm run verify` on
  push and PR. Make required before merge once green.
- Dependency: FU-T01 must land first or CI is permanently red.
- Effort: ~30 min.

### P1 — observability + agent feedback loop

**FU-T04. Coverage tooling.**
- State: open. `@vitest/coverage-v8` is not in package.json. Running
  `npx vitest run --coverage` fails out of the box.
- Fix: install the provider, commit a `vitest.config.ts` coverage
  config (sources `src/**/*.ts`, exclude `dist/`), add a
  `test:coverage` script. Run baseline. **Do not set thresholds** —
  per the methodology-strip rule, ratchets stay cut until concrete
  pain justifies them. Coverage as info, not enforcement.
- Effort: ~30 min.

**FU-T05. Fast/slow test split.**
- State: open. Runner suite is ~237s serial. `build-runtime-wiring`
  alone is 72-85s; `cli-router` ~40s; `sweep-runtime-wiring` ~44s.
  Most of the time is real subprocess spawning.
- Fix: add `verify:fast` (tsc + biome + contracts + unit + properties
  + drift) and `verify:full` (everything including runner). Agents
  default to fast; use full before claiming completion.
- Why it matters: a slow suite changes agent behavior — they run
  fewer checks or only the ones they think are relevant. That
  increases risk.
- Effort: ~30 min (script-level; no test rewrites required).

**FU-T06. Real recursion integration test (sub-run / fanout).**
- State: open, flagged by both reviewers and prior HANDOFF. Every
  parent sub-run/fanout test stubs `childRunner`; no test proves
  real recursive child execution end-to-end.
- Fix: one small hermetic integration test — parent workflow with a
  sub-run, child resolved through real resolver, real `runWorkflow`
  for the child, fake dispatcher, assertions on parent + child event
  logs and the copied result.
- Why it matters: sub-run/fanout is substrate-critical and currently
  trust-by-stubbing.
- Effort: ~2-3 hours.

### P2 — maintainability + agent repair ergonomics

**FU-T07. Failure-message helpers naming the invariant.**
- State: open. Most assertions name the bad value, not the violated
  concept.
- Fix: helpers like `expectWorkflowRejected(recipe, "WF-I10: pass
  routes must target canonical outcome ids")`. Apply selectively to
  high-traffic contract tests.
- Why it matters: agents repair faster when the failure names the
  invariant + intended behavior.
- Effort: incremental — add as a helper module, migrate as test
  files are touched. ~2 hours for an initial helper + ~5 high-value
  conversions.

**FU-T08. Anti-vacuity check pattern.**
- State: open. `catalog-derivations.test.ts` already does this
  (asserts catalog floor). Generalize wherever a test loops over a
  dynamic collection.
- Fix: add `expect(x.length).toBeGreaterThanOrEqual(MIN)` (or
  `.toBeGreaterThan(0)`) to discovery loops.
- Why it matters: agents break discovery logic in ways that make
  tests vacuously pass.
- Effort: ~1 hour for an initial sweep across high-traffic files.

**FU-T09. Mega-file splits.**
- State: open. Reviewer flagged `contracts/schema-parity.test.ts` at
  4,159 lines and Build tests at 4 files / ~2,435 lines. Verify
  current sizes before acting — may have shrunk since the prior
  HANDOFF.
- Fix: split `schema-parity.test.ts` by invariant family
  (gate-schema, step-schema, selection-schema, workflow-graph,
  workflow-path-safety, skill-schema, pass-route-policy). Extract
  shared builders to `tests/helpers/`.
- Why it matters: smaller failure neighborhoods → faster agent
  repair.
- Effort: ~3-4 hours (large diff, ratifying refactor).

**FU-T10. Collapse `plugin-command-invocation.test.ts` brittle
doc-shape pins.**
- State: open. ~19 doc-shape assertions; reviewer recommends keeping
  the shell-injection regression + 1 smoke and dropping prose pins.
- Fix: keep — shell-injection regression, every generated command
  has at least one executable invocation, invocation resolves to the
  intended CLI entrypoint, manifest exposes every generated command.
  Drop — exact prose pins, markdown-shape assertions, duplicated
  "docs mention X" checks.
- Why it matters: agents are especially prone to satisfying brittle
  text tests while damaging behavior.
- Effort: ~1 hour.

**FU-T11. Direct tests for step-handlers.**
- State: open. `src/runtime/step-handlers/*.ts` has 0/9 direct
  imports from tests (transitively covered through runner suites).
- Fix: priority targets — `dispatch.ts`, `checkpoint.ts`,
  `verification.ts`, `sub-run.ts`, `fanout.ts`. One direct test file
  each, focused on the handler's own responsibilities (parsing
  step config, returning step results, error paths). Not a
  duplicate of runner tests.
- Why it matters: localized failures help agents fix the right
  layer.
- Effort: ~3-4 hours.

**FU-T12. Property-test expansion.**
- State: open. Currently 2 property test files / ~141 LOC, both
  Review. `tests/properties/hidden/` is empty.
- Fix: add property tests for workflow graph closure, route
  collision/tie-breaking, artifact pointer normalization,
  checkpoint/resume state transitions, fanout join policies,
  cross-artifact authority references. Deterministic table loops
  are fine — property-test dependency not required initially.
- Effort: ~2-3 hours per area.

**FU-T13. Slice-vocabulary residue sweep.**
- State: open, carried from prior session. The two filename renames
  are done, but adjacent test files (codex-dispatch-roundtrip,
  agent-dispatch-roundtrip, runtime-smoke,
  runner-dispatch-adapter-identity, etc.) still carry "Slice N"
  references. Per methodology-strip, this vocabulary is gone from
  the rest of the codebase and should be cleaned out of these
  files.
- Effort: ~30 min — pure rename / comment cleanup.

### Recommended order across sessions

The first three (FU-T01, FU-T02, FU-T03) are ~3 hours total and
address the actual quality-signal problems both reviewers flagged.
Land them first. The rest can pace.

## Notes

- Six adversarial subagent reviews ran during the catalog-reorg
  session (one per phase). Findings were triaged inline; CRITICAL/
  HIGH always addressed before the next phase. The Phase-4 review
  caught two CRITICAL test-framing issues (a "wrap" test that didn't
  exercise the wrap; a fanout test that never asserted the parent
  outcome) and three HIGH vacuous-pass risks — all fixed in the
  f43b93b follow-up commit.
- specs/ is now mostly the engine-wide ledgers (artifacts.json,
  invariants.json, domain.md), behavioral notes, and legacy-circuit
  reference. Workflow-specific material, generic engine contracts,
  and workflow design notes all moved out.
