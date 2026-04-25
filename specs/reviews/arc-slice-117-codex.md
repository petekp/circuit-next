---
name: arc-slice-117-codex
description: Per-slice Codex challenger record for Slice 117 Build artifact contracts; primary contract review is build-md-v0.1-codex.md.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via user-run codex exec + operator fold-in
review_target: slice-117-build-artifact-contracts
target_kind: arc
target: slice-117
target_version: "Base HEAD=35e2d90d2f8a1697d12bc17c1416c4814c939f8d; working tree reviewed before Slice 117 commit"
arc_target: build-workflow-parity
arc_version: "Work item 2 Build artifact schemas and authority rows"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next -m gpt-5.4 -o specs/reviews/build-md-v0.1-codex.md (operator-run contract challenger)"
  - "npx vitest run tests/contracts/build-artifact-schemas.test.ts tests/contracts/cross-model-challenger.test.ts tests/contracts/artifact-authority.test.ts tests/contracts/artifact-backing-path-integrity.test.ts tests/contracts/invariant-ledger.test.ts"
  - "npm run verify"
opened_scope:
  - specs/contracts/build.md
  - specs/reviews/build-md-v0.1-codex.md
  - src/schemas/artifacts/build.ts
  - specs/artifacts.json
  - tests/contracts/build-artifact-schemas.test.ts
  - specs/plans/build-workflow-parity.md
  - specs/reference/legacy-circuit/build-characterization.md
skipped_scope:
  - Product Build workflow fixture and runtime writers were intentionally out of scope for Work item 2.
fold_in_disposition: |
  The contract challenger found two HIGH issues and one MED issue. Slice 117 folded all three in before commit: shell executables and Windows absolute/UNC cwd forms are rejected, verification command status is tied to exit_code, and Build review findings now accept critical severity.
---

# Slice 117 - Build Artifact Contracts - Codex Challenger Record

This per-slice record points to the primary Build contract challenger artifact
at `specs/reviews/build-md-v0.1-codex.md`.

Codex returned **REJECT-PENDING-FOLD-INS** with two HIGH findings and one MED
finding. All findings were folded into `src/schemas/artifacts/build.ts` and
`tests/contracts/build-artifact-schemas.test.ts` before commit, yielding an
ACCEPT-WITH-FOLD-INS close for this slice.
