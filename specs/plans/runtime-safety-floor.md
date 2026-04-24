---
plan: runtime-safety-floor
status: operator-signoff
revision: 03
opened_at: 2026-04-24
revised_at: 2026-04-24
revised_in_session: runtime-safety-floor-codex-challenger-02-med-foldins
cleared_at: 2026-04-24
cleared_in_session: runtime-safety-floor-codex-challenger-03-accept
signoff_at: 2026-04-24
signoff_in_session: runtime-safety-floor-operator-signoff
signoff_note: "Operator explicit signoff ('Thank you for the plain English. It helps a LOT. Please consider this signed off by me, the orchestrator.', 2026-04-24). operator_signoff_predecessor: 4d36585415858ddcd57d62a3df119da6266e380a."
base_commit: 3e38c6b
target: runner-runtime-safety
trigger: |
  Takeover assessment reproduced five runtime safety failures on current
  HEAD: workflow-controlled paths can escape runRoot; reusing a run root
  mutates the prior event log before failing; dispatcher exceptions leave
  runs permanently in progress; pass-route cycles parse; non-complete
  terminal routes close as complete. P2.9 is challenger-cleared but not
  operator-signed, and adding a second workflow before closing this floor
  would multiply the unsafe runtime surface.
authority:
  - AGENTS.md §Hard invariants (Codex-facing session copy)
  - CLAUDE.md §Hard invariants (tracked authority for existing audit checks)
  - CLAUDE.md §Cross-slice composition review cadence (privileged runtime arcs ≥3 slices)
  - CLAUDE.md §Plan-authoring discipline (ADR-0010 lifecycle)
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md §Decision
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-2
  - specs/contracts/step.md
  - specs/contracts/workflow.md
  - specs/invariants.json
  - src/schemas/event.ts
  - src/runtime/runner.ts
  - src/runtime/adapters/dispatch-materializer.ts
  - src/schemas/step.ts
  - src/schemas/workflow.ts
prior_challenger_passes:
  - specs/reviews/runtime-safety-floor-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 01 — 2 HIGH;
    revision 02 folds both by preserving dispatch provenance on
    adapter failure and naming the contract/invariant movement for
    run-relative paths + pass-route reachability)
  - specs/reviews/runtime-safety-floor-codex-challenger-02.md
    (verdict ACCEPT-WITH-FOLD-INS vs revision 02 — 0 HIGH + 2 MED;
    revision 03 folds both by making any failure event additive-only
    unless contracts are explicitly reopened and by binding the snapshot
    projection surface of adapter-invocation aborts)
  - specs/reviews/runtime-safety-floor-codex-challenger-03.md
    (verdict ACCEPT vs revision 03 — 0 findings; authorizes
    challenger-cleared transition)
---

# Runtime Safety Floor

Establish the minimum runner safety properties needed before restarting
P2.9 second-workflow work. The batch fixes five reproduced product
failures and turns each into regression coverage. It deliberately avoids a
large runner architecture rewrite; the target is a safer current runtime,
not a new `RunStore` / `ArtifactStore` architecture.

## Why this plan exists

Arc goal: make the current runner unable to escape the run root, corrupt an
existing run, hang on pass-route cycles, strand adapter failures, or
misreport terminal outcomes.

Implementation goal: keep capability work honest. The second-workflow
plan increases fixture/runtime surface; it should start after the
single-workflow runner has a basic safety floor.

