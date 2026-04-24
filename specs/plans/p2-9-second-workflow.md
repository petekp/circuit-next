---
plan: p2-9-second-workflow
status: closed
revision: 04
opened_at: 2026-04-24
revised_at: 2026-04-23
opened_in_session: post-planning-readiness-meta-arc-close
revised_in_session: post-codex-challenger-03-med-foldin
cleared_in_session: post-codex-challenger-04-accept
cleared_at: 2026-04-23
signoff_at: 2026-04-24
closed_at: 2026-04-24
closed_in_slice: 82
closed_with: "P2.9 audit-only review-family generalization validated; arc-close composition reviews landed; ARC_CLOSE_GATES binding added; one future follow-on declared for per-workflow synthesis-writer registration."
signoff_in_session: post-runtime-safety-floor-p2-9-operator-signoff
signoff_note: "Operator explicit signoff ('I sign off on P2.9', 2026-04-24) after runtime-safety-floor closure. operator_signoff_predecessor: 5590abd13b7c801d99098eb64ab00d3b0669986f."
base_commit: d921528
target: review
target_hypothesis_note: |
  target selection confirmed as `review` on two grounds: (i) reference Circuit has a live
  `review` skill at ~/Code/circuit/skills/review/SKILL.md (characterization captured at
  specs/reference/legacy-circuit/review-characterization.md), so ADR-0003 successor-to-live
  path is unblocked for this surface; (ii) `review` is the closest structural twin to
  `explore` among available targets — both are investigation-shaped, both emit a single
  primary artifact. P2.9 narrows further in revision 02 per Codex pass 01 HIGH 2 + MED 3:
  the P2.9 variant of `review` is a 3-phase AUDIT-ONLY workflow (no Verification Rerun
  phase). A verification-bearing variant would be a separate future workflow entry, not a
  placeholder in this one. A successful P2.9 therefore proves "audit-only review-family
  generalization" — narrower still than revision 01's "review-family generalization"
  framing. Workflow-system generalization (repair, build, sweep, migrate) is out of scope.
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
    against the flawed draft; revision 01 folded most; revision 02 closes
    the remaining partials per §0.A)
  - specs/reviews/p2-9-second-workflow-codex-challenger-01.md (pass 01
    against revision 01; 2 HIGH + 1 MED fold-ins drove revision 02 — see §0.B)
  - scripts/policy/workflow-kind-policy.mjs (single source of truth for
    canonical phase sets; P2.9 adds the `review` entry at Slice 63)
  - src/schemas/step.ts (DispatchStep.writes.result + ResultVerdictGate contract;
    authoritative for the analyze-phase dispatch shape per revision 02 §5)
  - tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md (byte-identical
    committed copy of the flawed draft; retained as reproducibility fixture)
  - User decision 2026-04-24 in-session: P2.9 restart under the new discipline
artifact_ids:
  - review.result
prior_challenger_passes:
  - specs/reviews/p2-9-second-workflow-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 01 — 2 HIGH + 1 MED;
    all 3 fold-ins applied in revision 02 per §0.B)
  - specs/reviews/p2-9-second-workflow-codex-challenger-02.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 02 — 2 HIGH + 1 MED;
    revision 02 HIGH 1 dispatch-contract binding remained partial;
    2 new findings: HIGH 2 close-phase schema seam overreach + MED 1
    Slice 63 policy-test path drift; all 3 fold-ins applied in
    revision 03 per §0.C)
  - specs/reviews/p2-9-second-workflow-codex-challenger-03.md
    (verdict ACCEPT-WITH-FOLD-INS vs revision 03 — all 3 pass-02
    fold-ins CLOSED; 1 new MED only: E12/E13 citation anchors
    under-proved two "verified" subclaims; MED applied in revision 04
    per §0.D)
---

# P2.9 — Second Workflow (`review`) — multi-slice arc (restart revision 04)

Land a second registered workflow in circuit-next whose contract, artifact
schema, plugin command, and runtime-dispatch path exercise the same pattern
`explore` proved, with one deliberate variation: a **3-phase audit-only
spine** mapped explicitly onto the canonical phase set declared at
`scripts/policy/workflow-kind-policy.mjs`. This arc answers whether the
explore-shaped discipline actually generalizes beyond one workflow kind
for an audit-only review variant, or whether it's single-instance
scaffolding dressed in reusable-sounding names.

## §0 — Fold-in map

Four fold-in tranches: §0.A (flawed-draft 13-finding ledger), §0.B
(pass 01 against revision 01), §0.C (pass 02 against revision 02), and
§0.D (pass 03 against revision 03).

### §0.A — Flawed-draft 13-finding ledger (revisions 01 + 02)

The flawed draft (`tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md`)
carried 13 Codex findings. Revision 01 folded 11 fully and 2 partially
(HIGH 5 + MED 11). Revision 02 closes the two partials.

