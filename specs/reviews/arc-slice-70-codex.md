---
name: arc-slice-70-codex
description: Cross-model challenger pass over Slice 70 (runtime-safety-floor Slice 2 - fresh run-root guard). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance plus privileged runtime run-root initialization. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 70 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-70-runtime-safety-floor-fresh-run-root-guard
target_kind: arc
target: slice-70
target_version: "Base HEAD=a5ee4fa (Slice 69 run-relative paths); landed by the Slice 70 commit carrying this file"
arc_target: runtime-safety-floor
arc_version: "Slice 2 of 7 planned runtime-safety-floor slices"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 2
  med: 2
  low: 0
  meta: 0
commands_run:
  - attempted repo-preferred /codex wrapper; failed before review because configured model gpt-5.5 was unavailable
  - ran codex exec --sandbox read-only -m gpt-5.4 over the Slice 2 working tree
  - ran codex exec --sandbox read-only -m gpt-5.4 re-challenges over the fold-ins
  - parent session ran targeted vitest and npm run verify in writable environment
opened_scope:
  - AGENTS.md / CLAUDE.md plan-authoring and challenger discipline
  - specs/plans/runtime-safety-floor.md Slice 2
  - src/runtime/runner.ts bootstrapRun and run-root initialization
  - tests/runner/fresh-run-root.test.ts
  - tests/runner/dogfood-smoke.test.ts
  - tests/unit/runtime/event-log-round-trip.test.ts
  - tests/runner/agent-dispatch-roundtrip.test.ts
  - tests/runner/codex-dispatch-roundtrip.test.ts
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-generation Circuit at ~/Code/circuit (read-only reference; not needed for this guard)
  - tests/properties/** (Tier 2+ deferred)
  - AGENT_SMOKE and CODEX_SMOKE live smoke re-promotion (known fingerprint drift; not part of Slice 2)
authority:
  - AGENTS.md §Hard invariants #6
  - AGENTS.md §Cross-model challenger protocol
  - specs/plans/runtime-safety-floor.md §4 Slice 2
  - scripts/audit.mjs Check 35
---

# Slice 70 - Runtime Safety Floor Slice 2 - Codex Challenger Pass

This records the Codex cross-model challenger pass for the second
runtime-safety-floor implementation slice: rejecting reused run roots
before bootstrap writes can mutate prior run evidence.

## Wrapper Note

The repo-preferred `/codex` wrapper was attempted first through
`run-codex.sh --sandbox read-only`, but the local wrapper selected
`gpt-5.5`, which was unavailable for this account. The challenger was
therefore run directly with `codex exec --sandbox read-only -m gpt-5.4`,
matching the model lineage used for the runtime-safety-floor plan
challenger records.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** The first implementation pass found one HIGH
and one MED finding. A second re-challenge found one additional HIGH
finding. A later re-challenge found one MED finding.

## Objection List and Dispositions

### HIGH 1 - Verification was failing on formatter/import order

Codex found that `npm run verify` failed because the new files had Biome
formatting and import-order drift.

Disposition: **folded in**. Biome was run against
`src/runtime/runner.ts` and `tests/runner/fresh-run-root.test.ts`; the
targeted runtime suites and full `npm run verify` pass after formatting.

### MED 1 - First-start concurrency was not atomically claimed

Codex found that the initial emptiness guard was non-atomic: two same-path
first starts could both observe an empty directory before either wrote
canonical artifacts.

Disposition: **folded in**. `claimFreshRunRoot` now creates a
`.run-root.claim` file with exclusive `wx` open before bootstrap writes
begin, rejects a second claimant with the run-root reuse/no-resume message,
and releases the claim on bootstrap exit.

### HIGH 2 - The empty-check still raced stale after the claim fold-in

The follow-up pass found that the empty-directory scan still happened
before the claim in one fold-in draft. A delayed second invocation could
observe stale emptiness, wait until the first invocation released the
claim, then claim a directory that already contained finished run
artifacts.

Disposition: **folded in**. The implementation now creates the exclusive
claim first, then rechecks directory contents while holding the claim.
If anything besides `.run-root.claim` is present, it releases the claim
and rejects reuse.

### MED 2 - Existing file and symlink run roots leaked lower-level errors

Codex found that an existing file or symlink at the `runRoot` path could
hit lower-level filesystem errors before the required run-root
reuse/no-resume message.

Disposition: **folded in**. `claimFreshRunRoot` now `lstat`s an existing
path before `mkdir`, rejects non-directories and symlinks with the required
message, and the tests cover both cases.

## Closing Verdict

**ACCEPT.** The final re-challenge found no remaining HIGH or MED
findings. It specifically confirmed that the existing file/symlink case,
claim lifecycle, empty pre-created directory, concurrent claim, rerun byte
stability, and canonical artifact marker coverage were adequate for
Slice 2.
