---
name: slice-29-d10-property-fuzzer-evidence
description: Non-LLM evidence artifact for Phase 1.5 Alpha Proof Close Criterion #13. Property-based fuzzer pass on scripts/audit.mjs §checkAdversarialYieldLedger (the D10 extension landed in slice-28 / DOG+1). Mode is structurally different from the pre-DOG+1 LLM-review and LLM-cold-read passes per specs/methodology/decision.md §D10 clause 2.
type: review
review_kind: property-fuzzer
target_kind: implementation
target: scripts/audit.mjs §checkAdversarialYieldLedger
target_commit: 7a12329
review_date: 2026-04-20
reviewer_id: property-fuzzer
mode: property-fuzzer
rigor_profile: deep
pass_number_for_artifact: 2
prior_execution_commit_sha: 7a12329
why_continue_failure_class: LLM-review-echo miss on adversarial-audit branch conditions — hunted by RNG coverage of rigor × pass × mode × date boundaries
verdict_overall: ACCEPT
---

# Slice 29 — D10 Property-Fuzzer Evidence

**Purpose.** Satisfy Phase 1.5 Alpha Proof Close Criterion #13 (broader
adversarial pass includes ≥ 1 non-LLM evidence artifact) with a
structurally-different mode per `specs/methodology/decision.md` §D10 clause 2
(`{runtime, human, fuzzer, property-test, non-llm-review}`). The structural
break from Claude + Codex LLM passes is that inputs are **generated** by a
seeded RNG rather than written by a model; no LLM is in the loop at
input-generation time. Knight & Leveson 1986 correlated-failure concern
cannot apply to RNG-generated inputs.

**Target.** `scripts/audit.mjs` §`checkAdversarialYieldLedger` — the D10
extension landed in slice-28 / commit `7a12329`. This is pass 2 on this
artifact; pass 1 was the pre-DOG+1 grandfather row
(`2026-04-20 | scripts/audit.mjs | reversible | 1 | gpt-5-codex | llm-review | 2 | 5 | 2`).

**Test file.** `tests/contracts/slice-29-d10-property-fuzzer.test.ts`
(18 `it` blocks, seeded Mulberry32 RNG, `PROP_SEED = 0xc1a51c29`).

## Invariants exercised

Fourteen invariants × 40 iterations per block + 4 single-shot deterministic
blocks = ~600 randomized inputs total. Each block fixes one invariant and
varies one or more fields over a constrained distribution.

| # | Invariant | Iterations | Field varied |
|---:|---|---:|---|
| 1 | `lite` rigor reds on pass ≥ 1 | 40 | passNumber ∈ [1,4], artifactClass ∈ {reversible, governance, irreversible} |
| 2 | `standard` rigor reds on pass ≥ 2 without past-cap justification | 40 | passNumber ∈ [2,3] |
| 3 | Unknown rigor value reds | 40 | rigor ∈ {ultra, hyper, moderate, extreme, mega, normie, xxx} |
| 4 | Grandfather ≤ 2026-04-20 is green | 40 | passDate ∈ {5 historical dates}, artifactClass varies |
| 5 | Grandfather strictly after cutoff reds | 40 | passDate ∈ {6 post-cutoff dates} |
| 6 | `why_continue` placeholder reds on deep pass 2 | 11 | placeholder ∈ WHY_PLACEHOLDERS (n/a, N/A, none, tbd, more review, various, general, see body, -, —, .) |
| 7 | `why_continue` < 30 chars reds | 40 | len ∈ [1,29] |
| 8 | Substantive `why_continue` + valid SHA → green | 40 | why length varies with padding |
| 9 | `deep`/`tournament` pass ≥ 2 with `n/a` SHA reds | 40 | rigor ∈ {deep, tournament}, SHA ∈ {n/a, N/A, NA, -, —} |
| 10 | Unresolvable hex-shaped SHA reds | 40 | random 40-hex SHA |
| 11 | Non-hex SHA reds | 40 | malformed ∈ {not-a-sha, zzzzzzz, 1234, hello world, ggggg...} |
| 12 | Three consecutive same-mode rows reds | 40 | mode ∈ LLM_MODES |
| 13 | Two same-mode rows don't trigger mode-cycle | 40 | mode ∈ LLM_MODES |
| 14 | Tournament pass 3 with all-LLM priors reds | 40 | mode distinct in each of 3 passes |
| 15 | Tournament pass 3 with ≥ 1 non-LLM prior → green | 40 | non-LLM mode ∈ {human-cold-read, property-fuzzer, runtime-probe, fuzzer} |
| 16 | Invalid artifact_class reds | 40 | class ∈ {unknown, mutable, critical, core, tainted} |
| 17 | Non-positive pass_number reds | 40 | pass ∈ [-5, 0] |
| 18 | Committed ledger is green from repo root | 1 | n/a |

## Findings

**Headline: 0 HIGH / 0 MED / 0 LOW.**

