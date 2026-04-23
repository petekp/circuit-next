---
name: p2-9-plan-lint-retroactive-run
description: Slice 60 retroactive proof — plan-lint run against the flawed P2.9 draft + cross-reference against the 13-finding Codex ledger.
type: review
review_kind: retroactive-proof
review_date: 2026-04-23
review_target: specs/plans/p2-9-second-workflow.md
lint_input_sha256_hint: "flawed draft — intentionally untracked; committed fixture copy at tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md is byte-identical"
linted_at_head: 0f9d2e8-equivalent (post slice-59a; rule #4 strengthened in slice 60 to catch MED 7 on ownership grounds)
ratios:
  high_caught: 6/6
  high_pct: 100
  combined_caught: 10/13
  combined_pct: 77
  threshold_high: "100% (6/6) — MET"
  threshold_combined: "≥77% (≥10/13) — MET"
authority:
  - specs/plans/planning-readiness-meta-arc.md §4 Slice 60
  - specs/reviews/p2-9-plan-draft-content-challenger.md (13-finding ledger; denominator)
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md §Decision
---

# P2.9 retroactive plan-lint run — Slice 60 proof

## Purpose

The Planning-Readiness Meta-Arc exists because the P2.9 second-workflow
plan reached operator-decision time carrying 13 Codex findings (6 HIGH +
7 MED) that no pre-signoff gate caught. Slices 57-59 landed the gate:
ADRs, the `plan-lint` tool with 22 rules, audit Check 36, the
`blocked` vocabulary. Slice 60 runs plan-lint against the original
flawed draft as empirical proof that the rule set would have caught the
failure surface the Codex reviewer manually identified.

If plan-lint catches 100% of HIGH findings + ≥77% combined, the rule
set is adequate for this failure class. If it misses HIGHs or falls
below the combined threshold, rule additions land as intra-slice
follow-ups before Slice 60 closes.

## Input

`specs/plans/p2-9-second-workflow.md` is intentionally untracked per
the meta-arc plan's authority declaration (it is the "flawed-plan case
study" artifact). A byte-identical committed copy lives at
`tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md` so the retroactive
run is reproducible from a clean checkout.

## Lint output (summary)

```
plan-lint: specs/plans/p2-9-second-workflow.md — 22 red, 0 yellow
```

22 RED findings spanning 13 unique plan-lint rules:

| Rule id | Count |
|---|---|
| `plan-lint.verification-runtime-capability-assumed-without-substrate-slice` | 4 |
| `plan-lint.test-path-extension` | 3 |
| `plan-lint.stale-symbol-citation` (Slice 60 strengthening) | 2 |
| `plan-lint.invariant-without-enforcement-layer` | 2 |
| `plan-lint.cli-invocation-shape-matches` | 2 |
| `plan-lint.artifact-materialization-uses-registered-schema` | 2 |
| `plan-lint.evidence-census-present` | 1 |
| `plan-lint.tbd-in-acceptance-evidence` | 1 |
| `plan-lint.unverified-hypothesis-presented-as-decided` | 1 |
| `plan-lint.artifact-cardinality-mapped-to-reference` | 1 |
| `plan-lint.status-field-valid` | 1 |
| `plan-lint.canonical-phase-set-maps-to-schema-vocabulary` | 1 |
| `plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live` | 1 |

## Cross-reference against the 13-finding Codex ledger

Denominator: `specs/reviews/p2-9-plan-draft-content-challenger.md`
enumerates 6 HIGH + 7 MED = 13 findings. The table maps each to the
plan-lint rule that catches it.

| Codex # | Severity | Plan-lint rule caught | Status | Notes |
|---|---|---|---|---|
| HIGH 1 — Canonical phase mapping missing | HIGH | #18 `canonical-phase-set-maps-to-schema-vocabulary` | CAUGHT | Fires with message naming non-canonical titles + canonical set |
| HIGH 2 — Artifact model contradicts reference | HIGH | #14 `artifact-cardinality-mapped-to-reference` | CAUGHT | Fires on "4 artifacts for successor-to-live surface without reference cardinality" |
| HIGH 3 — REVIEW-I1 unenforceable | HIGH | #7 `invariant-without-enforcement-layer` | CAUGHT | Fires 2× on invariant declarations missing `enforcement_layer:` |
| HIGH 4 — Verdict determinism incomplete | HIGH | #19 `verdict-determinism-includes-verification-passes-for-successor-to-live` | CAUGHT | Fires on "CLEAN iff Critical=0 AND High=0" without verification clause |
| HIGH 5 — Verification runtime not implemented | HIGH | #20 `verification-runtime-capability-assumed-without-substrate-slice` | CAUGHT | Fires 4× — one per subprocess-execution claim without substrate-widening slice |
| HIGH 6 — Markdown artifact materialization unsafe | HIGH | #21 `artifact-materialization-uses-registered-schema` | CAUGHT | Fires 2× on `report.md` Markdown-shaped dispatch artifacts |
| MED 7 — Stale audit.mjs target | MED | #4 `stale-symbol-citation` (strengthened this slice) | CAUGHT | Fires 2× — `WORKFLOW_KIND_CANONICAL_SETS` appears only in import/re-export statements in audit.mjs; authoritative definition lives in `scripts/policy/workflow-kind-policy.mjs` |
| MED 8 — CLI shape mismatch | MED | #13 `cli-invocation-shape-matches` | CAUGHT | Fires 2× — `--scope` + `--` (positional workflow) not in dogfood.ts flags |
| MED 9 — `/circuit:run` heuristic bug farm | MED | — | NOT CAUGHT | Design-critique finding, not a lint-kind check. Plan's own acceptance of "remove the heuristic; use pass-through" is a decision, not a mechanically-detectable pattern. |
| MED 10 — Check 23 rule-g premise stale | MED | — | NOT CAUGHT | Cross-surface finding requiring plan-vs-code-reality comparison of audit-rule behavior. Plan-lint operates on plan content only. |
| MED 11 — Target=review accepted conditionally | MED | #10 `unverified-hypothesis-presented-as-decided` | CAUGHT | Fires on `target: review` frontmatter without matching evidence-census verified row |
| MED 12 — Parent-plan conditional collapsed without census | MED | #10 (same rule as MED 11) | CAUGHT | Same rule catches both — the symptom (target without census) IS the mechanical form of the "treated parent plan as authority" failure |
| MED 13 — Plan authorship outran extraction | MED | — | NOT CAUGHT | Meta-finding about process. The entire planning-readiness meta-arc exists to address this. Not mechanically catchable by any single rule. |

## Ratios

- **HIGH caught: 6/6 = 100%** — meets 100% threshold ✓
- **Combined caught: 10/13 ≈ 77%** — meets ≥77% threshold ✓
- **MED caught: 4/7 ≈ 57%** — uncaught MEDs are design-critique (MED 9), cross-surface (MED 10), and meta-finding (MED 13) — not in the scope of a mechanical content-lint for plan files.

## Bonus findings — plan-lint catches issues Codex did not enumerate

Plan-lint emits 12 additional findings beyond the 10 mapped to Codex items:

- **Rule #1 (evidence-census-present):** P2.9 draft has `§Evidence-census` header prose but lacks the `verified/inferred/unknown-blocking` vocabulary. Plan-lint requires BOTH section + vocabulary.
- **Rule #2 (tbd-in-acceptance-evidence):** P2.9 contains TBD markers in acceptance-evidence blocks.
- **Rule #3 (test-path-extension, 3 hits):** deliverable paths under `tests/contracts/*.md` should be `.test.ts` per spec convention.
- **Rule #15 (status-field-valid):** `status: draft` is not in the Slice 57 vocabulary `{evidence-draft, challenger-pending, challenger-cleared, operator-signoff, closed}`.
- **Rules #7, #20, #21, #13, #4 multi-hits:** these rules fire multiple times against P2.9 (e.g., rule #20 fires 4×) because the plan made the same failure repeatedly. Plan-lint's per-match emit pattern makes this visible as a density signal.

These bonus findings show the rule set has coverage beyond just the 13 Codex-enumerated items — it catches generic plan-quality violations not specific to the P2.9 case.

## Gap analysis — what plan-lint does NOT catch

Three of the 13 findings are not mechanically catchable:

1. **MED 9 (`/circuit:run` verb-match heuristic):** a design-critique finding. Whether a routing heuristic is "a bug farm" is a judgement call about taste + future maintainability. Mechanical lint cannot encode "this will accumulate bugs" — that requires human or adversarial-model review.
2. **MED 10 (Check 23 rule-g premise stale):** a cross-surface finding comparing the plan's factual claim about audit-rule behavior to the actual audit-rule code. Detecting this would require plan-lint to interpret plan claims about code state and check them against the code — which is effectively "verify every assertion in the plan against repo reality." Not in scope.
3. **MED 13 (plan authorship outran extraction):** a meta-finding about process discipline. The entire meta-arc's existence IS the response to this finding; no single rule could catch it, since it's about the ABSENCE of a planning-time gate, which is what plan-lint now supplies.

These gaps are accepted by the Slice 60 gate design: the retroactive threshold is `HIGH 100% + combined ≥77%`, specifically because some findings are structurally outside the reach of static plan-lint.

## Acceptance

Slice 60 acceptance criteria (from `specs/plans/planning-readiness-meta-arc.md` §4 Slice 60 Acceptance-evidence):

- [x] Retroactive run file committed with full output + ratios + commentary (this file).
- [x] HIGH-caught ≥ 6/6 (achieved 6/6 = 100%).
- [x] Combined ≥ 10/13 (achieved 10/13 = 77%).
- [x] One intra-slice rule extension landed: rule #4 `stale-symbol-citation` strengthened to detect "symbol appears only in import/re-export statements" so MED 7 crosses from uncaught-to-caught. No additional rule extensions warranted — the remaining gaps (MED 9, MED 10, MED 13) are structurally outside plan-lint's scope.

## Sign-off

The plan-lint rule set is **empirically adequate** for the P2.9 failure class. The gate catches all HIGH findings (the operator-signoff-blocking tier) and enough MED findings to clear the 77% combined threshold.

Advance to Slice 61 (memory rule + CLAUDE.md discipline) on this evidence.
