---
plan: repair-workflow-parity
status: challenger-cleared
revision: 03
opened_at: 2026-04-24
opened_in_session: post-repair-reference-characterization
revised_at: 2026-04-24
revised_in_session: repair-workflow-parity-codex-challenger-02-foldin
cleared_at: 2026-04-24
cleared_in_session: repair-workflow-parity-codex-challenger-02
base_commit: 8143851
target: repair
authority:
  - specs/parity-map.md
  - specs/reference/legacy-circuit/repair-characterization.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/plans/build-workflow-parity.md
  - scripts/policy/workflow-kind-policy.mjs
  - src/schemas/step.ts
  - src/runtime/runner.ts
  - src/runtime/router.ts
artifact_ids:
  - repair.brief
  - repair.analysis
  - repair.implementation
  - repair.verification
  - repair.review
  - repair.result
prior_challenger_passes:
  - specs/reviews/repair-workflow-parity-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 01 — 2 HIGH,
    1 MED; revision 02 folds all three by expanding the checkpoint,
    resume, selection, Lite-route, optional-review close, and command
    audit-surface budgets)
  - specs/reviews/repair-workflow-parity-codex-challenger-02.md
    (verdict ACCEPT-WITH-FOLD-INS vs revision 02 — 1 MED wording fix;
    revision 03 folds it by pointing command registration to
    `commands/repair.md` rather than the plugin manifest)
---

# Repair Workflow Parity Plan

Repair workflow parity targets the everyday bug-fix path after Build close:
frame the bug, reproduce and isolate it, make the smallest fix, verify the
regression stays fixed, review the fix when rigor requires it, and close with
clear evidence.

Repair is a successor-to-live surface. The old Circuit Repair workflow is
pinned in `specs/reference/legacy-circuit/repair-characterization.md`; this
plan uses that shape as reference evidence while keeping circuit-next's
structured JSON artifact direction.

## §0 — Prior pass log

Revision 02 folded the first Codex challenger pass. Revision 03 folds the
second Codex challenger pass and reaches `challenger-cleared`.

| Pass-01 # | Severity | Objection | Revision-02 fold-in |
|---|---|---|---|
| 1 | HIGH | The plan understated how deeply Build-specific the checkpoint, resume, and execution-rigor dispatch-selection path still is. | §7 and Work item 3 now explicitly budget checkpoint policy payload widening beyond `policy.build_brief`, artifact-neutral checkpoint request/resume context, Repair brief hash validation, and Repair execution-rigor dispatch-selection binding. |
| 2 | HIGH | Lite review skip was named as behavior but no slice owned the route and close mechanics. | New Work item 4 owns mode-aware Verify routing, conditional Close consumption when `repair.review` is absent, and `repair.result` pointer/cardinality rules for review-present versus Lite-skipped runs. |
| 3 | MED | The public-command work omitted the hardcoded plugin command-closure audit update needed to admit `commands/repair.md`. | Work item 7 now explicitly updates `checkPluginCommandClosure`, plugin-surface tests, and the plugin-surface description to the five-command set. |

| Pass-02 # | Severity | Objection | Revision-03 fold-in |
|---|---|---|---|
| 1 | MED | Work item 7 said to register `/circuit:repair` in the plugin manifest, but this repo derives slash commands from `commands/*.md`; the manifest is only descriptive and must not gain a rejected `commands` array. | Work item 7 now says command registration happens by adding `commands/repair.md`; `.claude-plugin/plugin.json` is updated only where descriptive text must stay honest about the wired command set. |

