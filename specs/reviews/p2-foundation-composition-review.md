---
name: p2-foundation-composition-review
description: Two-prong adversarial composition review of the Phase 2 foundation landed overnight 2026-04-21 (P2.1 ADR-0007 governance + P2.2 plugin surface + P2.3 explore contract + fixture + audit Check 24). Operator-initiated pressure-test before P2.4 (real agent adapter) crosses into runtime dispatch authority.
type: review
review_kind: composition-review
review_scope: three-slice-aggregate
target_kind: arc
target: phase-2-foundation-p2.1-p2.2-p2.3
target_version: "HEAD=7d65f8b (post-slice-34)"
review_date: 2026-04-21
reviewers:
  - model: claude-opus-4-7
    role: fresh-read-composition-adversary
  - model: gpt-5-codex
    role: cross-model-challenger
    session_id: 019db094-5cfa-7383-a8ca-fcb0d0ed1e44
    prompt_ref: /tmp/codex-composition-review/prompt.txt
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS (unchanged; fold-in slice required before P2.4)
severity_counts:
  HIGH: 5
  MED: 5
  LOW: 2
  META: 2
authority:
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-1..P2-8
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.3 (no-aggregate-scoring)
  - specs/contracts/explore.md v0.1
  - .claude-plugin/plugin.json + .claude-plugin/commands/*.md
  - .claude-plugin/skills/explore/circuit.json
  - scripts/audit.mjs Checks 22, 23, 24
commands_run:
  - git log b582aba^..7d65f8b --pretty=format (commit posture verification)
  - read specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 (CC#P2-1..P2-8 full binding text)
  - read scripts/audit.mjs checkPhase2SliceIsolationCitation / checkPluginCommandClosure / checkSpineCoverage (Checks 22/23/24)
  - read specs/contracts/explore.md v0.1 (full)
  - read .claude-plugin/skills/explore/circuit.json (full fixture)
  - read specs/artifacts.json explore.* rows (592-710)
  - read specs/invariants.json EXPLORE-I1 + explore.prop.* rows
  - read .claude-plugin/plugin.json + commands/circuit-run.md + commands/circuit-explore.md
  - read src/schemas/event.ts DispatchStartedEvent + DispatchCompletedEvent (composition-check for CC#P2-2)
  - codex exec (composition prompt; 269716 tokens; session 019db094-5cfa-7383-a8ca-fcb0d0ed1e44)
---

# Phase 2 foundation — adversarial composition review (P2.1 + P2.2 + P2.3)

**Scope.** Operator-initiated sanity pass on the three overnight slices as an aggregate before P2.4 (real agent adapter) crosses into runtime dispatch authority. Each slice had its own Codex challenger pass (folded in). The value of this review is the **composition view** — places where the parts pass individually but the whole leaks.

**Opening verdict: REJECT-PENDING-FOLD-INS.** The foundation is not load-bearing enough for P2.4 to touch runtime yet. Individual slices are mostly honest, but the three-slice aggregate has several "green locally, ambiguous globally" failures around dispatch semantics, result ownership, deferred-property enforcement, and CC#P2-7 trigger capability-vs-citation.

**Closing verdict: REJECT-PENDING-FOLD-INS.** A fold-in slice (or 2-3 tight ones) must land before P2.4. Proceeding to P2.4 with these HIGHs open would either smuggle architectural decisions into the first privileged runtime slice, or produce an adapter that the target `explore` workflow can't actually dispatch to.

---

## HIGH findings

### HIGH 1 — The target `explore` workflow has no step that would dispatch to the P2.4 adapter

**Evidence.**
- `specs/contracts/explore.md:107` maps Synthesize → canonical `act`; fixture honors with `canonical: "act"` at `.claude-plugin/skills/explore/circuit.json:37`.
- **Every step in the explore fixture has `executor: "orchestrator"` and `kind: "synthesis"`** (`.claude-plugin/skills/explore/circuit.json` lines 67, 92, 117, 142, 167).
- Runtime dispatch authority is `kind: "dispatch"` + `executor: "worker"` per `src/schemas/step.ts:60`.
- Plan `specs/plans/phase-2-implementation.md:277` explicitly expects P2.5's explore run to exercise the `agent` adapter.

**Impact.** P2.4 can land a correct, tested `agent` adapter — and the explore workflow still won't invoke it. CC#P2-1 ("real agent dispatch" end-to-end parity) will fail at P2.5. The canonical `act` label is not itself a dispatch signal; there is no wiring from `canonical: "act"` to `kind: "dispatch"`. This is the load-bearing composition bug.

**Fix hint.** Before P2.4, decide explicitly whether (a) explore's Synthesize and/or Review phases become `dispatch` steps, or (b) a first-class "orchestrator synthesis uses adapter" contract is introduced. Then add an audit or test binding that asserts the target explore fixture actually exercises an adapter path. Without this, P2.4 and P2.5 lose their connection.

### HIGH 2 — ADR-0007 CC#P2-2 demands event kinds the schema doesn't define

**Evidence.**
- ADR-0007 CC#P2-2 binding requires, in order: `dispatch.started` → `dispatch.request` (payload hash) → `dispatch.receipt` (receipt id) → `dispatch.result` (result hash). Four events. `specs/adrs/ADR-0007-phase-2-close-criteria.md:131-140`.
- `src/schemas/event.ts` defines only `dispatch.started` (line 86) and `dispatch.completed` (line 97). The discriminated `Event` union at line 139 has no request/receipt/result variants.
- `specs/contracts/run.md:256` pairs started/completed, not the four ADR-named kinds.

**Impact.** CC#P2-2 as written is literally unsatisfiable with today's event schema. P2.4's promised close evidence cannot be produced without widening the event schema or contract. That's a hidden prerequisite the ADR smuggles into P2.4, not a P2.4 implementation detail.

**Fix hint.** Pick one: **(a)** Widen `src/schemas/event.ts` to add `dispatch.request`, `dispatch.receipt`, `dispatch.result` variants in a pre-P2.4 fold-in slice, or **(b)** amend ADR-0007 CC#P2-2 to refer to the info-equivalent data already carried by `dispatch.started` + `dispatch.completed` (the `receipt_path` + `result_path` fields + adapter id — all present). Option (b) is the lighter fix; option (a) is architecturally cleaner if dispatch semantics are going to get richer. Either way, the contradiction must close before P2.4.

### HIGH 3 — CC#P2-7 trigger #6 (write-capable dispatch) is defeatable by incantation

**Evidence.**
- ADR-0007 trigger #6 (`specs/adrs/ADR-0007-phase-2-close-criteria.md:333-338`) fires when an adapter, hook, or workflow step has repo write capability — P2.4's `agent` adapter is the paradigm case.
- `checkPhase2SliceIsolationCitation` (`scripts/audit.mjs:2347-2398`) is a **commit-body string search** for one of two posture strings (or a Break-Glass lane). Not a capability check. Not a code-path inspection. Not a tool-use permission audit.

**Impact.** P2.4 could land an adapter with file-write tool capability, include `Isolation: policy-compliant (no implementer separation required)` in the commit body, and stay audit-green while literally firing trigger #6. The whole point of the trigger list is to catch the moment when the LLM-drafting-in-operator-session case stops applying; the check can't see that moment.

**Fix hint.** One of: **(a)** constrain the P2.4 adapter v0 to explicitly no repo-write tool capability and require the commit to cite that capability boundary (simplest; defers the real gate), or **(b)** land a trigger-aware check pre-P2.4 that inspects what the adapter can actually do (harder; needs a capability descriptor). Option (a) as an immediate bandage + (b) as a downstream slice is a reasonable sequencing.

### HIGH 4 — `explore.result` collides with `run.result` on the same backing path

**Evidence.**
- `specs/artifacts.json:202, 216` registers `run.result` at `<run-root>/artifacts/result.json`.
- `src/runtime/result-writer.ts:5` documents that file as the only path by which `result.json` comes into being.
- Slice 34 registers `explore.result` at the **same** path: `specs/artifacts.json:688, 699`.
- Fixture close-step writes `artifacts/result.json` with schema `explore.result@v1`: `.claude-plugin/skills/explore/circuit.json:160`.

**Impact.** P2.5 has two authorities for one file: the workflow-layer artifact (`explore.result@v1`) and the runtime-layer artifact (`RunResult`). Whichever writer runs last wins. One will counterfeit the other. The artifact registry admits the collision because there's no duplicate-backing-path check.

**Fix hint.** Either **(a)** make `explore.result` a payload field/reference inside `run.result` (so it's a *shape* description for the runtime artifact's `result_artifact` field, not a sibling artifact), or **(b)** move the workflow-specific artifact to `<run-root>/artifacts/explore-result.json` and have the close-step write both. Add a duplicate-backing-path audit check so the next workflow contract (build/repair/etc.) doesn't hit the same collision invisibly.

### HIGH 5 — EXPLORE-I1 says "runtime MUST reject" but Check 24 passes structurally broken fixtures

**Evidence.**
- `specs/contracts/explore.md:161` declares runtime MUST reject violating explore-kind workflows.
- Line 180 names `checkSpineCoverage` (Check 24) as enforcement.
- Check 24 (`scripts/audit.mjs:2783-2788`) hand-parses `fixture.phases[].canonical`. It does NOT call `Workflow.safeParse`.
- The "valid explore fixture" test at `tests/contracts/spine-coverage.test.ts:34` uses `steps: []` — an invalid Workflow — and Check 24 still returns green at line 70.
- Runtime fixture loading at `src/cli/dogfood.ts:125` calls only `Workflow.parse`; no kind-specific policy check.

**Impact.** Check 24 passes broken runtime shapes. EXPLORE-I1's "runtime MUST reject" is aspirational. CC#P2-6 looks greener than it is — the enforcement binding is a fixture-field check, not a runtime-schema check. The scope-gaps are honestly admitted in explore.md lines 180-198, but the headline invariant still promises runtime enforcement that nothing delivers.

**Fix hint.** Extract a `validateWorkflowKindPolicy(workflow)` helper used by BOTH runtime fixture loading and audit Check 24. Make Check 24 run `Workflow.safeParse` first (reject on schema failure), THEN kind-specific checks on the parsed value. This collapses the audit-vs-runtime gap and makes EXPLORE-I1 mean what it says.

---

## MED findings

### MED 1 — Deferred explore properties are human-readable-only; no machine tie to P2.5

**Evidence.** Explore.md §Deferred properties (line 203) + reopen condition #5 (line 343) name P2.5 as the promotion slice. `specs/invariants.json:1290, 1311` list `target_slice: 38` + a reopen-condition sentence. `tests/contracts/invariant-ledger.test.ts:233` only checks that phase2-property rows have `target_slice` and `reopen_condition` — not that they *promote* when the target slice lands. `scripts/audit.mjs:545` counts them.

**Impact.** P2.5 could land without promoting the four `explore.prop.*` entries to `test-enforced` and no audit would fail. The reopen rule is prose the operator must invoke, not a tripwire.

**Fix hint.** Add an audit check keyed to actual P2.5 evidence presence (`tests/runner/explore-e2e-parity.test.ts` present AND `tests/fixtures/golden/explore/` non-empty ⇒ all four `explore.prop.*` rows must have `enforcement_state != phase2-property`). Keyed to evidence, not projected slice number (38+ will drift).

### MED 2 — Plugin command closure check can't prevent semantic drift

**Evidence.** Check 23 (`scripts/audit.mjs:2430-2707`) validates structural closure: manifest ↔ file, YAML frontmatter non-empty, body non-empty, anchors present, no symlinks. It does not cross-check command prose against the workflow contract. `.claude-plugin/plugin.json:13` still says "to be authored at slice P2.3" even though P2.3 landed.

**Impact.** P2.8/P2.11 can silently over-specify or drift the command behavior while Check 23 stays green. The plugin manifest's description text is already stale by one slice.

**Fix hint.** Two options: **(a)** keep command docs as thin routing surfaces (no normative prose about behavior); any behavioral claim lives in `specs/contracts/<workflow>.md`. **(b)** add a minimum-length-diff check against the bound contract's §Scope paragraph. Plus: fix the stale `plugin.json` description text as part of the fold-in slice.

### MED 3 — `schema_file: ""` in the five explore rows is an undocumented sentinel

**Evidence.** `specs/artifacts.md:141` says `schema_file` is "Path to the zod schema, or `null` if there is no runtime schema." The five explore rows at `specs/artifacts.json:598, 621, 646, 669, 694` use `""` (empty string). `scripts/audit.mjs:1353` skips schema checks on falsy `schema_file`, so `""` and `null` are behaviorally equivalent today — but contractually they differ.

**Impact.** Deferred schemas are represented by an undocumented sentinel that silently escapes schema-export enforcement. Spec and ledger drift by convention.

**Fix hint.** Convert the five values to `null`. Add a validator to artifacts graph: `schema_file === null || schema_file is non-empty string ending with .ts`. One-line fix, closes the spec/ledger gap.

### MED 4 — No binding between `/circuit:<name>` command and `.claude-plugin/skills/<name>/` skill

**Evidence.** Check 23 verifies manifest ↔ command-file closure. Check 24 verifies fixture ↔ contract closure for each known workflow kind. Nothing ties the two layers. A slice could rename `.claude-plugin/skills/explore/` to `.claude-plugin/skills/exploration/` (or invent `.claude-plugin/skills/explore-mini/` with `id: "explore"`) and neither check fails.

**Impact.** Runtime-invisible today (command bodies are placeholders). Real at P2.4/P2.8 when dispatch wires up — if the command targets a skill directory that doesn't exist, dispatch silently fails. If two fixtures share `id: "explore"`, dispatch non-determinism.

**Fix hint.** Add a cross-layer check: for every manifest command `circuit:<name>` that's not `circuit:run`, the directory `.claude-plugin/skills/<name>/circuit.json` must exist and its `id` field must equal `<name>`. Can land alongside P2.4 or as a micro-slice in the fold-in bundle.

### MED 5 — CC#P2-6 binding text says "declares AND exercises"; only declaration has an enforcement hook

**Evidence.** ADR-0007 CC#P2-6 (`specs/adrs/ADR-0007-phase-2-close-criteria.md:238`) says the fixture "declares **and exercises**" the canonical phase set. The three named enforcement hooks (contract, audit Check 24, spine-coverage test) all test the *declaration* half. The *exercises* half has no named hook — it's implicitly deferred to CC#P2-1's P2.5 end-to-end run. This implicit deferral is honestly documented in explore.md §EXPLORE-I1 scope (lines 180-194) but absent from ADR-0007's own CC#P2-6 text.

**Impact.** A reader of ADR-0007 alone would think CC#P2-6 enforcement is complete after slice 34. The plan's locked summary row keeps CC#P2-6 at `active — red`, but the reason isn't visible in the ADR. Weakens the one-file-carries-the-gate property.

**Fix hint.** Amend CC#P2-6 binding text in ADR-0007 to state: "Declaration-half enforced by Check 24 + spine-coverage.test.ts at P2.3. Exercise-half transitively enforced by CC#P2-1's end-to-end explore run at P2.5." One-paragraph ADR amendment.

---

## LOW findings

### LOW 1 — Ratchet floor narrative is weaker than the mechanism

**Evidence.** `countTests` is a static declaration count (`scripts/audit.mjs:398, 409`). Floor is 740 at `specs/ratchet-floor.json:4`. The `notes` field only explains the 574→727 jump, not the 727→740 jump. Several spine-coverage tests count audit-helper fixtures (`steps: []`) that are not valid workflows.

**Impact.** Floor protects against test deletion. It does NOT protect against scaffold tests being counted as if they were invariant tests. The narrative could mislead a reader into thinking 740 = 740 real invariants.

**Fix hint.** Add a coverage-ledger note per floor advance: for each bump, which test declarations are new AND which invariant/check id they bind to. Makes the floor advance self-documenting. Low urgency; fold into the next floor-advance slice.

### LOW 2 — `specs/artifacts.md` companion doc is stale

**Evidence.** `specs/artifacts.md:110` says the graph has 17 artifacts. `specs/artifacts.json` now has 22 (17 + 5 explore.* rows starting at line 592).

**Impact.** Not a runtime blocker. Weakens the human-readable authority graph exactly where P2.4 needs clear artifact ownership. Companion doc drifting from json is the kind of rot that compounds.

**Fix hint.** Either update the count in artifacts.md, or add a sentinel comment marking the roll-up as stale with expected current count. Trivial fix.

---

## META observations

### META 1 — No close criterion is missing its binding (governance-without-code-binding check passes)

Both reviewers independently verified: every one of CC#P2-1..P2-8 has a named code or file binding — not just prose. The ADR-0002 citation rule holds at the ADR-authorship layer. The problem isn't **missing** governance; it's **binding strength** — several bindings enforce less than their prose promises (HIGH 3, HIGH 5, MED 5).

### META 2 — The aggregate failures are layer-boundary failures

Each individual slice is mostly honest about its own scope. What the aggregate exposes is a set of **boundary seams** that no single slice owns:

- phase canonical label (`act`) vs step dispatch kind (`dispatch`) — HIGH 1
- audit-time enforcement (Check 24 JSON parse) vs runtime enforcement (`Workflow.parse` + kind policy) — HIGH 5
- workflow-artifact layer (`explore.result`) vs runtime-artifact layer (`run.result`) — HIGH 4
- commit-body citation posture vs actual adapter capability — HIGH 3
- ADR-named event kinds vs actual event-schema variants — HIGH 2

These are the seams that "each slice reviewed individually" couldn't surface. The composition review was the right move.

---

## Closing — what the operator should do

**Do not proceed to P2.4 as currently scoped.** Land a fold-in slice (or a small bundle of tight slices) first that closes at minimum the five HIGH findings. Concrete sequencing suggestion:

1. **Fold-in slice A (event + ADR):** Resolve HIGH 2 by picking either event-schema widen or ADR-0007 CC#P2-2 amendment. Land the amendment + any schema changes in one slice. Codex challenger pass required (governance touch).
2. **Fold-in slice B (artifact collision):** Resolve HIGH 4 by moving `explore.result` to a distinct backing path OR reshaping it as a payload field inside `run.result`. Update contract, fixture, artifacts.json, and the artifacts graph in one go. Add a duplicate-backing-path audit check so the next workflow can't repeat this.
3. **Fold-in slice C (dispatch wiring + audit-vs-runtime parity):** Resolve HIGH 1 and HIGH 5 together — they compose. Introduce the mechanism by which explore's Synthesize (and possibly Review) phases reach an adapter. Collapse Check 24 onto `Workflow.safeParse` + kind policy so EXPLORE-I1 is actually runtime-enforced.
4. **Scoping decision for HIGH 3:** Either constrain P2.4's agent adapter v0 to no-repo-write-capability (bandage; commit explicitly cites the boundary) OR land a capability-aware audit check as a fourth fold-in slice before P2.4.

MED 1/2/3/4/5 and LOW 1/2 can fold into the next slice that touches their area; none are independent blockers.

**After fold-ins land:** revisit this review. If the five HIGHs close, P2.4 can proceed.

---

## Artifacts

- Codex session transcript: `specs/reviews/p2-foundation-composition-review-codex-transcript.md` (14,895 lines; 269,716 tokens; session 019db094-5cfa-7383-a8ca-fcb0d0ed1e44). Archived from `/tmp/codex-composition-review/output.md` in Slice 35 ceremony commit per `specs/plans/phase-2-foundation-foldins.md`.
- Claude self-review: this file, §HIGH/MED/LOW above (prongs merged under unified severity)
- Foundation artifacts reviewed: see frontmatter `commands_run`
