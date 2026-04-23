---
plan: rule-20-verification-runtime-without-substrate
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-20-proof
---

# Bad fixture — rule #20

## Why this plan exists

Fixture assumes runtime subprocess capability.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | No runtime capability exists for subprocess exec | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:** Verification step performs subprocess execution of commands captured in scope. Orchestrator-executed subprocess collects stdout, stderr, and exit codes, emitting results as an inline artifact.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Add capability slice to arc.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