## §1 — Evidence census

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | Target selection confirmed: the parity map recommends Repair next after Build close. | verified | `specs/parity-map.md` |
| E2 | Reference Repair declares six steps: frame, analyze, fix, verify, review, close. | verified | `specs/reference/legacy-circuit/repair-characterization.md` |
| E3 | Reference Repair emits six workflow artifact roles: brief, analysis, implementation handoff, verification, review, and result. | verified | `specs/reference/legacy-circuit/repair-characterization.md` |
| E4 | Reference Repair has four entry modes: default, lite, deep, and autonomous. Lite skips independent review. | verified | `specs/reference/legacy-circuit/repair-characterization.md` |
| E5 | Current circuit-next workflow policy knows Explore, Review, and Build only; Repair is not registered yet. | verified | `scripts/policy/workflow-kind-policy.mjs` |
| E6 | Current step schema supports checkpoint, synthesis, verification, and dispatch steps, but checkpoint artifact writing is currently restricted to `build.brief@v1`. | verified | `src/schemas/step.ts` |
| E7 | Current runtime verification execution is Build-specific: it reads `build.plan@v1` and writes `build.verification@v1`. Repair needs a Repair-specific verified command path rather than a placeholder synthesis artifact. | verified | `src/runtime/runner.ts` |
| E8 | Current synthesis writers know Build Plan/Result and Review/Explore variants; Repair needs registered writers for Repair Analyze and Repair Result rather than fallback placeholder JSON. | verified | `src/runtime/runner.ts` |
| E9 | Current router knows Explore, Review, and Build; `fix:` and `repair:` shortcuts are not full Repair entries. | verified | `src/runtime/router.ts`, `specs/parity-map.md` |
| E10 | Current plugin command surface exposes run, explore, review, and build; there is no `/circuit:repair` command yet. | verified | `commands/`, `.claude-plugin/plugin.json` |
| E11 | Build now provides run-root safety, checkpoint/resume, entry-mode selection, dispatch, bounded command running, public command wiring, and typed JSON close artifacts. Repair should reuse these substrates where they are generic enough and explicitly widen the Build-specific parts where needed. | verified | `specs/plans/build-workflow-parity.md`, `PROJECT_STATE.md` |
| E12 | The current plugin command-closure audit hardcodes the public command set as run/explore/review/build, so adding `commands/repair.md` requires an audit and test update in the same command-surface slice. | verified | `scripts/audit.mjs`, `tests/contracts/plugin-surface.test.ts` |
| E13 | Unknown-blocking: none. | unknown-blocking | Current gaps are known enough to plan slices. |

## §2 — Why this plan exists

`circuit-next` now has a real command path for Explore, Review, and Build.
That is useful, but users still cannot ask it to fix a bug as a first-class
workflow.

Repair is the next smallest useful parity expansion because it reuses much of
Build's proven runtime path while adding the bug-fix discipline Build does not
cover: expected versus actual behavior, reproduction, root-cause isolation, and
regression-proof verification.

## §3 — Scope

Target Repair surface:

- `/circuit:repair` exists as a direct command.
- `/circuit:run fix:` routes to Repair Lite.
- `/circuit:run repair:` routes to Repair Deep.
- Clear bug, regression, flaky behavior, incident, broken, and error prompts
  can route to Repair.
- Repair has the canonical phase set `{frame, analyze, act, verify, review,
  close}` and `spine_policy.omits: {plan}`. The reference `fix` step maps to
  the canonical `act` phase in circuit-next vocabulary.
- Repair declares and exposes `default`, `lite`, `deep`, and `autonomous`
  entry modes.
- Default, Deep, and Autonomous include independent review.
- Lite skips independent review by routing Verify directly to Close. This must
  be runtime behavior, not only a recorded mode label.
- Frame is a real checkpoint that writes `repair.brief@v1`.
- Analyze is a synthesis step that writes `repair.analysis@v1` with repro
  results, repro confidence, hypotheses, eliminated hypotheses, root cause, and
  diagnostic-path state when the bug is not reproducible.
- Implementation evidence comes from a dispatch step that writes
  `repair.implementation@v1`.
- Verify runs explicit commands and writes `repair.verification@v1`; it must
  distinguish "verification passed" from "commands were not run".
- Review is a dispatch step that writes `repair.review@v1` when the selected
  entry mode requires review.
- Close writes `<run-root>/artifacts/repair-result.json`, path-distinct from
  the engine-authored `<run-root>/artifacts/result.json`.

This plan declares six new artifact ids for a successor-to-live surface. The
reference surface emits six artifact roles, mapped one-for-one while changing
the persisted format from Markdown to structured JSON.

## §4 — Non-goals

- Do not recreate old Circuit's Markdown artifact bytes.
- Do not implement Migrate, Sweep, Create, or Handoff in this arc.
- Do not claim full first-generation Circuit parity at Repair close.
- Do not let Repair bypass Build's existing run-root, checkpoint, dispatch,
  verification, and terminal-outcome safety rules.
- Do not treat no-repro bugs as success without a diagnostic path and residual
  trigger.

## §5 — Target Repair shape

Repair's circuit-next fixture should use these phases:

