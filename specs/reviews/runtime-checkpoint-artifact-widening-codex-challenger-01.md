---
name: runtime-checkpoint-artifact-widening-codex-challenger-01
description: First Codex challenger pass for the runtime-checkpoint-artifact-widening prerequisite arc plan.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: runtime-checkpoint-artifact-widening
  plan_revision: '01'
  plan_base_commit: a364454a3b8f396c91ad0bc257a2f2b6b908d34e
  plan_content_sha256: eb3d8b2d98fc2a05ce192c2c1fb47f4e14361460cd6124c2c5173ba1faee2438
target: specs/plans/runtime-checkpoint-artifact-widening.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 0
  high: 2
  med: 1
  low: 0
  meta: 0
---

Codex returns **REJECT-PENDING-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `eb3d8b2d98fc2a05ce192c2c1fb47f4e14361460cd6124c2c5173ba1faee2438`, and the plan self-declares `base_commit: a364454a3b8f396c91ad0bc257a2f2b6b908d34e`, matching the reviewed packet. The widening itself is narrow and the runner-side fence is mostly honest, but three fold-inable gaps block close: the Slice D arc-close review-artifact naming does not match the audit's regex, the Slice A ratchet claim is false against the repo's static test-declaration counter, and the build-brief precondition that survives the widening is left as undisposed contract drift.

## Findings

1. **HIGH — Slice D's named review artifacts do not satisfy the repo's standard arc-close challenger path.**

   *Failure mode.* Slice D is Heavy work on an audit gate, so the repo requires `Codex challenger: REQUIRED` plus audit-acceptable review evidence. The plan names only two composition-review files, `runtime-checkpoint-artifact-widening-claude-composition.md` and `runtime-checkpoint-artifact-widening-codex-composition.md`, and then relies on a custom `ARC_CLOSE_GATES` regex. But the audit's arc-subsumption path only accepts arc-close review filenames matching `arc-.+-composition-review-(claude|codex).md`; on ceremony commits it rejects the per-slice arc-subsumption shape. As written, Slice D can wire Check 26 yet still be under-scoped for Check 35 unless it also budgets a separate per-slice Codex review file.

   *Fold-in.* Make the composition-review filenames and the new `review_file_regex` conform to the repo's existing arc-close naming shape, for example `arc-runtime-checkpoint-artifact-widening-composition-review-{claude,codex}.md`. If the plan wants to keep the current filenames, it must explicitly add a third review artifact to Slice D: the separate per-slice Codex review file that Check 35 will consume.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:170-173,442-455`. Source: `AGENTS.md:124-128`; `scripts/audit.mjs:5032-5043,5124-5145`.

2. **HIGH — Slice A's ratchet accounting is not machine-honest against the repo's counted test floor.**

   *Failure mode.* The plan says Slice A is Ratchet-Advance because the existing checkpoint test will stay a single renamed test but gain one extra internal assertion. The repo's contract-test ratchet does not count assertions; it counts authored `it(`/`test(` declarations statically. So landing Slice A exactly as written does not advance the counted floor at all. That makes the §9 ratchet claim false and leaves the slice's "strictly advance" story unsupported by the repo's own measurement surface.

   *Fold-in.* Either add a new standalone `it(...)` for the new positive `fix.no-repro-decision@v1` case so the static count really increases by 1, or rewrite Slice A's lane/ratchet text so it does not claim a count-based ratchet advance and does not imply a floor bump.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:398-400,415-417,478-486`. Source: `scripts/audit.mjs:507-518,2707-2720`; `specs/ratchet-floor.json:4-8`.

3. **MED — The plan identifies the checkpoint-artifact contract drift, then leaves it in place.**

   *Failure mode.* E7 correctly shows that the checkpoint artifact rule is not represented by any named invariant in `specs/contracts/step.md` or `specs/invariants.json`, and that the current test title is mis-bound to `STEP-I9`. Slice A only renames the test. After the widening, the surviving special rule `build.brief@v1 requires policy.build_brief` still lives only in runtime code plus an unbound test title, so the plan preserves split authority between the runtime schema and the contract surface. That is not fatal to clearing substrate F2, but it is real contract drift the plan already knows about and does not dispose.

   *Fold-in.* Add a small same-slice contract bookkeeping patch: either name the surviving coupling as its own Step invariant in `specs/contracts/step.md` and bind it in `specs/invariants.json`, or explicitly narrow the plan's closure claim to "runtime parse sink only" and record this contract-authority drift as deferred rather than silently carrying it forward.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:57-58,143-149,328-352`. Source: `specs/contracts/step.md:121-126`; `specs/invariants.json:600-605`.

## Bottom line

The widening itself is narrow and the out-of-scope fence around runner-side Fix execution is mostly honest, but the plan is not yet structurally ready to clear. The blockers are all fold-inable: fix the Slice D review-artifact shape or budget the extra Codex review file, make Slice A's ratchet advance real under the repo's actual counting method, and either bind or explicitly defer the contract drift E7 already surfaced.
