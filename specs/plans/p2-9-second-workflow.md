---
plan: p2-9-second-workflow
status: challenger-pending
revision: 01
opened_at: 2026-04-24
opened_in_session: post-planning-readiness-meta-arc-close
base_commit: d921528
target: review
target_hypothesis_note: |
  target selection confirmed as `review` on two grounds: (i) reference Circuit has a live
  `review` skill at ~/Code/circuit/skills/review/SKILL.md (characterization captured at
  specs/reference/legacy-circuit/review-characterization.md), so ADR-0003 successor-to-live
  path is unblocked for this surface; (ii) `review` is the closest structural twin to
  `explore` among available targets — both are investigation-shaped, both emit a single
  primary artifact. A successful P2.9 proves "review-family generalization," not "workflow-
  system generalization." The latter requires additional targets (repair, build, sweep,
  migrate) — scope claim downgraded from the flawed draft per Codex MED 11.
authority:
  - specs/plans/phase-2-implementation.md §P2.9 (parent plan; this arc occupies that slot)
  - specs/adrs/ADR-0003-authority-graph-gate.md §Decision + Addendum C
    (successor-to-live gate; plan-payload extension)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 + Addendum A
    (CC#P2-1 one-workflow parity; second-workflow separation)
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md §Decision
    (plan-authoring-time discipline; this plan is authored under the new gate)
  - specs/reference/legacy-circuit/review-characterization.md
    (reference evidence base for the review surface; captures phases,
    artifacts, invariant candidates, CLI, runtime-capability requirements)
  - specs/contracts/explore.md (template; workflow-kind-seam pattern)
  - specs/plans/planning-readiness-meta-arc.md (the meta-arc closed 2026-04-23
    at Slice 62; this plan is authored under the new discipline)
  - specs/reviews/p2-9-plan-draft-content-challenger.md (13-finding ledger
    against the flawed draft; this revision folds all 13 findings per §0 below)
  - scripts/policy/workflow-kind-policy.mjs (single source of truth for
    canonical phase sets; P2.9 adds the `review` entry at Slice 63)
  - tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md (byte-identical
    committed copy of the flawed draft; retained as reproducibility fixture)
  - User decision 2026-04-24 in-session: P2.9 restart under the new discipline
---

# P2.9 — Second Workflow (`review`) — multi-slice arc (restart revision 01)

Land a second registered workflow in circuit-next whose contract, artifact
schema, plugin command, and runtime-dispatch path exercise the same pattern
`explore` proved, with one deliberate variation: a **4-phase spine** (not
5), mapped explicitly onto the canonical phase set declared at
`scripts/policy/workflow-kind-policy.mjs`. This arc answers whether the
explore-shaped discipline actually generalizes beyond one workflow kind,
or whether it's single-instance scaffolding dressed in reusable-sounding
names.

## §0 — Flawed-draft fold-in map

Revision 01 (this document) replaces an earlier flawed draft
(`tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md`) that reached
operator decision time carrying 13 Codex findings (6 HIGH + 7 MED)
before the Planning-Readiness Meta-Arc installed the plan-lint gate.
Each finding's resolution in this revision:

| Codex # | Severity | Flawed-draft failure | Revision-01 fold-in |
|---|---|---|---|
| HIGH 1 | Canonical phase mapping missing | 4 invented phase titles with no canonical map | §3 declares explicit title→canonical map + spine_policy.omits |
| HIGH 2 | Artifact model contradicts reference | 4 artifact ids for a 1-artifact reference surface | §5 declares 1 artifact; §5 records reference cardinality |
| HIGH 3 | REVIEW-I1 unenforceable as drafted | "adapter identity" claim unenforceable at current runtime | §4 rewrites REVIEW-I1 to structural-ordering form (enforceable at contract parse) |
| HIGH 4 | Verdict determinism incomplete | "CLEAN iff Critical=0 AND High=0" missing verification clause | §8 verdict rule: CLEAN iff Critical=0 AND High=0 AND verification passes |
| HIGH 5 | Verification runtime not implemented | Plan assumed subprocess execution without a substrate-widening slice | §7 adopts Option B (no substrate widening); verification phase is synthesis-step placeholder per reference "None available" valid outcome |
| HIGH 6 | Markdown artifact materialization unsafe | review.report.md as dispatch-emitted Markdown | §5 artifact is structured JSON under src/schemas/; markdown rendering defers to a follow-on slice |
| MED 7 | Stale audit.mjs target | WORKFLOW_KIND_CANONICAL_SETS cited at stale path | §1 cites `scripts/policy/workflow-kind-policy.mjs` (authoritative per Slice 43a extraction) |
| MED 8 | CLI shape mismatch | --scope invented | §6 uses `--goal` (actual flag at src/cli/dogfood.ts) |
| MED 9 | /circuit:run heuristic bug farm | verb-match routing heuristic | Out of scope for P2.9; /circuit:run stays pass-through per Slice 56 |
| MED 10 | Check 23 rule-g premise stale | Fictional generalization work | Dropped; Check 23 already N-command data-driven per Slice 52 |
| MED 11 | Target=review generalization overclaim | "workflow system generalization" overclaim | §Target-hypothesis-note downgrades to "review-family generalization" |
| MED 12 | Parent-plan conditional collapsed without census | target: review without evidence census | §1 Evidence census row E3 records target reselection |
| MED 13 | Plan authorship outran extraction | Plan invented surface before characterization landed | Characterization landed at specs/reference/legacy-circuit/review-characterization.md 2026-04-24 PRIOR to this plan revision 01 |

## §1 — Evidence census

Status values per claim: `verified` (file read and confirmed), `inferred`
(reasoned from visible evidence), `unknown-blocking` (needs resolution
before the arc can proceed).

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | Reference Circuit's `review` skill exists and declares a 4-phase spine (Intake → Independent Audit → Verification Rerun → Verdict) | verified | specs/reference/legacy-circuit/review-characterization.md §Observed phases |
| E2 | Reference `review` emits exactly one primary artifact (`review.md`); step-internal intermediates are not registry artifacts | verified | specs/reference/legacy-circuit/review-characterization.md §Observed artifacts |
| E3 | Target reselection confirmed `review` at P2.9 framing 2026-04-24 (twin-structure argument + ADR-0003 unblocked by characterization) | verified | §Target-hypothesis-note above + ~/Code/circuit/skills/review/SKILL.md readable at cited path |
| E4 | circuit-next's DispatchRole enum already admits `reviewer` as a valid role — no schema widening needed to enforce REVIEW-I1 | verified | src/schemas/step.ts line 6 (z.enum(['researcher', 'implementer', 'reviewer'])) |
| E5 | circuit-next's current runtime does not execute verification commands as subprocesses; step kinds at src/runtime/runner.ts are `synthesis` (writes placeholder JSON) and `dispatch` (launches adapter CLI only) | verified | src/runtime/runner.ts lines 479-503 + writeSynthesisArtifact at line 375 |
| E6 | Reference `review` skill's "None available" branch is a valid outcome: "Record 'No authoritative verification command available' in review.md. This is a valid outcome, not a failure." | verified | ~/Code/circuit/skills/review/SKILL.md line 106 |
| E7 | WORKFLOW_KIND_CANONICAL_SETS authoritative definition lives at scripts/policy/workflow-kind-policy.mjs; scripts/audit.mjs imports it (MED 7 resolution) | verified | scripts/policy/workflow-kind-policy.mjs lines 37-44 |
| E8 | src/cli/dogfood.ts accepts `--rigor`, `--run-root`, `--fixture`, `--goal`, `--dry-run`, `--help` flags; no `--scope` flag | verified | src/cli/dogfood.ts argv parser |
| E9 | specs/invariants.json enforcement_state_semantics vocab: {audit-only, blocked, phase2-property, prose-only, static-anchor, test-enforced} — authoritative for any invariant declared in this plan | verified | specs/invariants.json::enforcement_state_semantics |
| E10 | specs/contracts/explore.md is the template for workflow-specific contracts; workflow-kind-seam pattern enumerates the 5 generalization risk points | verified | specs/contracts/explore.md + P2.9 flawed draft §"generalization seam" cited this pattern correctly |
| E11 | The flawed P2.9 draft's byte-identical committed copy at tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md is the plan-lint retroactive-proof reproducibility fixture — not to be deleted | verified | Slice 60 committed this fixture; specs/reviews/p2-9-plan-lint-retroactive-run.md §Input |

## §2 — Why this plan exists

Phase 2 close criterion CC#P2-1 (per ADR-0007 §Decision.1) names
"one-workflow parity" as the target-bound close signal. `explore` reached
that at Slice 43c. One workflow proves the end-to-end protocol **once**. It
does not prove the protocol **generalizes** — a critical distinction. If
the second workflow requires re-authoring the adapter registry, the
dispatch transcript shape, the run-artifact naming rule, the fixture spine
discipline, or the audit-check kind map, the pattern hasn't actually landed
as reusable plumbing. It's landed as single-instance scaffolding.

The flawed first draft of this plan (2026-04-23, untracked at the time)
proposed a runtime-ambitious target: a `review` workflow that executes
verification subprocesses and materializes Markdown artifacts. Codex
challenger (specs/reviews/p2-9-plan-draft-content-challenger.md) exposed
6 HIGH and 7 MED findings, none of which were caught automatically at
the time. The Planning-Readiness Meta-Arc (specs/plans/planning-
readiness-meta-arc.md, closed 2026-04-23 Slice 62) installed the plan-
authoring-time gate. This revision 01 is authored under that gate and
restarts the arc on evidence-driven grounds.

## §3 — Canonical phase set + title→canonical map

Reference Circuit's `review` skill uses workflow-kind-specific phase
titles (Intake → Independent Audit → Verification Rerun → Verdict). Those
titles do not match circuit-next's canonical set
`{frame, analyze, plan, act, verify, review, close}` declared at
scripts/policy/workflow-kind-policy.mjs. Per HIGH 1 fold-in, P2.9 declares
an explicit **title→canonical map**:

| Reference title | Canonical phase | Notes |
|---|---|---|
| Intake | frame | Scope resolution via goal text |
| Independent Audit | analyze | Dispatched reviewer emits findings |
| Verification Rerun | act | Synthesis-step placeholder under Option B; see §7 |
| Verdict | close | Aggregates findings, computes verdict, writes artifact |

**spine_policy.omits:** `{plan, verify, review}`. Rationale: `plan` has
no counterpart in review's investigation-shaped pattern; `verify` is
rolled into the close phase's verdict rule rather than split out;
`review` is subsumed by Independent Audit's dispatched reviewer (the
adversarial pass IS the review phase for this workflow).

