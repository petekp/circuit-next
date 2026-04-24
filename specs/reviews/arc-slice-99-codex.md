---
name: arc-slice-99-codex
description: Cross-model challenger pass over Slice 99 (ADR-0007 JSON successor substitution for CC#P2-1).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-99-json-successor-substitution
target_kind: arc
target: slice-99
target_version: "Base HEAD=c39ac76e66895b6a5b7d87297e8c283432a7a16d; working tree reviewed before Slice 99 commit"
arc_target: phase-2-close-evidence-cleanup
arc_version: "Slice 99 accepts structured JSON as the clean-break successor artifact shape for CC#P2-1"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 5
  med: 4
  low: 0
  meta: 0
commands_run:
  - "npm run test -- tests/contracts/legacy-explore-characterization.test.ts tests/contracts/phase-2-close-matrix.test.ts tests/contracts/artifact-authority.test.ts"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 99 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up over folded Slice 99 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (second follow-up; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (third follow-up; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (final follow-up; verdict ACCEPT)"
opened_scope:
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/reviews/phase-2-close-matrix.md
  - specs/reviews/p2-1-json-successor-operator-decision.md
  - specs/reference/legacy-circuit/explore-characterization.md
  - specs/contracts/explore.md
  - specs/artifacts.json
  - specs/plans/phase-2-implementation.md
  - scripts/audit.mjs
  - tests/contracts/legacy-explore-characterization.test.ts
  - tests/contracts/phase-2-close-matrix.test.ts
  - tests/fixtures/reference/legacy-circuit/explore/reference-shape.json
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - old Circuit Markdown import/export implementation
  - repo-wide workflow artifact policy beyond Explore/CC#P2-1
  - final Phase 2 close claim
  - P2-3 live Claude Code slash-handler proof
  - final post-commit audit result; parent session owns the after-commit run
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §6
  - specs/reference/legacy-circuit/explore-characterization.md
---

# Slice 99 - JSON Successor Substitution - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that accepts
structured JSON as the clean-break successor artifact shape for ADR-0007
CC#P2-1.

The landed claim is narrow: Explore step artifacts are canonical structured
JSON for circuit-next's first parity workflow. This does not claim old Circuit
Markdown byte-shape compatibility, old Markdown import support, repo-wide
legacy substitution authority, or Phase 2 close.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found two high issues and two medium issues
on the opening pass. Later follow-up passes found three more high issues and
two more medium issues before the final ACCEPT.

## Objection List and Dispositions

### HIGH 1 - Missing Slice 99 Codex review artifact

Codex found that ADR-0007 said the Slice 99 Codex challenger pass was recorded
at `specs/reviews/arc-slice-99-codex.md`, but the draft did not yet contain
that file.

Disposition: **folded in.** This file records the opening objection list, the
fold-ins, and the final follow-up verdict. The adversarial-yield ledger now has
a governance-class Slice 99 row.

### HIGH 2 - P2-1 matrix row cited a pre-resolution commit

Codex found that the P2-1 close-matrix row used `c39ac76e...` as the passing
commit even though that commit still marked P2-1 red and did not contain the
operator decision artifact.

Disposition: **folded in.** The P2-1 row now cites accepted ADR-0007
substitution authority instead of a pre-resolution SHA. `checkPhase2CloseMatrix`
now allows only P2-1 to cite the accepted ADR-0007 substitution. Other
active-satisfied rows require a resolving commit SHA and must not cite the
substitution in either the evidence path or passing-commit cell.

### MED 1 - Operator decision artifact was broader than CC#P2-1

Codex found that the operator note targeted ADR-0007 CC#P2-1 but used wording
that could be read as repo-wide authorization for JSON substitution, while other
legacy workflows still have Markdown-shaped reference evidence.

Disposition: **folded in.** The operator note now records only the
Explore/CC#P2-1 consequence of the operator's JSON preference and explicitly
says it does not authorize repo-wide substitutions for other legacy-shaped
workflows.

### MED 2 - Plan table mixed lock-time and live status

Codex found that `specs/plans/phase-2-implementation.md` still labelled its
table `Status at lock`, but the draft changed only P2-1 to a live Slice 99
status while leaving other rows at lock-time status.

Disposition: **folded in.** The P2-1 table row is restored to the original
lock-time red status, and a separate Slice 99 note points readers to the live
close matrix and PROJECT_STATE for current status. The characterization
contract test now pins that split plus the PROJECT_STATE live wording.

### FOLLOW-UP HIGH 3 - ADR substitution escape was not P2-1 scoped

Codex found that the first `checkPhase2CloseMatrix` fold-in allowed any
active-satisfied row to cite ADR-0007 instead of a SHA.

Disposition: **folded in.** The audit check now only permits the accepted
ADR-0007 substitution on P2-1; non-P2-1 rows remain SHA-backed. A contract
test proves P2-2 cannot use the substitution without a SHA.

### FOLLOW-UP MED 3 - ADR-0007 still had stale byte-shape wording

Codex found live ADR-0007 sections that still described P2-1 as a byte-shape
golden match after §Decision.1 had moved to structured JSON successor parity.

Disposition: **folded in.** The retarget checklist, non-gating schema note,
Appendix A, and Addendum A now use the Slice 99 successor-shape wording, and
`legacy-explore-characterization.test.ts` pins those active sections.

### FOLLOW-UP HIGH 4 - CC#P2-8 still required SHA-only evidence

Codex found that CC#P2-8 still said every active-satisfied row needed a commit
SHA, contradicting the P2-1 ADR-backed substitution.

Disposition: **folded in.** CC#P2-8 now explicitly carves out only the Slice 99
P2-1 structured JSON successor substitution while keeping SHA-backed evidence
for every other active-satisfied row.

### FOLLOW-UP MED 4 - Mixed SHA plus substitution could pass on non-P2-1 rows

Codex found that a non-P2-1 row could include both a valid SHA and ADR-0007
substitution text and still pass.

Disposition: **folded in.** `checkPhase2CloseMatrix` rejects the substitution
on non-P2-1 active-satisfied rows even when a valid SHA is present. A contract
test pins the mixed-authority case.

### FOLLOW-UP HIGH 5 - Evidence-path-only substitution could pass

Codex found that the non-P2-1 guard checked the passing-commit cell but not the
evidence-path cell.

Disposition: **folded in.** The audit check now scans both cells for the
substitution marker/path, and a contract test pins the evidence-path-only escape.

## Follow-up Verdict

After the fold-ins, Codex returned **ACCEPT**. Remaining work is the parent
session's normal verification and post-commit audit.

## Verification Owned By Parent Session

- `npm run test -- tests/contracts/legacy-explore-characterization.test.ts tests/contracts/phase-2-close-matrix.test.ts tests/contracts/artifact-authority.test.ts`
- `npm run verify`
- `npm run audit` after commit
