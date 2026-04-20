---
name: arc-slice-25b-drafted-docs-codex
description: Codex challenger pass on the drafted Slice 25b doc set (D1/D4/D10 install + TIER matrix + exemption ledger + two audit checks).
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-20
verdict: REJECT pending HIGH fold-ins
authored_by: gpt-5-codex
target_kind: arc
target: slice-25b
target_version: 870f040c38174816d04b9cd3fc56371abbb6d536
review_target: arc-slice-25b-drafted-docs
arc_target: slice-25b
arc_version: c673a7b..870f040
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT-WITH-FOLD-INS (after HIGH-1 + HIGH-2 + MED-1 folded into hotfix slice)
commands_run:
  - git show HEAD
  - git show c673a7b
  - read specs/methodology/decision.md
  - read scripts/audit.mjs (Slice 25b checks)
  - read tests/contracts/governance-reform.test.ts
  - read TIER.md
  - read specs/methodology/product-gate-exemptions.md
  - read specs/reviews/adversarial-yield-ledger.md
  - npm run verify
  - npm run audit
  - temp-fixture probes (2-row ledger; pass_number=99; status-signal disagreement)
opened_scope:
  - specs/methodology/decision.md
  - scripts/audit.mjs (checkProductRealityGateVisibility, checkTierOrphanClaims, checkAdversarialYieldLedger)
  - tests/contracts/governance-reform.test.ts
  - TIER.md
  - specs/methodology/product-gate-exemptions.md
  - specs/reviews/adversarial-yield-ledger.md
skipped_scope:
  - specs/contracts/ (out of 25b scope; D3 reopen lives in Slice 25d)
  - specs/adrs/ADR-0006-* (out of 25b scope)
  - src/ (no implementation changes in 25b)
---

# Codex Challenger Pass — Slice 25b Drafted Doc Set

## Opening verdict

REJECT pending HIGH fold-ins

## Objections

### HIGH

**1. HIGH — Product Gate exemptions are reusable by accident**

D1 says Slice 25b consumes a one-time bootstrap waiver and that exemptions cannot amend D1 or D3 (`specs/methodology/decision.md:191-196`). The audit does not enforce either property. `checkProductRealityGateVisibility` only parses the ledger and looks for the seed row (`scripts/audit.mjs:733-757`); it does not reject extra consumed rows, require per-row operator authorization, bind rows to commit bodies, require `Lane: Break-Glass`, or detect exemption text that tries to amend D1/D3. I verified a temp ledger with the Slice 25b seed plus a second consumed waiver row still returns green: `2 exemption row(s); consumed seed row present...`. The current tests cover missing/malformed/seed-present only (`tests/contracts/governance-reform.test.ts:62-88`, `168-181`), so there is no red fixture for "second exemption row without operator note." This leaves the Product Reality Gate with exactly the escape hatch it was meant to prevent.

**Disposition:** FOLDED IN this slice. Exemption ledger schema gains `authorization_record` column; every row must name a path to a review record / ADR / operator sign-off that exists on disk. Audit rejects any row whose `reason` matches `amend(s|ing) D1` or `amend(s|ing) D3`. Methodology D1 prose updated to document the three integrity rules. Seed row authorization record points to `specs/reviews/phase-1-close-reform-human.md`. Commit-body `Lane: Break-Glass` cross-reference is NOT machine-enforced this slice (prose-only operator discipline) and is scheduled for Slice 25c — noted in the ledger header.

**2. HIGH — D10 pass budgets are prose-only**

D10 installs hard caps, past-cap justification, stopping criteria, and a mode-cycle rule (`specs/methodology/decision.md:210-231`), but `checkAdversarialYieldLedger` only checks that the ledger exists, has a table with named columns, and has at least one row (`scripts/audit.mjs:842-863`). It does not parse artifact class, compare `pass_number_for_artifact` against the 2/3/4 caps, reject placeholder justifications, detect same-mode loops, or enforce the "different mode next" rule. I verified a temp yield ledger with `pass_number_for_artifact = 99` and `operator_justification_if_past_cap = n/a` still returns green. The test suite only checks missing ledger and current-ledger presence (`tests/contracts/governance-reform.test.ts:139-152`), so D10's strongest promises are not executable yet.