The `review` entry lands at scripts/policy/workflow-kind-policy.mjs
(Slice 63) with `canonicals: ['frame', 'analyze', 'act', 'close']` and
`omits: ['plan', 'verify', 'review']`. canonical phase set of
{frame, analyze, act, close} with title→canonical map above is what
the policy constant encodes.

## §4 — Invariants

### REVIEW-I1 — reviewer identity separation

**Rule:** The step that writes the `review` workflow's primary artifact
(at canonical phase `close`) MUST be preceded in the `steps[]` array by a
dispatch step with `role: reviewer` at canonical phase `analyze`.

enforcement_layer: static-anchor

**Rationale:** Reference skill dispatches the reviewer as a fresh-context
subprocess; the orchestrator synthesizing the Verdict is a different
actor. This is enforceable at contract-parse time by structural
ordering — no runtime adapter-identity tracking required.

**Bound to:** scripts/policy/workflow-kind-policy.mjs (review entry) +
src/runtime/policy/workflow-kind-policy.ts (parse-time check). Property-
test stub lands at tests/properties/visible/review-i1.test.ts (Slice 64).

### REVIEW-I2 — verdict determinism

**Rule:** The `review` workflow's close-phase artifact carries
`verdict: "CLEAN"` if and only if
`critical_count == 0 AND high_count == 0 AND verification_passes == true`.
If verification is unavailable (see §7), `verification_passes` is `null`
and the verdict degrades to `ISSUES_FOUND` with a `verification_status:
"unavailable"` field — matching the reference skill's "None available"
valid outcome.

