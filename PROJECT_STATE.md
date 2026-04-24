<!-- current_slice: 75 -->

# PROJECT_STATE — circuit-next

**Phase:** 2 — Implementation (continuing). See
[PROJECT_STATE-chronicle.md](PROJECT_STATE-chronicle.md) for the
relocated narrative log + the full phase block with CC#14 retarget
context and phase-open provenance.

## §0 Live state

- **current_slice:** 75
- **current_arc:** between arcs (runtime-safety-floor closed; P2.9 remains
  challenger-cleared and awaits operator signoff before implementation)
- **current_phase:** Phase 2 — Implementation (continuing)

Chronicle (relocated narrative history — non-authoritative; see
disclaimer at file top) at
[PROJECT_STATE-chronicle.md](PROJECT_STATE-chronicle.md).

*This file carries only live state. Per-slice narrative — historical
reference, with authoritative ceremony evidence in the commit bodies
themselves — is relocated to the chronicle and appended by each slice
ceremony. Live state at `## §0` above is the machine-readable surface
for new consumers (`readLiveStateSection` helper in `scripts/audit.mjs`);
the `<!-- current_slice: N -->` HTML-comment marker at file top is
preserved unchanged for existing consumers (doctor.mjs, inventory.mjs,
audit.mjs status-epoch + freshness + arc-close gate + contract tests) per
ADR-0010 compat-shim discipline. Slice 68 ARC-CLOSE fold-in (Codex MED-2):
authority wording reconciled with chronicle's own "non-authoritative
history" disclaimer — commits are authoritative, chronicle is narrative
companion. Runtime Safety Floor plan revision 03 reached challenger-cleared
on 2026-04-24 via `specs/reviews/runtime-safety-floor-codex-challenger-03.md`
and received operator signoff on 2026-04-24. Slice 69 landed the
run-relative path primitive and runtime containment checks. Slice 70
landed the fresh run-root guard so a reused root is rejected before
bootstrap writes can mutate prior run evidence. Slice 71 landed durable
adapter invocation failure closure: thrown dispatchers now emit
`dispatch.failed`, close the run as aborted, and write aborted
`result.json` / `state.json` surfaces.*
Slice 72 added WF-I11 pass-route terminal reachability and a runtime
schema-bypass cycle guard: pass-only self-cycles and multi-step cycles now
fail workflow parsing, and any already-parsed workflow object that revisits
a step closes the run as aborted with `step.aborted`, aborted state, and
aborted result instead of hanging or falsely marking the step complete.*
Slice 73 maps terminal route labels to honest run outcomes: `@complete`
closes complete, `@stop` closes stopped, `@escalate` closes escalated,
and `@handoff` closes handoff, with `run.closed`, `state.json`,
`RunProjection`, and `artifacts/result.json` agreeing for each route.*
Slice 74 records the regression proof for the five original runtime-safety
findings and declares the challenger-cleared P2.9 second-workflow plan
fresh against the new path, run-root, dispatch-failure, pass-route,
terminal-outcome, and synthesis-boundary semantics. No P2.9 implementation
started in this slice.*
Slice 75 closed the runtime-safety-floor arc with two composition-review
prong files, folded the Codex MED by binding the arc into
`ARC_CLOSE_GATES`, advanced the plan to `closed`, and left P2.9 untouched
pending its separate operator signoff.*
