# HANDOFF

Last updated: 2026-04-28 — Sessions 1-9 of the test-quality backlog complete. Session 1: lint cleared, invariant-ledger meta-test landed, CI workflow live. Session 2: ledger triage, coverage tooling, fast/slow split. Session 3: slice vocabulary stripped, anti-vacuity floors, real-recursion sub-run test. Session 4: prose-pin collapse, real-recursion fanout test. Session 5: direct unit tests for the dispatch and sub-run step handlers (FU-T11 parts 1 + 2 of 5). Session 6: direct unit tests for the checkpoint, verification, and fanout step handlers (FU-T11 parts 3-5 of 5 — FU-T11 now fully closed). Session 7: failure-message helper module + 5 high-value conversions (FU-T07 closed). Session 8: split `tests/contracts/schema-parity.test.ts` (4156 lines / 359 tests) into 11 per-invariant-family files with two shared builder modules under `tests/helpers/`; all 80 ledger binding_refs repointed (FU-T09 closed). Session 9: 4 of 6 FU-T12 areas closed (property-test expansion across workflow graph closure, fanout join policies, artifact pointer normalization, and route collision/tie-breaking); 7 `*.prop.*` ledger entries flipped from `phase2-property` to `test-enforced`; small `evaluateFanoutJoinPolicy` extraction to make the fanout join decision a pure helper.

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

1010 tests pass, 6 skipped across 89 test files. Session 9 added
four new property-test files under `tests/properties/visible/` — the
test count rose by 13 vitest cases (each property file exercises
hundreds of inner cases via deterministic mulberry32 loops, but
counts as a small number of vitest top-level cases). tsc clean, biome clean, drift clean.
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
- State: **done** across `b26eb64` + `f5647d7` (2026-04-27). Two
  hermetic no-stub tests that omit `childRunner` so the runner
  defaults to `runWorkflow` itself and recurses end-to-end.
  - `tests/runner/sub-run-real-recursion.test.ts` (single-child
    case): parent has a single sub-run step, child has a single
    dispatch step served by a fake `acceptingDispatcher`. Verifies
    child has its own run-root + event log + run_id, dispatch
    lifecycle events fire on the child, child's result.json is
    authored via the real result-writer and copied verbatim into the
    parent's writes.result slot, parent's gate admits the verdict.
  - `tests/runner/fanout-real-recursion.test.ts` (multi-child case):
    parent has a fanout step with two static branches under
    aggregate-only join. Verifies each branch produces a distinct
    fresh run_id, each child has its own event log with the right
    run_id and the dispatch lifecycle events, each result.json
    carries the child's run_id and verdict, the aggregate artifact
    materializes, parent admits via fanout.joined.
  Sisters to `tests/runner/sub-run-runtime.test.ts` and
  `tests/runner/fanout-runtime.test.ts` (handler-isolation unit
  tests).

### P2 — maintainability + agent repair ergonomics

**FU-T07. Failure-message helpers naming the invariant.**
- State: **done** across `7a715f7` + `921ce07` (2026-04-28). New
  module `tests/helpers/failure-message.ts` exposes five high-level
  helpers (`expectSchemaRejects`, `expectSchemaAccepts`,
  `expectStepAborted`, `expectStepAdvance`,
  `expectStepWaitingCheckpoint`) plus a primitive formatter
  (`invariantMessage(rule, detail?)`) for ad-hoc cases. Step-handler
  helpers double as `asserts result is ...` type narrows so callers
  no longer write the `if (result.kind !== 'aborted') throw` preamble
  manually. 15 self-tests at
  `tests/helpers/failure-message.test.ts` pin both positive and
  negative paths (negatives capture the failure and assert the rule
  string appears in the message).
- Convention for the rule string: `"<INVARIANT-ID>: <claim>"` when the
  invariant exists in `specs/invariants.json`; plain prose with a
  domain-prefixed claim otherwise (e.g., `"dispatch handler: a
  result_body that is not valid JSON aborts with a parse-failure
  reason"`).