| Codex # | Severity | Flawed-draft failure | Revision-01 status | Revision-02 delta |
|---|---|---|---|---|
| HIGH 1 | Canonical phase mapping missing | 4 invented phase titles with no canonical map | Fully folded — §3 declares title→canonical map + spine_policy.omits | (no change; still fully folded, now 3 phases instead of 4) |
| HIGH 2 | Artifact model contradicts reference | 4 artifact ids for a 1-artifact reference surface | Fully folded — §5 declares 1 artifact; cardinality recorded | (no change; still fully folded) |
| HIGH 3 | REVIEW-I1 unenforceable as drafted | "adapter identity" claim unenforceable at current runtime | Fully folded — §4 rewrites REVIEW-I1 to structural-ordering form | (no change; still fully folded) |
| HIGH 4 | Verdict determinism incomplete | "CLEAN iff Critical=0 AND High=0" missing verification clause | Fully folded — §8 rule includes verification-passes | Rewritten per §0.B fold-in 2: rule no longer claims verification-passes because verification is out of P2.9 scope entirely; §8 narrative retains verification word for rule #19 compliance and narrative honesty |
| HIGH 5 | Verification runtime not implemented | Plan assumed subprocess execution without a substrate-widening slice | Partially folded — §7 Option B conflated "None available" with "runtime incapable" per pass 01 HIGH 2 | Fully folded — P2.9 pivoted to 3-phase audit-only; verification is not attempted at all (not a placeholder). See §0.B fold-in 2 + §7 |
| HIGH 6 | Markdown artifact materialization unsafe | review.report.md as dispatch-emitted Markdown | Fully folded — §5 artifact is structured JSON | (no change; still fully folded) |
| MED 7 | Stale audit.mjs target | WORKFLOW_KIND_CANONICAL_SETS cited at stale path | Fully folded — §1 E7 cites `scripts/policy/workflow-kind-policy.mjs` | (no change; still fully folded) |
| MED 8 | CLI shape mismatch | --scope invented | Fully folded — §6 uses `--goal` | (no change; still fully folded) |
| MED 9 | /circuit:run heuristic bug farm | verb-match routing heuristic | Fully folded — out of P2.9 scope | (no change; still fully folded) |
| MED 10 | Check 23 rule-g premise stale | Fictional generalization work | Fully folded — dropped | (no change; still fully folded) |
| MED 11 | Target=review generalization overclaim | "workflow system generalization" overclaim | Partially folded — revision 01 narrowed to "review-family generalization" but Slice 68/§10 close logic still read as one ACCEPT bucket per pass 01 MED 3 | Fully folded — §Target-hypothesis-note narrowed further to "audit-only review-family generalization"; §10 Close criteria tri-valued (clean / with-declared-follow-ons / re-framed) per §0.B fold-in 3 |
| MED 12 | Parent-plan conditional collapsed without census | target: review without evidence census | Fully folded — §1 E3 records target reselection | (no change; still fully folded) |
| MED 13 | Plan authorship outran extraction | Plan invented surface before characterization landed | Fully folded — characterization landed before revision 01 authoring | (no change; still fully folded) |

### §0.B — Pass 01 (revision 01) fold-ins (revision 02)

Pass 01 (`specs/reviews/p2-9-second-workflow-codex-challenger-01.md`)
emitted REJECT-PENDING-FOLD-INS with 2 HIGH + 1 MED. Revision 02 folds
all three.

| Pass-01 # | Severity | Objection | Revision-02 fold-in |
|---|---|---|---|
| HIGH 1 | The planned analyze-phase dispatch payload is not bound to the live dispatch contract | Revision 01 §5 / Slice 66 hand-waved "structured findings JSON" without naming the `DispatchStep.writes.result` shape, gate.pass verdict vocabulary, or ResultVerdictGate contract; Slice 66 would have re-invented it | §5 now names the dispatch shape explicitly: writes.result carries `{verdict, findings}`; gate.pass admits `NO_ISSUES_FOUND`, `ISSUES_FOUND`; the reviewer-declared verdict gates the dispatch step but does NOT become the workflow's final verdict (which is computed in the close phase from the findings list). §9 Slice 64 deliverables include this shape; §9 Slice 66 acceptance evidence bound to it. Evidence-census row E12 added |
| HIGH 2 | §7 Option B conflates runtime incapability with the reference "None available" branch | Revision 01 used the reference skill's "authority exhaustion" clause to justify a runtime-incapability placeholder; these are not the same condition, and the artifact could not distinguish {no command / runtime incapable / intentionally deferred} | §7 rewritten: P2.9 is 3-phase audit-only (Intake → Independent Audit → Verdict). No Verification Rerun phase exists in P2.9's variant. Revision 02 does not claim the reference "None available" clause as cover; the clause is out-of-scope. Verification deferrals are out-of-scope future work, not a degraded run |
| MED 3 | Slice ordering + close semantics inconsistencies | Revision 01 Slice 63 acceptance claimed Check 24 fixture compliance, but the fixture lands at Slice 65; Slice 68 close semantics collapsed three outcomes into one ACCEPT bucket | §9 Slice 63 acceptance evidence scoped to policy-table edit only (no fixture dependency). §9 Slice 68 acceptance evidence tri-valued: {clean generalization / validated with declared follow-on widening / not-yet-validated}. §10 Close criteria item 4 split to match |

