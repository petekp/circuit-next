---
review: planning-readiness-meta-arc-codex-challenger-01
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
verdict: REJECT-PENDING-FOLD-INS
objections_count: 12
fold_ins_minimum: 3
reviewed_plan:
  plan_slug: planning-readiness-meta-arc
  plan_revision: 01
  plan_base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
  plan_content_sha256: not-captured (pre-revision-04-hash-requirement; revision 01 content was superseded before hash became enforcement-bound)
  plan_status_at_review: evidence-draft (untracked)
continuity_source: .circuit/control-plane/continuity-records/continuity-4930a90a-ad22-4fa8-a172-43802d2f1a2f.json
purpose: |
  Persist the Codex cross-model challenger pass against the planning-readiness-
  meta-arc plan (the reflexive arc that proposes the discipline to close the
  P2.9 failure mode). This pass IS the discipline working on its own authoring
  — the new discipline (challenger-before-operator-signoff) caught 12 real
  flaws before operator sign-off was requested. Reflexive validation
  **succeeds** in the sense of "caught flaws"; reflexive verdict is REJECT
  because those flaws must be folded before sign-off is valid.
---

# Planning-Readiness Meta-Arc — Codex Challenger Pass 01

## Verdict

**REJECT-PENDING-FOLD-INS.** 12 objections, 3 minimum fold-ins required
before re-dispatch. All 12 objections are technically valid. Fold-in
pass 02 required before operator sign-off.

## Summary

Plan is structurally coherent and the arc shape is correct. The 12
objections are a mix of mechanical fixes (~8), substantive gaps
(~4), and two CRITICAL items that invalidate core payload fields if
unaddressed.

## Objections (severity-ordered)

### CRITICAL 9. Enforcement-layer vocabulary mismatch with `specs/invariants.json`
**Severity:** CRITICAL.

Plan's §3 lint-rule inventory proposes enforcement-layer vocabulary
`{schema, runtime, audit, test, manual-evidence, blocked}` as a closed
set for `plan-lint.invariant-without-enforcement-layer`. This set does
**NOT** match the existing circuit-next invariant states codified at
`specs/invariants.json::enforcement_state_semantics`:
`{test-enforced, audit-only, static-anchor, prose-only, phase2-property}`.
Adopting the proposed set would force lossy relabeling across every
existing invariant (ADAPTER-I1..I8, EXPLORE-I1, contract + behavioral-
track). Resolution: align plan-lint vocabulary to the observed set.
Add new states only if a gap exists — `blocked` (substrate-widening
required) is a genuinely new state; the others map to existing vocab.

### CRITICAL 11. Untracked-draft loophole survives
**Severity:** CRITICAL.

Plan's Slice 58 defines `audit.mjs` new Check to run plan-lint "on
committed `specs/plans/*.md`". This is **exactly the loophole P2.9
exploited** — untracked draft plans carrying non-existent paths, stale
symbol ownership, and unenforced claims reached operator sign-off with
zero programmatic pushback. Closing the loophole requires one of:
(a) plan must be committed before operator sign-off is valid — operator-
signoff must read from git-committed state, not untracked working-tree
state; (b) plan-lifecycle state machine that requires `challenger-
cleared` status (itself requiring a committed Codex review artifact)
before sign-off is accepted; (c) UserPromptSubmit hook that detects
sign-off language in operator input and injects a reminder to run
plan-lint first. Strongly prefer (a)+(b) combined — state-machine the
lifecycle such that untracked status is pre-challenger only.

### HIGH 1. Rule count contradiction (10 vs 12)
**Severity:** HIGH.

§3 of plan lists 10 rules including 2 invariant rules
(`plan-lint.invariant-without-enforcement-layer`,
`plan-lint.blocked-invariant-without-substrate-slice`). Slice 59
frames as "invariant enforceability dimension" **adding** the invariant
rules — double-counting. Either the baseline is 8 rules (§3 removes
invariant rules → Slice 58 count 8, Slice 59 extends to 10) or the
baseline is 10 (§3 includes invariant rules → Slice 59 does not add
them, it reorganizes/hardens). Resolution: baseline at 10, Slice 59
extends **beyond** 10 — add new dimensions Codex enumerates (HIGH 2-5
below) OR move invariant rules to Slice 59 exclusively and baseline is
8.

### HIGH 2-5. Missing rule dimensions
**Severity:** HIGH (4 separate items).

Plan's 10-rule baseline misses four real failure modes the P2.9 draft
demonstrated:

- **HIGH 2. Arc-level trajectory check.** CLAUDE.md:90 mandates a
  trajectory check at slice framing but not at plan authoring. P2.9's
  draft collapsed a conditional target to a normative target without
  the "what Phase 2 evidence now says" census. Rule
  `plan-lint.arc-trajectory-check-present` must require an §Entry-state
  section (or equivalent) showing arc-level trajectory justification.
- **HIGH 3. Live-state evidence ledger.** P2.9 draft cited stale symbol
  ownership (WORKFLOW_KIND_CANONICAL_SETS at audit.mjs, when it moved
  to workflow-kind-policy.mjs). Rule `plan-lint.live-state-evidence-
  ledger-complete` must require structured verified / inferred /
  unknown-blocking census for every cited symbol and file.
