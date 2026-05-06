# Circuit core-v2 Phase 5.34 review: retained trace/status/progress/checkpoint-state ownership

Please review this narrow next boundary before implementation. The goal is to decide whether any retained trace/status/progress/checkpoint-state code can move to neutral ownership now, and what proof is required. This is a review checkpoint because the files involved affect saved run folders, `runs show`, checkpoint resume, progress output, and retained trace/state recovery.

## Current state

Generated public fresh runs are already core-v2-routed for the current catalog. Recent phases moved several shared infrastructure clusters out of `src/runtime/**` while keeping old runtime paths as compatibility wrappers:

- Phase 5.13: registries and catalog derivations moved to `src/flows/**`.
- Phase 5.21: retained/v1 saved-folder operations were isolated behind `src/compat/retained-checkpoint-folders.ts`.
- Phase 5.32: connector subprocesses and relay materialization moved to `src/connectors/**`.
- Phase 5.33: router and schematic compiler moved to `src/flows/router.ts` and `src/flows/compile-schematic-to-flow.ts`.

Old runtime deletion is still blocked. The live blockers include retained/v1 checkpoint folders, arbitrary fixtures, custom roots, rollback, public `composeWriter`, old public wrappers, old oracle tests, and retained trace/progress/checkpoint/status behavior.

## Boundary under review

The next possible ownership move touches these clusters:

```text
src/runtime/trace-reader.ts
src/runtime/trace-writer.ts
src/runtime/reducer.ts
src/runtime/append-and-derive.ts
src/runtime/snapshot-writer.ts
src/runtime/progress-projector.ts
src/runtime/checkpoint-resume.ts
src/runtime/step-handlers/checkpoint.ts
src/run-status/project-run-folder.ts
src/run-status/v1-run-folder.ts
src/run-status/v2-run-folder.ts
src/compat/retained-checkpoint-folders.ts
src/core-v2/projections/progress.ts
src/core-v2/run/checkpoint-resume.ts
```

Existing docs have historically said not to move these internals without a focused ownership decision, because they are tied to retained/v1 saved folders and operator-facing inspection.

## Questions to answer

1. Is there any behavior-preserving ownership move that is safe now?
   - Examples: a neutral `src/trace/**` or `src/run-state/**` v1 trace facade, a neutral retained-progress wrapper, or a narrower compatibility package.
   - If yes, name the smallest implementation slice and exact old paths that must remain compatibility re-exports.

2. Which files must stay retained-runtime-owned for now?
   - In particular, decide whether `trace-reader`, `trace-writer`, `reducer`, `snapshot-writer`, `append-and-derive`, `progress-projector`, `checkpoint-resume`, and `step-handlers/checkpoint` should remain where they are.

3. Should we avoid moving implementation and only add stronger import guards/tests?
   - If yes, propose the most valuable behavior-preserving cleanup that can proceed without more review.

4. What tests and guardrails are required before any move?
   - Include `runs show`, retained/v1 checkpoint resume, malformed/tampered checkpoint state, retained progress, v2 progress, trace round-trip, handoff/status fallback, and old-path compatibility.

5. Confirm non-goals:
   - no retained/v1 folder migration or expiry;
   - no v2 resume for unmarked retained folders;
   - no status/handoff fallback widening;
   - no progress wording/schema change unless explicitly called out;
   - no rollback or `composeWriter` behavior change;
   - no arbitrary fixture or custom-root routing change;
   - no old runtime deletion;
   - no old oracle test deletion.

## Desired output

Please return:

- executive verdict;
- blocking findings, if any;
- approved next implementation slice, if any;
- exact files likely touched;
- tests and validation commands;
- what does and does not require another review.

If there is no safe ownership move, say that clearly and recommend the next autonomous behavior-preserving work.