### §0.C — Pass 02 (revision 02) fold-ins (revision 03)

Pass 02 (`specs/reviews/p2-9-second-workflow-codex-challenger-02.md`)
emitted REJECT-PENDING-FOLD-INS with 2 HIGH + 1 MED. One HIGH was
pass-01 HIGH 1 still-partial; two were new. Revision 03 folds all three.

| Pass-02 # | Severity | Objection | Revision-03 fold-in |
|---|---|---|---|
| HIGH 1 | §5 still misbinds the live dispatch contract, and Slice 64 does not pin the missing field | Revision 02 §5 declared `source: {kind: 'result', ref: 'result'}` but the live `ResultVerdictGate` contract at src/schemas/gate.ts:32-37,67-73 admits only `source: {kind: 'dispatch_result', ref: 'result'}`. Revision 02 Slice 64 promised to pin `writes.result`, `gate.pass`, and adapter JSON shape, but NOT `gate.source.kind` / `gate.source.ref` | §5 corrected: `source.kind` is `'dispatch_result'` (the live literal), `source.ref` is `'result'`. §9 Slice 64 deliverables extended to pin `gate.source.kind` and `gate.source.ref` literals in the schema-level dispatch-shape test. Evidence-census row E12 rewritten to cite `DispatchResultSource` at gate.ts:32-38 directly |
| HIGH 2 | Slice 64/66 assume a valid close-phase `review.result` without budgeting the live synthesis seam | Revision 02 Slice 66 acceptance claimed the close-phase synthesis step produces a valid `review.result` artifact parsing against the Zod schema. Current `writeSynthesisArtifact` at src/runtime/runner.ts:363-385 writes one placeholder-string per gate.required entry only; no synthesis-artifact schema-parse path exists in the runtime today (dispatch-result parse only, src/runtime/artifact-schemas.ts:3-17). Slice 66 as written cannot satisfy its acceptance evidence without synthesis-seam widening | §9 Slice 66 narrowed: end-to-end runtime test uses an INJECTED synthesis-writer stub (test-seam only) that reads the analyze-phase result file and produces the schema-valid artifact. The test proves the wiring and schema conformance when synthesis is customizable; it does NOT claim the generic runtime synthesis-writer supports review workflows. §9 adds named follow-on slice note: per-workflow synthesis-writer registration is declared explicit post-P2.9 substrate work. §10 Close criteria item 4 updated to surface this follow-on as a documented narrowing of the generalization claim |
| MED 1 | Slice 63 policy-test path points to a file that does not exist | Revision 02 Slice 63 cites `tests/policy/workflow-kind-policy.test.ts` but the actual file lives at `tests/contracts/workflow-kind-policy.test.ts` (tests/policy/ does not exist in the repo) | §9 Slice 63 path corrected to `tests/contracts/workflow-kind-policy.test.ts` |

### §0.D — Pass 03 (revision 03) fold-ins (revision 04)

Pass 03 (`specs/reviews/p2-9-second-workflow-codex-challenger-03.md`)
emitted ACCEPT-WITH-FOLD-INS — the three pass-02 objections all closed.
One new MED: E12/E13's citation anchors under-proved two "verified"
subclaims. Revision 04 folds the MED.

| Pass-03 # | Severity | Objection | Revision-04 fold-in |
|---|---|---|---|
| MED 1 | E12/E13 citation anchors under-prove two "verified" subclaims | E12 cited `src/runtime/runner.ts:503-540` for the "prompts instruct workers to return raw JSON" and "gate rejects missing/non-member verdicts" claims. Those behaviors are actually proved at `src/runtime/runner.ts:176-210` (`evaluateDispatchGate`) and `:224-247` (`composeDispatchPrompt`). E13's "dispatch-side parse path only" claim cited registry module comments but not the call-site at `src/runtime/runner.ts:537-538` | §1 E12 rewritten with both anchors (`evaluateDispatchGate` at 176-210 + `composeDispatchPrompt` at 224-247) replacing the weaker `:503-540` span; E13 rewritten to include the `parseArtifact` call-site at `:537-538` explicitly |

## §1 — Evidence census

