---
doc: explore-characterization
status: active
capture_date: 2026-04-24
characterized_by: codex
source: live old-Circuit state on disk at ~/Code/circuit
authority: reference evidence for CC#P2-1; NOT runtime compatibility
---

# Legacy Circuit - Explore Workflow Characterization

This document characterizes the live on-disk `explore` workflow in
first-generation Circuit as observed on **2026-04-24**. It exists because
ADR-0007 CC#P2-1 requires circuit-next's first parity workflow (`explore`)
to be checked against the corresponding reference Circuit workflow at
`~/Code/circuit`.

This is **reference evidence**, not a compatibility layer. circuit-next does
not parse old Circuit Explore artifacts through normal runtime paths. The
reference shape is pinned here so a circuit-next self-golden cannot be
mistaken for old-Circuit parity.

## Source paths inspected

```
~/Code/circuit/commands/explore.md
~/Code/circuit/skills/explore/SKILL.md
~/Code/circuit/skills/explore/circuit.yaml
~/Code/circuit/.circuit/circuit-runs/smoke-explore-decide-plural/
```

The characterization uses the live skill definition and one real old-Circuit
run record. The run record is useful but incomplete: it reached `close` and
did not write `artifacts/result.md`. The declared close shape comes from the
skill and workflow definition.

## Source fingerprints

The committed pin for this characterization is
`tests/fixtures/reference/legacy-circuit/explore/reference-shape.json`.
It records SHA-256 fingerprints for the inspected old-Circuit sources:

| Source | SHA-256 |
|---|---|
| `skills/explore/circuit.yaml` | `36779b6a631d4e8a45ae1a252edcc54f5eb8939f652c1405438b1891c67d9ae5` |
| `skills/explore/SKILL.md` | `fa762f6d6a78d0b09208fe966de02d37d23eaa2b91eb664e097952a463f9a4fc` |
| `.circuit/circuit-runs/smoke-explore-decide-plural/state.json` | `ce9e2f494b3694ab23159627ddb64fd2b358913de2ca34e147bce576b2be9fca` |
| `.circuit/circuit-runs/smoke-explore-decide-plural/events.ndjson` | `4779bf5309f7db4e8f54293aef0144f2741fc12430ab44084fabff759efb9b94` |

## Observed command surface

The old slash command at `~/Code/circuit/commands/explore.md` is a direct
skill launch:

- Lines 5 and 20 identify `/circuit:explore` as a direct command that
  launches the `circuit:explore` skill.
- Lines 21-26 tell the model to use `.circuit/bin/` helper wrappers and to
  treat manually authored run files as invalid for smoke/bootstrap proof.

## Declared workflow shape

The old workflow definition at `~/Code/circuit/skills/explore/circuit.yaml`
declares four steps:

| Step | Executor / kind | Writes |
|---|---|---|
| `frame` | orchestrator / checkpoint | `artifacts/brief.md` |
| `analyze` | worker / dispatch | `artifacts/analysis.md`, plus job request/receipt/result JSON files |
| `decide` | orchestrator / synthesis | `artifacts/plan.md` and `artifacts/decision.md` |
| `close` | orchestrator / synthesis | `artifacts/result.md` |

Relevant source lines:

- `circuit.yaml` lines 36-57: `frame` writes `artifacts/brief.md`.
- `circuit.yaml` lines 59-77: `analyze` dispatches and writes
  `artifacts/analysis.md`.
- `circuit.yaml` lines 79-98: `decide` writes both `artifacts/plan.md` and
  `artifacts/decision.md`.
- `circuit.yaml` lines 100-115: `close` writes `artifacts/result.md` and
  routes `pass` to `@complete`.

## Declared close artifact

The old skill body at `~/Code/circuit/skills/explore/SKILL.md` declares the
human-readable close artifact as Markdown:

```markdown
# Result: <task>
## Findings
<key discoveries>
## Decision (if applicable)
<what was decided and why>
## Plan (if applicable)
<execution plan ready for Build>
## Next Steps
<hand to Build, or done>
## PR Summary
<PR body seed if applicable>
```

Relevant source lines:

- `SKILL.md` lines 423-439: close phase writes `artifacts/result.md` with
  the headings above.
- `SKILL.md` lines 441-459: a plan-shaped result may transfer into Build
  instead of closing as a standalone Explore result.
- `SKILL.md` lines 461-466: decision-shaped results close normally, with a
  gate requiring non-empty Findings.

## Observed run record

The inspected run is:

```
~/Code/circuit/.circuit/circuit-runs/smoke-explore-decide-plural/
```

Its `state.json` says:

- `schema_version: "1"`.
- `circuit_id: "explore"`.
- `status: "in_progress"`.
- `current_step: "close"`.
- Artifacts completed: `artifacts/brief.md`, `artifacts/analysis.md`,
  `artifacts/plan.md`, `artifacts/decision.md`.
- No `artifacts/result.md` was present in the run directory.

Its event log confirms the same route:

```
run_started -> frame -> analyze -> decide -> close
```

The final recorded event is `step_started` for `close`, not a completed close.

## Reference artifact set

The reference Explore surface is Markdown-first:

| Reference artifact | Shape | Source of evidence |
|---|---|---|
| `artifacts/brief.md` | Markdown | declared in `circuit.yaml`, observed in run |
| `artifacts/analysis.md` | Markdown | declared in `circuit.yaml`, observed in run |
| `artifacts/plan.md` | Markdown | declared in `circuit.yaml`, observed in run |
| `artifacts/decision.md` | Markdown | declared in `circuit.yaml`, observed in run |
| `artifacts/result.md` | Markdown | declared in `circuit.yaml` and `SKILL.md`; not observed complete in the inspected run |

The reference workflow has no dedicated review-verdict artifact.

## circuit-next comparison

circuit-next's current Explore fixture emits structured JSON:

| circuit-next artifact | Shape | Notes |
|---|---|---|
| `artifacts/brief.json` | `explore.brief@v1` JSON | successor to reference `brief.md` |
| `artifacts/analysis.json` | `explore.analysis@v1` JSON | successor to reference `analysis.md` |
| `artifacts/synthesis.json` | `explore.synthesis@v1` JSON | structured successor to the reference decide outputs |
| `artifacts/review-verdict.json` | `explore.review-verdict@v1` JSON | new circuit-next artifact; no reference Explore counterpart |
| `artifacts/explore-result.json` | `explore.result@v1` JSON | structured successor to reference `result.md` |

That means the current `tests/fixtures/golden/explore/result.sha256` proves
circuit-next self-consistency for the structured JSON close artifact. It does
**not** prove byte-shape parity with old Circuit's Markdown close artifact.

## Implication for CC#P2-1

Slice 98 left CC#P2-1 **active - red** after this characterization. Slice 99
then made the product decision explicit: circuit-next uses structured JSON as
the canonical workflow artifact shape, and old Circuit's Markdown artifacts are
reference evidence rather than the target persisted format.

Effective Slice 99, ADR-0007 accepts clean-break structured JSON successor
parity for CC#P2-1. The accepted claim is that circuit-next's typed JSON
artifacts are the successor shape for Explore. It is not a claim that
circuit-next emits old-Circuit Markdown byte-for-byte.

This characterization is the reference side of that decision: it records what
old Circuit did, so the clean-break substitution is visible instead of implicit.

## Non-claims

- This document does not make old Circuit Markdown artifacts parseable by
  circuit-next.
- This document does not prove old Markdown byte-shape parity.
- This document does not claim the inspected old run reached completion.
- This document does not change the current circuit-next Explore runtime.