| Phase title | Canonical phase | Step kind | Role |
|---|---|---|---|
| Frame | frame | checkpoint | Define expected behavior, actual behavior, repro recipe, verification commands, and regression-test intent. |
| Analyze | analyze | synthesis | Attempt reproduction, isolate root cause, and record diagnostic path if reproduction is unavailable. |
| Fix | act | dispatch | Implement the smallest root-cause fix and return structured implementation evidence. |
| Verify | verify | substrate-widened command execution | Run the regression and verification commands and record pass/fail evidence. |
| Review | review | dispatch | Check root-cause fit, regression-test adequacy, and introduced risks when selected rigor requires review. |
| Close | close | synthesis | Write the final Repair result artifact. |

The canonical phase set is `{frame, analyze, act, verify, review, close}`.
`spine_policy.omits` is `{plan}` because Repair's planning discipline lives in
the regression contract plus Analyze's root-cause work rather than a separate
Plan phase.

The public entry-mode selector remains
`--entry-mode <default|lite|deep|autonomous>`, independent from `--rigor`.
The selected entry mode supplies the default execution rigor; explicit
invocation rigor wins when supplied. The resolved execution rigor drives
checkpoint behavior, dispatch selection, and whether the Repair review step is
required.

Lite behavior is part of this arc: the runner must be able to skip the Review
dispatch only for Lite Repair and still close honestly from verification
evidence. Standard, Deep, and Autonomous must not skip Review.

## §6 — Artifact map

| Reference role | circuit-next artifact id | Schema | Backing path |
|---|---|---|---|
| Brief | `repair.brief` | `repair.brief@v1` | `<run-root>/artifacts/repair/brief.json` |
| Analysis | `repair.analysis` | `repair.analysis@v1` | `<run-root>/artifacts/repair/analysis.json` |
| Implementation handoff/result | `repair.implementation` | `repair.implementation@v1` | `<run-root>/artifacts/repair/implementation.json` |
| Verification | `repair.verification` | `repair.verification@v1` | `<run-root>/artifacts/repair/verification.json` |
| Review | `repair.review` | `repair.review@v1` | `<run-root>/artifacts/repair/review.json` |
| Result | `repair.result` | `repair.result@v1` | `<run-root>/artifacts/repair-result.json` |

Each artifact is a clean-break structured JSON successor to the reference
Markdown role. Repair role artifacts live under `artifacts/repair/` to avoid
collisions with Explore, Review, Build, and the engine-authored run result.

`repair.result` must stay path-distinct from `run.result`. The engine-authored
universal run result remains `<run-root>/artifacts/result.json`; the
workflow-specific Repair close artifact is
`<run-root>/artifacts/repair-result.json`.

`repair.brief@v1` must include the regression contract:

```json
{
  "regression": {
    "expected_behavior": "<what should happen>",
    "actual_behavior": "<what happened instead>",
    "repro": {
      "kind": "command",
      "command": {
        "id": "regression",
        "cwd": ".",
        "argv": ["npm", "run", "test"],
        "timeout_ms": 120000,
        "max_output_bytes": 200000,
        "env": {}
      }
    },
    "regression_test": {
      "status": "planned",
      "description": "<test that should fail before the fix>"
    }
  }
}
```

When the bug is not reproducible, `regression.repro.kind` may be
`not_yet_reproducible`, but `repair.analysis@v1` must then carry diagnostic
path evidence: containment, instrumentation, deferred regression-test trigger,
and the signal used for root-cause work.

## §7 — Runtime seams that must widen

Repair should reuse the Build substrates, but several Build-specific
boundaries must widen before a real Repair fixture can run:

- Checkpoint artifact writing currently supports only `build.brief@v1`.
  Repair needs a typed checkpoint policy payload for `repair.brief@v1`, not
  only an artifact-schema allowlist. The policy must carry the regression
  contract fields needed to write the brief honestly: expected behavior, actual
  behavior, repro status or command, regression-test status, verification
  command candidates, and checkpoint request/response pointers.
- Checkpoint request/resume context currently persists `build_brief_sha256`.
  Repair needs an artifact-neutral or Repair-specific brief hash binding that
  records the written `repair.brief@v1` bytes and validates those bytes on
  resume before continuing.
- Verification execution currently reads Build's planned command payload and
  writes `build.verification@v1`. Repair needs the same direct-argv execution
  safety, but the command source and output artifact are Repair-specific.
- Execution-rigor-to-dispatch-selection binding currently applies to Build
  only. Repair needs the same binding so the resolved execution rigor can drive
  dispatch selection and review-required behavior.