Trajectory: the methodology-trim arc just closed at Slice 68 and reduced
process burden. The next available capability plan, P2.9, is
`challenger-cleared` but not operator-signed. This safety arc is adjacent
because the takeover probe found live P0/P1 runtime failures that the
process gates do not yet catch. Starting P2.9 first would make those bugs
harder to isolate and easier to normalize.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | `ArtifactRef.path` is a plain string and `StepBase.reads` is an array of plain strings. | verified | `src/schemas/step.ts:9-20` |
| E2 | Synthesis artifact writes use `join(runRoot, step.writes.artifact.path)` with no containment check. | verified | `src/runtime/runner.ts:375-385` |
| E3 | Dispatch prompt reads use `join(runRoot, path)` with no containment check. | verified | `src/runtime/runner.ts:224-237` |
| E4 | Dispatch transcript and artifact writes use `join(runRoot, writes.*)` with no containment check. | verified | `src/runtime/adapters/dispatch-materializer.ts:138-152` |
| E5 | `bootstrapRun` writes manifest + bootstrap event before deriving state; run-root reuse mutates the event log before failing. | verified | `src/runtime/runner.ts:53-57` + takeover probe |
| E6 | Dispatcher exceptions escape at the `await dispatcher.dispatch(...)` call and leave no `run.closed` or `artifacts/result.json`. | verified | `src/runtime/runner.ts:509` + takeover probe |
| E7 | Workflow terminal reachability follows any route, while runtime follows only `routes.pass` after successful gates. | verified | `src/schemas/workflow.ts:239-277` + `src/runtime/runner.ts:654-679` |
| E8 | `@stop`, `@escalate`, and `@handoff` set only a reason and leave `runOutcome` at the default `complete`. | verified | `src/runtime/runner.ts:670-690` + takeover probe |
| E9 | Current audit baseline is `33 green / 2 yellow / 0 red`; the two yellows are AGENT_SMOKE and CODEX_SMOKE fingerprint drift. | verified | `npm run audit` on 2026-04-24 |
| E10 | `npm run verify` passes on current HEAD with `1235 passed / 19 skipped`. | verified | `npm run verify` on 2026-04-24 |
| E11 | P2.9 second-workflow plan is `challenger-cleared` but not operator-signed. | verified | `specs/plans/p2-9-second-workflow.md` frontmatter |
| E12 | The live dispatch provenance surface includes `adapter`, `role`, `resolved_selection`, and `resolved_from`; failure handling must not regress that audit trail. | verified | `src/schemas/event.ts` + `src/runtime/adapters/dispatch-materializer.ts:36-75` |
| E13 | Current workflow authority defines WF-I8 as broad terminal reachability through any route chain, while no current Step invariant names run-relative path syntax. | verified | `specs/contracts/workflow.md:45-52`, `specs/invariants.json` WF-I8, `specs/contracts/step.md` |
| E14 | Current dispatch-content failure authority uses the uniform `gate.evaluated` → `step.aborted` → `run.closed` failure surface and explicitly says no separate `dispatch.failed` event exists for that class. | verified | `specs/contracts/explore.md:657-701`, `specs/plans/clean-clone-reality-tranche.md:117` |

### §1.B Hypotheses

| # | Hypothesis | Resolution point |
|---|---|---|
| H1 | A single run-relative path primitive can cover every workflow-controlled read/write path without changing fixture authoring syntax. | Slice 1 tests |
| H2 | Adapter invocation exceptions are most honest as the existing uniform failure closure plus additive typed metadata; non-additive failure-event semantics require an explicit contract reopen. | Slice 3 challenger + tests |
| H3 | Static pass-route validation plus a runtime visited-step guard is sufficient to prevent pass-route hangs once the workflow contract/invariant ledger names pass-route reachability explicitly. | Slice 4 tests |
| H4 | P2.9 assumptions remain valid after the safety floor, or can be refreshed with a small plan revision. | Batch close freshness check |

### §1.C Unknown-blocking

*None.*

## §2 — Lifecycle and Governance Envelope

This plan is `operator-signoff`: the operator reviewed the
challenger-cleared revision and explicitly signed off on 2026-04-24.
Implementation slices may open from this state, but runtime changes are
still outside this signoff commit.

Lifecycle completed before implementation:

1. Run `npm run plan:lint -- specs/plans/runtime-safety-floor.md` and
   `npm run plan:lint -- --context=committed specs/plans/runtime-safety-floor.md`
   at the appropriate lifecycle points.
2. Dispatch Codex challenger via `/codex` against the committed plan.
3. Fold in challenger findings or revise the plan.
4. Advance only to `challenger-cleared` after an ACCEPT-class review.
5. Request operator signoff only after challenger clearance.
6. Start implementation only from `operator-signoff` — now satisfied by
   this transition.

Because the arc spans more than three slices and touches privileged
runtime paths, the close ceremony MUST include a two-prong composition
review and an `ARC_CLOSE_GATES` entry so audit binds the arc-close
review mechanically.

Audit acceptance vocabulary for every slice:

- Required: `npm run verify` passes.
- Required: `npm run audit` reports `0 red`.
- Required: no new or compounded yellows beyond the known
  AGENT_SMOKE/CODEX_SMOKE fingerprint drift unless the slice explicitly
  touches adapter-source fingerprint paths and records that compounding.
- Not required inside this arc: re-promoting AGENT_SMOKE or CODEX_SMOKE
  fingerprints. That is a separate operator-local action unless the
  operator chooses to run it.

## §3 — Non-goals

- Do not implement P2.9 `review`.
- Do not add `/circuit:review`.
- Do not land P2-MODEL-EFFORT.
- Do not redesign the runner around `RunStore` / `ArtifactStore`.
- Do not add resume mode.
- Do not claim smoke fingerprint yellows are resolved unless the
  operator-local smoke re-promotion actually runs.

