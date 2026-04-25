---
name: arc-slice-120-codex
description: Per-slice Codex challenger record for Slice 120 Build checkpoint waiting substrate.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec + operator fold-in
review_target: slice-120-build-checkpoint-waiting-substrate
target_kind: arc
target: slice-120
target_version: "Base HEAD=2b5a5bb572313d42aef75fb05d2d18e43ef86948; working tree reviewed before Slice 120 commit"
arc_target: build-workflow-parity
arc_version: "Work item 5 first checkpoint substrate slice: policy, waiting, safe resolution, and Build brief writing; resume remains next slice"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 2
  med: 3
  low: 0
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (operator-approved workspace challenger)"
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (Slice 120 fold-in recheck)"
  - "npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/contracts/schema-parity.test.ts tests/contracts/build-artifact-schemas.test.ts tests/contracts/workflow-kind-policy.test.ts tests/contracts/artifact-authority.test.ts tests/runner/cli-router.test.ts"
  - "npm run check"
  - "npm run verify"
  - "npm run audit"
opened_scope:
  - src/runtime/runner.ts
  - src/cli/dogfood.ts
  - src/schemas/step.ts
  - src/schemas/event.ts
  - tests/runner/build-checkpoint-exec.test.ts
  - tests/runner/cli-router.test.ts
  - tests/contracts/schema-parity.test.ts
  - specs/artifacts.json
  - specs/invariants.json
  - specs/contracts/step.md
  - specs/domain.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - Checkpoint resume command, public Build workflow fixture, implementation/review dispatch, and custom workflow configuration remain later Build parity work.
fold_in_disposition: |
  The challenger found two HIGH and three MED issues. Slice 120 folded four
  directly into runtime/schema/tests and narrowed the fifth into the next
  checkpoint slice: resume is explicitly not claimed here. Build briefs now use
  the invocation goal rather than checkpoint prompt, checkpoint_waiting CLI
  output is versioned, checkpoint request/resolution events require the evidence
  fields needed for audit, and unsupported checkpoint artifact configs fail at
  schema parse instead of runtime. The recheck found no remaining blocking
  objections for the narrowed scope.
---

# Slice 120 - Build Checkpoint Waiting Substrate - Codex Challenger Record

Codex returned **REJECT-PENDING-FOLD-INS** with five findings:

1. **HIGH:** the original claim included resume behavior, but no resume path
   existed.
2. **HIGH:** `build.brief@v1` used the checkpoint prompt as the objective
   instead of the operator's run goal.
3. **MED:** the `checkpoint_waiting` CLI envelope lacked a schema version.
4. **MED:** checkpoint event metadata was still optional enough that old,
   low-evidence event shapes could parse.
5. **MED:** checkpoint step typing allowed unsupported artifact configs that
   only failed later at runtime.

The resume concern was resolved by narrowing this slice: Slice 120 lands the
safe checkpoint substrate only, and the public resume command remains the next
checkpoint slice. The remaining findings were folded into code and tests before
commit. Build briefs now carry the run goal, CLI waiting output is versioned,
checkpoint event schemas require request/response evidence, and checkpoint
artifact writing is limited to declared `build.brief@v1` policy.

Codex rechecked the folded scope and reported no remaining blocking objections.

Verification after fold-in:

- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/contracts/schema-parity.test.ts tests/contracts/build-artifact-schemas.test.ts tests/contracts/workflow-kind-policy.test.ts tests/contracts/artifact-authority.test.ts tests/runner/cli-router.test.ts`
- `npm run check`
- `npm run verify`
- `npm run audit`
