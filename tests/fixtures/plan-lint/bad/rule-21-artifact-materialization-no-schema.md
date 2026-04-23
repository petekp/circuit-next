---
plan: rule-21-artifact-materialization-no-schema
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-21-proof
---

# Bad fixture — rule #21

## Why this plan exists

Fixture declares model-authored Markdown dispatch artifact.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Declared artifact is Markdown-shaped via dispatch | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:** IndependentAudit dispatch step emits model-authored adversarial Markdown via role=reviewer. Artifact materializes as `review.report.md` adjacent to other run artifacts. Verdict aggregates finding counts from the emitted Markdown.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Add JSON binding for report.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
