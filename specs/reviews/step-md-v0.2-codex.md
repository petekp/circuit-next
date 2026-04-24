---
contract_target: step
contract_version: 0.2
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
review_kind: adversarial property-auditor
review_date: 2026-04-24
verdict: REJECT → incorporated → ACCEPT
authored_by: operator + Codex
authorship_role: operator+agent
---

# step.md v0.2 - Codex Adversarial Property-Auditor Review

This records the Codex challenger pass for the `step.md` v0.2
grandfather exit in runtime-safety-floor Slice 1. The v0.2 change adds
STEP-I8, binds workflow-controlled Step paths to `RunRelativePath`, and
removes the old grandfathered review frontmatter in favor of this review
record.

Dispatch provenance note: the repo-preferred `/codex` wrapper failed
before review because its configured default model `gpt-5.5` was not
available to this account. A direct `codex exec` retry with
`gpt-5-codex` failed for the same account/model-access reason. The
successful challenger pass used the local Codex CLI with `gpt-5.4`,
`--sandbox read-only`, and no file edits.

## Delta Under Review

- `specs/contracts/step.md` moved from v0.1 grandfathered review status to
  v0.2 with `codex_adversarial_review:
  specs/reviews/step-md-v0.2-codex.md`.
- STEP-I8 added to frontmatter and body.
- `RunRelativePath` added in `src/schemas/primitives.ts` and used by
  `src/schemas/step.ts` for `ArtifactRef.path`, `reads`, checkpoint
  write paths, and dispatch write paths.
- `specs/invariants.json` added STEP-I8 and
  `step.prop.run_relative_paths`.
- The old `step.md` grandfather allowlist entry was removed from
  `tests/contracts/cross-model-challenger.test.ts`.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** The first Codex pass found one HIGH and two
MED findings across the combined runtime/contract slice. The contract
specific MED was the expected missing review artifact before this file
was created.

## Objection List and Dispositions

### HIGH 1 - Lexical containment missed symlink escapes

Codex found that `resolveRunRelative` used `resolve` plus `relative`, so a
workflow path through a symlinked ancestor inside `runRoot` could still
read or write outside the real root.

Disposition: **folded in**. `src/runtime/run-relative-path.ts` now rejects
existing symlink path components and validates real containment for
existing ancestors. `tests/runner/run-relative-path.test.ts` covers
symlinked synthesis write, dispatch read, and dispatch materialization
write ancestors.

### MED 1 - Contract review artifact missing

Codex found that `specs/contracts/step.md` linked to
`specs/reviews/step-md-v0.2-codex.md`, but the file did not exist yet.

Disposition: **folded in** by this review record. The generic
cross-model-challenger linkage test now has a canonical contract-review
file to resolve.

### MED 2 - Current-directory path cases were untested

Codex found that STEP-I8 and `RunRelativePath` rejected `.` path
segments, but the tests omitted `./x` and `artifacts/./x`.

Disposition: **folded in**. Primitive and schema tests now include both
current-directory cases, and the runtime-bypass test covers a current
directory segment before dispatch materialization.

### LOW 1 - STEP-I8 runtime defense was not ledger-bound

The re-challenge found that the contract named runtime defense in
STEP-I8, while `specs/invariants.json` bound STEP-I8 only to the schema
test.

Disposition: **folded in**. STEP-I8 now also binds to
`tests/runner/run-relative-path.test.ts`, whose describe title includes
`STEP-I8`.

### LOW 2 - Source line citations were stale

The re-challenge found stale line-number citations in `step.md` after the
schema file shifted.

Disposition: **folded in**. The contract now uses symbol-level
references for the Step union, variant schemas, budget shape, and
protocol field.

## Closing Verdict

**ACCEPT.** All HIGH/MED findings were folded in, and the re-challenge's
LOW traceability findings were also folded in before commit.