## §4 — Slices

### Slice 1 — Run-relative path primitive

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Workflow-controlled paths are plain strings
and are joined to `runRoot`; a workflow can write or read outside the run
root with `..` segments or absolute paths.

**Deliverables:**

1. Add a `RunRelativePath` schema, likely under `src/schemas/primitives.ts`
   or a sibling module that matches existing schema organization.
2. Define the accepted syntax as portable POSIX-style run-relative paths:
   non-empty, no absolute prefix, no `..` segment after normalization, no
   empty segment, no backslash, no drive-letter or colon form.
3. Use `RunRelativePath` for all workflow-controlled file fields:
   `ArtifactRef.path`, `StepBase.reads`, checkpoint `writes.request`,
   checkpoint `writes.response`, dispatch `writes.request`,
   dispatch `writes.receipt`, dispatch `writes.result`, and dispatch
   `writes.artifact.path`.
4. Add `resolveRunRelative(runRoot, relPath)` in runtime code. It must
   resolve the path and enforce containment before every read or write.
5. Replace raw `join(runRoot, path)` at the current call sites:
   `composeDispatchPrompt`, `writeSynthesisArtifact`, and
   `materializeDispatch`.
6. Add an explicit Step-contract invariant for run-relative path syntax
   (preferred id: `STEP-I8`) and update `specs/contracts/step.md`,
   contract frontmatter, `specs/invariants.json`, and contract tests so
   the parser-tightening is not a silent schema-only semantic change.

**Acceptance evidence:**

- Tests reject `../escaped.json`, `artifacts/../../escaped.json`,
  `/tmp/escaped.json`, `C:\escaped.json`, `artifacts\escaped.json`,
  `artifacts//x.json`, and empty strings for every relevant schema path
  surface.
- Runtime test proves a workflow with `writes.artifact.path:
  '../escaped.json'` cannot parse or cannot execute, and no file appears
  outside `runRoot`.
- Runtime test proves dispatch `request`, `receipt`, `result`, and
  dispatch `artifact.path` cannot escape.
- Runtime test proves `reads: ['../secret.txt']` cannot escape.
- Existing `dogfood-run-0` and `explore` fixtures still parse.
- Step contract / invariant-ledger tests prove the new run-relative path
  invariant is named, indexed, and test-bound.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Start with adapter-failure closure. Rejected because every later slice
continues reading and writing workflow-controlled paths. Closing path
containment first prevents the rest of the batch from adding tests or
helpers on top of an unsafe filesystem boundary.

### Slice 2 — Fresh run-root guard

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Reusing an existing run root appends a new
bootstrap event and overwrites manifest state before validation fails,
corrupting prior run evidence.

**Deliverables:**

1. Add a pre-write guard in `bootstrapRun` or a lower run-root init helper.
2. Permit an existing empty directory because callers may pre-create a
   temp directory.
3. Reject any run root that already contains run artifacts such as
   `events.ndjson`, `manifest.snapshot.json`, `state.json`, or
   `artifacts/result.json`.
4. Error message must name run-root reuse and state that resume mode does
   not exist yet.
5. Do not implement resume mode in this slice.

**Acceptance evidence:**

- Test runs once into a root, records hashes or byte contents of
  `events.ndjson`, `manifest.snapshot.json`, `state.json`, and
  `artifacts/result.json`, then attempts a second run with a different
  run id.
- Second invocation fails before any of those files change.
- Existing fresh-run tests still pass.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Implement resume mode. Rejected because no resume contract exists; a
fresh-run guard is the smaller safety fix and preserves the current
runtime model.

### Slice 3 — Durable adapter invocation failure

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Adapter subprocess failures, auth failures,
timeouts, or thrown test dispatchers escape the runner after
`step.entered`, leaving no close event and no user-visible result.

**Deliverables:**

1. Preserve the existing uniform failure closure as the baseline:
   `gate.evaluated outcome=fail` → `step.aborted` → `run.closed
   outcome=aborted` → `artifacts/result.json`. A typed
   `dispatch.failed` event, or an equivalently explicit typed failure
   event, is allowed only as additive metadata for adapter invocation
   exceptions unless the slice explicitly reopens the event/run/explore
   contracts and names the semantic tradeoff.
2. Refactor dispatch execution so the runner records enough durable
   dispatch context before awaiting the adapter. This MUST preserve the
   existing dispatch provenance surface: adapter identity, role,
   resolved selection, resolved-from provenance, step id, attempt, a
   pre-await request hash or prompt hash, and failure reason.
