---
contract_target: build
contract_version: 0.1
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
review_kind: adversarial property-auditor
review_date: 2026-04-25
verdict: REJECT → incorporated → ACCEPT (after fold-in)
authored_by: gpt-5.4 via user-run codex exec + operator fold-in
authorship_role: operator+agent
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
---

# build.md v0.1 - Codex Adversarial Property-Auditor Review

This records the required Codex challenger pass for `specs/contracts/build.md`
v0.1, the companion Build artifact schemas at
`src/schemas/artifacts/build.ts`, and the six Build artifact authority rows in
`specs/artifacts.json`.

The Codex CLI was run by the operator outside this session because this
session's escalation reviewer blocked sending the uncommitted workspace to the
external Codex CLI. The operator provided the review output, and the fold-ins
below were applied in this session.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found two HIGH issues and one MED issue in
the draft artifact schemas.

## Findings and Dispositions

### HIGH 1 - Direct-exec boundary was bypassable

Codex found that `BuildVerificationCommand` only rejected shell binaries when
`argv` contained `-c`, and `ProjectRelativeCwd` only blocked Unix absolute and
home paths. The draft still accepted `argv: ['bash', 'scripts/verify.sh']`,
`argv: ['cmd.exe', '/c', 'dir']`, and `cwd: 'C:\\tmp'`.

Disposition: **folded in**. The schema now rejects known shell executables
outright, including Windows shell names, and rejects Windows absolute and UNC
`cwd` forms. Tests now cover `bash`, `cmd.exe`, and `C:\\tmp`.

### HIGH 2 - Verification results could lie about exit codes

Codex found that `BuildVerificationCommandResult` did not relate `status` to
`exit_code`, and `BuildVerification` derived `overall_status` from `status`
alone. The draft accepted false-green and false-red command result pairs.

Disposition: **folded in**. Each command result now enforces
`status === 'passed'` iff `exit_code === 0`, and the aggregate status continues
to derive from the parsed command statuses. Tests cover both mismatched pairs.

### MED 1 - Build review omitted critical severity

Codex found that `BuildReviewFinding` allowed `high | medium | low` but not
`critical`, while the existing review artifact schema and legacy Build review
loop both need a critical severity class.

Disposition: **folded in**. `BuildReviewFinding` now accepts `critical`, and
the schema tests assert that critical findings parse without downgrading.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** The two HIGH issues and one MED issue were folded
into the schema and tests before commit.
