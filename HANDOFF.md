# HANDOFF

Last updated: 2026-04-27 — Sessions 1 + 2 + 3 of the test-quality backlog complete. Session 1: lint cleared, invariant-ledger meta-test landed, CI workflow live. Session 2: ledger triage done, coverage tooling added, fast/slow split added. Session 3: slice vocabulary stripped from comments / test names, anti-vacuity floors added to discovery-loop tests, real-recursion integration test for sub-run landed.

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

932 tests pass, 6 skipped. tsc clean, biome clean, drift clean.
`npm run verify` is green on origin. CI workflow at
`.github/workflows/verify.yml` mirrors the gate on every push and PR
to `main`. `npm run verify:fast` is the tight-loop alternative
(~40% wall time off; excludes subprocess-heavy `tests/runner/**`).
`npm run test:coverage` produces a baseline report at
`coverage/`; current sources stand at 84.7% lines / 82% branches /
94.6% functions (informational, no thresholds enforced).

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
- State: **done** in `116dafc` (2026-04-27). 46 biome errors cleared:
  33 fixed by `biome check --write`, 10 cosmetics applied via
  `--unsafe` (prose-only `noUnusedTemplateLiteral` — backtick →
  quote, zero behavior change), 1 `noImplicitAnyLet` cleared by
  restructuring a try/catch in `catalog-completeness.test.ts`.

**FU-T02a. Meta-test for invariant-ledger binding completeness.**
- State: **done** in `e9cf64e` (2026-04-27). Test at
  `tests/contracts/invariant-ledger-bindings.test.ts` walks every
  `binding_refs[].path` in `specs/invariants.json` and asserts each
  resolves on disk. Anti-vacuity floor on total ref count. Now
  un-skipped and active (FU-T02b cleared the data).

**FU-T02b. Triage the 15 stale invariant bindings.**
- State: **done** in `3abf0ad` (2026-04-27). Root cause: the
  methodology strip (commit `60b1263`, 2026-04-25) deleted 5 test
  files without cleaning the corresponding ledger entries. Triage
  by class:
  - **Class A (2 invariants)** — real contract claims with dead
    binding paths. ADAPTER-I10 → repointed to
    `tests/contracts/schema-parity.test.ts`. EXPLORE-I1 →
    repointed to `tests/contracts/workflow-kind-policy.test.ts`.
    Anchor tokens added to the relevant describe/it titles so
    the `test_title` binding semantic is honest.
  - **Class B (13 invariants)** — behavioral disciplines whose
    underlying methodology was deliberately stripped. Downgraded
    `enforcement_state` from `test-enforced` → `prose-only` and
    added a `rationale` field naming commit `60b1263` and the
    specific reason no machine-enforceable surface remains.
    Pattern matches the existing CHALLENGER-I2/I6 + PROSE-YAML-I3
    prose-only entries in the same file.

**FU-T03. CI workflow.**
- State: **done** in `1c0f0f0` (2026-04-27).
  `.github/workflows/verify.yml` runs `npm ci && npm run verify` on
  every push and PR to `main`. Node 22, npm cache enabled. No matrix
  — minimal mirror of the canonical gate. Lands green because
  FU-T01 cleared the baseline and FU-T02a is `it.skip`'d.
- Operator follow-up: flip required-before-merge in branch
  protection after the first run lands green.

### P1 — observability + agent feedback loop

**FU-T04. Coverage tooling.**
- State: **done** in `64d20ea` (2026-04-27). `@vitest/coverage-v8`
  pinned to vitest's version. `vitest.config.ts` configures the v8
  provider for `src/**/*.ts` with text + html + json-summary
  reporters. New `test:coverage` script. NO thresholds (coverage
  as info, not enforcement). Baseline: 84.7% lines / 82% branches /
  94.6% functions.

**FU-T05. Fast/slow test split.**
- State: **done** in `f29a6dd` (2026-04-27). New scripts:
  - `test:fast` — vitest excluding `tests/runner/**` (subprocess-
    heavy). 666 of 936 tests; ~5s wall vs ~13s for full.
  - `verify:fast` — check + lint + build + test:fast + drift.
    ~12s wall vs ~20s for full (~40% off).
  Convention documented in AGENTS.md: use `verify:fast` during
  iteration, full `verify` before claiming completion. CI runs
  full `verify`.

**FU-T06. Real recursion integration test (sub-run / fanout).**
- State: **done** in `b26eb64` (2026-04-27). New file
  `tests/runner/sub-run-real-recursion.test.ts` omits the
  `childRunner` stub so the runner defaults to `runWorkflow` itself
  and recurses end-to-end. Parent has a single sub-run step; child
  has a single dispatch step served by a fake `acceptingDispatcher`.
  Hermetic, ~12ms. Verifies child has its own run-root + event log
  with its own run_id, dispatch lifecycle events fire on the child
  (proof the child step actually ran), child's result.json is
  authored via the real result-writer and copied verbatim into the
  parent's writes.result slot, parent's gate admits the verdict.
  Sister to `tests/runner/sub-run-runtime.test.ts` (handler-isolation
  unit test).
- Fanout real-recursion test deferred — same pattern would apply,
  but fanout has additional fanout-specific surface that warrants a
  separate hermetic case.

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
- State: **done** in `14f78ea` (2026-04-27). Floors added to:
  `tests/contracts/schemas-barrel.test.ts` (modules >= 10),
  `tests/contracts/engine-workflow-boundary.test.ts` (4 walks: src/
  runtime / inspected workflow packages / src / tests),
  `tests/contracts/catalog-completeness.test.ts` (workflow-package
  count + WORKFLOWS_ROOT entry count). Pattern reference:
  `tests/runner/catalog-derivations.test.ts` (already had floors
  pre-this work).

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
- State: **done** in `3983ff7` (2026-04-27). Three sweep passes
  cleared ~230 references across 41 files (net -134 lines): slice
  tags (`Slice 27d`, `slice-43a-`, `(Slice 47c-2)`); Codex
  challenger tags (`Codex HIGH #1 fold-in`, `Codex MED #4`,
  references to deleted `specs/reviews/*.md`); bare review tags
  (`(adversarial-review MED #7)`, `Codex review`, `MED #6.b:`).
  Invariant IDs preserved; technical content preserved; only
  historical scaffolding dropped. mkdtemp prefix strings renamed
  from `'slice-42-roundtrip-'` style to descriptive
  `'agent-dispatch-roundtrip-'` style.

### Recommended order across sessions

Sessions 1 + 2 closed. The full P0 trio (FU-T01, FU-T02a, FU-T03) +
FU-T02b's triage + the two mechanical P1 items (FU-T04, FU-T05) all
landed. The verify gate is green, CI mirrors it, the invariant
ledger is honest, coverage is observable, and the inner loop has a
fast-path. Session 3 cleared FU-T13 (slice-vocabulary residue),
FU-T08 (anti-vacuity floors), and FU-T06 (real recursion integration
test for sub-run). Session 4+ remaining: FU-T07 (failure-message
helpers naming the invariant, ~2h), FU-T09 (mega-file splits —
verify current sizes first, ~3-4h), FU-T10 (collapse
plugin-command-invocation prose pins, ~1h), FU-T11 (direct
step-handler tests, ~3-4h), FU-T12 (property-test expansion,
~2-3h per area). A fanout-side companion to FU-T06 also fits the
remaining work — same hermetic-recursion approach applied to the
fanout step kind.

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
