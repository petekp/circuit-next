---
name: runtime-checkpoint-artifact-widening-codex-challenger-02
description: Second Codex challenger pass for the runtime-checkpoint-artifact-widening prerequisite arc plan, revision 02 (post-pass-01 fold-in).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: runtime-checkpoint-artifact-widening
  plan_revision: '02'
  plan_base_commit: 91da48165b9050ae2928d55bdb1ede219751417d
  plan_content_sha256: 207e1738b4fec1629dadaa829d22f8b3f3831c03e479440f84cadf88db4f269b
target: specs/plans/runtime-checkpoint-artifact-widening.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 1
  med: 2
  low: 0
  meta: 0
---

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `207e1738b4fec1629dadaa829d22f8b3f3831c03e479440f84cadf88db4f269b`, and the plan self-declares `base_commit: 91da48165b9050ae2928d55bdb1ede219751417d`, matching the reviewed packet. The pass-01 fold-ins are real: the arc-close filenames now match the audit regex, the test-count ratchet is wired to a separate new `it(...)`, and the contract-authority drift is explicitly deferred. Three remaining issues are all mechanical / textual fixes that do not reopen the plan shape.

## Findings

1. **HIGH — §6 overstates the widening as a live-behavior strict relaxation, but the runner still treats the newly admitted checkpoint shape as unsupported.**

   *Failure mode.* §6 says the widening is a strict relaxation and that "no live consumer relied on the rejection" of non-`build.brief@v1` checkpoint artifact schemas. On disk, the runtime does parse manifests through `Workflow.parse(...)`, but checkpoint execution still throws on any checkpoint artifact schema other than `build.brief@v1`. That means this arc is only a parse-layer relaxation, not an end-to-end runtime relaxation. As written, the plan can be read as proving more than it actually proves, which is exactly the kind of false-green seam this prerequisite arc is meant to avoid for substrate revision 04.

   *Fold-in.* Tighten §6 so every "strict relaxation" claim is explicitly bounded to `Step` / `Workflow.parse` acceptance only. Replace the "no live consumer relied on the rejection" sentence with wording that acknowledges the live runner still rejects the new shape later at execution time, and cross-reference §3 out-of-scope plus §11 close criterion 5 so the classification story and the close story use the same boundary.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:373-387,599-621`. Source: `specs/adrs/ADR-0003-authority-graph-gate.md:73-78`; `src/runtime/runner.ts:796-798,1174-1183`.

2. **MED — §7 and Slice D cite the wrong audit mechanisms, so the verification story is not reproducible from the named surfaces alone.**

   *Failure mode.* The plan says `countTests` is the "Check 26 / ratchet-floor surface" and says Check 35 enforces the ratchet-floor advance ↔ test-addition co-landing. On disk, Check 26 is the arc-close composition-review presence gate, Check 35 is the Codex-challenger declaration / arc-subsumption gate, the contract-test ratchet is main audit Check 6, and the pinned floor is enforced by `checkPinnedRatchetFloor`. The Slice D authority list also names `tests/scripts/audit-arc-close-gates.test.ts`, which does not exist in the current tree; the actual `ARC_CLOSE_GATES` coverage lives under `tests/contracts/`. That does not break the plan's architecture, but it does make the acceptance evidence mechanically hard to replay from the cited artifacts.

   *Fold-in.* Rewrite §7 to separate three things cleanly: `countTests`, the pinned floor check, and the arc-close / challenger audit checks. Remove the claim that Check 35 enforces ratchet-floor co-landing. In Slice D authority, replace the nonexistent test path with the real current coverage files, or phrase it generically as the contract tests that bind `ARC_CLOSE_GATES` and arc-subsumption.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:399-411,536-538`. Source: `scripts/audit.mjs:2690-2720,6289-6315,6546-6558,6665-6686`; `tests/contracts/artifact-backing-path-integrity.test.ts:732-780`; `tests/contracts/slice-47d-audit-extensions.test.ts:423-455`.

3. **MED — Close criterion 5 promises a `Workflow.parse()` proof, but Slice A only budgets the existing Step-level proof surface.**

   *Failure mode.* §11.5 says the downstream readiness check is a hand-authored `Workflow.parse()` success on the Fix-style checkpoint shape. But §3's Slice A instructions only update the existing checkpoint test block and add one nearby `it(...)`; the current block at `tests/contracts/schema-parity.test.ts:560-610` is a `Step.safeParse(...)` surface. `Workflow` is not a pure alias for `Step`; it adds its own structure-level checks over `steps`, `entry_modes`, `phases`, and route targets. If the slice follows the obvious local edit path the plan describes, the plan can close with a Step-level proof while documenting it as a Workflow-level proof.

   *Fold-in.* Make the proof surface explicit. Either require the new positive case to construct a minimal workflow and assert `Workflow.parse` / `Workflow.safeParse` success, or narrow §11.5 so it names a Step-level parse sink rather than a Workflow-level one. The plan is fine either way, but the prose and executable proof need to match.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:146-175,599-609`. Source: `tests/contracts/schema-parity.test.ts:560-610`; `src/schemas/workflow.ts:26-40,54-99`.

## Bottom line

The revision is bound, and the pass-01 fold-ins are real: the arc-close filenames now match the audit regex, the test-count ratchet is wired to a separate new `it(...)`, and the contract-authority drift is explicitly deferred instead of silently claimed closed. The remaining issues are fixable without reopening the plan shape: narrow the strict-relaxation language to the parse layer, correct the audit/test citations, and make the `Workflow.parse()` proof surface explicit. Once those fold-ins land, the plan is structurally honest as a prerequisite arc for substrate F2 at the runtime-parse layer only.