Status values per claim: `verified` (file read and confirmed), `inferred`
(reasoned from visible evidence), `unknown-blocking` (needs resolution
before the arc can proceed).

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | Reference Circuit's `review` skill exists and declares a 4-phase spine (Intake → Independent Audit → Verification Rerun → Verdict). P2.9 inherits only 3 of those (audit-only scope; see §7). | verified | specs/reference/legacy-circuit/review-characterization.md §Observed phases |
| E2 | Reference `review` emits exactly one primary artifact (`review.md`); step-internal intermediates are not registry artifacts | verified | specs/reference/legacy-circuit/review-characterization.md §Observed artifacts |
| E3 | Target reselection confirmed `review` at P2.9 framing 2026-04-24 (twin-structure argument + ADR-0003 unblocked by characterization). P2.9 narrows to audit-only per revision 02 | verified | §Target-hypothesis-note above + ~/Code/circuit/skills/review/SKILL.md readable at cited path |
| E4 | circuit-next's DispatchRole enum already admits `reviewer` as a valid role — no schema widening needed to enforce REVIEW-I1 | verified | src/schemas/step.ts line 6 (z.enum(['researcher', 'implementer', 'reviewer'])) |
| E5 | circuit-next's current runtime does not execute verification commands as subprocesses; step kinds at src/runtime/runner.ts are `synthesis` (writes placeholder JSON) and `dispatch` (launches adapter CLI only). P2.9 audit-only scope does not require this capability | verified | src/runtime/runner.ts lines 479-503 + writeSynthesisArtifact at line 375 |
| E6 | Reference `review` skill's "None available" branch applies to authority-exhaustion cases, not runtime-incapability cases. P2.9 does not invoke this clause (see §7 scope framing) | verified | ~/Code/circuit/skills/review/SKILL.md lines 95-106 + pass-01 HIGH 2 disambiguation |
| E7 | WORKFLOW_KIND_CANONICAL_SETS authoritative definition lives at scripts/policy/workflow-kind-policy.mjs; scripts/audit.mjs imports it (MED 7 resolution) | verified | scripts/policy/workflow-kind-policy.mjs lines 37-44 |
| E8 | src/cli/dogfood.ts accepts `--rigor`, `--run-root`, `--fixture`, `--goal`, `--dry-run`, `--help` flags; no `--scope` flag | verified | src/cli/dogfood.ts argv parser |
| E9 | specs/invariants.json enforcement_state_semantics vocab: {audit-only, blocked, phase2-property, prose-only, static-anchor, test-enforced} — authoritative for any invariant declared in this plan | verified | specs/invariants.json::enforcement_state_semantics |
| E10 | specs/contracts/explore.md is the template for workflow-specific contracts; workflow-kind-seam pattern enumerates the 5 generalization risk points | verified | specs/contracts/explore.md + P2.9 flawed draft §"generalization seam" cited this pattern correctly |
| E11 | The flawed P2.9 draft's byte-identical committed copy at tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md is the plan-lint retroactive-proof reproducibility fixture — not to be deleted | verified | Slice 60 committed this fixture; specs/reviews/p2-9-plan-lint-retroactive-run.md §Input |
| E12 | `ResultVerdictGate.source` is the `DispatchResultSource` discriminant with `kind: z.literal('dispatch_result')` and `ref: z.literal('result')` — both literals fixed at the type layer. The gate's `pass` field is a non-empty array of strings; the dispatch prompt explicitly instructs workers to return raw JSON with a top-level string `verdict` field; the gate evaluator rejects non-object parse, missing `verdict`, non-string `verdict`, or `verdict` not drawn from `gate.pass` | verified | src/schemas/gate.ts lines 32-38 (DispatchResultSource literal kind/ref) + src/schemas/gate.ts lines 67-74 (ResultVerdictGate) + src/schemas/step.ts lines 60-73 (DispatchStep writes.result + gate wiring) + src/runtime/runner.ts lines 176-210 (evaluateDispatchGate — JSON parse / verdict field presence / gate.pass membership rejection paths) + src/runtime/runner.ts lines 224-247 (composeDispatchPrompt — "raw JSON ... verdict ... accepted-verdicts" instruction emitted into the dispatch prompt) |
| E13 | Current `writeSynthesisArtifact` (src/runtime/runner.ts:363-385) writes a flat JSON object with one placeholder string per `step.gate.required` entry — no synthesis-time schema parse, no per-workflow customization. Dispatch-side artifact-schema registry (`src/runtime/artifact-schemas.ts`) is scoped to dispatch-result bodies only, invoked at the dispatch call site where the adapter's result_body is schema-parsed | verified | src/runtime/runner.ts lines 375-386 (writeSynthesisArtifact implementation — placeholder body) + src/runtime/artifact-schemas.ts lines 3-17 + src/runtime/artifact-schemas.ts lines 53-58 (parseArtifact scoped to dispatchResult.result_body) + src/runtime/runner.ts lines 537-538 (the lone parseArtifact call site — dispatch-path only, no synthesis equivalent) |

## §2 — Why this plan exists

Phase 2 close criterion CC#P2-1 (per ADR-0007 §Decision.1) names
"one-workflow parity" as the target-bound close signal. `explore` reached
that at Slice 43c. One workflow proves the end-to-end protocol **once**. It
does not prove the protocol **generalizes** — a critical distinction. If
the second workflow requires re-authoring the adapter registry, the
dispatch transcript shape, the run-artifact naming rule, the fixture spine
discipline, or the audit-check kind map, the pattern hasn't actually
landed as reusable plumbing. It's landed as single-instance scaffolding.

