---
contract_target: fix
contract_version: 0.1
reviewer_model: gpt-5.5 via codex exec
reviewer_model_id: gpt-5.5
review_kind: adversarial property-auditor
review_date: 2026-04-25
verdict: REJECT → incorporated → ACCEPT (after fold-in)
authored_by: gpt-5.5 via codex exec + operator fold-in
authorship_role: operator+agent
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
---

# fix.md v0.1 - Codex Adversarial Property-Auditor Review

This records the Codex challenger pass for `specs/contracts/fix.md` v0.1, the
companion Fix artifact schemas at `src/schemas/artifacts/fix.ts`, the Fix
artifact authority rows in `specs/artifacts.json`, and the design-only Fix
recipe at `specs/workflow-recipes/fix-candidate.recipe.json`.

Codex was run through the local Codex CLI in read-only mode. It did not edit
files. The opening verdict was **REJECT-PENDING-FOLD-INS**.

## Findings and Dispositions

### HIGH 1 - Verification result accepted unsafe commands

Codex found that `fix.verification` reused the Build command-result schema,
which records `argv` and `cwd` but does not carry the safe command fields
`timeout_ms`, `max_output_bytes`, or `env`, and does not reject shell
executables. A result for `sh -c true` could have parsed as passed.

Disposition: **folded in**. `FixVerificationCommandResult` now carries the
bounded command spec fields, validates them through `FixVerificationCommand`,
and still ties `status` to `exit_code`. Tests now reject unsafe command results
at the `FixVerification` layer.

### HIGH 2 - The normal recipe path required a missing decision artifact

Codex found that `fix-diagnose.continue` routed directly to `fix-act`, while
`fix-act` required `fix.no-repro-decision@v1`. The normal reproduced path could
reach Act before the Human Decision item wrote that artifact.

Disposition: **folded in**. `fix-act` no longer requires the no-repro decision
artifact. The decision artifact remains available on the uncertain-evidence
path, and the recipe test pins that Act does not require it.

### HIGH 3 - Close could point at evidence it did not consume

Codex found that `FixResult` required pointers to context, diagnosis, change,
verification, and review, while `fix-close` consumed only brief, verification,
and review. The result pointer paths were also plain non-empty strings.

Disposition: **folded in**. `fix-close` now consumes brief, context, diagnosis,
change, verification, and review. `FixResultArtifactPointer` now pins each
artifact id to the expected run-relative path and schema. Tests cover path
mismatch rejection.

### HIGH 4 - Regression contract evidence was missing

Codex found that the old Repair characterization requires expected behavior,
actual behavior, a repro command or recipe, and a failing regression test unless
the bug is not reproducible. The draft Fix schema could report `fixed` with a
generic passed command but no failing-before-fix evidence or deferral reason.

Disposition: **folded in**. `FixBrief` now carries `FixRegressionContract`.
When repro evidence exists, its regression test must be
`failing-before-fix`. `FixResult` now carries `regression_status`, and a
`fixed` outcome requires `regression_status: proved`.

### MED 1 - Review was both optional and mandatory

Codex found that the recipe docs allow Lite-style review skipping, while
`FixResult` always required a `fix.review` pointer.

Disposition: **folded in**. `FixResult` now has `review_status:
completed | skipped`. Completed review requires a review verdict and
`fix.review` pointer. Skipped review requires an explicit skip reason and no
review verdict.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** The four HIGH issues and one MED issue were folded
into the schema, recipe, contract prose, and tests before commit.
