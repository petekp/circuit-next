---
name: arc-slice-97-codex
description: Cross-model challenger pass over Slice 97 (Phase 2 close matrix draft and audit validator).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-97-phase-2-close-matrix
target_kind: arc
target: slice-97
target_version: "Base HEAD=fb3b4f32521b9791c973bfe8194c21b5f706af84; working tree reviewed before Slice 97 commit"
arc_target: phase-2-close-evidence-cleanup
arc_version: "Slice 97 drafts the Phase 2 close matrix and adds checkPhase2CloseMatrix"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 4
  med: 0
  low: 0
  meta: 0
commands_run:
  - "npm run test -- tests/contracts/phase-2-close-matrix.test.ts"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --full-auto --ephemeral --color never (opening pass over draft Slice 97 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --full-auto --ephemeral --color never (first follow-up over folded Slice 97 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --full-auto --ephemeral --color never (final follow-up over exact-match fold-in; verdict ACCEPT)"
opened_scope:
  - specs/reviews/phase-2-close-matrix.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/phase-2-close-matrix.test.ts
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - final Phase 2 close claim
  - specs/reviews/phase-2-close-codex.md (future final phase-close review)
  - specs/reviews/phase-2-operator-product-check.md (future operator product-direction note)
  - runtime behavior changes
  - reference-Circuit parity proof
  - live Claude Code slash-handler proof
  - final post-commit audit result; parent session owns the after-commit run
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/adrs/ADR-0007-phase-2-close-criteria.md CC#P2-8
  - specs/reviews/phase-2-close-matrix.md
  - scripts/audit.mjs Check 37
---

# Slice 97 - Phase 2 Close Matrix - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that drafts
the Phase 2 close matrix and adds `checkPhase2CloseMatrix`.

The landed claim is narrow: the close matrix is a draft, not a Phase 2 close
claim. It enumerates the close-criterion rows and product-ratchet rows, marks
open criteria honestly, and makes any future `phase_close_claim=true` fail
without properly shaped Codex close-review and operator product-direction
artifacts.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found three high issues.

## Objection List and Dispositions

### HIGH 1 - P2-3 was overclaimed as satisfied

Codex found that the matrix marked `P2-3` satisfied while the cited evidence
proved only CLI-surrogate parity. ADR-0007 still requires the live Claude Code
command path or an authoritative rebinding.

Disposition: **folded in.** `P2-3` is now `active — red`, with notes saying the
live Claude Code slash-handler proof or authoritative rebinding remains pending.

### HIGH 2 - P2-1 lacked reference-Circuit parity evidence

Codex found that the matrix marked `P2-1` satisfied while the cited evidence
proved circuit-next local golden self-consistency. It did not prove parity with
the corresponding prior-generation Circuit artifact or cite an amendment
replacing that requirement.

Disposition: **folded in.** `P2-1` is now `active — red`, with notes saying the
reference-Circuit parity proof or authoritative substitute remains pending.

### HIGH 3 - Future close artifacts were accepted too loosely

Codex found that `checkPhase2CloseMatrix` only checked for an ACCEPT-class
verdict and minimal operator-note fields. It did not enforce the ADR-required
frontmatter shape for the Codex close review, the operator product-direction
note, or accepted-status ADR citation.

Disposition: **folded in.** The audit check now validates:

- `phase-2-close-codex.md` frontmatter shape for a phase-close challenger
  objection list, including `review_kind`, `target_kind`, `review_target`,
  reviewer role, mode, non-empty required fields, and ACCEPT-class closing
  verdict.
- `phase-2-operator-product-check.md` frontmatter shape for the operator
  product-direction note, including `target_kind`, `review_target`, operator,
  confirmation, non-empty `not_claimed`, author, and `adr_authority: ADR-0007`.
- The re-deferred ADR citation has frontmatter `status: Accepted`.

`tests/contracts/phase-2-close-matrix.test.ts` covers malformed Codex review
frontmatter, malformed operator-note frontmatter, non-accepted ADR status, and
a valid future close-claim shape.

### HIGH 4 - Accepted-token regexes still false-greened malformed values

On follow-up, Codex reproduced that the first fold-in still accepted
`closing_verdict: ACCEPT-PENDING-FOLD-INS` and ADR `status:
Accepted-but-not-really`.

Disposition: **folded in.** The verdict matcher now accepts only `ACCEPT` or
`ACCEPT-WITH-FOLD-INS`, with an optional parenthetical annotation. The ADR
status matcher now accepts only `Accepted`, with an optional parenthetical
annotation. The contract test adds regression cases for both false-green inputs
and keeps a green case for parenthetical annotations.

## Follow-up Verdict

The first follow-up returned **REJECT-PENDING-FOLD-INS** for HIGH 4. After the
exact-match fold-in, the final Codex follow-up returned **ACCEPT**.

## Verification Owned By Parent Session

- `npm run test -- tests/contracts/phase-2-close-matrix.test.ts`
- `npm run verify`
- `npm run audit` after commit
