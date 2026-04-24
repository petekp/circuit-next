---
contract_target: workflow
contract_version: 0.3
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
review_kind: adversarial property-auditor
review_date: 2026-04-24
verdict: NEEDS ADJUSTMENT → incorporated → ACCEPT
authored_by: operator + Codex
authorship_role: operator+agent
---

# workflow.md v0.3 - Codex Adversarial Property-Auditor Review

This records the contract-review facet of runtime-safety-floor Slice 4.
The v0.3 workflow contract adds **WF-I11** for pass-route terminal
reachability while keeping **WF-I8** as the broader graph sanity check.
The same challenger pass also reviewed the paired runtime guard in
`src/runtime/runner.ts`; the per-slice record is
`specs/reviews/arc-slice-72-codex.md`.

## Delta Under Review

- `specs/contracts/workflow.md` moved from v0.2 to v0.3.
- `codex_adversarial_review` now points at this canonical contract review
  record.
- WF-I11 was added to frontmatter and body.
- `specs/invariants.json` added a test-enforced WF-I11 row.
- `src/schemas/workflow.ts` now follows only `routes.pass` when proving
  terminal reachability for WF-I11.
- `tests/contracts/schema-parity.test.ts` covers a self-cycle, a
  multi-step pass-cycle, and a valid pass chain.
- `tests/runner/pass-route-cycle-guard.test.ts` covers a schema-bypass
  runtime cycle and verifies the runner closes the run as aborted.

## Opening Verdict

**ACCEPT-WITH-FOLD-INS.** The first Codex pass found no HIGH objections and
one MED objection in the runtime half of the contract movement.

## Objection List and Dispositions

### MED 1 - Runtime cycle abort projected a completed step

Codex found that the initial runtime guard closed the run as `aborted` but
emitted `step.completed` before rejecting the pass-route transition. That
made the event log and snapshot imply `routes.pass` had been taken even
though the safety guard blocked it.

Disposition: **folded in**. The runner now emits `step.aborted` before
`run.closed` on the cycle path and does not emit `step.completed`. The
runtime test asserts the exact event sequence and projected step state, so
WF-I11's schema-level rule has an honest runtime defense-in-depth closure.

## Closing Verdict

**ACCEPT.** The final Codex re-check accepted the fold-in. The challenger
could not run Vitest in its read-only sandbox because Vitest attempted
temp/cache writes; the parent session ran the targeted tests in a writable
environment.
