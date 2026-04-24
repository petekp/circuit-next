---
name: arc-slice-98-codex
description: Cross-model challenger pass over Slice 98 (legacy Circuit Explore characterization and P2-1 close-accounting correction).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-98-legacy-explore-characterization
target_kind: arc
target: slice-98
target_version: "Base HEAD=663504c854e0a6ed8c0dbf67de1dc5a1aa7f17fd; working tree reviewed before Slice 98 commit"
arc_target: phase-2-close-evidence-cleanup
arc_version: "Slice 98 characterizes legacy Circuit Explore and keeps P2-1 active-red pending parity proof or explicit substitute"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 1
  med: 1
  low: 0
  meta: 0
commands_run:
  - "npm run test -- tests/contracts/legacy-explore-characterization.test.ts tests/contracts/artifact-authority.test.ts"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 98 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up over folded Slice 98 diff; verdict ACCEPT)"
opened_scope:
  - specs/reference/legacy-circuit/explore-characterization.md
  - tests/fixtures/reference/legacy-circuit/explore/reference-shape.json
  - tests/contracts/legacy-explore-characterization.test.ts
  - specs/artifacts.json
  - specs/contracts/explore.md
  - specs/reviews/phase-2-close-matrix.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - runtime behavior changes
  - fresh legacy Circuit Explore close execution
  - accepting circuit-next JSON as the Phase 2 P2-1 substitute
  - final Phase 2 close claim
  - final post-commit audit result; parent session owns the after-commit run
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/reviews/phase-2-close-matrix.md
---

# Slice 98 - Legacy Explore Characterization - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
characterizes the first-generation Circuit Explore workflow and corrects the
Phase 2 close accounting for P2-1.

The landed claim is narrow: old Circuit Explore is now characterized well
enough to show that the current circuit-next JSON golden is not, by itself,
old-Circuit byte-shape parity. P2-1 remains active-red until a reference-backed
comparison lands or ADR-0007 is explicitly amended to accept a clean-break JSON
successor claim.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found one high issue and one medium issue.

## Objection List and Dispositions

### HIGH 1 - ADR-0007 still carried P2-1 as closed

Codex found that the draft slice updated the close matrix to mark P2-1 red, but
ADR-0007 still carried the older Slice 44 placeholder-parity sentence as closed
accounting. That left two authoritative surfaces in conflict.

Disposition: **folded in.** ADR-0007 now says the older placeholder-parity
accounting is superseded for Phase 2 close accounting. Effective Slice 98,
P2-1 is active-red until either a reference-backed comparison proves the old
Circuit Explore close shape against documented circuit-next output, or the ADR
is amended under its substitution rules to accept the structured JSON successor
claim.

### MED 1 - The guard test did not pin exact reference mappings

Codex found that the first test asserted broad prose claims, but did not pin
the exact source hashes or artifact mappings. That would allow authority rows
or characterization details to drift while the test still passed.

Disposition: **folded in.** The slice now adds
`tests/fixtures/reference/legacy-circuit/explore/reference-shape.json` with
source SHA-256s and exact artifact mappings. The contract test asserts those
source hashes, the old Markdown artifact names, the current circuit-next JSON
artifact names, the exact `specs/artifacts.json` `reference_surfaces` arrays,
and the ADR-0007 active-red reconciliation.

## Follow-up Verdict

After the fold-ins, Codex returned **ACCEPT** with no remaining objections. It
noted older placeholder-parity wording in historical plan prose, but did not
treat those as current false close claims because the live authority path now
marks P2-1 red in ADR-0007, the Phase 2 close matrix, and PROJECT_STATE.md.

Codex could not run `npm run verify` inside its read-only sandbox because the
build and test tools needed writable output directories. The parent session ran
the verification commands in the normal workspace.

## Verification Owned By Parent Session

- `npm run test -- tests/contracts/legacy-explore-characterization.test.ts tests/contracts/artifact-authority.test.ts`
- `npm run verify`
- `npm run audit` after commit