3. On adapter exception, emit a durable failure sequence ending in:
   `gate.evaluated outcome=fail`, `step.aborted`, `run.closed
   outcome=aborted`, and `artifacts/result.json`.
4. Keep reason strings byte-identical across all surfaces that carry the
   terminal reason.
5. If `dispatch.failed` is introduced, it must be additive to the
   current dispatch audit trail rather than a smaller substitute for
   `dispatch.started`-equivalent provenance. Any smaller representation
   must explicitly reopen the event, run, and affected workflow contract
   authorities and name the semantic tradeoff before implementation.
6. Update event / run / projection tests and contract prose as needed so
   adapter invocation failure is not misrepresented as a model verdict.

**Acceptance evidence:**

- Throwing dispatcher test ends with `run.closed outcome=aborted` and
  `artifacts/result.json outcome=aborted`.
- Event log includes the typed dispatch failure event or accepted
  equivalent when the slice chooses additive metadata; otherwise the
  contract-reopen path names why the uniform failure surface alone is
  sufficient for adapter invocation exceptions.
- Event log preserves `dispatch.started`-equivalent provenance for the
  failed attempt: adapter, role, resolved selection, resolved-from
  provenance, step id, and attempt. It also records a durable pre-await
  request hash or prompt hash so the failure can be tied to the exact
  invocation payload.
- No implementation may replace the existing dispatch provenance surface
  with only `{adapter, step_id, attempt, reason}`.
- `state.json` parses as a `Snapshot` with `status: aborted`, and
  `RunProjection.safeParse({ log, snapshot })` succeeds for the aborted
  log/snapshot pair.
- No `step.completed` appears for the failed dispatch step.
- Reason is byte-identical across `dispatch.failed`, `gate.evaluated`,
  `step.aborted`, `run.closed`, and `result.json` where those surfaces
  carry it.
- Existing verdict-failure and schema-failure dispatch tests still pass.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Represent adapter exceptions only as `gate.evaluated outcome=fail`.
Rejected as the default because it conflates infrastructure failure with
model verdict failure. A typed dispatch failure event is the more honest
runtime record; the challenger may still approve a smaller representation
only if the contract explicitly names the semantic tradeoff.

### Slice 4 — Pass-route reachability and runtime cycle guard

**Lane:** Ratchet-Advance.

**Failure mode addressed:** WF-I8 accepts any route eventually reaching a
terminal, but runtime follows only `routes.pass` after successful gates.
A workflow can parse with `pass` cycling forever and `fail` pointing to
`@complete`.

**Deliverables:**

1. Change workflow validation so every step's pass route reaches a
   terminal by following only `routes.pass`.
2. Bind the contract movement explicitly. Preferred shape: keep WF-I8 as
   broad terminal reachability if it remains useful, and add a new
   workflow invariant (preferred id: `WF-I11`) for pass-route terminal
   reachability. If implementation instead replaces WF-I8, revise
   `specs/contracts/workflow.md`, contract frontmatter, property ids,
   `specs/invariants.json`, and tests so no authority still describes
   the broader rule as satisfying runtime liveness.
3. Keep or separately validate broader graph reachability only if it has
   a named purpose; do not let it satisfy pass-route safety.
4. Add a runtime guard: revisiting a step id in one run aborts the run
   with a clear cycle reason. A stricter equivalent such as
   `executedSteps > workflow.steps.length` is acceptable only if the
   test proves the same failure mode.
5. Runtime guard must close the run with `outcome=aborted` and
   `artifacts/result.json`, not throw and strand the log.

**Acceptance evidence:**

- Workflow with `routes: { pass: "loop-step", fail: "@complete" }`
  fails parse.
- Self-cycle and multi-step pass-cycle fixtures fail parse.
- Existing valid fixtures still parse.
- Workflow contract / invariant-ledger tests prove pass-route
  reachability is named, indexed, and test-bound; broad WF-I8 text is
  either preserved as a separate invariant or revised consistently.
- Runtime-cycle test bypasses schema if necessary and proves the runner
  aborts cleanly instead of hanging.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Only add a static schema check. Rejected because direct runtime callers
and future schema gaps can still produce a loop. The runtime needs a
defense-in-depth abort path.

### Slice 5 — Terminal outcome mapping

**Lane:** Ratchet-Advance.

**Failure mode addressed:** `@stop`, `@escalate`, and `@handoff` are
schema-valid terminal routes but currently close as `complete`.

**Deliverables:**