enforcement_layer: test-enforced (schema-level pre-check) +
test-enforced (property test on the aggregation function).

**Rationale:** Codex HIGH 4 flagged that the flawed draft's verdict rule
omitted the verification-passes clause. This clause is load-bearing —
without it, a `review` run whose subsumed tests silently failed would
emit CLEAN. The schema-level pre-check rejects malformed artifacts at
parse; the property test validates the aggregation function on randomized
finding-count / verification-status inputs.

**Bound to:** src/schemas/artifacts/review.ts (Slice 64) + tests/
properties/visible/review-i2.test.ts (Slice 64).

## §5 — Artifact model

**Single primary artifact. Cardinality matches reference surface exactly.**

Reference `review` skill emits one artifact (review.md); this plan
declares 1 artifact. The mapping:

| P2.9 artifact id | Reference counterpart | Shape | Writer step |
|---|---|---|---|
| `review.result` | `review.md` (reference) | Structured JSON under src/schemas/artifacts/review.ts | close-phase synthesis step |

**Reference cardinality:** reference surface emits 1 artifact. **P2.9
cardinality:** 1 artifact. One artifact; reference cardinality recorded.

The structured JSON carries fields: `scope` (string), `findings` (array
of `{severity, id, text, file_refs}`), `verification_status` (enum: `pass`,
`fail`, `unavailable`), `verdict` (enum: `CLEAN`, `ISSUES_FOUND`). No
Markdown synthesis in the runtime — that deferral is intentional (see §7).

