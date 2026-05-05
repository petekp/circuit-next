# Circuit v2 Phase 2 Notes

## 1. Adapter Design

Phase 2 adds `src/core-v2/manifest/from-compiled-flow-v1.ts`.

The adapter takes a parsed v1 `CompiledFlow` and produces an
`ExecutableFlowV2`. It preserves v1 vocabulary at the adapter boundary:

- Terminal targets stay `@complete`, `@stop`, `@handoff`, and `@escalate`.
- Route names are copied as authored/compiled.
- Entry mode names, depths, and start steps are copied.
- Stage ids and step ids are copied.
- Stage membership is copied through `stages[].stepIds`. Steps do not carry a
  singular stage id because v1 allows overlapping stages.
- Step kinds are copied into v2 equivalents.
- Run-file paths are copied from v1 `reads` and `writes`.
- Report schema refs are preserved as `RunFileRef.schema`.
- Selection overrides are copied into v2 selection records with v1 field names
  preserved at the adapter boundary.

The adapter validates the produced manifest with `assertExecutableFlowV2`.

## 2. v1 Quirks Isolated

Known v1 behavior kept explicit:

- `continue` and `complete` route aliases remain route names in adapted
  manifests. The adapter does not normalize them away.
- Checkpoint choices are not always route names. Checkpoint routing still
  requires `pass`, while choice ids remain preserved separately.
- Stage membership stays in v1 order under `stages[].steps`. A step may appear
  in multiple stages, matching v1 selection behavior.
- Compose writer identity is currently represented by v1 `protocol`.
- Verification checks preserve the v1 check object rather than inventing a new
  check vocabulary.
- Fanout branch and join configuration are preserved as data. v2 does not
  execute fanout yet.
- Sub-run child flow id, entry mode, optional version, goal, depth, and result
  paths are preserved.

## 3. Unsupported v1 Shapes

The adapter rejects a v1 flow if validation finds a step that is not listed in
any stage. It accepts overlapping stage membership because v1 selection can
apply multiple stage layers to one step.

The adapter represents all current v1 step kinds, but v2 execution support is
still limited to compose and relay. Adapter parity does not imply execution
parity.

## 4. Validation Behavior

Phase 2 strengthens v2 manifest validation for adapter correctness:

- Flow must declare at least one step.
- Flow must declare at least one stage.
- Stage ids and step ids must be unique.
- Stage step references must point at known steps.
- Each step must be listed in at least one stage.
- A stage must not list the same step more than once.
- Non-checkpoint and checkpoint steps must declare `pass`.
- Route targets must be known steps or v1 terminal targets.
- Checkpoint choices must be non-empty and unique.
- Entry modes, when present, must be non-empty.
- Entry mode names must be unique.
- Entry mode start steps must exist.
- Run-file read and write paths must be valid before execution starts.

Deeper graph liveness checks remain deferred: terminal reachability, pass-route
terminal reachability, and no-dead-step analysis should be added when v2 starts
execution parity work.

## 5. Tests Added

`tests/core-v2/from-compiled-flow-v1.test.ts` covers:

- Conversion of representative generated flows:
  - `review`
  - `fix`
  - `build`
  - `migrate`
  - `sweep`
  - `explore` tournament
- Step-kind representation for compose, verification, checkpoint, relay,
  sub-run, and fanout.
- Entry mode and stage preservation.
- Overlapping stage membership preservation.
- Route and terminal target preservation.
- Read/write path preservation.
- Report schema ref preservation.
- Checkpoint policy and choice preservation.
- Sub-run config preservation.
- Fanout config and aggregate report preservation.
- Adapter validation failure for unknown route target.
- Adapter validation failure for missing `pass` route.
- v2 validation for missing stage membership.
- v2 validation for duplicate step references within one stage.
- v2 validation for duplicate checkpoint choices.
- v2 validation for duplicate entry mode names and unknown entry mode starts.
- v2 validation for run-file path safety.

## 6. Risks for Parity Phase

- Trace shape is still minimal and not exact v1 schema parity.
- Result shape is still minimal and not exact v1 result schema parity.
- v2 cannot execute verification, checkpoint, sub-run, or fanout yet.
- The adapter preserves v1 quirks, but later phases must avoid turning those
  quirks into new generic runtime concepts.
- Deeper graph liveness validation still needs to be added before v2 can claim
  broad execution parity.

## 7. Commands Run

- `npx vitest run tests/core-v2/from-compiled-flow-v1.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order in new files.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  new files.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npx vitest run tests/core-v2`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

## 9. Adversarial Review Fixes

After the Phase 2.5 review, core-v2 fixed four issues before Phase 3:

- The graph runner now validates an executor-returned route before appending
  `step.completed`, so undeclared routes produce `step.aborted` without a
  contradictory completion entry.
- The adapter now uses `entry_modes[0]` as the default executable entry,
  matching v1 runtime behavior.
- The manifest validator now rejects invalid run-file paths before run
  bootstrap.
- Selection conversion now preserves v1 `invocation_options` instead of
  renaming it at the adapter boundary.

Tests added explicit coverage for each fix. Commands for this correction pass
are recorded in `docs/architecture/v2-worklog.md`.
- `npm run verify`: passed.
- `npm run test`: passed.
- `npm run verify`: passed.

## 8. Phase 2.5 Correction

Phase 2.5 removed singular `BaseStepV2.stageId`. The manifest now derives step
membership only from `ExecutableStageV2.stepIds`, which preserves v1 overlapping
stage semantics and avoids a future selection translation layer.

The validator now accepts a step listed in multiple distinct stages while still
rejecting missing stage membership, unknown stage step references, duplicate
step references inside one stage, duplicate entry mode names, empty entry modes,
and entry modes whose start step does not exist.

Phase 2.5 tests added explicit coverage for:

- v2 accepting one step listed in two stages.
- `fromCompiledFlowV1` accepting a v1 parsed flow with overlapping stages.
- duplicate entry mode names.
- unknown entry mode starts.
- empty entry mode arrays.

Phase 2.5 commands:

- `npx vitest run tests/core-v2`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
