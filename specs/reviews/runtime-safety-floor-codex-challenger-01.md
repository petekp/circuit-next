---
review: runtime-safety-floor-codex-challenger-01
review_date: 2026-04-24
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authored_by: gpt-5.4
plan_slug: runtime-safety-floor
plan_revision: 01
plan_base_commit: 49090cd
plan_content_sha256: 1fc1e294a07e45d853f984a9eea04478004b6727d43aa2bedf92673541c6a48b
verdict: REJECT-PENDING-FOLD-INS
---

# Runtime Safety Floor — Codex Challenger Pass 01

## Verdict

**REJECT-PENDING-FOLD-INS.** Reviewed against HEAD
`942e67b5736c3a68a1f840db98641f7d4b179992`; the plan SHA matched
`1fc1e294a07e45d853f984a9eea04478004b6727d43aa2bedf92673541c6a48b`,
and `npm run plan:lint -- --context=committed
specs/plans/runtime-safety-floor.md` stayed green.

## Findings

### HIGH 1 — Slice 3 can fix the hang while shrinking dispatch provenance

Anchor: `specs/plans/runtime-safety-floor.md` §4 Slice 3.

Slice 3 closes the hang, but it does not bind the failure path to the
existing dispatch-provenance surface. The plan only requires adapter name,
step id, attempt, request-or-prompt hash, and reason, while the live
durable dispatch surface already requires `adapter`, `role`,
`resolved_selection`, and `resolved_from` at `src/schemas/event.ts` and
`src/runtime/adapters/dispatch-materializer.ts`.

As written, an implementation could "fix" the hang by emitting only a
smaller failure record and silently regress the current audit trail.

Blocks challenger-cleared: yes.

Minimum fold-in: require adapter-invocation failures to preserve
`dispatch.started`-equivalent provenance plus a durable pre-await
request-hash/prompt-hash record. If a new `dispatch.failed` event is
introduced, make it additive or explicitly reopen the event contract with
a named semantic tradeoff.

### HIGH 2 — Slices 1 and 4 move contract semantics without naming the movement

Anchor: `specs/plans/runtime-safety-floor.md` §4 Slice 1 and §4 Slice 4.

These slices change authoritative parse semantics, but the plan only
explicitly names contract/invariant updates in Slice 5. Slice 4 would
change WF-I8 from "some route chain reaches a terminal" to pass-only
reachability, while current authority still says the broader rule at
`specs/contracts/workflow.md` WF-I8 and `specs/invariants.json` WF-I8.
Slice 1 likewise tightens accepted step path syntax without naming where
that new invariant will live.

Blocks challenger-cleared: yes.

Minimum fold-in: explicitly bind the contract movement. Either revise
WF-I8 plus the invariant ledger and name the home for the run-relative
path invariant, or introduce new invariant ids instead of silently
redefining existing ones.

## Required Fold-Ins

1. Tighten Slice 3 so failure handling preserves existing dispatch
   provenance and pre-await durability, not just eventual abort semantics.
2. Tighten Slice 1 and Slice 4 so the contract/invariant edits are
   explicit, named, and review-bound.
3. Re-run the challenger pass against the revised plan revision and SHA,
   then transition to `challenger-cleared`.

## Artifact Note

This review cannot be used unchanged as the `challenger-cleared`
artifact after fold-ins. Once the plan is edited, the binding fields must
change with it (`plan_revision`, `plan_base_commit`,
`plan_content_sha256`). A rewritten or fresh ACCEPT-class review against
the revised plan can serve as the challenger-cleared artifact; this
revision-01 pass cannot.