- **HIGH 4. CLI command-shape verification.** P2.9 draft invoked CLI
  with `--scope` when actual CLI uses `--goal` + positional workflow.
  Rule `plan-lint.cli-invocation-shape-matches` must verify plan's CLI
  invocations against actual CLI help output (or documented invocation
  signatures).
- **HIGH 5. Artifact cardinality mapping.** P2.9 draft declared 4
  artifacts where reference surface has 1. Rule
  `plan-lint.artifact-cardinality-mapped-to-reference` must require
  successor-to-live plan payloads to record reference cardinality and
  justify departures (per ADR-0003).

### HIGH 6. Slice ordering wrong
**Severity:** HIGH.

Plan orders: Slice 57 (ADRs) → 58 (plan-lint baseline) → 59 (invariant
dim extension) → 60 (memory+CLAUDE.md discipline) → 61 (retroactive
proof) → 62 (arc-close). This lands discipline (memory rule, CLAUDE.md
process sequence) on a **tool that has not yet proven effective against
real flaws**. If retroactive proof at Slice 61 reveals rule gaps, Slice
60 memory + CLAUDE.md updates were premature — they told operators to
trust a tool that isn't ready. Resolution: swap slices — retroactive
proof BEFORE discipline hardening. New order: 57 → 58 → 59 → (retroactive
proof, now Slice 60) → (memory+CLAUDE.md, now Slice 61) → 62.

### HIGH 7. Finding denominator is mutable session record
**Severity:** HIGH.

Plan §3 cites "13 verified findings against the P2.9 draft" as denominator
for Slice 61 retroactive-proof ratio. Source is continuity record
(`.circuit/control-plane/continuity-records/continuity-79f40bf8*.json`)
— mutable, local-to-machine, not git-tracked. ADR-0010 cannot cite a
mutable local artifact as authority. Resolution: persist Codex's findings
to `specs/reviews/p2-9-plan-draft-content-challenger.md` as committed
evidence BEFORE ADR-0010 authoring. Plan references the committed file,
not the continuity record.

### HIGH 8. §8 Self-validation hand-waves the ledger ADR-0010 requires
**Severity:** HIGH.

§8 claims plan is "authored under the same discipline it proposes" but
the §Evidence census (§1) is narrative prose, not a structured ledger
with per-claim verified/inferred/unknown-blocking tags as ADR-0010
demands. Resolution: restructure §1 as a structured table with explicit
status per claim, and §8 references specific rows of that table.

### HIGH 10. ≥70% threshold too permissive
**Severity:** HIGH.

Plan's Slice 61 acceptance criterion is "findings-caught ratio ≥ 70%".
A 70% threshold could pass while plan-lint catches 0/6 HIGH findings
and 9/7 lower findings — mathematically adequate, substantively failed.
Resolution: severity-aware threshold. Required: 100% HIGH findings
caught + ≥70% combined overall. If any HIGH missed, rule set extends
before arc close regardless of overall ratio.

### MED 12. Known-good fixture p2-11 has no §Evidence census
**Severity:** MED.

Plan proposes `specs/plans/p2-11-plugin-wiring.md` as known-good
fixture for `plan-lint.evidence-census-present` rule. That plan has no
§Evidence census section (it predates the discipline). Plan-lint would
fire on p2-11, contradicting its own "known-good" fixture status.
Resolution: author a purpose-built minimal compliant fixture plan
(e.g., `tests/fixtures/plan-lint/good/minimal-compliant-plan.md`)
rather than grandfathering p2-11.

## Three minimum fold-ins (Codex priority order)

**A. Structural finding-count fix + 4 missing rules.**
Resolve rule-count contradiction (HIGH 1). Add the 4 missing dimensions
(HIGH 2-5): arc-trajectory, live-state evidence ledger, CLI shape,
artifact cardinality.

**B. Persist findings as committed evidence.**
Commit `specs/reviews/p2-9-plan-draft-content-challenger.md` with
structured 13-finding ledger (HIGH/MED severity-tagged) BEFORE ADR-0010
authoring. Plan's citation target becomes the committed file, not the
continuity record.

**C. Slice reorder + severity-aware threshold.**
Swap slices so retroactive proof lands before discipline-hardening
(HIGH 6). Replace 70% threshold with 100% HIGH + ≥70% overall (HIGH 10).

## Remaining objections for operator disposition

**CRITICAL 9 (vocabulary) + CRITICAL 11 (untracked-draft) require
operator-level decision on scope of substrate change.** Codex cannot
unilaterally extend specs/invariants.json vocabulary or mandate a plan-
lifecycle state machine; those touch discipline surface at a level
that needs operator sign-off on the shape of the fix.

## Reflexive remark

This challenger pass is the discipline working on its own authoring.
The 12 objections are the evidence that challenger-before-operator-
signoff is the right gate — without this pass, the flawed plan would
have reached operator sign-off with the same structural flaws P2.9
did. Plan passes 02 (after fold-ins) is required before sign-off is
valid.