**Disposition:** FOLDED IN this slice. Yield ledger schema gains `artifact_class` column with values `{reversible, governance, irreversible}` mapping to D10 caps 2 / 3 / 4. Audit now (a) parses `pass_number_for_artifact` as integer and compares against class cap; (b) when past cap, requires `operator_justification_if_past_cap` to be substantive (≥ 30 characters, not in placeholder blocklist `n/a` / `none` / `see body` / `tbd` / `.` / `justified` / `-` / `–` / `—`); (c) groups rows by artifact_path, sorts by pass_number, rejects three consecutive same-mode passes (K=2 mode-cycle rule). Methodology D10 prose updated to document the machine-enforced schema and K=2 choice.

### MED

**1. MED — TIER status semantics can lie while audit stays green**

The TIER prose says every row has exactly one claim classification: `file_path`, `planned_slice`, or `status=not claimed` (`TIER.md:10-12`). The audit enforces mutual exclusion among those three signals and stats file paths (`scripts/audit.mjs:804-839`), which is good, but it never validates that `status` is one of `enforced | planned | not claimed` or that the status agrees with the chosen signal. I verified all of these pass green: `status=planned` with only `file_path`, `status=enforced` with only `planned_slice`, and `status=banana` with a valid `file_path`. That means the matrix can be visually dishonest while still satisfying the "orphan claim" audit.

**Disposition:** FOLDED IN this slice. `checkTierOrphanClaims` now validates `status` ∈ `{enforced, planned, not claimed}` and requires status to agree with the signal mode (file_path ↔ enforced; planned_slice ↔ planned; empty ↔ not claimed). Mismatches red.

**2. MED — "Not claimed" has no dependency check against methodology load-bearing rules**

`container_isolation`, `hidden_property_pool`, and `mutation_testing_gate` are classified as `not claimed` with a Tier 2+ rationale (`TIER.md:33-35`). That may be the right honest current state, but the audit has no concept of "methodology depends on this, therefore it must be planned or explicitly ADR-deferred." In particular, the methodology text already names containerized execution and hidden tests as part of the discipline (`specs/methodology/decision.md:33`, plus the P4/P2 pre-mortems nearby). The current checker only requires a non-empty rationale for `not claimed` (`scripts/audit.mjs:828-832`), so future rows can demote load-bearing claims to "not claimed" without a planned slice, ADR link, or operator decision.

**Disposition:** DEFERRED. Building a "load-bearing dependency" classifier requires first enumerating which methodology rules depend on which claims — that is itself a methodology-mapping artifact (Slice 25c candidate). The current three `not claimed` rows are backed by ADR-0001 Tier 2+ deferral, which is the correct authority pattern; the concern is about future rows regressing. Scheduled as a planned TIER addition: will add `adr_reference` column (optional) and require it for load-bearing `not claimed` rows once the load-bearing set is named. Tracked as a watch item in Slice 25c scope.

### LOW

**1. LOW — Review target was ambiguous because HEAD is not the implementation commit**

The prompt said to review the most recent `HEAD`, but `git show HEAD` is `870f040`, a `PROJECT_STATE.md` freshness commit. The actual Slice 25b implementation commit is `c673a7b`, referenced by HEAD's body. I reviewed the working-tree doc set and inspected `c673a7b`, but this ambiguity affects facts like "test count strictly increased from prior HEAD": `c673a7b` increases the static authored-test count 468 → 478 and runtime tests to 531, while `HEAD` itself is 478 → 478 because it only edits PROJECT_STATE. Future challenger prompts should pin the implementation SHA when a follow-up docs commit sits on top.

**Disposition:** deferred — no code change required. Logged as a prompting-discipline lesson: future challenger prompts pin `implementation_commit: <sha>` alongside the review-head SHA when a follow-up docs-only commit sits atop the implementation. Noted in the yield-ledger slice-25b pass context section.

## Closing note

`npm run check`, `npm run lint`, and `npm run verify` pass; `npm run verify` reports 531 passing tests. `npm run audit` still exits with 13 green / 1 yellow / 1 red because the known historical `78a4bc3` framing and `ec69669` lane findings remain in the default 10-commit window; I did not count those as new Slice 25b findings. The Slice 25b commit body itself has the literal lane, framing triplet, and citations.