Repair also needs a mode-aware route decision after Verify so Lite can skip
Review without letting Standard, Deep, or Autonomous skip it.

These are substrate widenings, not new safety models. They must preserve direct
argv execution, project-root-contained cwd, explicit timeouts, bounded output,
safe checkpoint choices, and honest run outcome mapping.

## §8 — Slices

### Work item 1 — Repair policy only

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could be treated as a router label without a
workflow shape, letting later slices invent phases locally.

**Deliverables:**

- Add Repair to the workflow-kind policy table with canonicals `{frame,
  analyze, act, verify, review, close}` and omitted `{plan}`.
- Add policy tests using shaped fixture objects that prove the Repair
  canonical set and omitted Plan phase.
- Do not add the product Repair fixture in this work item. The fixture needs
  Repair artifact schemas and Build-specific substrate widenings first.

**Acceptance evidence:**

- Policy tests prove Repair has exactly the intended canonical phase set.
- Policy tests reject malformed Repair phase sets.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Starting with command wiring would expose `/circuit:repair` before there is a
workflow shape behind it. Starting with runtime fixture work would force
placeholder Repair artifacts before their contracts exist, so the smallest safe
first move is policy only.

### Work item 2 — Repair artifact schemas and authority rows

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could produce placeholder JSON or reuse
Build artifact shapes without carrying the regression contract and diagnostic
path users need.

**Deliverables:**

- Add `src/schemas/artifacts/repair.ts`.
- Add authority rows for the six Repair artifact ids in `specs/artifacts.json`.
- Add contract tests for strict parse/reject behavior and reference
  cardinality.
- Make `repair.brief@v1` carry the regression contract and typed verification
  command candidates.
- Make `repair.analysis@v1` carry repro result, repro confidence, hypotheses,
  eliminated hypotheses, root cause when known, and diagnostic-path fields when
  no-repro applies.
- Make `repair.result@v1` point back to the prior Repair artifacts and require
  root cause or diagnostic path, fix summary, regression-test status,
  verification result, review status, residual risk, and PR summary.
- Make `repair.result@v1` enforce two pointer shapes: review-present runs carry
  pointers for brief, analysis, implementation, verification, and review;
  Lite review-skipped runs carry pointers for brief, analysis, implementation,
  and verification plus an explicit `review_status: "skipped_by_lite"`.
- Add backing-path tests proving `repair.result` uses
  `<run-root>/artifacts/repair-result.json` and does not collide with
  `run.result`.

**Acceptance evidence:**

- All six Repair artifact schemas accept minimal valid objects and reject
  missing required fields or surplus keys.
- `repair.brief@v1` schema tests reject missing expected behavior, actual
  behavior, repro status, and verification command bounds.
- `repair.analysis@v1` schema tests reject no-repro analysis without diagnostic
  containment, instrumentation, and deferred-trigger evidence.
- Authority graph tests prove each Repair artifact row has a backing path,
  schema file, schema export, writer, reader, and reference evidence.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Runtime writers and command wiring should not land before the artifact
contracts exist. The schema slice gives later runtime work a stable target.

### Work item 3 — Repair checkpoint, selection, and verification substrate widening

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could appear to reuse Build's proven
checkpoint and verification support while silently falling back to
Build-specific schemas or placeholder artifacts.

**Deliverables:**

- Widen checkpoint policy from the singleton `policy.build_brief` shape to an
  explicit typed shape that can also carry `policy.repair_brief` for
  `repair.brief@v1`.
- Make `policy.repair_brief` carry enough source data to write the regression
  contract honestly: expected behavior, actual behavior, repro command or
  no-repro status, regression-test status, verification command candidates,
  and checkpoint prompt/choice context.
- Widen checkpoint artifact writing from only `build.brief@v1` to an explicit
  schema-to-policy allowlist that includes `repair.brief@v1` only when
  `policy.repair_brief` is present.
- Replace Build-only `build_brief_sha256` resume coupling with an
  artifact-neutral or Repair-specific checkpoint context that records the
  written Repair brief schema and SHA-256, then validates the same bytes on
  resume before continuing.
- Preserve checkpoint request/response artifact hashing, safe default choice,
  safe autonomous choice, Deep waiting behavior, and resume validation.
- Widen verification execution so the runtime can read Repair verification
  commands and write `repair.verification@v1`.
- Widen execution-rigor-to-dispatch-selection binding so Repair, not only
  Build, receives the resolved execution rigor in dispatch selection.