The dispatched reviewer (analyze-phase dispatch step) writes its raw
findings to a step-internal intermediate at
`${RUN_ROOT}/phases/analyze/review-raw-findings.json` (per step.writes
shape at src/schemas/step.ts lines 60-73). That file is **not** a
registered artifact; the close-phase synthesis step reads it and produces
the registered `review.result` artifact after verdict computation.

## §6 — CLI surface

`/circuit:review` plugin command body invokes:

```
npm run circuit:run review --goal "<user scope text>"
```

`--goal` is the flag accepted by src/cli/dogfood.ts. The command body
follows the same shape as `/circuit:explore` (which uses
`npm run circuit:run explore --goal "..."`). No new CLI flags are
introduced by P2.9 — the scope-text-as-goal pattern is consistent with
the reference skill's goal-driven intake.

## §7 — Runtime feasibility (Option B: no substrate widening)

The flawed draft assumed subprocess execution capability that does not
exist in current circuit-next runtime (per E5 in §1). Two response paths
were available:

- **Option A (substrate-widening slice first):** Land a substrate-widening
  slice that adds a new step kind — tentatively `verification-exec` — for
  external-command execution before P2.9 opens. Introduces pre-requisite
  work ahead of the second-workflow generalization test; delays the arc
  and expands scope. **Not chosen.**
- **Option B (scope-pivot, chosen):** Land `review` without subprocess
  execution capability entirely. The Verification Rerun phase is a
  synthesis-step placeholder that writes `{status: "unavailable"}` into
  the artifact's `verification_status` field. This matches the reference
  skill's explicit "None available" valid outcome (E6). A follow-on
  substrate-widening slice (post-P2.9, candidate name `verification-exec
  step kind landing`) can promote the placeholder to a real verification
  step without restructuring the phase graph.

Under Option B, P2.9 requires **zero new step kinds**, **zero new
adapters**, **zero schema widenings**. Existing `synthesis` and
`dispatch` step kinds are sufficient. The arc tests generalization —
does the explore-established pattern fit a second, structurally-similar
workflow? — without bundling a substrate expansion.