- 5 high-value conversions landed (one per helper-shape, 4 files, 4
  invariant families): STEP-I1 dispatch mismatch in
  `schema-parity.test.ts`; advance-on-pass + parse-failure abort in
  `dispatch-handler-direct.test.ts`; childWorkflowResolver-undefined
  abort in `sub-run-handler-direct.test.ts`; deep-rigor waiting in
  `checkpoint-handler-direct.test.ts`. Future test files migrate to
  the helper as they're touched — no big-bang rewrite needed.

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
- State: **done** in Session 8 (2026-04-28). Original
  `tests/contracts/schema-parity.test.ts` (4,156 lines / 359 tests)
  split into 11 per-invariant-family files alongside
  `tests/contracts/`:
  - `declaration-primitives.test.ts` — `Rigor`, `Role`,
    `LaneDeclaration` (6 tests, no invariant family).
  - `gate-schema.test.ts` — `Gate` discriminated union (3 tests).
  - `skill-schema.test.ts` — SKILL-I1..I6 (19 tests).
  - `step-schema.test.ts` — STEP-I1..I9 (25 tests).
  - `workflow-graph-schema.test.ts` — WF-I1..I11 (17 tests).
  - `workflow-path-safety-schema.test.ts` — PHASE-I1..I6 (19 tests).
  - `runlog-schema.test.ts` — RUN-I1..I8 + Event/Snapshot bootstrap
    (79 tests).
  - `continuity-schema.test.ts` — CONT-I1..I12 (40 tests).
  - `selection-schema.test.ts` — SEL-I1..I9 (64 tests).
  - `adapter-schema.test.ts` — ADAPTER-I1..I11 + Config+adapter
    registry parity (61 tests).
  - `config-schema.test.ts` — CONFIG-I1..I8 (26 tests).
  Two shared builder modules extracted to `tests/helpers/`:
  `runlog-builders.ts` (RUN_A, RUN_B, lane, bootstrapAt,
  stepEntered, runClosed — RUN_A also imported by
  `adapter-schema.test.ts` for DispatchStartedEvent fixtures) and
  `continuity-builders.ts` (CONT_RUN, CONT_NARRATIVE,
  CONT_RUN_PROVENANCE). Per-describe-block scoped helpers
  (`baseSynthesis`, `okWorkflow`, etc) stayed local to their family
  file. Invariant tokens (STEP-I, WF-I, ADAPTER-I, …) preserved in
  describe/it titles so the invariant-ledger semantic is intact.
  All 80 `binding_refs[].path` entries in `specs/invariants.json`
  repointed from `schema-parity.test.ts` to the appropriate family
  file.

**FU-T10. Collapse `plugin-command-invocation.test.ts` brittle
doc-shape pins.**
- State: **done** in `e7f61e9` (2026-04-27). Dropped 6 `it` blocks
  (~26 individual expects) of prose / doc-shape pins. Kept the
  shell-injection regression block, the four positive
  executable-invocation tests (one per command), the
  direct-launcher correctness check, the negative-fixture predicate
  tests, and the manifest-exposure tests (split into one `it` per
  command for clearer failure attribution). Removed the now-unused
  `PLACEHOLDER_STRING` constant and `hasEntryModeAndRigorInvocation`
  helper.

**FU-T11. Direct tests for step-handlers.**
- State: **done.** All five priority targets covered.
  - `tests/runner/dispatch-handler-direct.test.ts` (commit
    `0210fab`, 2026-04-27, 11 cases): full lattice of
    evaluateDispatchGate failure paths (parse / non-object / no
    verdict / not-in-pass), adapter throw, plus three event-sequence
    shape tests.
  - `tests/runner/sub-run-handler-direct.test.ts` (commit `6ed7948`,
    2026-04-27, 10 cases): early aborts (divergent artifact path,
    missing resolver, resolver throw, wrong workflow id), child
    failures (child runner throw, checkpoint_waiting), and the full
    evaluateChildVerdict shape lattice.
  - `tests/runner/checkpoint-handler-direct.test.ts` (commit
    `7a4ee40`, 2026-04-27, 14 cases): resolution-lattice branches
    (waiting at deep/tournament rigor, failed-resolution at
    standard/autonomous without safe choices, resolved at
    standard/autonomous/lite), operator resume, post-resolution
    selection-not-in-gate.allow throw, three event-sequence anchors,
    and one artifact-content assertion. The deep/tournament cases
    use a `primeBootstrap` helper to seed events.ndjson because
    `writeDerivedSnapshot` reads from disk.
  - `tests/runner/verification-handler-direct.test.ts` (commit
    `ff88f44`, 2026-04-27, 5 cases): scoped to the two error
    branches reachable without a registered verification writer
    (projectRoot undefined fires before the registry call,
    unsupported artifact schema fires when findVerificationWriter
    returns undefined). The verification-writers registry is closed
    by design and built at module load from workflowPackages, so
    the spawn-subprocess and builder.buildResult branches stay
    covered through runner-level tests using real workflow packages.
  - `tests/runner/fanout-handler-direct.test.ts` (commit `0cbccd7`,
    2026-04-27, 15 cases): pre-execution aborts
    (childWorkflowResolver/projectRoot undefined, dynamic resolution
    throw, zero-branches), per-branch failures (worktreeRunner.add
    throw, resolver throw, childRunner throw, child returns
    checkpoint_waiting), each join-policy decision (pick-winner
    admit-order, pick-winner no-admitted, disjoint-merge collision,
    disjoint-merge pass, aggregate-only ignores verdicts), and two
    event-sequence anchors. Stub WorktreeRunner and BranchPlanEntry
    helpers extend the harness pattern for per-branch fault
    injection.

