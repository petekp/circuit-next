---
review: planning-readiness-meta-arc-codex-challenger-02
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
review_session_id: 019db8fa-f307-7983-a98e-e271f799fa38
verdict: REJECT-PENDING-FOLD-INS
fold_ins_minimum: 7
prior_objections_count: 12
prior_objection_resolution:
  resolved: 4
  partial: 7
  unresolved: 1
new_findings:
  critical: 2
  high: 2
  med: 2
reviewed_plan:
  plan_slug: planning-readiness-meta-arc
  plan_revision: 02
  plan_base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
  plan_content_sha256: not-captured (pre-revision-04-hash-requirement; revision 02 content was superseded before hash became enforcement-bound)
  plan_status_at_review: evidence-draft (untracked)
  plan_line_count_at_review: 803
purpose: |
  Persist the Codex cross-model challenger pass 02 verdict against
  planning-readiness-meta-arc.md revision 02 as durable committed
  authority. Pass 02 returned REJECT-PENDING-FOLD-INS with 7 minimum
  fold-ins; all 7 are addressed in revision 03.
---

# Planning-Readiness Meta-Arc — Codex Challenger Pass 02

## Verdict

**REJECT-PENDING-FOLD-INS.** Revision 02 is materially better than
revision 01, but not sign-off ready. Revision 02 resolves several
prior objections in text, but introduces new lifecycle and audit-
scope failures that would either block the repo immediately or allow
stale challenger artifacts to bless changed plans.

## Prior-objection resolution (revision 01 → 02)

| Prior # | Status | Note |
|---|---|---|
| 1. Rule count contradiction | PARTIAL | §3 now says 15 baseline + 2 invariant rules = 17, but the fold-in map still says Slice 58 = 12, Slice 59 = +2, total 14. |
| 2. Missing arc trajectory rule | PARTIAL | Rule #11 exists, but the plan itself still lacks a clear §Entry-state / arc trajectory section satisfying its own rule. |
| 3. Missing live-state evidence ledger | PARTIAL | §1 is structured now, but not every cited file/symbol is ledgered; some "verified" rows rely on prior pass relay rather than direct evidence. |
| 4. Missing CLI shape rule | PARTIAL | Rule #13 exists, but revision 02 introduces a new command-shape mismatch: `--path <plan-file>` in ADR-0010 deliverable vs positional `npm run plan:lint -- <path>` in acceptance evidence. |
| 5. Missing artifact cardinality rule | RESOLVED | Rule #14 exists and is scoped to successor-to-live payloads. |
| 6. Slice ordering wrong | RESOLVED | Retroactive proof now lands before memory/CLAUDE.md discipline, at Slices 60/61. |
| 7. Mutable denominator | UNRESOLVED | P2.9 findings file exists but is untracked. Plan claims it is committed durable evidence but repo state says `?? specs/reviews/p2-9-plan-draft-content-challenger.md`. |
| 8. Self-validation ledger hand-wave | PARTIAL | §8 references §1 rows, but recursive validation fails: plan is still untracked/evidence-draft while challenger pass 02 is being run. |
| 9. Enforcement vocabulary mismatch | PARTIAL | Existing vocabulary is aligned, but `blocked` is still half-designed and may become an "unenforced normative invariant" escape hatch. |
| 10. ≥70% threshold too permissive | RESOLVED | Slice 60 now requires HIGH 6/6 plus combined ≥10/13. |
| 11. Untracked-draft loophole | PARTIAL | State machine exists, but does not bind challenger artifact freshness to current plan revision/content, and current repo state violates the proposed sequence. |
| 12. p2-11 known-good fixture | RESOLVED | No longer canonical known-good fixture. (NEW concern: legacy-plan exemption is too narrow for existing committed plans — see NEW CRITICAL 2.) |

## New findings (revision 02)

### CRITICAL 1. Lifecycle gate does not prove challenger reviewed the CURRENT plan

Rule #17 (`plan-lint.status-challenger-cleared-requires-committed-
challenger-artifact`) only requires a committed
`*-codex-challenger-*.md` with ACCEPT-class verdict. It does **not**
bind `plan`, `revision`, `base_commit`, content hash, or predecessor
SHA. A stale ACCEPT artifact could clear a materially changed plan
by matching filename glob alone.

Resolution: strengthen Rule #17 to require the challenger review file
carry `reviewed_plan:` frontmatter fields matching the current plan's
identity (slug, revision, base_commit, and optionally content hash).

### CRITICAL 2. Audit-on-all-committed-plans breaks the existing plan corpus

Rule #15 only allows the new vocabulary (`evidence-draft`,
`challenger-pending`, `challenger-cleared`, `operator-signoff`,
`closed`). Existing committed plans use statuses like:

- `closed` (clean-clone-reality-tranche.md, p2-11-plugin-wiring.md) — OK
- `active — target workflow locked to explore ...` (phase-2-implementation.md) — NOT OK
- `active — drafted 2026-04-21 post-composition-review ...` (phase-2-foundation-foldins.md) — NOT OK
- `in-progress` (slice-47-hardening-foldins.md) — NOT OK
- `superseded` (project-holistic-foldins.md) — NOT OK
- `draft` (p2-9-second-workflow.md, untracked) — NOT OK
- No `status:` at all (phase-1-close-revised.md, arc-remediation-plan-codex.md)

Check 36 would red-fail the existing repo at Slice 58 landing. The
legacy exemption at §4 Slice 58 only names rules #1 (evidence-census)
and #11 (arc-trajectory); it does NOT exempt rule #15 (status vocab)
for legacy plans.

Resolution: migration / effective-date strategy. Either widen
Rule #15 allowed set to include legacy values OR add an effective-
date gate (plans opened pre-2026-04-23 exempt from all rules, not
just #1 and #11).

### HIGH 3. Repo state contradicts the plan's own next steps

The plan says (§8 Self-validation step 1): "Commit this revised plan
+ both Codex review artifacts ... Status transitions evidence-draft
→ challenger-pending. Dispatch Codex challenger pass 02."

Current repo state:

```
?? scripts/plan-lint.mjs
?? specs/adrs/ADR-0010-arc-planning-readiness-gate.md
?? specs/plans/p2-9-second-workflow.md
?? specs/plans/planning-readiness-meta-arc.md
?? specs/reviews/p2-9-plan-draft-content-challenger.md
?? specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md
 M specs/adrs/ADR-0003-authority-graph-gate.md