Option B preserves honest reporting: when a `review` run produces
`verdict: "ISSUES_FOUND"` with `verification_status: "unavailable"`, the
downstream operator sees both the content findings and the honest
admission that verification was not exercised. A future slice
(tentatively post-P2.10) can introduce a subprocess-executing step kind
if the operator decides verification-reruns are worth building.

## §8 — Verdict rule

Per REVIEW-I2 (§4), the `review` workflow's verdict is deterministic:

- **CLEAN iff** `critical_count == 0` AND `high_count == 0` AND
  `verification_passes == true` (all three clauses load-bearing;
  verification passes is the clause the flawed draft omitted).
- **ISSUES_FOUND** otherwise, with a required `verification_status`
  field disambiguating `pass` / `fail` / `unavailable`.

The aggregation is orchestrator-authored (close-phase synthesis step).
No model-in-the-loop verdict synthesis — the rule is pure function of
the analyze-phase findings file + the verification-status enum.

## §9 — Slices

Six execution slices + one arc-close ceremony slice. Each declares its
own lane and framing triplet at landing per CLAUDE.md §Lane discipline.
Acceptance evidence per slice is normative; lane / slice ids are
provisional (may re-number with session context, but ordering is fixed).

### Slice 63 — Characterization-to-policy seam

**Lane:** Ratchet-Advance (workflow-kind-policy table gains an entry;
characterization-doc count advances).

**Deliverables:** Add `review` entry to
`scripts/policy/workflow-kind-policy.mjs::WORKFLOW_KIND_CANONICAL_SETS`
with the title→canonical map from §3. Add a corresponding
`tests/policy/workflow-kind-policy.test.ts` row validating the entry.
Extend audit Check 24 coverage verification so P2.9 registration is
tested end-to-end.

**Acceptance evidence:** `npm run verify` green. `npm run audit` green
with Check 24 reporting `review` fixture-shape compliance. New policy
test row passes.

### Slice 64 — Invariants + artifact schema

**Lane:** Ratchet-Advance (invariant count advances; schema count
advances).

**Deliverables:** Land `src/schemas/artifacts/review.ts` with the Zod
schema described in §5. Land tests/properties/visible/review-i1.test.ts
(structural-ordering property) and tests/properties/visible/review-i2.test.ts
(verdict-aggregation property). Update specs/invariants.json with
REVIEW-I1 and REVIEW-I2 entries carrying the enforcement_layer values
from §4.

**Acceptance evidence:** `npm run verify` green with 2 new property
tests passing. `npm run audit` green. specs/invariants.json carries
REVIEW-I1 and REVIEW-I2.

### Slice 65 — Contract + fixture

**Lane:** Ratchet-Advance (contract count advances; fixture count
advances).

**Deliverables:** Land `specs/contracts/review.md` following the
specs/contracts/explore.md template. Land
`.claude-plugin/skills/review/circuit.json` as the runtime fixture
exercising the review spine. Bind artifact_ids and invariant_ids
per §4 / §5.

**Acceptance evidence:** `npm run verify` green. `npm run audit` green
with Check 24 (spine coverage) reporting review fixture as compliant.
Contract test row under tests/contracts/ passes.

### Slice 66 — Runtime dispatch + adapter wiring

**Lane:** Ratchet-Advance (adapter-dispatch coverage advances to a second
workflow kind).

**Deliverables:** Wire the `review` fixture through the dogfood run loop.
Add a test exercising end-to-end execution of the fixture with a stubbed
dispatch adapter (reviewer stub emits structured findings JSON). Confirm
the close-phase synthesis step produces a valid review.result artifact
parsing against src/schemas/artifacts/review.ts.

**Acceptance evidence:** `npm run verify` green with new runtime test.
Event log shows `step.entered` / `step.artifact_written` / `gate.evaluated`
events in correct order for all 4 phases.

### Slice 67 — Plugin command + CLI wiring

**Lane:** Ratchet-Advance (plugin-command count advances to 3 — adds
`/circuit:review`).

