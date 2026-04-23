---
plan: rule-12-live-state-ledger-incomplete
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-12-proof
---

# Bad fixture — rule #12

## Why this plan exists

Fixture cites many files without corresponding census rows.

## §1 — Evidence census

Minimal. Only one verified row.

| # | Claim | Status |
|---|---|---|
| E1 | See body | verified |

Keywords: inferred unknown-blocking.

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:**
- scripts/audit.mjs
- scripts/planlint.mjs
- scripts/policy/workflow.mjs
- src/runtime/runner.ts
- src/cli/dogfood.ts
- src/schemas/workflow.ts
- src/runtime/adapter.ts
- src/runtime/dispatch.ts
- src/schemas/step.ts
- src/schemas/adapter.ts
- src/runtime/close.ts
- specs/contracts/explore.md
- specs/adrs/adr.md
- package.json

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Add census rows.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
