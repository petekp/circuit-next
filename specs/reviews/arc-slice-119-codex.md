---
name: arc-slice-119-codex
description: Per-slice Codex challenger record for Slice 119 Build verification command execution.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec + operator fold-in
review_target: slice-119-build-verification-execution
target_kind: arc
target: slice-119
target_version: "Base HEAD=113727d300d6e9ec8596686d96ca1633ced0188e; working tree reviewed before Slice 119 commit"
arc_target: build-workflow-parity
arc_version: "Work item 4 Build verification command execution substrate"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 1
  high: 3
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --color never --skip-git-repo-check (operator-approved workspace challenger)"
  - "npx vitest run tests/runner/build-verification-exec.test.ts tests/runner/build-artifact-writer.test.ts tests/contracts/build-artifact-schemas.test.ts tests/contracts/schema-parity.test.ts tests/contracts/workflow-kind-policy.test.ts tests/contracts/artifact-authority.test.ts"
  - "npm run check"
  - "npm run verify"
  - "npm run audit"
opened_scope:
  - src/runtime/runner.ts
  - src/cli/dogfood.ts
  - src/schemas/step.ts
  - tests/runner/build-verification-exec.test.ts
  - tests/contracts/schema-parity.test.ts
  - tests/contracts/workflow-kind-policy.test.ts
  - specs/artifacts.json
  - specs/contracts/step.md
  - specs/domain.md
  - specs/plans/build-workflow-parity.md
skipped_scope:
  - Product Build workflow fixture, checkpoint execution, implementation/review dispatch, and custom workflow configuration remain later Build parity work.
fold_in_disposition: |
  The challenger found one CRITICAL, three HIGH, and one MED issue. Slice 119
  folded all five in: verification cwd resolution is realpath-checked and
  rejects symlink escapes, the CLI now passes an explicit project root into the
  runner, verification subprocesses inherit only a narrow environment allowlist
  plus command-declared env, VerificationStep is registered in the authority
  graph, and regression tests cover cwd containment plus output bounding.
---

# Slice 119 - Build Verification Execution - Codex Challenger Record

Codex returned **REJECT-PENDING-FOLD-INS** with five findings:

1. **CRITICAL:** verification cwd containment was lexical only, so symlinked
   paths could escape the declared project root.
2. **HIGH:** verification cwd resolution was anchored to ambient
   `process.cwd()` rather than the invocation's declared project root.
3. **HIGH:** verification subprocesses inherited the full parent environment.
4. **HIGH:** `VerificationStep` was exported from schema code but missing from
   the authority graph.
5. **MED:** tests did not cover cwd containment or output-limit behavior.

All findings were folded in before commit. Verification commands now run from a
declared project root with realpath and symlink checks, use a narrow environment
inheritance policy, and write bounded `build.verification@v1` evidence. The
authority graph names `VerificationStep`, and the runtime tests cover the
challenger's safety cases.

Verification after fold-in:

- `npx vitest run tests/runner/build-verification-exec.test.ts tests/runner/build-artifact-writer.test.ts tests/contracts/build-artifact-schemas.test.ts tests/contracts/schema-parity.test.ts tests/contracts/workflow-kind-policy.test.ts tests/contracts/artifact-authority.test.ts`
- `npm run check`
- `npm run verify`
- `npm run audit`