- Preserve direct argv execution, shell-binary rejection, project-root-contained
  cwd, explicit env policy, timeouts, output bounds, and fail-closed behavior.
- Add focused runner tests for Repair checkpoint waiting/resume and Repair
  verification pass/fail paths.

**Acceptance evidence:**

- Schema and runner tests prove a Repair Frame checkpoint writes a valid
  `repair.brief@v1` while waiting and after resume.
- Resume tests prove tampering with the waiting `repair.brief@v1` bytes or
  schema binding is rejected before the runner continues.
- Runner tests prove Repair verification writes `repair.verification@v1` from
  actual command execution.
- Dispatch-selection tests prove Repair receives the resolved execution rigor,
  including explicit `--rigor` overriding selected `--entry-mode`.
- Negative tests prove shell strings, shell `-c`, cwd escape, missing timeout,
  and unbounded output still fail.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The Build substrate is close, but still partially Build-specific. Widening it
before adding the Repair fixture prevents a fake Repair workflow from passing
through Build-only code paths.

### Work item 4 — Repair Lite route and optional-review close behavior

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Lite Repair could be recorded as "no independent
review" while the runtime still has only static pass routes and required close
reads, forcing fake review artifacts or hidden opportunistic routing.

**Deliverables:**

- Add the smallest mode-aware route mechanism needed for Repair Verify:
  resolved Lite routes Verify pass directly to Close; Standard, Deep, and
  Autonomous route Verify pass to Review.
- Keep route decisions explicit in event evidence so a later audit can see
  whether Review was completed or skipped by Lite policy.
- Make the Repair close writer consume `repair.review@v1` conditionally:
  required for Standard, Deep, and Autonomous; absent and forbidden for Lite
  review-skipped runs.
- Make `repair.result@v1` encode `review_status` and enforce pointer
  cardinality by mode: review-present results include the review pointer;
  Lite review-skipped results omit it and carry the skip reason.
- Add runner and schema tests for both result shapes.

**Acceptance evidence:**

- Runner tests prove Lite Verify pass routes directly to Close without writing
  or reading `repair.review@v1`.
- Runner tests prove Standard, Deep, and Autonomous cannot close without a
  valid `repair.review@v1`.
- Schema tests prove `repair.result@v1` rejects a Lite result that pretends
  review completed without a review pointer, and rejects a Standard/Deep/
  Autonomous result that omits the review pointer.
- Event tests prove the skipped-review route is visible as selected-mode
  behavior, not a missing step accident.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Repair Lite's review skip is a defining behavior of the reference workflow.
Owning the route and close mechanics before the full fixture lands prevents a
metadata-only implementation.

### Work item 5 — Repair synthesis writers

**Lane:** Ratchet-Advance.

**Failure mode addressed:** The fallback synthesis writer can produce
schema-shaped placeholder output that looks like progress but does not prove
reproduction, root cause, or repair closeout.

**Deliverables:**

- Register synthesis writers for `repair.analysis@v1` and `repair.result@v1`.
- Make `repair.analysis@v1` read the Repair brief and produce either a
  reproducible root-cause path or a bounded diagnostic path.
- Make `repair.result@v1` read Repair artifacts and write
  `artifacts/repair-result.json`.
- Ensure placeholder fallback cannot satisfy Repair analysis or Repair result
  acceptance.

**Acceptance evidence:**

- Runner tests prove Repair Analyze and Close artifacts are schema-valid
  through the default runtime path.
- Runner tests prove Close aborts instead of writing success when required
  Repair artifacts are missing or malformed.
- Runner tests prove no-repro close carries diagnostic-path residual risk
  instead of pretending the bug was fixed.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Dispatch and final command wiring need typed Repair artifacts to read. The
orchestrator-owned artifacts are the stable base for those later steps.

### Work item 6 — Repair fixture and dispatch path

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could have schemas and writers but no real
workflow path that exercises fix and review dispatch.

**Deliverables:**

- Add the product Repair fixture with Frame, Analyze, Fix, Verify, Review, and
  Close.
- Add the Repair dispatch steps for fix and review with registered schemas.
- Add adapter-binding policy coverage for Repair dispatch requirements.
- Add runtime tests proving Standard/Deep/Autonomous include Review and Lite
  skips Review only after Verification passes.
- Add failure-path tests for fix dispatch failure, review rejection, and
  verification failure.

**Acceptance evidence:**

