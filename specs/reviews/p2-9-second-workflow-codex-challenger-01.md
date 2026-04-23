---
review: p2-9-second-workflow-codex-challenger-01
review_date: 2026-04-23
plan_slug: p2-9-second-workflow
plan_revision: 01
plan_base_commit: d921528
plan_content_sha256: 3a6f84478b3122bd4f9c87c8ee4ffbbda593d4550770d75134331d57983e86f3
verdict: REJECT-PENDING-FOLD-INS
---

# P2.9 Second Workflow — Codex Challenger Pass 01

## Verdict

**REJECT-PENDING-FOLD-INS.** Revision 01 is materially better than the flawed draft and it does close most of the original invention-heavy failures. But three load-bearing gaps remain: the analyze-phase dispatch contract is still under-modeled against the live runtime, §7's Option B overreads the reference "None available" branch, and the slice/proof closure logic still lets the arc claim more than the execution plan actually proves.

## Findings

### HIGH 1 — The planned analyze-phase dispatch payload is not bound to the live dispatch contract

§5 and Slice 66 describe the reviewer step as emitting "structured findings JSON" into a phase-local intermediate that the close step later aggregates. The current runtime is tighter than that. `dispatch` steps are hard-bound to `ResultVerdictGate`, `writes.result`, and a top-level string `verdict` field; prompt composition explicitly instructs the worker to return raw JSON shaped around that verdict contract, and gate evaluation aborts when `verdict` is absent or not in `gate.pass`.

The plan never says what the review analyzer's accepted verdict vocabulary is, whether the findings payload is carried in `writes.result` or a registered artifact, or whether any gate/schema widening is needed. As written, Slice 66 would need to invent that contract during implementation time. That is exactly the class of plan drift the new gate is supposed to stop.

Why this matters:
- The current runtime does not have a generic "dispatch arbitrary findings JSON" seam.
- A stubbed adapter emitting findings-only JSON would fail the live gate.
- If the intended shape is `{ verdict, findings, ... }`, that shape needs to be declared now, not improvised in Slice 66.

### HIGH 2 — §7 Option B does not actually close HIGH 5; it renames runtime incapability as "verification unavailable"

The reference skill's "None available" branch is about **authority exhaustion** after checking user-supplied, artifact-declared, and repo-declared verification commands. Revision 01 uses that clause to justify a Verification Rerun phase that always writes `verification_status: "unavailable"` because circuit-next cannot execute subprocesses yet.

Those are not the same condition. "No authoritative command exists" is different from "authoritative commands may exist, but this runtime cannot run them." The characterization's no-substrate escape hatch was a scope pivot that **defers the verification phase**, not a permanent placeholder rerun that records unavailability for capability reasons.

As written, REVIEW-I2 makes `CLEAN` unreachable under Option B, and the artifact cannot distinguish:
- no command existed,
- a command existed but runtime could not execute it,
- a command was intentionally deferred out of P2.9 scope.

That means HIGH 5 is only partially folded in, and the plan still overclaims parity with the reference review surface.

### MED 3 — Slice ordering and proof/closure semantics are internally inconsistent

Slice 63 acceptance says Check 24 should report `review` fixture-shape compliance, but the `review` fixture does not land until Slice 65. That acceptance evidence cannot be satisfied at Slice 63 as currently ordered.

Later, Slice 68 says any seam that still requires widening can be declared as a follow-on and "does not block P2.9 close", while §10.4 still says the arc closes on "review-family generalization empirically validated." Those two statements do not fit together. If the proof slice discovers that a named generalization seam still needs widening, the arc may still be worth closing, but it is not the same thing as "generalization validated cleanly."

This leaves MED 11 only partially resolved: the rewrite narrows the headline claim, but the close gate still lets a failed seam read as a validated proof.

## 13-finding denominator check

Revision 01 does fold in most of the original ledger:

- Fully folded: HIGH 1, HIGH 2, HIGH 3, HIGH 4, HIGH 6, MED 7, MED 8, MED 9, MED 10, MED 12, MED 13.
- Partial only: HIGH 5 and MED 11.
- New gap relative to the old ledger: the live dispatch-result contract for the analyze-phase reviewer step is still unspecified even though Slice 66 depends on it.

So the plan's §0 statement that all 13 findings are folded in is too strong as written. It is closer to "all 13 are addressed, but not all 13 are closed cleanly."

## Required fold-ins

1. Bind the analyze-phase reviewer step to the current dispatch contract. If the intended payload is `{ verdict, findings, ... }`, say so in §5 and in Slice 64-66 deliverables/acceptance evidence. If that contract is not sufficient, add an explicit gate/schema-widening substrate slice instead of leaving the shape implicit.
2. Rework §7 so `verification_status: "unavailable"` means authority exhaustion, not runtime incapability. Either:
   - pivot P2.9 to a true 3-phase audit-only workflow with verification deferred, or
   - add explicit verification-source/provenance modeling and narrow the claim so the plan no longer implies reference-grade Verification Rerun parity.
   If reference review fast-mode intake (explicit scope / current diff / recent commit) is also out of scope for P2.9, say that plainly in §2/§6 rather than letting "review-family" read as fuller parity than the plan intends.
3. Repair the execution proof structure: remove fixture-dependent Check 24 evidence from Slice 63, and split the close semantics in §68/§10 so "clean generalization", "validated with declared follow-on widening", and "not yet validated" are distinct outcomes instead of one ACCEPT-shaped bucket.
