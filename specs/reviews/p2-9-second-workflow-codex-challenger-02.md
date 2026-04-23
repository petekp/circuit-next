---
review: p2-9-second-workflow-codex-challenger-02
review_date: 2026-04-23
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authored_by: gpt-5-codex
plan_slug: p2-9-second-workflow
plan_revision: 02
plan_base_commit: d921528
plan_content_sha256: c94adab8bb469f8f2be5783800e1380a10ba9e90d8b17e8c345ccbda84685d98
verdict: REJECT-PENDING-FOLD-INS
---

# P2.9 Second Workflow — Codex Challenger Pass 02

## Verdict

**REJECT-PENDING-FOLD-INS.** Revision 02 cleanly closes the audit-only
pivot and the tri-valued close semantics, but HIGH 1 from pass 01 is
still only partially folded in, and the rewrite introduced two new
execution-plan gaps: one around the close-phase artifact seam, one around
Slice 63's policy-test path.

## Findings

### HIGH 1 — §5 still misbinds the live dispatch contract, and Slice 64 does not pin the missing field

Revision 02 says the analyze-phase gate is
`source: {kind: 'result', ref: 'result'}` at
`specs/plans/p2-9-second-workflow.md:253-255`. The live
`ResultVerdictGate` contract does not admit that shape. Its source kind
is fixed to `dispatch_result`, not `result`
(`src/schemas/gate.ts:32-37`, `src/schemas/gate.ts:67-73`), and existing
fixture-policy tests already use that exact literal
(`tests/contracts/workflow-kind-policy.test.ts:65-69`,
`tests/contracts/workflow-kind-policy.test.ts:89-92`).

The problem is not just a prose typo. Slice 64's planned
"dispatch-shape" test only promises to pin `writes.result`,
`gate.pass`, and the adapter JSON response shape
(`specs/plans/p2-9-second-workflow.md:381-383`). It does **not** say it
will pin `gate.source.kind` / `gate.source.ref`, which was the actual
contract seam pass 01 called out. So the fold-in remains partial:
revision 02 names the live contract, but still misstates one of its
literal fields and leaves that field outside the promised schema-level
test.

The `NO_ISSUES_FOUND` / `ISSUES_FOUND` vocabulary itself is coherent with
the workflow's final verdict computation. The dispatch verdict is a
liveness/admission gate, and the artifact verdict is a separate close-phase
aggregation. The remaining defect is the contract binding, not the
two-level verdict model.

### HIGH 2 — Slice 64/66 assume a valid close-phase `review.result` without budgeting the live synthesis seam

The plan's artifact model says the registered `review.result` carries
`scope: string`, `findings: array`, and `verdict: CLEAN | ISSUES_FOUND`
(`specs/plans/p2-9-second-workflow.md:237-243`), and Slice 64 lands a
dedicated `src/schemas/artifacts/review.ts` for that shape
(`specs/plans/p2-9-second-workflow.md:374-379`). Slice 66 then claims the
synthesis step will produce a valid `review.result` artifact "parsing
against" that schema (`specs/plans/p2-9-second-workflow.md:413-417`).

But the live close-phase synthesis seam does not do that today. The
runner's synthesis path still writes one placeholder **string** per
`gate.required` entry and nothing more
(`src/runtime/runner.ts:363-385`). There is also no synthesis-artifact
schema parse path in the runtime: the only artifact-schema registry is
dispatch-only `src/runtime/artifact-schemas.ts`, and it is explicitly
scoped to `dispatchResult.result_body`
(`src/runtime/artifact-schemas.ts:3-17`,
`src/runtime/artifact-schemas.ts:53-58`,
`src/runtime/runner.ts:523-538`).

That means Slice 64/66 are not atomic as written. A close-step artifact
cannot simultaneously be:

1. Produced by the current placeholder synthesis helper, and
2. Valid against the declared `{scope, findings[], verdict}` schema

without an additional seam-widening act that the plan does not currently
budget. Either the plan needs to declare the extra runtime work
(specialized close-step authoring or earlier-than-P2.10 synthesis-schema
integration), or it needs to weaken the Slice 66 acceptance claim so it
does not promise a schema-valid close artifact the current seam cannot
emit.

### MED 1 — Slice 63's policy-test deliverable points to a file that does not exist

Slice 63 says the policy-table row should land in
`tests/policy/workflow-kind-policy.test.ts` and repeats that path in the
acceptance evidence (`specs/plans/p2-9-second-workflow.md:358-366`). That
is not the repo's actual policy-test location. The existing file is
`tests/contracts/workflow-kind-policy.test.ts`
(`tests/contracts/workflow-kind-policy.test.ts:1-12`), and there is no
`tests/policy/` tree in the current checkout.

This is not a conceptual blocker, but it does make the slice
non-executable as written. A plan slice cannot claim a test-row landing
against a path that does not exist in the repo's current contract/test
layout.

## Fold-In Check

- Pass-01 HIGH 1 (dispatch contract binding): **not closed**. The two-level
  verdict story is better, and E12 is directionally accurate, but §5 still
  misstates `gate.source.kind` and Slice 64 still under-specifies the test
  that is supposed to pin the live contract.
- Pass-01 HIGH 2 (§7 audit-only pivot): **closed**. The 3-phase scope
  narrowing is internally consistent, the plan no longer borrows the
  reference skill's "None available" authority-exhaustion branch as cover
  for runtime incapability, and the arc claim is honestly narrowed to
  audit-only review-family generalization.
- Pass-01 MED 3 (slice ordering + tri-valued close semantics): **closed**.
  Slice 63 no longer claims Check 24 before the fixture lands, Slice 68 now
  produces a usable three-class report, and §10.4's three-form close claim
  is operationally distinct rather than one overloaded ACCEPT bucket.

## Bottom Line

Revision 02 is closer, but not challenger-clearable yet. The required
next fold-ins are:

1. Correct §5's `ResultVerdictGate.source` binding to the literal live
   shape and extend Slice 64's dispatch-shape test to pin `gate.source.kind`
   and `gate.source.ref`, not only `writes.result` and `gate.pass`.
2. Reconcile Slice 64/66 with the current placeholder-only synthesis seam:
   either budget the extra runtime/schema work explicitly, or narrow the
   schema-valid close-artifact claim.
3. Fix Slice 63's policy-test path to the real contract test file.
