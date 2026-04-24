---
review_kind: regression-proof
review_target: runtime-safety-floor
target_kind: arc
target: runtime-safety-floor
authored_at: 2026-04-24
authored_against_commit: b74c741
status: accepted
scope: |
  Compact closeout proof for Runtime Safety Floor Slice 6. This records the
  five original reproduced runtime failures, the fixed behavior now present
  after Slices 69-73, and the freshness check against the already
  challenger-cleared P2.9 second-workflow plan. It is not a P2.9
  implementation start.
---

# Runtime Safety Floor Regression Proof

## Verdict

The five reproduced runtime failures are fixed or fail closed with regression
coverage. P2.9's challenger-cleared plan remains semantically valid under
the new safety floor; no P2.9 plan revision or re-challenger is required
before operator signoff. The safety floor tightens authoring/runtime
preconditions, so future P2.9 slices must use fresh run roots and portable
run-relative artifact paths.

## Original probes and fixed outcomes

| Probe | Fixed outcome | Binding evidence |
|---|---|---|
| Workflow paths escape the run root. | Workflow-authored read/write paths now parse through `RunRelativePath`; runtime call sites resolve through `resolveRunRelative`, including symlink ancestor checks, before reading or writing. | `src/schemas/primitives.ts:37-59`, `src/schemas/step.ts:10-20`, `src/schemas/step.ts:61-74`, `src/runtime/run-relative-path.ts:10-45`, `src/runtime/runner.ts:306-329`, `src/runtime/runner.ts:475-485`, `src/runtime/adapters/dispatch-materializer.ts:147-164`, `specs/contracts/step.md:120-132`, `tests/runner/run-relative-path.test.ts:71-215`, `tests/contracts/schema-parity.test.ts:570` |
| Reusing a run root corrupts the prior log before failing. | `bootstrapRun` claims a fresh root before manifest/event/state writes; non-empty roots, claim collisions, files, symlinks, and existing run markers fail with a no-resume message before persistent bytes change. | `src/runtime/runner.ts:53-144`, `tests/runner/fresh-run-root.test.ts:108-153`, `tests/runner/fresh-run-root.test.ts:155-215` |
| Adapter failures leave runs permanently in progress. | A thrown dispatcher now emits `dispatch.failed`, mirrors dispatch provenance, fails the gate, aborts the step, closes the run as aborted, and writes aborted `state.json` plus `artifacts/result.json`. | `src/schemas/event.ts:145`, `src/runtime/runner.ts:445-448`, `src/runtime/runner.ts:646-691`, `tests/runner/dispatch-invocation-failure.test.ts:59-154` |
| Pass-route cycles parse and can hang the runner. | Workflow parsing now requires every `routes.pass` chain to reach a terminal route, and the runner has a schema-bypass visited-step guard that aborts before `step.completed`. | `src/schemas/workflow.ts:279-307`, `specs/contracts/workflow.md:73-81`, `specs/invariants.json:668`, `src/runtime/runner.ts:839-860`, `tests/contracts/schema-parity.test.ts:953`, `tests/contracts/schema-parity.test.ts:976`, `tests/contracts/schema-parity.test.ts:1002`, `tests/runner/pass-route-cycle-guard.test.ts:64-136` |
| Non-complete terminal routes close as complete. | Terminal labels now map to explicit run outcomes: `@complete -> complete`, `@stop -> stopped`, `@escalate -> escalated`, and `@handoff -> handoff`. The run log, projection, state, and result surfaces agree. | `src/runtime/runner.ts:450-461`, `src/runtime/runner.ts:843-879`, `src/runtime/runner.ts:885-912`, `specs/invariants.json:368`, `tests/runner/terminal-outcome-mapping.test.ts:18-49`, `tests/runner/terminal-outcome-mapping.test.ts:148-219` |

## P2.9 freshness check

P2.9 remains fresh, with these safety-floor overlays:

- Path semantics: P2.9 already intends run-root-relative artifact paths for
  the review dispatch result (`specs/plans/p2-9-second-workflow.md:283-303`).
  The safety floor narrows those paths from "non-empty string" to
  `RunRelativePath` (`src/schemas/step.ts:61-74`). Intended paths like
  `phases/analyze/review-raw-findings.json` remain valid; paths with `..`,
  absolute prefixes, backslashes, empty segments, dot segments, or colons do
  not.
- Run-root lifecycle: P2.9 runtime tests must allocate fresh run roots or
  pre-created empty directories. Reuse is now an immediate failure before
  bootstrap writes (`src/runtime/runner.ts:66-144`), which is compatible with
  the plan's fixture/test flow.
- Dispatch gate shape: P2.9's analyze-phase contract remains aligned with
  the live dispatch gate: `source.kind` is `dispatch_result`, `source.ref`
  is `result`, and the gate evaluator rejects missing, non-string, parse
  failure, or non-member verdicts (`src/schemas/gate.ts:32-38`,
  `src/schemas/gate.ts:67-74`, `src/runtime/runner.ts:258-293`,
  `src/runtime/runner.ts:306-329`). The plan's E12 line anchors are stale
  after the safety-floor edits, but the semantic claim is still true.
- Adapter invocation failure behavior is stricter now. P2.9 does not depend
  on thrown dispatchers leaving an in-progress run. Any P2.9 dispatch failure
  tests should preserve the new durable-abort surface (`dispatch.failed` ->
  failed gate -> `step.aborted` -> `run.closed outcome=aborted`).
- Route semantics are stricter now. A P2.9 review fixture must have a
  `routes.pass` chain that reaches a terminal route; the planned
  analyze-to-close-to-`@complete` spine remains compatible.
- Terminal outcomes are now honest. P2.9's clean close path can continue to
  use `@complete`; future `@stop`, `@escalate`, or `@handoff` paths will
  now report stopped, escalated, or handoff instead of complete.
- Synthesis limitation remains exactly the declared P2.9 boundary. The
  generic `writeSynthesisArtifact` helper still writes placeholder JSON
  from `gate.required` (`src/runtime/runner.ts:475-485`); P2.9 Slice 66's
  injected synthesis-writer seam and follow-on per-workflow synthesis-writer
  note remain necessary (`specs/plans/p2-9-second-workflow.md:454-486`).

## Acceptance notes

- This proof closes Runtime Safety Floor Slice 6's P2.9 freshness check
  without modifying `specs/plans/p2-9-second-workflow.md`.
- Verification is rerun in the Slice 74 landing command sequence.
- Audit acceptance is measured against the operator's current baseline:
  no new reds and no new unaccounted yellows. The already-known historical
  plan-commit reds and AGENT_SMOKE/CODEX_SMOKE fingerprint yellows are not
  treated as new regressions for this arc.