**Deliverables:** Add `/circuit:review` plugin command body invoking
`npm run circuit:run review --goal "<scope>"`. Extend audit Check 23 to
assert 3-command closure (or confirm it's already N-command per Slice 52).
Extend src/cli/dogfood.ts if the positional workflow argument needs to
admit `review` (it already does per E8 inference — verify at Slice open).

**Acceptance evidence:** `npm run verify` green. `npm run audit` green
with Check 23 reporting closure for 3 commands. Manual smoke test:
`/circuit:review` with a scope argument runs through the review pipeline
to a valid verdict.

### Slice 68 — Second-workflow parity proof

**Lane:** Equivalence Refactor (semantics-preserving consolidation if the
explore-pattern generalized cleanly; otherwise Discovery, lane reframed at
slice open).

**Deliverables:** Walk through the 5 generalization risk points named in
the flawed draft's §"generalization seam" (canonical phase set uniform,
invariant shape, artifact-count balance, plugin-command composability,
audit-rule kind-independence) and record observed generalization state in
a report at `specs/reviews/p2-9-generalization-proof.md`. Per risk point:
did the explore-established pattern hold, or did it require widening?

**Acceptance evidence:** Report committed at specs/reviews/p2-9-
generalization-proof.md with per-risk-point finding. If widening was
required for any risk point, the widening is declared as a named follow-
on slice (does not block P2.9 close).

### Slice 69 — Arc-close ceremony

**Lane:** Ratchet-Advance (arc-close gate satisfied).

**Deliverables:** Two-prong composition review (Claude fresh-read + Codex
via /codex) per CLAUDE.md §Cross-slice composition review cadence. Update
`PROJECT_STATE.md current_slice` to 69 in same commit as review files per
audit Check 26 staging discipline. Update ARC_CLOSE_GATES table in
scripts/audit.mjs to add the p2-9-second-workflow entry. Update this plan
frontmatter `status: closed`, `closed_at`, `closed_in_slice: 69`,
`closed_with: <summary of what landed>`.

**Acceptance evidence:** `npm run audit` Check 26 reports p2-9-second-
workflow arc-close gate satisfied. Both prong files committed under
specs/reviews/. Composition review verdicts both ACCEPT-class. Arc-close
claim satisfied per Check 26 gate.

## §10 — Close criteria

The arc closes when:

1. All slices 63–69 landed. (Gate: git log shows each slice commit.)
2. `npm run audit` reports all existing checks green. (Gate: audit green.)
3. `npm run verify` green with the new review property tests and runtime
   test included. (Gate: verify green.)
4. Arc-close claim "P2.9 second workflow landed; review-family
   generalization empirically validated" is satisfied per the Slice 69
   composition review. (Gate: audit Check 26 ARC_CLOSE_GATES entry for
   p2-9-second-workflow passes.)
5. Parent plan `specs/plans/phase-2-implementation.md §P2.9` slot is
   marked complete; `specs/plans/phase-2-implementation.md §P2-CLOSE-
   CRITERIA` table is not affected (per ADR-0007 Addendum A, second-
   workflow generalization is separated from CC#P2-1).

## §11 — Arc trajectory

This arc advances two independent ratchets:
- Workflow-kind coverage (1 → 2): the first empirical test of whether
  the explore-established pattern generalizes.
- Plugin-command closure (2 → 3): `/circuit:review` joins `/circuit:run`
  and `/circuit:explore`.

Neither obsoletes any earlier slice. The Planning-Readiness Meta-Arc
(Slices 57–62, closed) is pre-requisite discipline for this arc's plan-
authoring; no slice within P2.9 modifies meta-arc artifacts.

Post-P2.9 options include: (a) third-workflow slice to further test
generalization (repair / build / sweep / migrate); (b) a substrate-widening slice adding real verification subprocess execution (promoting
the §7 Option B placeholder to a live capability); (c) /circuit:run
routing heuristic work (deferred from P2.9 per MED 9). Slot-ordering
among these is an operator-decision at P2.9 close.