The flawed first draft of this plan (2026-04-23, untracked at the time)
proposed a runtime-ambitious target: a `review` workflow that executes
verification subprocesses and materializes Markdown artifacts. Codex
challenger (specs/reviews/p2-9-plan-draft-content-challenger.md) exposed
6 HIGH and 7 MED findings, none of which were caught automatically at
the time. The Planning-Readiness Meta-Arc (specs/plans/planning-
readiness-meta-arc.md, closed 2026-04-23 Slice 62) installed the plan-
authoring-time gate. This plan is authored under that gate.

Revision 02 additionally narrows scope per pass 01 (§0.B): P2.9's `review`
variant is **audit-only** (3 phases, no Verification Rerun). A future
verification-bearing variant is a separate workflow kind, not a placeholder
in this one.

## §3 — Canonical phase set + title→canonical map

Reference Circuit's `review` skill uses workflow-kind-specific phase
titles (Intake → Independent Audit → Verification Rerun → Verdict). P2.9's
audit-only variant retains only three of those four, mapped onto
circuit-next's canonical set `{frame, analyze, plan, act, verify, review,
close}` declared at scripts/policy/workflow-kind-policy.mjs:

| Reference title | P2.9 inherits? | Canonical phase | Notes |
|---|---|---|---|
| Intake | yes | frame | Scope resolution via goal text |
| Independent Audit | yes | analyze | Dispatched reviewer emits findings |
| Verification Rerun | **no** | — (omitted) | Out of P2.9 scope per §7; future variant only |
| Verdict | yes | close | Aggregates findings, writes artifact |

**spine_policy.omits:** `{plan, act, verify, review}`. Rationale: `plan`
has no counterpart in review's investigation-shaped pattern; `act` is
omitted because P2.9 has no active-execution phase (verification deferred
per §7); `verify` is omitted because P2.9 does not exercise verification
commands; `review` is omitted because the adversarial pass IS the
Independent Audit phase (the "review phase" of a review workflow would be
pointless nesting).

The `review` entry lands at scripts/policy/workflow-kind-policy.mjs
(Slice 63) with `canonicals: ['frame', 'analyze', 'close']` and
`omits: ['plan', 'act', 'verify', 'review']`. canonical phase set of
{frame, analyze, close} with title→canonical map above is what the
policy constant encodes.

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
`verdict: "CLEAN"` iff `critical_count == 0` AND `high_count == 0`
(verification-passes clause omitted per P2.9 3-phase audit-only scope;
see §7 for scope rationale and §Target-hypothesis-note for why
verification-bearing variants are future work rather than placeholders in
this workflow)

enforcement_layer: test-enforced (schema-level pre-check) +
test-enforced (property test on the aggregation function).

**Rationale:** Revision 02 narrows the verdict rule to a 2-clause form
matching P2.9's audit-only scope. Adding a verification clause would
require either (a) a placeholder that always reports "unavailable" and
therefore makes CLEAN unreachable (rejected per pass-01 HIGH 2), or
(b) real verification capability (rejected as a pre-requisite substrate
arc — out of P2.9 scope). A future `review-with-verification` variant
would be a separate workflow kind carrying the 3-clause rule per
reference parity.

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

The registered artifact's structured JSON carries fields:
- `scope`: string (goal text resolved at Intake)
- `findings`: array of `{severity, id, text, file_refs}` (aggregated
  from the analyze-phase dispatch result file)
- `verdict`: enum `CLEAN | ISSUES_FOUND` (computed by REVIEW-I2 at close
  phase; the reviewer's own dispatch-step verdict is a distinct
  intermediate gate, see below)

### Analyze-phase dispatch shape (pass-01 HIGH 1 fold-in)

The `review` fixture's analyze-phase dispatch step binds to the live
`DispatchStep` contract at `src/schemas/step.ts:60-73` + `ResultVerdictGate`
at `src/schemas/gate.ts:67-74` (E12):

- `writes.result`: non-empty string path (relative to run root) where
  the adapter writes its raw JSON output. Per-step choice:
  `phases/analyze/review-raw-findings.json`.
- `gate`: `ResultVerdictGate` with `source: {kind: 'dispatch_result', ref:
  'result'}` — both literals fixed per the DispatchResultSource
  discriminant at gate.ts:32-38. The reviewer's JSON must carry a
  top-level string `verdict` field.
- `gate.pass` admits exactly two values: `NO_ISSUES_FOUND`,
  `ISSUES_FOUND`. These are **dispatch-step gate verdicts**, not the
  workflow's final verdict. The reviewer emits a tentative verdict
  based on what it observed, but the workflow's artifact-level verdict
  is re-computed by the close-phase synthesis step from the `findings`
  array using REVIEW-I2's deterministic rule. This two-level
  distinction is explicit: the dispatch gate is a liveness check (the
  reviewer finished and declared a posture); the artifact verdict is
  the authoritative summary.

The adapter's JSON response shape:

```
{ "verdict": "NO_ISSUES_FOUND" | "ISSUES_FOUND",
  "findings": [ { "severity": "critical"|"high"|"low",
                  "id": "...",
                  "text": "...",
                  "file_refs": [...] }, ... ] }