**FU-T12. Property-test expansion.**
- State: 4 of 6 areas closed (Session 9). Property test count is now
  6 files / ~1.5k LOC under `tests/properties/visible/`.
  `tests/properties/hidden/` is still empty.
- Closed in Session 9:
  - **Workflow graph closure** —
    `tests/properties/visible/workflow-graph-closure.test.ts`
    covers WF-I2/I3/I4/I8/I9 via deterministic mulberry32-driven
    chainBase fixtures, ~200 cases per branch. Five ledger
    entries (`workflow.prop.{entry_mode_reachability,
    no_dead_steps, phase_step_closure, route_target_closure,
    terminal_target_coverage}`) flipped from `phase2-property` to
    `test-enforced`.
  - **Fanout join policies** — small src/ refactor extracted
    `evaluateFanoutJoinPolicy` (pure helper) from
    `runFanoutStep`; runner hoists `worktreeRunner.changedFiles`
    ahead of the call so the join decision stays
    table-testable. `tests/properties/visible/fanout-join-policy.test.ts`
    drives the helper across pick-winner (250 cases),
    disjoint-merge happy/sad (300 cases), disjoint-merge
    file-discovery error (50 cases), and aggregate-only (300
    cases). All 22 existing fanout direct-handler/runtime tests
    still pass.
  - **Artifact pointer normalization** —
    `tests/properties/visible/step-paths-and-writes.test.ts`
    exercises `RunRelativePath` across six failure-mode buckets
    (~400 cases) and surplus-key rejection on the four step
    variants with declared writes records (~200 cases). Two
    ledger entries (`step.prop.{run_relative_paths,
    writes_shape_per_variant}`) flipped to `test-enforced`.
  - **Route collision / tie-breaking** —
    `tests/properties/visible/workflow-router-tiebreak.test.ts`
    drives `classifyTaskAgainstRoutables` over synthetic
    routables with shuffled `order` and optional
    `skipOnPlanningArtifact` flags (~300 cases) plus a 200-case
    totality check. No ledger flips — the router's
    tie-breaking law has no property invariant id yet.
- Remaining (Session 10+):
  - **Checkpoint/resume state transitions** — substantial; ties
    into the substrate work the deferred-decision memory tracks
    (nested checkpoint sub-run resume).
  - **Cross-artifact authority references** — needs investigation
    to identify which artifact pairs the property would target.
- Effort remaining: ~4-6 hours total for the two open areas.

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
FU-T08 (anti-vacuity floors), and the sub-run half of FU-T06.
Session 4 cleared FU-T10 (brittle prose pins) and the fanout half
of FU-T06 (full FU-T06 now closed). Session 5 cleared two of the
five FU-T11 priority targets (dispatch + sub-run direct unit
tests). Session 6 cleared the remaining three FU-T11 targets
(checkpoint, verification, fanout direct unit tests — 34 new cases)
so FU-T11 is fully closed. Session 7 cleared FU-T07 (failure-message
helper module with 5 helpers + a primitive formatter; 15 self-tests;
5 high-value conversions across schema-parity, dispatch, sub-run, and
checkpoint direct-handler tests). Session 8 cleared FU-T09
(mechanical split of `tests/contracts/schema-parity.test.ts` into 11
per-invariant-family files; two shared builder modules extracted to
`tests/helpers/`; 80 ledger binding_refs repointed; verify gate
holds at 997 / 6). Session 9 closed 4 of 6 FU-T12 areas (workflow
graph closure, fanout join policies, artifact pointer
normalization, route collision/tie-breaking — see the FU-T12
entry above for file-by-file detail). Verify gate now at 1010 / 6;
seven `*.prop.*` ledger entries flipped from `phase2-property` to
`test-enforced`. Session 10+ remaining: the two open FU-T12
areas (checkpoint/resume state transitions, cross-artifact
authority references) and substrate work
(WorktreeRunner CLI wiring, real Inventory dispatcher per the
deferred-decision memory, nested checkpoint sub-run resume).

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
