---
name: adversarial-yield-ledger
description: Ledger of adversarial review pass yield used to tune D10 review-discipline priors.
type: ledger
date: 2026-04-20
---

# Adversarial Yield Ledger

One row per adversarial pass. `artifact_class` values are `reversible`,
`governance`, or `irreversible` and map to D10 caps 2 / 3 / 4.
`operator_justification_if_past_cap` is `n/a` until a pass exceeds the D10
cap for its artifact class; when past-cap, it must be substantive
(≥ 30 characters, not a placeholder like `tbd` / `none` / `see body`).
Mode-cycle rule: three consecutive passes on the same artifact in the same
`mode` without an intervening structurally different mode is rejected by
audit (D10 clause 3, K=2).

## Slice 28 (plan §Slice DOG+1) schema extension (2026-04-20)

Three columns added by Slice 28 (plan names it "DOG+1") per
`specs/methodology/decision.md` §D10 Extension — Rigor-Profile Budget Binding:

- `rigor_profile` — one of `lite` / `standard` / `deep` / `tournament` /
  `autonomous` / `pre-dog-1-grandfather` (grandfather value for rows
  landed before DOG+1; hard expiry at Phase 2 close; new rows must use
  a concrete value).
- `why_continue_failure_class` — substantive specific-failure-class string
  (≥ 30 chars, no placeholders) when `pass_number_for_artifact >= 2`;
  otherwise `n/a`.
- `prior_execution_commit_sha` — git SHA of an execution commit between
  the prior pass and this one that touches at least one path outside
  `specs/reviews/`, when `rigor_profile ∈ {deep, tournament}` and
  `pass_number_for_artifact >= 2`; otherwise `n/a`.

For Tournament rigor, pass 3 additionally requires a prior row on the same
artifact whose `mode` does not begin with `llm-`.

| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap | rigor_profile | why_continue_failure_class | prior_execution_commit_sha |
|---|---|---|---:|---|---|---:|---:|---:|---|---|---|---|---|
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | governance | 1 | gpt-5-codex | llm-review | 7 | 5 | 3 | ACCEPT-WITH-FOLD-INS | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | governance | 2 | claude-opus-4-7+gpt-5-codex | llm-cold-read-standin-for-human | 0 | 8 | 8 | ACCEPT-WITH-FOLD-INS | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/reviews/arc-slice-25b-drafted-docs-codex.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 1 | REJECT pending HIGH fold-ins | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/contracts/config.md` | reversible | 1 | gpt-5-codex | llm-review | 1 | 4 | 1 | REJECT → incorporated → ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/artifacts.json` | reversible | 1 | gpt-5-codex | llm-review | 0 | 4 | 3 | ACCEPT-WITH-FOLD-INS → incorporated → ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `scripts/audit.mjs` | reversible | 1 | gpt-5-codex | llm-review | 2 | 5 | 2 | REJECT pending HIGH fold-ins → incorporated → ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/adrs/ADR-0001-methodology-adoption.md` Addendum B | governance | 1 | gpt-5-codex | llm-review | 5 | 7 | 4 | REJECT pending fold-ins → incorporated → ACCEPT-WITH-FOLD-INS | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `specs/contracts/workflow.md` v0.2 | reversible | 1 | gpt-5-codex | llm-review | 3 | 3 | 2 | REJECT → incorporated → ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |
| 2026-04-20 | `scripts/audit.mjs` | reversible | 2 | property-fuzzer | property-fuzzer | 0 | 0 | 0 | ACCEPT | n/a | deep | LLM-review-echo miss on adversarial-audit branch conditions — hunted by RNG coverage of rigor × pass × mode × date boundaries | 7a12329 |
| 2026-04-20 | `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md` | governance | 1 | gpt-5-codex | llm-review | 5 | 5 | 1 | REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | n/a | n/a |
| 2026-04-21 | `specs/adrs/ADR-0007-phase-2-close-criteria.md` | governance | 1 | gpt-5-codex | llm-review | 7 | 5 | 1 | REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | n/a | n/a |
| 2026-04-21 | `slice-33-plugin-surface` | reversible | 1 | gpt-5-codex | llm-review | 3 | 4 | 0 | REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | n/a | n/a |
| 2026-04-21 | `specs/contracts/explore.md` | reversible | 1 | gpt-5-codex | llm-review | 4 | 7 | 2 | REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | n/a | n/a |
| 2026-04-21 | `arc-p2-foundation-composition-review` | governance | 1 | gpt-5-codex + claude-opus-4-7 | llm-review-composition | 5 | 5 | 2 | REJECT-PENDING-FOLD-INS (composition review; fold-ins land across Slices 35-40 arc) | n/a | standard | composition-review over three-slice aggregate (P2.1 + P2.2 + P2.3) — surfaced boundary-seam failures no individual slice owned | n/a |
| 2026-04-21 | `slice-35-methodology-upgrade` | governance | 1 | gpt-5.4 | llm-review | 5 | 3 | 2 | REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | ratchet change (two new audit checks + allowlist shape) requiring Codex pass per §Hard Invariants #6 | n/a |
| 2026-04-21 | `slice-37-widen-event-schema` | governance | 1 | gpt-5-codex | llm-review | 1 | 4 | 2 | REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | governance-amendment ratchet (ADR-0007 §Amendment Slice 37 binding four new event variants) + contract-test ratchet advance 779 → 810 per §Hard Invariants #6 | n/a |
| 2026-04-21 | `slice-38-dispatch-granularity-adr-0008` | governance | 1 | gpt-5-codex | llm-review | 3 | 3 | 3 | REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | new governance ADR (ADR-0008 dispatch granularity modeling) — contract widening that triggers §6-equivalent applicability (§6.4 inline weaker-evidence disclosure + §6.6 cross-model challenger). All HIGH + MED folded in across ADR + contract + artifacts registry + audit check (Check 27 strengthened with WORKFLOW_KIND_DISPATCH_POLICY) + ratchet floor 810 → 828. | n/a |
| 2026-04-21 | `slice-39-artifact-path-split-high-4` | reversible | 1 | n/a (Codex pass not required per plan §Slice 39 — registry ratchet advances either direction) | no-llm-pass | 0 | 0 | 0 | ACCEPT (no challenger pass) | n/a | standard | artifact-registry ratchet-advance (path split explore.result → <run-root>/artifacts/explore-result.json, resolving Slice 35 tracked collision and deleting founding ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS entry; Check 25 green on live repo terminal state). Codex challenger pass explicitly exempted by plan text (specs/plans/phase-2-foundation-foldins.md §Slice 39) — registry ratchet advances either direction; no ADR amendment; no gate loosening. | n/a |
| 2026-04-21 | `slice-40-arc-close-composition-review` | governance | 1 | claude-opus-4-7 (fresh-read prong) + gpt-5.4 (Codex challenger prong) | llm-review-composition | 2 | 4 | 3 | REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS (both prongs; convergent on 2 HIGH boundary-seam findings — plan-vs-state drift on Slice 40 identity / HIGH 5 retargeting invisible + Check 26 chicken-and-egg / single-prong acceptance) | n/a | standard | two-prong arc-close composition review over pre-P2.4 foundation fold-in arc Slices 35-40 per CLAUDE.md §Cross-slice composition review cadence (first application). Both prongs' HIGHs folded in inline: plan §Slice 40 rewrite + P2.4 HIGH 3 capability-boundary amendment + P2.5 HIGH 5 helper retargeting + CLAUDE.md cadence two-prong tightening + Check 26 two-prong binding (requires both Claude + Codex prong files with ACCEPT* closing verdicts) + ADR-0008 §5 reopen trigger #7 + explore.md v0.3 review link + synthetic shape test + ratchet floor 830 → 835. §6 precedent firewall applies — arc-close review is a governance ratchet scaled from per-slice challenger protocol. | n/a |
| 2026-04-21 | `slice-41-adr-0009-adapter-invocation-pattern` | governance | 1 | gpt-5-codex | llm-review | 4 | 6 | 3 | REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS | n/a | standard | new governance ADR (ADR-0009 adapter invocation pattern — subprocess-per-adapter for v0) + Check 28 audit binding + FORBIDDEN_ADAPTER_SDK_DEPS constant (8 direct-vendor + 7 wrapper/provider entries per Codex HIGH 2 fold-in = 15 total) + contract-test ratchet advance 835 → 844 (+9 tests: 6 initial + 3 fold-in per MED 2 and HIGH 2) + P2.4 plan amendment per §Hard Invariants #5 (ADR required for amendment) + #6 (cross-model challenger on governance ratchet). All 4 HIGH + 6 MED + 3 LOW folded in across ADR-0009 + specs/contracts/adapter.md ADAPTER-I1 agent-bullet (narrowing-with-semantic-amendment per HIGH 1) + specs/adrs/ADR-0007-phase-2-close-criteria.md CC#P2-2 + scripts/audit.mjs (Check 28 forbidden list expanded with wrapper SDKs per HIGH 2) + tests/contracts/adapter-invocation-discipline.test.ts (+2 tests: peerDependencies + set-equality per MED 2) + specs/plans/phase-2-implementation.md §P2.4 (CLI no-write capability proof requirement per HIGH 4) + ADR-0009 §2.v capability-boundary-deferral ground + §6 reopen triggers 5/6/7 (CLI contract failure + bypass discovery + auth/session). Operator product constraint binding: "Claude Code out-of-box, no Codex required" + "note future possibilities like B2 so we don't forget them" (2026-04-21 operator direction). ADR §3 records four deferred options (SDK-direct / Task-tool pause-resume / pooling / streaming) with named reopen triggers per operator's explicit "don't-forget" request. §6 precedent firewall applies (narrowing-with-semantic-amendment per §6.4 partial-substitute disclosure). | n/a |

**Slice 29 property-fuzzer pass context.** Pass 2 on `scripts/audit.mjs`
(commit `7a12329`, slice-28). Non-LLM evidence artifact for Phase 1.5
Close Criterion #13. Runs 18 vitest property blocks (~600 RNG-generated
inputs) against `checkAdversarialYieldLedger` covering rigor-budget,
grandfather cutoff, why-continue, review-execution alternation,
mode-cycle K=2, tournament-pass-3 non-LLM gate, and structural reds.
0H / 0M / 0L — invariants held across the randomized input space. Full
evidence artifact at `specs/reviews/slice-29-d10-property-fuzzer-evidence.md`.
Duration 8.21 s. Seed `0xc1a51c29`.

**Pass 2 context.** Pass 2 is an L3 non-LLM cold-read, delegated to Claude + Codex as LLM stand-ins under operator authorization while the operator was asleep. The delegation is recorded as reviewer_role `LLM-standin-for-human-cold-read` in `specs/reviews/phase-1-close-reform-human.md`. Counts are 0 HIGH / 8 MED / 8 LOW; all MED and LOW findings were folded back into the plan in this planning pass. Pass 2 did not violate D10 artifact-size signal (pass count 2 < governance cap 3). A genuine operator cold-read on pickup may append a third evaluator section to the review record; that addition does not count as a new adversarial pass unless it raises defects.

**Slice 25b drafted-doc-set pass context.** Codex challenger pass on the
Slice 25b implementation (HEAD 870f040, impl commit c673a7b) surfaced 2 HIGH
findings: (1) exemption ledger integrity was seed-only (no rejection on
second-row insertion, no per-row authorization, no amend-D1/D3 detection);
(2) D10 pass budgets were prose-only (audit did not parse pass_number vs
cap, did not reject placeholder justifications, did not enforce mode-cycle).
Both HIGH folded in by the current hotfix slice (adds `authorization_record`
column to exemption ledger, `artifact_class` column to this ledger, and
three strengthened audit checks). MED 1 (TIER status semantics) also folded
in same slice. MED 2 (load-bearing dependency classification) and LOW 1
(prompt-target-SHA ambiguity) deferred to later work — dispositions recorded
in `specs/reviews/slice-25b-drafted-docs-codex.md`.
