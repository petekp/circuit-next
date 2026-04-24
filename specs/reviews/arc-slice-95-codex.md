---
name: arc-slice-95-codex
description: Cross-model challenger pass over Slice 95 (inherited product-ratchet TIER evidence bindings for Phase 2 close cleanup).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-95-inherited-product-ratchet-bindings
target_kind: arc
target: slice-95
target_version: "Base HEAD=e2667eb (Slice 94 CODEX_SMOKE fingerprint refresh); working tree reviewed before Slice 95 commit"
arc_target: phase-2-close-evidence-cleanup
arc_version: "Slice 95 binds inherited product-ratchet rows in TIER.md to explicit audit/test evidence surfaces"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 2
  med: 1
  low: 0
  meta: 0
commands_run:
  - "npm run test -- tests/contracts/inherited-ratchet-bindings.test.ts tests/contracts/governance-reform.test.ts"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 95 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "parent session folded findings by adding independent ratchet-id coverage, duplicate claim-id rejection, test coverage for duplicates, and evidence-surface wording"
  - "npm run test -- tests/contracts/inherited-ratchet-bindings.test.ts tests/contracts/governance-reform.test.ts"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 95 diff; verdict ACCEPT)"
opened_scope:
  - TIER.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/inherited-ratchet-bindings.test.ts
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
skipped_scope:
  - AGENT_SMOKE fingerprint promotion, pending explicit operator approval for external Claude disclosure
  - Phase 2 close matrix authoring
  - operator product check for Phase 2 close
  - product runtime behavior
  - full npm run verify inside the read-only Codex sandbox; parent session owns executable verification
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.4c
  - TIER.md
  - scripts/audit.mjs
---

# Slice 95 - Inherited Product-Ratchet Bindings - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that turns
five stale `TIER.md` inherited-product-ratchet rows from old planned-slice
pointers into enforced evidence-surface bindings.

The landed claim is narrow: the audit now verifies that the inherited
Phase 2 product-ratchet rows named for close-review consumption stay present,
enforced, non-duplicated, and bound to the expected referenced evidence
surfaces. It does not run AGENT_SMOKE, author the Phase 2 close matrix, or
claim Phase 2 close completion.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found two high issues and one medium issue.

## Objection List and Dispositions

### HIGH 1 - Binding list was self-authorizing

The first draft used the exported binding table as both the implementation
source and the test source. A future edit could drop a ratchet from that table
and keep the audit/test path green.

Disposition: **folded in.** `scripts/audit.mjs` now carries the independent
`ADR0007_INHERITED_PRODUCT_RATCHET_IDS` set and rejects missing, extra, or
duplicate binding entries. The contract test also has its own local
`EXPECTED_INHERITED_RATCHET_IDS` literal so test coverage catches accidental
binding-table shrinkage.

### HIGH 2 - Duplicate TIER claim ids collapsed silently

The first draft built a `Map` from parsed TIER rows. Duplicate claim ids used
last-row-wins behavior, so a stale planned row could be hidden by a later
enforced row for the same claim.

Disposition: **folded in.** `parseTierClaims` now rejects duplicate
`claim_id` values as malformed. `tests/contracts/inherited-ratchet-bindings.test.ts`
adds a duplicate inherited-row regression.

### MED 1 - Wording overstated what path existence proves

The first draft said several files already enforce the ratchets, but the new
check proves path binding and existence. Some listed paths were source files,
not executable proof surfaces.

Disposition: **folded in.** The evidence bindings now point at audit/test
surfaces for the snapshot, manifest, status-doc, and tier-claim rows. TIER,
ADR, and project-state wording now says evidence-surface binding instead of
claiming every named path independently proves the ratchet.

## Follow-up Verdict

Codex follow-up returned **ACCEPT**. It confirmed the three opening findings
were folded in and found no remaining blocker. Vitest could not run inside the
read-only Codex sandbox because Vitest writes cache/temp files; parent-session
verification owns the executable evidence.

## Verification Owned By Parent Session

- `npm run test -- tests/contracts/inherited-ratchet-bindings.test.ts tests/contracts/governance-reform.test.ts`
- `npm run verify`
- `npm run audit` after commit
