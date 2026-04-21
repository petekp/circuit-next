---
name: arc-slice-37-high-2-widen-event-schema-codex
description: Codex challenger objections on Slice 37 — HIGH 2 fold-in (widen event schema with dispatch.request / dispatch.receipt / dispatch.result variants + ADR-0007 §Amendment Slice 37). Adversarial lint per CLAUDE.md §Cross-model challenger protocol; §6 precedent firewall applies because ADR amendment is a governance ratchet.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-21
verdict: REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 (objections) + claude-opus-4-7 (fold-in synthesis + closing annotations)
target_kind: arc
target: slice-37-widen-event-schema
target_version: "2026-04-21 as-staged pre-ceremony at HEAD=7e773dc (post-Slice-35)"
review_target: arc-slice-37-widen-event-schema
arc_target: slice-37
arc_version: 7e773dc..HEAD (Slice 37 working tree, pre-commit)
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 1
  MED: 4
  LOW: 2
authority: CLAUDE.md §Cross-model challenger protocol + §6 precedent firewall
dispatched_at: 2026-04-21
dispatched_via: /codex skill → scripts/run-codex.sh (codex exec --full-auto --ephemeral)
artifact_ids:
  - run.log
  - run.projection
commands_run:
  - read specs/reviews/p2-foundation-composition-review.md (triggering HIGH 2)
  - read specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-2 pre-fold-in body)
  - read specs/plans/phase-2-implementation.md (P2.4 binding that cites CC#P2-2)
  - read specs/contracts/run.md (dispatch_event_pairing invariant)
  - read src/schemas/event.ts (event-union widening diff)
  - read src/schemas/adapter.ts (ResolvedAdapter shape — HIGH #1 dereference)
  - read src/runtime/reducer.ts (no-op case branches)
  - read src/runtime/runner.ts (dry-run runner adapter shape — LOW #6)
  - read tests/contracts/slice-37-dispatch-transcript.test.ts (contract tests pre-fold-in)
  - read specs/domain.md (glossary drift — MED #4)
  - npm run verify (green baseline)
  - npm run audit (24/2/0 baseline)
  - codex exec (Slice 37 challenger prompt; full-auto ephemeral run)
opened_scope:
  - src/schemas/event.ts
  - src/schemas/adapter.ts
  - src/runtime/reducer.ts
  - src/runtime/runner.ts
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/contracts/run.md
  - specs/plans/phase-2-implementation.md
  - specs/domain.md
  - tests/contracts/slice-37-dispatch-transcript.test.ts
  - specs/reviews/p2-foundation-composition-review.md
skipped_scope:
  - bootstrap/* (Phase 0 scratch; Slice 37 does not touch Phase 0 artifacts)
  - src/continuity/* (continuity subsystem unrelated to event-schema widening)
  - scripts/audit.mjs checks unrelated to schema-export allowlist (Check 25/26 audits unchanged by this slice)
  - .claude-plugin/* (plugin surface unchanged by this slice)
binds_to:
  - specs/reviews/p2-foundation-composition-review.md §HIGH 2
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Amendment (Slice 37) on CC#P2-2
  - src/schemas/event.ts (DispatchRequestEvent, DispatchReceiptEvent, DispatchResultEvent)
  - specs/contracts/run.md §dispatch_event_pairing
fold_in_disposition: HIGH #1 incorporated (adapter-field path correction in ADR-0007 §CC#P2-2 prose + phase-2-implementation.md §P2.4 + ADR §Amendment explanation block). MED #2 incorporated (receipt_id refine for non-whitespace-only + 2 additional test cases). MED #3 incorporated (reducer-consumption tests using reduce() + RunProjection.safeParse for canonical sequence and dry-run shape). MED #4 incorporated (specs/domain.md event kinds list widened to include the three new variants). MED #5 already scoped — not folded (property-level, Phase 2 property-test harness). LOW #6 already scoped — not folded (P2.4 adapter-level Enforcement binding concern). LOW #7 incorporated (ADR amendment "What did not change" sentence rewritten to distinguish realness criterion from executable binding).
session_reference:
  - prompt: /tmp/codex-slice-37.out (captured output; session id ephemeral)
  - dispatch_via: /codex skill
---

# Codex per-slice challenger pass — Slice 37 (HIGH 2 fold-in)

## Context

Slice 37 widens `src/schemas/event.ts` with `DispatchRequestEvent`,
`DispatchReceiptEvent`, `DispatchResultEvent` discriminated variants
and amends `specs/adrs/ADR-0007-phase-2-close-criteria.md` CC#P2-2 to
line-bind those variants by schema location. The amendment is the
operator's widen-over-weaken choice for composition review §HIGH 2
(recorded 2026-04-21 in `specs/plans/phase-2-foundation-foldins.md`).

Per CLAUDE.md §Cross-model challenger protocol and §6 precedent
firewall, an ADR amendment is a governance ratchet and so requires a
Codex challenger pass. This file archives that pass.

## Dispatch

Challenger brief sent via `/codex` skill (verbatim preservation
required by skill contract). The brief covered 10 candidate attack
surfaces and asked for a numbered objection list with severity labels
+ one of three verdicts (REJECT-PENDING-FOLD-INS / ACCEPT-WITH-FOLD-
INS / ACCEPT).

## Codex objection list (verbatim)

**OBJECTION LIST**

1. **HIGH — CC#P2-2 still names a non-existent adapter field.**
   [ADR-0007-phase-2-close-criteria.md](../adrs/ADR-0007-phase-2-close-criteria.md:133)
   says the transcript must include a `dispatch.started` event whose
   `resolved_adapter.name` is the real adapter id, and
   [phase-2-implementation.md](../plans/phase-2-implementation.md:254)
   repeats `resolved_adapter.name = 'agent'`. But the executable
   schema has `DispatchStartedEvent.adapter: ResolvedAdapter` at
   [event.ts](../../src/schemas/event.ts:86), and `ResolvedAdapter`
   is the `adapter` union at [adapter.ts](../../src/schemas/adapter.ts:59).
   **Failure mode:** this preserves a governance/runtime mismatch
   inside the same CC#P2-2 binding Slice 37 is supposed to harden.
   P2.4 can either follow the ADR literally and assert a field that
   cannot exist, or silently reinterpret it as `adapter.name`,
   recreating the "prose says one thing, schema says another" hole
   HIGH 2 was meant to close.

2. **MED — `receipt_id` is too weak for the stated correlation role.**
   [event.ts](../../src/schemas/event.ts:139) says the receipt id
   lets a later result correlate back to the request, but the schema
   only requires `z.string().min(1)` at
   [event.ts](../../src/schemas/event.ts:144), and the tests only
   reject missing/empty while accepting a UUID-shaped example at
   [slice-37-dispatch-transcript.test.ts](../../tests/contracts/slice-37-dispatch-transcript.test.ts:203).
   **Failure mode:** `" "`, `"\0"`, or an arbitrarily huge provider
   string can satisfy the schema while being useless or hostile as
   audit evidence. More importantly, `dispatch.result` does not echo
   `receipt_id`; it only carries `result_artifact_hash` at
   [event.ts](../../src/schemas/event.ts:156). The actual correlation
   is therefore only `(step_id, attempt, ordering)`, not the receipt
   id itself.

3. **MED — reducer-consumption claim is not directly tested for the new event kinds.**
   The reducer gained no-op arms for `dispatch.request`,
   `dispatch.receipt`, and `dispatch.result` at
   [reducer.ts](../../src/runtime/reducer.ts:138), but the new
   canonical-sequence test stops at `RunLog.safeParse` at
   [slice-37-dispatch-transcript.test.ts](../../tests/contracts/slice-37-dispatch-transcript.test.ts:323).
   ADR-0007 says "the reducer must have consumed that sequence" at
   [ADR-0007-phase-2-close-criteria.md](../adrs/ADR-0007-phase-2-close-criteria.md:136).
   **Failure mode:** the slice proves schema admission, not reducer
   round-trip consumption. `noImplicitReturns` helps catch totally
   unhandled variants, but it does not prove
   `reduce(canonicalLog).events_consumed === log.length` or that
   `RunProjection.safeParse({ log, snapshot })` still succeeds for
   the five-event transcript.

4. **MED — Domain glossary now contradicts the widened event surface.**
   [domain.md](../domain.md:41) still lists the event kinds as the
   old set with only `dispatch.started` and `dispatch.completed`.
   The executable union now includes `dispatch.request`,
   `dispatch.receipt`, and `dispatch.result` at
   [event.ts](../../src/schemas/event.ts:195).
   **Failure mode:** this is the same class of cross-document drift
   as HIGH 2, just in the domain glossary rather than ADR-0007.
   Future readers can still learn the wrong event universe from a
   core spec document.

5. **MED — Ordering enforcement remains documentary/property-level, not schema-level: already scoped — not a blocker.**
   [run.md](../contracts/run.md:276) says transcript events must
   appear between `dispatch.started` and `dispatch.completed` and in
   request → receipt → result order, but
   [run.ts](../../src/schemas/run.ts:42) only enforces bootstrap,
   sequence, run_id, singleton bootstrap, and closure-tail invariants.
   The doc explicitly reserves these sequence properties for Phase 2
   property tests at [run.md](../contracts/run.md:194).
   **Failure mode:** an out-of-order transcript can parse as a
   `RunLog` today. I am not calling this a pre-commit blocker
   because the contract already scopes it to
   `run.prop.dispatch_event_pairing`, but P2.4 must not mistake
   Slice 37's positive parse test for ordering enforcement.

6. **LOW — Dry-run and non-dry-run `agent` logs are distinguishable only by transcript absence: already scoped — not a blocker.**
   The current runner documents dry-run as `dispatch.started` +
   `dispatch.completed` only at
   [runner.ts](../../src/runtime/runner.ts:92), and emits
   `adapter: { kind: 'builtin', name: 'agent' }` without transcript
   events at [runner.ts](../../src/runtime/runner.ts:212).
   [run.md](../contracts/run.md:281) explicitly keeps zero transcript
   events legal for dry-run.
   **Failure mode:** a non-dry-run adapter that accidentally emits
   only started/completed has a schema-green shape indistinguishable
   from dry-run at the log layer. This is acceptable only if the
   P2.4 adapter test contains a negative fixture or hard assertion
   that the live path emits all three transcript events.

7. **LOW — The amendment block is governance-visible, but its "What did not change" sentence undercuts the new five-event language.**
   [ADR-0007](../adrs/ADR-0007-phase-2-close-criteria.md:174) says
   the durable transcript is now a five-event sequence including
   `dispatch.completed`, while
   [ADR-0007](../adrs/ADR-0007-phase-2-close-criteria.md:211) says
   CC#P2-2 prose is unchanged.
   **Failure mode:** this invites a future argument that the
   original four-kind prose still governs, even though the
   amendment's schema binding says five events. Not a blocker if
   objection #1 is folded in and the text clarifies that the
   executable binding is widened while the realness criterion is
   not weakened.

**Verdict: REJECT-PENDING-FOLD-INS**

## Fold-in disposition (authored by Claude, post-receipt)

| # | Severity | Disposition | Action |
|---|----------|-------------|--------|
| 1 | HIGH | **INCORPORATED (pre-commit)** | Fix `resolved_adapter.name` → `adapter.name` in `specs/adrs/ADR-0007-phase-2-close-criteria.md` CC#P2-2 prose AND in `specs/plans/phase-2-implementation.md` §P2.4. Both references point at a field that does not exist in `DispatchStartedEvent`; the correct path is `adapter.name` via the `ResolvedAdapter` discriminated union (`src/schemas/adapter.ts`). |
| 2 | MED | **INCORPORATED (pre-commit)** | Tighten `receipt_id` test coverage to reject whitespace-only and NUL-only strings; update `DispatchReceiptEvent` comment in `src/schemas/event.ts` to scope the correlation claim honestly (correlation is `(step_id, attempt, ordering)`; receipt_id is identity of record, not a cryptographic binding). Hash-tightening of `receipt_id` is deferred to a future slice if/when a real adapter surfaces concrete receipt formats; widening to a regex in Slice 37 would over-specify without provider-shape evidence. |
| 3 | MED | **INCORPORATED (pre-commit)** | Add a reducer-consumption test case that runs the canonical five-event sequence through `reduce()` and asserts `events_consumed === log.length` + `RunProjection.safeParse({ log, snapshot })` success. This closes the ADR-0007 line 136 "reducer must have consumed" claim at the contract layer in Slice 37 rather than deferring it to P2.4. |
| 4 | MED | **INCORPORATED (pre-commit)** | Update `specs/domain.md` event kinds list to include the three new variants. This is drift of the exact same class Slice 37 is folding in (glossary vs schema mismatch); leaving it open reproduces the same failure mode at a different artifact. |
| 5 | MED | **Already scoped — not folded** | Correctly identified as property-level by Codex. `run.prop.dispatch_event_pairing` is the existing binding; Phase 2 property-test harness lands the superRefine enforcement. Slice 37 widens the contract prose to name the property; it does not promote the property to schema-layer yet. Reference: `specs/contracts/run.md` v0.1-amendment entry. |
| 6 | LOW | **Already scoped — not folded** | Correctly identified. P2.4 adapter test must assert transcript-presence for non-dry-run; that is CC#P2-2 Enforcement binding territory, not Slice 37 territory. Flagged forward in `specs/plans/phase-2-foundation-foldins.md` Slice 37 acceptance evidence. |
| 7 | LOW | **INCORPORATED (pre-commit)** | Soften the "What did not change" sentence in the ADR §Amendment block to clarify that the *realness criterion* and the *ratchet advancement rule* are unchanged, while the *executable binding is widened from 4-event-prose to 5-event-schema*. |

## Post-fold-in verdict (Claude, authoritative)

**ACCEPT-WITH-FOLD-INS.**

All HIGH and MED objections are either incorporated before the
ceremony commit (1, 2, 3, 4, 7) or correctly scoped to a later slice
(5, 6). Slice 37 closes composition review §HIGH 2 at both the
schema layer and the governance surface. Arc trajectory unchanged:
Slice 38 (HIGH 1 dispatch wiring + ADR-0008) remains the next
privileged-runtime-adjacent slice; Slice 39 (HIGH 4 artifact-path
split) deletes the tracked Check 25 collision; Slice 40 lands the
arc-close composition review before P2.4 reopens.

No new ratchet floor advancement beyond the 779 → 805 bump already
carried in this slice; the fold-in tests live inside the same Slice
37 commit.
