# Implementer: Phase 1 — specs/contracts/step.md + close MED-#7

You are an independent implementation worker for circuit-next (not circuit).
Project root: `/Users/petepetrash/Code/circuit-next`.

## Mission

Land a single Ratchet-Advance commit that:
1. Tightens `src/schemas/gate.ts` so `Gate.source` is a typed kind-bound
   discriminated union (replaces `z.string()`).
2. Adds a `superRefine` to the `Step` discriminated union in
   `src/schemas/step.ts` that rejects any step whose `gate.source.ref`
   does not name an actual slot in the step's `writes` object.
3. Rewrites 7 existing positive-test sites in
   `tests/contracts/schema-parity.test.ts` to use the new typed source
   shape, and adds ≥ 4 new negative tests covering MED-#7 invariants.
4. Authors `specs/contracts/step.md` (new file) with YAML frontmatter
   + STEP-I1..STEP-I7 invariants + sections mirroring
   `specs/contracts/workflow.md`.
5. Updates `specs/contracts/workflow.md`'s "Gate source tightening
   (Phase 1 open)" section to a closed pointer targeting step.md.

## Authoritative sources

Read these IN ORDER before writing any code:

1. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/phases/implement/CHARTER.md`
2. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/implementation-handoff.md`
3. `/Users/petepetrash/Code/circuit-next/CLAUDE.md`
4. `/Users/petepetrash/Code/circuit-next/specs/domain.md`
5. `/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md` (template to follow)
6. `/Users/petepetrash/Code/circuit-next/bootstrap/adversarial-review-codex.md` (line 121+ for MED-#7)
7. Current state of the files in file_scope (see batch.json)

## Hard constraints

- Do NOT modify `/Users/petepetrash/Code/circuit` (distinct directory,
  read-only reference project).
- Do NOT use `--no-verify`, `--no-gpg-sign`, or any hook-skip flag.
- Do NOT invent step kinds, gate kinds, or invariants beyond what CHARTER
  and handoff specify.
- Do NOT delete existing tests; only rewrite the ones that used the old
  string-source shape and add new negatives.
- Ref grammar: `gate.source.ref` is a bare slot-name
  (`'artifact'`, `'response'`, `'result'`), NOT a dotted path. This is
  a deliberate design decision flagged in CHARTER Seam C.

## Verification

Run exactly once when done:

```bash
cd /Users/petepetrash/Code/circuit-next && npm run verify
```

Record the full output in your report. Test count must strictly advance
(current 34 contract tests + 1 smoke → ≥ 38 + 1 smoke = ≥ 39 total).

## Report shape

Write your report at
`/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/phases/implement/reports/report-step-contract-authorship.md`
with these headings exactly:

### Files Changed
### Tests Run
### Completion Claim
### Design Decisions Made
### Open Questions

See handoff §"Required report sections" for content requirements per heading.

Your verdict at `### Completion Claim` is one of exactly:
- `CLEAN`
- `ISSUES FOUND`

---
<!-- circuit:relay-protocol-inline -->
# Implementation Worker

Read `AGENTS.md` in the project root. Read `UBIQUITOUS_LANGUAGE.md` if it exists.
Use the task header above for prior context, scope, verification, and success criteria.

Stay inside the stated scope. If a necessary fix touches other files, keep it minimal and
explain why in the report.

Run every listed verification command before claiming completion. Re-run after each
meaningful change. You may run `./scripts/verify/verify.sh`; do not edit `.verifier/`.

Keep the change set clean:
- delete replaced code in the same change
- update docs or comments that describe changed behavior
- use project terms consistently

Write the implementation report to the exact path named in the header's `## Output`
section. If the header names multiple outputs, write the main worker report to the
report path and treat any other output paths as additional required artifacts.

Required report sections:

### Files Changed
List every file changed, created, or deleted with a one-line reason.

### Tests Run
Report the exact command, pass or fail count, and failures. Mark sandbox-caused failures
`SANDBOX_LIMITED`.

### Verification
If `./scripts/verify/verify.sh` ran, report the result. Otherwise say not run.

### Verdict
`N/A - implementation report`

### Completion Claim
`COMPLETE`, `PARTIAL`, or `BLOCKED`

### Issues Found
Problems, concerns, or edge cases you noticed.

### Next Steps
If `PARTIAL` or `BLOCKED`, name the next concrete action.