```

Plan + reviews are untracked. Slice 57/58 artifacts (`ADR-0010`,
modified `ADR-0003`, `scripts/plan-lint.mjs`) exist in working tree
before Slice 57 has opened. Process is not following the plan's own
prescription.

Resolution: commit the plan + reviews before re-dispatch. Remove
Slice 57/58 artifacts from working tree until Slice 57 opens OR
explicitly mark them as draft/non-slice evidence.

### HIGH 4. Rule inventory still misses several P2.9 HIGHs

The P2.9 HIGH findings the current rule set does not explicitly
catch:

- HIGH 1: canonical phase mapping (plan declares phase set that
  doesn't map to schema-valid canonicals).
- HIGH 4: verdict determinism (plan's verdict rule missing
  verification-passes clause).
- HIGH 5: verification-runtime capability (plan assumes runtime
  subprocess exec where only placeholder JSON currently lands).
- HIGH 6: markdown materialization (plan's artifact shapes require
  schema widening not yet landed).

Rule #9 (`contract-shaped-payload-without-characterization`) may
catch some by broad interpretation, but its text is narrower. Need
explicit coverage.

Resolution: add rules #18-#21 for these dimensions, OR widen rule #9
text explicitly.

### HIGH 5. `blocked` needs close-out semantics

`enforcement_layer: blocked` with a named `substrate_slice` is not
enough. Without close-out semantics, a plan can declare a blocked
invariant and reach arc close / operator-signoff without resolving
it. The plan must forbid arc close OR operator sign-off while any
blocked invariant remains unresolved, UNLESS explicitly marked
migration-escrow with expiry + reopen condition.

Resolution: extend `blocked` state semantics. Required fields:
`substrate_slice` + `owner` + `expiry_date` + `reopen_condition` +
`acceptance_evidence` (post-resolution). Rule #8 enforces all of
these. Additionally: new rule #N forbids `status: operator-signoff`
or `status: closed` while any `enforcement_layer: blocked` invariant
exists without resolution evidence.

### MED 6. Plan lifecycle says "four states" but rule #15 and Slice 62 use `closed`

Plan §Plan-lifecycle table has 4 rows (evidence-draft, challenger-
pending, challenger-cleared, operator-signoff). Rule #15 and Slice
62 use `closed` as a 5th state. Inconsistency.

Resolution: add `closed` to lifecycle table as 5th state OR remove
it from the valid set + Slice 62 frontmatter update path.

### MED 7. Draft plan-lint fails plan reflexively with 3 red findings

The already-present draft `plan-lint` script fails the revision 02
plan with 3 red findings:

1. `tests/contracts/review.md` mentioned in §2 failure-mode narrative
   (false positive — narrative reference, not deliverable).
2. `enforcement_layer: blocked` at §3.D (false positive — rule
   description, not invariant declaration).
3. `enforcement_layer: blocked` at §3.D again.

The proposed rules need section-aware scoping before they can be
trusted reflexively.

Resolution: plan-lint rules #3, #7, #8 need section-aware scoping:
skip matches inside §2 Failure-mode ledger (narrative), skip matches
inside §3 Lint-rule inventory (rule descriptions).

## Minimum fold-ins required (Codex enumeration)

1. **Commit plan + reviews before re-dispatch.** Or stop claiming
   "committed durable evidence" until they are committed. Keep slice
   implementation artifacts out of the sign-off commit unless
   explicitly marked draft/non-slice evidence.

2. **Strengthen lifecycle enforcement.** Bind challenger artifacts
   to `plan`, `revision`, `base_commit`, and preferably plan content
   hash; enforce `operator_signoff_predecessor`; reject stale
   accept-class artifacts.

3. **Add migration / effective-date strategy** for existing committed
   plans so audit Check 36 does not red-fail the current repository.

4. **Fix rule-count and CLI inconsistencies.** 17-rule inventory
   everywhere, and one plan-lint interface (positional or `--path`,
   not both).

5. **Add explicit rule coverage for P2.9 HIGH 1, 4, 5, 6** OR widen
   rule #9 text to include phase-spine mapping, verification-runtime
   assumptions, and artifact materialization capability.

6. **Add a real §Entry-state / arc trajectory section** to the plan,
   then make it pass its own lint without false positives
   (section-aware scoping).

7. **Decide `blocked`.** Drop it, or make it a non-closable temporary
   state with `substrate_slice`, `owner`, `expiry`, `reopen_
   condition`, and `acceptance_evidence` proving resolution before
   arc close.

## Recursive validation check

Does the plan pass its own rules? **No.**

It is still `status: evidence-draft`, untracked, and being challenged
before the `challenger-pending` transition the plan itself
prescribes. The two review artifacts are also untracked. The plan
lacks the arc trajectory section required by its new rule #11. The
draft linter already present in the working tree flags the plan red.
The recursive-validation invariant currently fails.

**Go/no-go: no-go for operator sign-off** until minimum fold-ins
land and pass 03 is re-run from a committed `challenger-pending`
plan.
