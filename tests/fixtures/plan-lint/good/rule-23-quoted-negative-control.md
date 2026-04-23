---
plan: rule-23-quoted-negative-control
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-23-quoted-negative-control-proof
trigger: |
  Violating chronology text inside a fenced code block inside the
  exact-match skip section `## §Evidence census`. Rule #23 stays
  silent on both guards: fenced code masks the line content; the
  skip section masks the whole region.
authority:
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md (lifecycle definition)
---

# Rule #23 Quoted Negative Control

## Why this plan exists

Arc goal: prove rule #23 respects both the fenced-code-block guard
and the exact-match skip section for `## §Evidence census`. Phase
goal: harden the rule against false positives on quoted authority
text. Trajectory: no earlier slice has reshaped this fixture.

## §Evidence census

The following code block contains text that would otherwise trigger
rule #23 P1/P2/P3 — but both the code fences AND the section match
keep the rule silent.

```
Slice 58 lands the plan-lint rule harness.
Slice 59 introduces the invariant vocab JSON.
Slice 60 advances the stale-symbol citation.
Slice 61 dispatches the CLAUDE.md discipline update.

If ACCEPT, commit the fold-ins.
If REJECT, revise the plan.

Next steps:
1. Commit revision 07.
2. Dispatch Codex pass.
3. Land the ADR.
```

### §Evidence census — Claims

| # | Claim | Status |
|---|---|---|
| E1 | Fenced code masks the chronology text | verified |
| E2 | Section match also masks the whole region | verified |

### §Evidence census — Hypotheses

*None.*

### §Evidence census — Unknown-blocking

*None.*

## §2 — The arc

Single-slice fixture arc.

### §2.A Slice description

**Lane:** Discovery (fixture authoring).

**Failure mode addressed:** Without a quoted-inside-skip-section
negative-control, the two guards (fenced code, section match) cannot
be proved orthogonal.

**Deliverable:** This fixture file.

**Acceptance evidence:** plan-lint against this fixture carries
zero `plan-lint.prospective-chronology-forbidden` findings.

**Alternate framing:** Put the violating text in plain prose inside
§Evidence census and rely on section-match alone. Rejected — that
tests only one guard; this fixture tests both.

**Ratchet:** Known-good fixture count for rule #23 (1 → 2).

**Codex challenger:** Not required for a fixture authoring slice.

## §3 — Acceptance evidence for arc close

1. This file is committed under `tests/fixtures/plan-lint/good/`.
2. plan-lint against the file returns GREEN.
3. The rule #23 negative-control test covers this fixture.