1. Map terminal labels to outcomes:
   `@complete -> complete`, `@stop -> stopped`, `@escalate -> escalated`,
   `@handoff -> handoff`.
2. Remove or rewrite the current "treating as complete" reason.
3. Update contract prose, invariant ledger, and tests as needed so event,
   snapshot, and result semantics agree.

**Acceptance evidence:**

- Runtime tests cover all four terminal labels.
- `run.closed.outcome`, `state.json status`, `RunProjection`, and
  `artifacts/result.json outcome` agree for each terminal.
- Existing complete-path tests still pass.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Defer non-complete terminals to P2.9. Rejected because these terminal
labels are already schema-valid; leaving them wrong makes every future
workflow author carry a hidden "only @complete is honest" rule.

### Slice 6 — Regression proof and P2.9 freshness check

**Lane:** Equivalence Refactor if Slices 1-5 only close the named
failures without changing external workflow authoring; Ratchet-Advance if
event schema or contract surfaces widen materially.

**Failure mode addressed:** The safety floor could land locally but leave
the next planned P2.9 arc stale or falsely cleared under assumptions that
changed during stabilization.

**Deliverables:**

1. Add a compact reproduction-proof document under `specs/reviews/` or
   `specs/reviews/runtime-safety-floor-repro-proof.md` recording the five
   original probes and their fixed outcomes.
2. Re-run `npm run verify`.
3. Re-run `npm run audit`.
4. Read P2.9 assumptions that cite runner path semantics, dispatch
   failure behavior, route semantics, terminal outcomes, and synthesis
   limitations.
5. Either record "P2.9 assumptions remain valid" with exact references,
   or revise `specs/plans/p2-9-second-workflow.md` and rerun the Codex
   challenger for that plan.

**Acceptance evidence:**

- Five original reproduction probes now fail closed or report correct
  outcomes.
- P2.9 freshness note lands in the proof document or P2.9 plan revision.
- `npm run verify` passes.
- `npm run audit` reports `0 red` and no new unaccounted yellow.

**Why this not adjacent:**

Start P2.9 immediately after Slice 5. Rejected because P2.9 is already a
cleared-but-not-signed plan; runtime safety changes can invalidate its
evidence census or slice assumptions without obvious test failures.

### Slice 7 — Arc-close ceremony

**Lane:** Ratchet-Advance for the audit gate / Equivalence Refactor for
ceremony-only code movement, declared precisely at slice open.

**Failure mode addressed:** A privileged runtime arc spanning more than
three slices can close without the composition review cadence being
mechanically bound.

**Deliverables:**

1. Commission two-prong composition review over Slices 1-6:
   fresh-read Claude composition-adversary pass plus Codex challenger via
   `/codex`.
2. Land review files under `specs/reviews/` with ACCEPT-class verdicts or
   fold-ins.
3. Add `runtime-safety-floor` to `ARC_CLOSE_GATES` in `scripts/audit.mjs`
   and update matching tests.
4. Advance `PROJECT_STATE.md` live state in the same commit.
5. Update this plan frontmatter to `status: closed`, `closed_at`,
   `closed_in_slice`, and `closed_with`.

**Acceptance evidence:**

- `npm run verify` passes.
- `npm run audit` Check 26 reports the runtime-safety-floor arc-close
  gate satisfied.
- Both composition-review prongs are committed with ACCEPT-class
  closing verdicts.

**Why this not adjacent:**

Skip arc-close because each slice has tests. Rejected because the repo's
own cadence says per-slice checks miss boundary seams between runtime
changes. These slices touch bootstrap, event schema, dispatch, routes,
and terminal semantics together.

## §5 — Arc close criteria

The arc closes when:

1. Plan lifecycle reached operator-signoff before implementation.
2. Slices 1-7 landed in order or any reordering was documented in the
   relevant slice framing.
3. The five original reproduced failures are fixed and covered by tests.
4. `npm run verify` passes.
5. `npm run audit` reports `0 red` and no new unaccounted yellow.
6. P2.9 is either declared fresh against the new runtime floor or revised
   and re-challenged.
7. Arc-close two-prong composition review is mechanically bound by audit.

## §6 — Follow-ons Explicitly Out Of Scope

- P2.9 second workflow implementation.
- Slice 70 per-workflow synthesis-writer registration from the P2.9 plan.
- P2-MODEL-EFFORT.
- P2.8 router.
- Smoke fingerprint re-promotion, unless the operator explicitly chooses
  to run the authenticated smoke updates.
- Full runner architecture extraction into `RunStore`, `ArtifactStore`,
  `WorkflowCompiler`, or `Engine`.
