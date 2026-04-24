---
name: p2-1-json-successor-operator-decision
description: Operator product decision accepting structured JSON as the canonical Explore successor artifact shape for ADR-0007 CC#P2-1.
type: operator-decision
decision_date: 2026-04-24
target: ADR-0007 CC#P2-1
status: accepted
operator: orchestrator
decision: accept-clean-break-json-successor
not_claimed:
  - old Circuit Markdown byte-shape compatibility
  - old Circuit Markdown import support
  - human-readable workflow configuration UX
---

# P2-1 JSON Successor Operator Decision

The operator accepted structured JSON as the canonical Explore step artifact
shape for ADR-0007 CC#P2-1.

Plain-English decision:

> Use JSON for step inputs and outputs. People are unlikely to read those
> artifacts directly. The human-facing product work should focus later on making
> workflow configuration easy to understand.

## Meaning

For CC#P2-1, circuit-next's strict `explore.*@v1` JSON artifacts are the
accepted successor to old Circuit's Markdown Explore artifacts.

This file records only the Explore/CC#P2-1 consequence of the operator's JSON
preference. It does not authorize repo-wide substitutions for other
legacy-shaped workflows; each one needs its own reference evidence and
authority mapping.

This does not claim that circuit-next emits old-Circuit Markdown
byte-for-byte, imports old Markdown runs, or has finished the future UI work for
human-readable workflow configuration.

## Binding

ADR-0007 records the formal substitution. The legacy characterization at
`specs/reference/legacy-circuit/explore-characterization.md` remains the
reference evidence showing exactly what is being replaced.