All 18 blocks pass on the first run of the fuzzer against `scripts/audit.mjs`
at commit `7a12329`. ~600 RNG-generated inputs failed to surface any
invariant hole not already covered by the 14 hand-written tests in
`slice-dog-1-d10-operationalization.test.ts`.

**What this tells us about the D10 audit code.**

The boundary behaviors that failure-prone hand-written tests most often miss
— character-count thresholds (MIN\_WHY\_CONTINUE\_CHARS = 30), placeholder
regexes (PLACEHOLDER\_WHY\_CONTINUE\_PATTERN), ISO date string comparison
at cutoff (GRANDFATHER\_CUTOFF\_DATE = '2026-04-20'), and the mode-cycle
three-in-a-row vs two-in-a-row boundary — are correctly handled by the
audit implementation across the randomized input space.

**What this does not tell us.**

Honest calibration of coverage limits:

- **ISO date assumption.** The fuzzer's generator always emits ISO-formatted
  dates (`YYYY-MM-DD`). It does not fuzz malformed dates (`04/21/2026`,
  `21 Apr 2026`, locale variants). The audit compares `passDate >
  GRANDFATHER_CUTOFF_DATE` as a string comparison; a non-ISO date could
  parse as either side of the cutoff nondeterministically. Not a finding
  in this pass because no row in the committed ledger uses non-ISO dates;
  recorded as future fuzz expansion candidate.
- **Case sensitivity.** `rigor_profile` is lowercased before comparison;
  the fuzzer exercises lowercase values only. Mixed-case inputs
  (`"Deep"`, `"DEEP"`) could exercise a different path. Not fuzzed.
- **Whitespace in fields.** `stripCellMarkup` handles leading/trailing
  whitespace in cells; the fuzzer does not deliberately inject inner
  whitespace or backticks into free-text fields. Not fuzzed.
- **Multi-artifact interaction.** The fuzzer exercises one artifact per
  ledger fixture. Cross-artifact interactions (mode-cycle across two
  artifacts sharing a reviewer_id, for example) are not covered.
- **Verdict field.** The audit does not validate `verdict` shape; fuzzer
  does not attempt to find a verdict-field parse bug because none is
  specified. If future D10 additions regulate `verdict`, the fuzzer
  should be extended.

These are structural-coverage gaps, not defects. Future slice can widen
generators without changing the invariants.

## Pass duration

**8.21 s** total for 18 blocks, measured by vitest. Well under 30 s, fits
inside the `npm run test` budget with room.

## D10 accounting

- `artifact_class`: `reversible` (code, not external-protocol).
- `artifact_class` cap: 2 passes.
- `pass_number_for_artifact`: 2 (within cap).
- `rigor_profile`: `deep` (budget 2 passes; within budget).
- `why_continue_failure_class`: "LLM-review-echo miss on adversarial-audit
  branch conditions — hunted by RNG coverage of rigor × pass × mode ×
  date boundaries" (95 chars, specific failure class, no placeholder).
- `prior_execution_commit_sha`: `7a12329` (slice-28 implementation commit,
  touches `scripts/audit.mjs`, `tests/contracts/`, `specs/reviews/`,
  `specs/methodology/decision.md`, `specs/plans/`; non-specs/reviews/
  content is present).
- `mode`: `property-fuzzer` — does not start with `llm-`, qualifies as
  non-LLM mode per D10 audit regex check.

## Verdict

**ACCEPT.** No HIGH, MED, or LOW findings. The D10 audit code correctly
enforces the rigor-profile budget, grandfather cutoff, why-continue
checkpoint, review-execution alternation, mode-cycle K=2, and
tournament-pass-3 non-LLM gate across ~600 randomized inputs.

This pass satisfies:

- **Close Criterion #13** ("Broader adversarial pass includes at least one
  non-LLM evidence artifact") per ADR-0001 Addendum B and
  `specs/plans/phase-1-close-revised.md` §Phase 1.5 Alpha Proof Close
  Criteria.
- **D10 clause 2** mode-cycle requirement: after two LLM-mode passes on
  the adversarial-yield-ledger surface, the next defect-discovery effort
  must come from a structurally different mode. Property-fuzzer is the
  structurally different mode.
- **D10 Extension** rigor-profile budget binding: the ledger row for this
  pass uses `rigor_profile: deep`, records a substantive
  `why_continue_failure_class`, and points to a valid
  `prior_execution_commit_sha` per the rules landed in slice-28.

## Residual items

Not folded; recorded for later:

- **Fuzzer generator widening.** Add non-ISO date strings, mixed-case
  rigor values, inner-whitespace cell injections, and multi-artifact
  ledger fixtures in a future slice. Low priority — current audit code
  handles the distribution the committed ledger actually uses.
- **Canonical operator cold-read.** A non-LLM cold-read by the operator
  is still the canonical form per D10 named examples. This
  property-fuzzer pass satisfies CC#13 (which requires ≥ 1 non-LLM
  artifact) but does not satisfy the stronger "zero-context human drill"
  signal in `specs/reviews/phase-1-close-reform-human.md`'s residual
  items list. Remains open.