```

The synthesis step reads the file at `writes.result`, parses it, builds
the findings array of the registered artifact, and computes the final
`verdict` per REVIEW-I2. No Markdown synthesis in the runtime — that
deferral is intentional (HIGH 6 fold-in remains in force).

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

Reference Circuit's `review` fast-modes (explicit scope paths / current
diff / recent commit) are out of P2.9 scope: the initial `review` fixture
accepts goal text only. A future slice can extend the intake to admit
scope-path arguments if operator usage demands it.

## §7 — P2.9 scope: 3-phase audit-only

P2.9's `review` variant is **audit-only**: `frame` (Intake) → `analyze`
(Independent Audit) → `close` (Verdict). There is NO Verification Rerun
phase in P2.9's variant.

Reference Circuit's 4-phase `review` skill includes a Verification Rerun
phase that requires subprocess execution (test / lint / check commands).
Revision 01 of this plan proposed a placeholder Verification Rerun step
that would always report "unavailable" under the pretense of the
reference skill's "None available" branch. Codex pass-01 HIGH 2 rejected
that framing: the reference branch is about **authority exhaustion** (no
verification command exists to run), not **runtime incapability** (a
command might exist but the runtime cannot execute it). Conflating the
two broke the artifact's ability to distinguish {no command / runtime
incapable / intentionally deferred}, and left REVIEW-I2's CLEAN path
unreachable.

Revision 02 drops the placeholder framing. P2.9 has no Verification
Rerun step at all. The artifact has no `verification_status` field.
REVIEW-I2 is 2-clause. The workflow makes a narrower claim (audit-only
generalization) honestly.

Future work: a **separate** workflow kind — tentatively
`review-with-verification` — would register its own entry in
WORKFLOW_KIND_CANONICAL_SETS, extend the canonical set with the `act` or
`verify` phase, add a new step kind with subprocess-execution capability
(substrate-widening slice), and carry a 3-clause REVIEW-I2 variant that
includes the `verification_passes` clause. That workflow kind is not
part of P2.9. Slot ordering among post-P2.9 options (see §11) is an
operator decision.

## §8 — Verdict rule

Per REVIEW-I2 (§4), the `review` workflow's verdict is deterministic:

- **CLEAN iff** `critical_count == 0` AND `high_count == 0`
  (verification-passes clause omitted per P2.9 3-phase audit-only scope;
  a future verification-bearing variant workflow would re-introduce the
  verification clause per reference parity — see §7)
- **ISSUES_FOUND** otherwise.

The aggregation is orchestrator-authored (close-phase synthesis step).
No model-in-the-loop verdict synthesis — the rule is a pure function of
the analyze-phase findings file.

## §9 — Slices

Six execution slices + one arc-close ceremony slice. Each declares its
own lane and framing triplet at landing per CLAUDE.md §Lane discipline.
Acceptance evidence per slice is normative; lane / slice ids are
provisional (may re-number with session context, but ordering is fixed).

### Slice 63 — Policy-table seam

**Lane:** Ratchet-Advance (workflow-kind-policy table gains an entry;
characterization-doc reference gets its second binding site).

**Deliverables:** Add `review` entry to
`scripts/policy/workflow-kind-policy.mjs::WORKFLOW_KIND_CANONICAL_SETS`
with `canonicals: ['frame', 'analyze', 'close']` and
`omits: ['plan', 'act', 'verify', 'review']` and a title-map matching §3.
Add a corresponding row to `tests/contracts/workflow-kind-policy.test.ts`
(the actual live location; `tests/policy/` does not exist in the repo)
validating the entry. No fixture changes in this slice.

**Acceptance evidence:** `npm run verify` green (new
tests/contracts/workflow-kind-policy.test.ts row passes). `npm run audit`
green. No Check 24 fixture-compliance claim in this slice; that lands at
Slice 65 when the fixture itself lands.

### Slice 64 — Invariants + artifact schema + dispatch-shape test

**Lane:** Ratchet-Advance (invariant count advances; schema count
advances).

**Deliverables:** Land `src/schemas/artifacts/review.ts` with the Zod
schema for the registered `review.result` artifact per §5. Land
tests/properties/visible/review-i1.test.ts (structural-ordering
property: close-phase synthesis step preceded by analyze-phase dispatch
step with role=reviewer). Land tests/properties/visible/review-i2.test.ts
(verdict-aggregation property on randomized finding-count inputs).
Update specs/invariants.json with REVIEW-I1 and REVIEW-I2 entries
carrying the enforcement_layer values from §4. Author a schema-level
test pinning the analyze-phase dispatch shape from §5 — the test pins
each of: `writes.result` non-empty string path, `gate.source.kind`
literal `'dispatch_result'`, `gate.source.ref` literal `'result'`,
`gate.pass` vocabulary `['NO_ISSUES_FOUND', 'ISSUES_FOUND']`, and the
adapter JSON response shape carrying `verdict` string + `findings`
array. All four source/gate/pass/shape literals are explicit in the
test — not inferred from ResultVerdictGate by parse, but literal-checked
so a future schema widening that relaxes any of them is caught here.

**Acceptance evidence:** `npm run verify` green with 3 new tests passing
(2 property + 1 dispatch-shape). `npm run audit` green. specs/invariants.json
carries REVIEW-I1 and REVIEW-I2.

### Slice 65 — Contract + fixture

**Lane:** Ratchet-Advance (contract count advances; fixture count
advances).

**Deliverables:** Land `specs/contracts/review.md` following the
specs/contracts/explore.md template. Land
`.claude-plugin/skills/review/circuit.json` as the runtime fixture
exercising the 3-phase review spine. Bind artifact_ids and invariant_ids
per §4 / §5. The fixture's analyze-phase dispatch step uses the shape
pinned at Slice 64.

**Acceptance evidence:** `npm run verify` green. `npm run audit` green
with Check 24 (spine coverage) reporting the review fixture as compliant
with the 3-phase canonical-phase-set policy entry added in Slice 63.
Contract test row under tests/contracts/ passes.

### Slice 66 — Runtime dispatch + adapter wiring (narrowed per pass-02 HIGH 2)

**Lane:** Ratchet-Advance (adapter-dispatch coverage advances to a second
workflow kind). Lane is narrow: the runtime synthesis-writer is NOT
widened in this slice.

**Scope narrowing.** The current runtime synthesis writer
(`writeSynthesisArtifact` at src/runtime/runner.ts:375-386, per E13)
writes placeholder strings per gate.required entry and has no per-
workflow customization. A review close-phase that reads the analyze-
phase dispatch result and produces a schema-valid aggregated artifact
requires either (a) a per-workflow synthesis-writer registration on the
runtime, or (b) a specialized close-step kind. **P2.9 does NOT land
either.** Declared named follow-on: `Slice 70 — per-workflow synthesis
writer registration` (post-P2.9, operator-scheduled).

**Deliverables:** Wire the `review` fixture through the dogfood run
loop. Add an end-to-end test that: (i) stubs the dispatch adapter to
emit adapter JSON matching §5's shape, (ii) injects a custom synthesis-
writer function (test-seam only, not a runtime feature) that reads the
analyze-phase dispatch result file and produces the schema-valid
`review.result` artifact per REVIEW-I2's aggregation rule, (iii) asserts
the analyze-phase dispatch gate admits `NO_ISSUES_FOUND` /
`ISSUES_FOUND` against the stubbed adapter output, (iv) asserts the
produced artifact parses against src/schemas/artifacts/review.ts, (v)
asserts REVIEW-I2 computes the artifact-level verdict correctly on the
stubbed findings input.

**Honesty about the boundary.** The injected synthesis-writer proves the
review workflow is WIREABLE end-to-end when synthesis is customizable;
it does NOT prove the generic runtime synthesis writer supports review
workflows today. Slice 68's generalization proof must surface this as a
"validated-with-declared-follow-on" outcome on the synthesis-seam risk
point unless Slice 70 also lands pre-close.

**Acceptance evidence:** `npm run verify` green with new runtime test.
Event log shows `step.entered` / `step.artifact_written` / `gate.evaluated`
events in correct order for all 3 phases (frame → analyze → close).
Test file explicitly comments the injected-synthesis-writer boundary so
future readers see the narrowed scope.

### Slice 67 — Plugin command + CLI wiring

**Lane:** Ratchet-Advance (plugin-command count advances to 3 — adds
`/circuit:review`).

**Deliverables:** Add `/circuit:review` plugin command body invoking
`npm run circuit:run -- review --goal "<scope>"`. Extend audit Check 23
to assert 3-command closure (or confirm it's already N-command per Slice
52). Extend src/cli/dogfood.ts if the positional workflow argument needs
to admit `review` (it already does per E8 inference — verify at Slice
open).

**Acceptance evidence:** `npm run verify` green. `npm run audit` green
with Check 23 reporting closure for 3 commands. Command-surface tests
pin that `/circuit:review` invokes the positional `review` workflow with
the safe `--goal` construction. Manual smoke expectation is bounded to:
`/circuit:review` with a scope argument reaches the review fixture and
surfaces run artifacts plus the current synthesis-writer caveat. It MUST
NOT claim that the default CLI path produces schema-valid `review.result`
until the post-P2.9 per-workflow synthesis-writer registration follow-on
lands. The schema-valid `review.result` proof for P2.9 remains the
Slice 66 injected-writer test seam. Post-close note: the follow-on landed
at actual Slice 83, so this command-surface caveat is no longer present in
the live `/circuit:review` command body.

### Slice 68 — Second-workflow parity proof

**Lane:** Equivalence Refactor if the explore-pattern generalized
cleanly; Discovery if generalization required widening. Lane declared
at slice open based on observed state from slices 63-67.

**Deliverables:** Walk through the 5 generalization risk points named in
the flawed draft's §"generalization seam" (canonical phase set uniform,
invariant shape, artifact-count balance, plugin-command composability,
audit-rule kind-independence). Record observed generalization state in a
report at `specs/reviews/p2-9-generalization-proof.md`. Per risk point,
classify observed state into one of three outcomes:

- **clean:** the explore-established pattern held without widening.
- **validated-with-declared-follow-on:** pattern held after a targeted
  widening that landed in the same slice (63-67) as the risk discovery,
  OR pattern did not hold but the gap is narrow and captured as a named
  follow-on slice.
- **not-yet-validated:** pattern did not hold and the gap materially
  changes the generalization claim; P2.9 may still close but the arc's
  acceptance evidence must narrate the re-framing.

**Acceptance evidence:** Report committed at specs/reviews/p2-9-
generalization-proof.md with per-risk-point outcome from the three
classes above. Aggregate outcome (any `not-yet-validated` ⇒ narrow the
close claim per §10 item 4).

### Slice 69 — Arc-close ceremony

**Lane:** Ratchet-Advance (arc-close gate satisfied).

**Deliverables:** Two-prong composition review (Claude fresh-read + Codex
via /codex) per CLAUDE.md §Cross-slice composition review cadence. Update
`PROJECT_STATE.md current_slice` to 69 in same commit as review files per
audit Check 26 staging discipline. Update ARC_CLOSE_GATES table in
scripts/audit.mjs to add the p2-9-second-workflow entry. Update this plan
frontmatter `status: closed`, `closed_at`, `closed_in_slice: 69`,
`closed_with: <summary of what landed, including the Slice 68 aggregate
outcome class>`.

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
4. Slice 68 generalization-proof report classifies each risk point. The
   arc's close claim adjusts to the Slice 68 aggregate outcome:
   - **All clean:** close claim is "P2.9 audit-only review-family
     generalization validated cleanly." (Gate: Slice 68 report shows 5/5
     clean.)
   - **Clean or with-declared-follow-on:** close claim is "P2.9 audit-
     only review-family generalization validated; N targeted follow-on
     slices declared for <named gaps>." Per §9 Slice 66, the synthesis-
     writer seam is a known "with-declared-follow-on" outcome absent a
     pre-close Slice 70 landing — the default aggregate outcome is
     "with-declared-follow-on" unless Slice 70 lands during P2.9.
     (Gate: Slice 68 report shows clean + with-declared-follow-on only.)
   - **Any not-yet-validated:** close claim is "P2.9 audit-only review
     workflow landed; generalization claim narrowed to <re-framed
     scope>." (Gate: Slice 68 report shows ≥1 not-yet-validated with the
     re-framing documented.)
   In all three cases the arc-close ceremony at Slice 69 proceeds; the
   Check 26 ARC_CLOSE_GATES entry for p2-9-second-workflow passes on the
   presence of the report + the two prong files, not on aggregate
   outcome class.
5. Parent plan `specs/plans/phase-2-implementation.md §P2.9` slot is
   marked complete with the appropriate aggregate-outcome class from
   item 4; `specs/plans/phase-2-implementation.md §P2-CLOSE-CRITERIA`
   table is not affected (per ADR-0007 Addendum A, second-workflow
   generalization is separated from CC#P2-1).

## §11 — Arc trajectory

This arc advances two independent ratchets:
- Workflow-kind coverage (1 → 2): the first empirical test of whether
  the explore-established pattern generalizes for an audit-only
  review variant.
- Plugin-command closure (2 → 3): `/circuit:review` joins `/circuit:run`
  and `/circuit:explore`.

Neither obsoletes any earlier slice. The Planning-Readiness Meta-Arc
(Slices 57–62, closed) is pre-requisite discipline for this arc's plan-
authoring; no slice within P2.9 modifies meta-arc artifacts.

Post-P2.9 options include: (a) third-workflow slice to further test
generalization across additional workflow kinds (repair / build / sweep /
migrate); (b) a substrate-widening slice adding real verification
subprocess execution alongside a new `review-with-verification` workflow
kind (per §7 future-variant framing); (c) /circuit:run routing heuristic
work (deferred from P2.9 per MED 9); (d) review fast-mode intake
extensions (per §6 scope-path deferral); (e) **Slice 70 — per-workflow
synthesis-writer registration** (declared follow-on per §9 Slice 66 HIGH 2
fold-in; promotes the test-seam-injected synthesis writer to a
runtime-level per-workflow registration so `review` close-phase synthesis
is a real runtime capability rather than a test-only wiring). The
per-workflow synthesis-writer follow-on closed after P2.9 at actual Slice
83. Slot-ordering among the remaining options is an operator-decision at
P2.9 close.
