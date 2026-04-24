---
name: arc-slice-71-codex
description: Cross-model challenger pass over Slice 71 (runtime-safety-floor Slice 3 - durable adapter invocation failure closure). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance plus privileged runtime dispatch failure handling. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 71 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-71-runtime-safety-floor-durable-adapter-invocation-failures
target_kind: arc
target: slice-71
target_version: "Base HEAD=482f474 (Slice 70 fresh run-root guard); landed by the Slice 71 commit carrying this file"
arc_target: runtime-safety-floor
arc_version: "Slice 3 of 7 planned runtime-safety-floor slices"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 1
  med: 1
  low: 0
  meta: 0
commands_run:
  - attempted repo-preferred /codex wrapper; failed before review because configured model gpt-5.5 was unavailable
  - ran codex exec --sandbox read-only -m gpt-5.4 over the Slice 3 working tree
  - ran codex exec --sandbox read-only -m gpt-5.4 re-checks over the fold-ins and final authority-sync edits
  - challenger attempted targeted vitest in read-only sandbox; Vitest failed on EPERM temp/cache writes, not product assertions
  - parent session ran targeted vitest and npm run verify in writable environment
opened_scope:
  - AGENTS.md / CLAUDE.md challenger discipline
  - specs/plans/runtime-safety-floor.md Slice 3
  - specs/domain.md Event glossary
  - specs/contracts/run.md dispatch_event_pairing
  - specs/contracts/explore.md dispatch failure ordering and content/schema failure surface
  - src/schemas/event.ts DispatchFailedEvent and Event union
  - src/runtime/runner.ts dispatch branch failure closure
  - src/runtime/adapters/dispatch-materializer.ts priorStart materialization path
  - src/runtime/reducer.ts dispatch.failed projection handling
  - src/runtime/artifact-schemas.ts content/schema failure comments
  - tests/contracts/schema-parity.test.ts
  - tests/contracts/slice-37-dispatch-transcript.test.ts
  - tests/runner/dispatch-invocation-failure.test.ts
  - tests/runner/materializer-schema-parse.test.ts
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-generation Circuit at ~/Code/circuit (read-only reference; not needed for adapter failure closure)
  - tests/properties/** (Tier 2+ deferred)
  - AGENT_SMOKE and CODEX_SMOKE live smoke re-promotion (known fingerprint drift; not part of Slice 3)
authority:
  - AGENTS.md §Hard invariants #6
  - AGENTS.md §Cross-model challenger protocol
  - specs/plans/runtime-safety-floor.md §4 Slice 3
  - specs/contracts/run.md run.prop.dispatch_event_pairing
  - specs/contracts/explore.md Adapter invocation failure ordering
  - scripts/audit.mjs Check 35
---

# Slice 71 - Runtime Safety Floor Slice 3 - Codex Challenger Pass

This records the Codex cross-model challenger pass for the third
runtime-safety-floor implementation slice: adapter invocation exceptions
now close as aborted runs with durable dispatch provenance instead of
escaping after `step.entered`.

## Wrapper Note

The repo-preferred `/codex` wrapper was attempted first through
`run-codex.sh --sandbox read-only`, but the local wrapper selected
`gpt-5.5`, which was unavailable for this account. The challenger was
therefore run directly with `codex exec --sandbox read-only -m gpt-5.4`,
matching the model lineage used for the runtime-safety-floor plan
challenger records.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** The first implementation pass found one HIGH
and one MED finding.

## Objection List and Dispositions

### HIGH 1 - Explore contract contradicted the new failure event

Codex found that the Slice 3 implementation introduced
`dispatch.failed`, while existing `specs/contracts/explore.md` prose still
said no separate `dispatch.failed` event existed.

Disposition: **folded in**. The explore contract now scopes the old
no-`dispatch.failed` statement to verdict/content/schema failures only
and adds a separate adapter-invocation failure ordering that emits
`dispatch.started -> dispatch.request -> dispatch.failed -> gate.evaluated
-> step.aborted -> run.closed`.

### MED 1 - Failure sequence proof was not pinned tightly enough

Codex found that the initial runner test asserted event presence but did
not pin the exact failed-dispatch sequence, and the contract suite only
covered the success/dry-run dispatch transcript.

Disposition: **folded in**. `tests/runner/dispatch-invocation-failure.test.ts`
now asserts the exact per-step sequence and byte-identical failure reason
across `dispatch.failed`, `gate.evaluated`, `step.aborted`, `run.closed`,
and `result.json`. `tests/contracts/slice-37-dispatch-transcript.test.ts`
now covers `DispatchFailedEvent`, Event-union parsing, role/provenance
cross-field rejection, and a well-formed aborted RunLog/RunProjection.

## Additional Sync

After the ACCEPT pass, the parent session noticed two authority-sync
clarifications: `specs/domain.md` now lists `dispatch.failed` in the Event
glossary, and `src/runtime/runner.ts` now states explicitly that
content/schema failures do not emit `dispatch.failed`. A final direct
Codex re-check over those edits returned **ACCEPT** with no remaining
blocking objections.

## Closing Verdict

**ACCEPT.** The final re-check found no remaining blocking objections. The
only residual risk noted was that the widened dispatch-pairing rule still
lives primarily at the contract/property layer rather than as a full
log-order validator; Codex did not consider that a Slice 71 blocker.
