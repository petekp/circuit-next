---
name: p2-9-generalization-proof
description: Slice 81 generalization proof for the P2.9 second-workflow arc.
type: review
review_kind: generalization-proof
review_date: 2026-04-24
target_kind: arc
target: p2-9-second-workflow
arc_target: p2-9-second-workflow
planned_slice: 68
actual_slice: 81
aggregate_outcome: validated-with-declared-follow-on
follow_ons:
  - per-workflow synthesis-writer registration
authority:
  - specs/plans/p2-9-second-workflow.md §9 Slice 68
  - specs/plans/p2-9-second-workflow.md §10
  - specs/contracts/review.md
  - scripts/policy/workflow-kind-policy.mjs
  - tests/runner/review-runtime-wiring.test.ts
---

# P2.9 Generalization Proof

## Scope

This report closes planned P2.9 Slice 68. It checks whether the
explore-established workflow pattern generalized to the audit-only
`review` workflow across the five risk points named by the signed plan:

1. canonical phase set uniformity
2. invariant shape
3. artifact-count balance
4. plugin-command composability
5. audit-rule kind-independence

Per the plan, each point is classified as:

- `clean`: the pattern held without widening.
- `validated-with-declared-follow-on`: the pattern held after targeted
  widening, or the remaining gap is narrow and named as a follow-on.
- `not-yet-validated`: the gap materially changes the generalization
  claim.

## Aggregate Outcome

**validated-with-declared-follow-on.**

No risk point is `not-yet-validated`. The outcome mix is three `clean`
risk points, one already-landed targeted widening for the review-specific
audit policy branch, and one future follow-on for the synthesis writer.
The P2.9 close claim can say:

> P2.9 audit-only review-family generalization validated; 1 targeted
> follow-on slice declared for per-workflow synthesis-writer registration.

The follow-on is needed because the default generic synthesis writer still
emits placeholder objects for `review.result`. Slice 79 proved
schema-valid materialization through an injected synthesis writer, but the
runtime-level per-workflow writer registry is intentionally post-P2.9
substrate work.

**Follow-on status:** closed at Slice 83. The default runtime writer now
has a narrow `review.intake@v1` / `review.result@v1` registration, so the
normal review path writes a schema-valid typed review result artifact.

## Risk Point Outcomes

| Risk point | Outcome | Evidence |
|---|---|---|
| Canonical phase set uniformity | `clean` | `scripts/policy/workflow-kind-policy.mjs` carries both `explore` and `review` entries in the same `WORKFLOW_KIND_CANONICAL_SETS` table. The `review` row binds `{frame, analyze, close}` and omits `{plan, act, verify, review}`. `tests/contracts/workflow-kind-policy.test.ts` covers green and red review payloads, and `tests/contracts/review-workflow-contract.test.ts` proves the live fixture parses and satisfies the policy. |
| Invariant shape | `clean` | Review added workflow-kind-specific invariants without changing the base workflow schema. REVIEW-I1 is enforced by the shared policy helper plus `tests/properties/visible/review-i1.test.ts`; REVIEW-I2 is enforced by `src/schemas/artifacts/review.ts` plus `tests/properties/visible/review-i2.test.ts`. The invariant anchors live on `specs/contracts/review.md`, matching the explore contract discipline. |
| Artifact-count balance | `validated-with-declared-follow-on` | Review has one registered primary artifact, `review.result`, rather than explore's five. That difference did not break the authority-graph pattern: the artifact row is homed on `specs/contracts/review.md`, has its own schema exports, and uses the sibling `<kind>-result.json` path pattern. At Slice 81, runtime proof was deliberately narrower: `tests/runner/review-runtime-wiring.test.ts` proved schema-valid `review.result` through an injected writer and separately proved the default writer remained placeholder-only. Follow-on: per-workflow synthesis-writer registration. Slice 83 closed that follow-on by moving review intake/result synthesis onto the default registered writer path. |
| Plugin-command composability | `clean` | `.claude-plugin/plugin.json` now registers `circuit:review`, and `.claude-plugin/commands/circuit-review.md` invokes the positional `review` workflow. `tests/runner/plugin-command-invocation.test.ts` pins the workflow positional token, rejects goal-text false positives, and carries the same single-quote safety checks as the existing command bodies. `tests/contracts/plugin-surface.test.ts` keeps the live plugin surface under Check 23 closure. |
| Audit-rule kind-independence | `validated-with-declared-follow-on` | Audit Check 23 walks manifest command entries and command files as data, so it reports all three commands without a hardcoded two-command ceiling. Audit Check 24 still discovers fixtures generically and delegates known workflow ids to the shared policy table; the live audit now scans `dogfood-run-0`, `explore`, and `review` fixtures. The review-specific REVIEW-I1 ordering rule did require an explicit `review` branch in the shared helper, which is acceptable for the audit-only review-family claim but is not proof of fully generic third-workflow invariant registration. No additional future follow-on is required for this point. |

## Close Claim Boundaries

The validated claim is intentionally limited to the audit-only review
family now present in the repo:

- `review` has a canonical phase set distinct from `explore`, and that
  distinction is policy-backed.
- `review` has workflow-specific invariants that are executable, not only
  prose.
- `review.result` was registered and schema-valid in the injected-writer
  runtime proof at Slice 81; Slice 83 later closed the named follow-on by
  making the default review path write the typed artifact directly.
- `/circuit:review` is a real command surface that reaches the positional
  review workflow path.
- The audit checks remained data-driven for command and fixture discovery
  as the counts increased; review's extra invariant branch is a
  workflow-specific widening, not a generic third-workflow registry.

The claim does not yet include:

- broader production default runtime support for typed synthesis artifacts
  beyond the narrow review intake/result registration added at Slice 83
- a third workflow kind such as build, repair, migrate, or sweep
- a verification-bearing review variant
- routing heuristics that choose review from free-form `/circuit:run`
  requests

Those are separate follow-on decisions. The only follow-on required by
this proof is per-workflow synthesis-writer registration.