- The live Repair fixture parses, passes workflow-kind policy, and has the
  expected dispatch coverage.
- Runner tests prove the Standard path completes through Review and Close.
- Runner tests prove Lite completes Verify to Close without Review and records
  that skip as selected-mode behavior.
- Runner tests prove failed verification prevents Review and Close.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The fixture should land only after the Repair-specific schemas and substrate
widenings exist. Otherwise it would need placeholder steps or dishonest skips.

### Work item 7 — Repair command and router surface

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could work only as an internal fixture while
users still cannot invoke it through the plugin command surface.

**Deliverables:**

- Add `commands/repair.md`; that root command file is the registration surface
  for `/circuit:repair`.
- Update `.claude-plugin/plugin.json` only where descriptive text must stay
  honest about the now-wired command set; do not add a rejected
  `manifest.commands` array.
- Update `checkPluginCommandClosure`, plugin-surface tests, and the
  plugin-surface description so the expected public command set is
  run/explore/review/build/repair.
- Update `/circuit:run` command docs to include `fix:` and `repair:` examples.
- Update the router so `fix:` selects Repair Lite, `repair:` selects Repair
  Deep, and clear bug/regression/flaky/error/incident prompts can select
  Repair.
- Add product-surface, plugin-surface, command-invocation, and CLI router
  tests.

**Acceptance evidence:**

- `./bin/circuit-next repair --goal '...'` reaches the Repair workflow.
- `./bin/circuit-next --goal 'fix: ...'` selects Repair Lite.
- `./bin/circuit-next --goal 'repair: ...'` selects Repair Deep.
- The plugin command-closure audit accepts `commands/repair.md` as expected
  and still rejects unexpected command files.
- Plugin-surface tests and command-invocation tests prove the five-command set.
- Command docs include same-invocation examples for `--entry-mode` and
  `--rigor`.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Public command wiring belongs after the workflow can actually run. That keeps
the command surface from promising a Repair path that the runtime cannot
complete.

### Work item 8 — Live Repair proof and arc close

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Repair could pass unit tests but fail through the
real launcher and plugin-command path.

**Deliverables:**

- Run a live `./bin/circuit-next repair` proof against a no-code-change Repair
  goal that can complete with schema-valid artifacts, and include schema
  parsing proof for the live Repair artifacts.
- Run a live router proof for `fix:` or `repair:` after direct command proof
  passes.
- Commission a two-prong composition review before closing the Repair arc.
- Close this plan only after the live proof and composition review fold-ins
  land.

**Acceptance evidence:**

- Live direct Repair command returns `outcome: complete`.
- Live router Repair proof selects the expected Repair entry mode.
- All six Repair artifacts parse with Repair schemas.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.
- The Repair plan reaches `closed` only after the composition review files and
  close evidence are committed.

**Why this not adjacent:**

Closing from internal tests alone would repeat the mistake the Build arc was
designed to avoid. The live proof and composition review are the smallest final
check that the product path works end to end.

## §9 — Acceptance

Repair is accepted for this arc when:

- `/circuit:repair` is user-visible and runnable.
- `/circuit:run fix:` reaches Repair Lite.
- `/circuit:run repair:` reaches Repair Deep.
- Clear bug-fix prompts can route to Repair.
- Repair Frame, Analyze, Fix, Verify, Review, and Close execute through the
  runtime.
- Lite skips independent Review only after Verification passes.
- Standard, Deep, and Autonomous include independent Review.
- Repair writes schema-valid structured JSON artifacts for all six reference
  roles.
- Repair result schema distinguishes review-present runs from Lite
  review-skipped runs without requiring fake review artifacts.
- The Repair close artifact lives at `artifacts/repair-result.json`.
- Live direct and router Repair proofs complete.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

## §10 — Close criteria

This plan may close only when:

1. All work items above are implemented or explicitly re-planned through a new
   challenger-cleared revision.
2. A two-prong Repair arc composition review exists in `specs/reviews/`.
3. `specs/plans/repair-workflow-parity.md` is updated to `status: closed` with
   `closed_at` and `closed_in_slice`.
4. `PROJECT_STATE.md`, `README.md`, `TIER.md`, and `specs/parity-map.md` say in
   plain language that Repair is operational and name the remaining parity
   gaps.

Closing Repair does not claim full first-generation Circuit parity. Migrate,
Sweep, custom workflow creation, polished configuration UX, and handoff command
parity remain separate future work.
