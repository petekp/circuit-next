# Circuit v2 Checkpoint 1

## 1. Proposed v2 Architecture

Create `src/core-v2/` beside the current runtime. Keep it host-neutral and
manifest-driven.

Proposed modules:

- `domain/`: plain types for flows, steps, routes, reports, files, runs, trace,
  connectors, and selection.
- `manifest/`: executable manifest type, validation, and v1 compiled-flow
  adapter.
- `trace/`: append-only trace store and sequence authority.
- `run-files/`: path-safe JSON file store.
- `run/`: graph runner, run context, result writer, and resume support.
- `executors/`: compose, verification, checkpoint, relay, sub-run, and fanout
  executors.
- `projections/`: progress, status, evidence, task state, and user-input views.
- `connectors/`: connector resolver plus Claude Code, Codex, and custom
  connector implementations.
- `fanout/`: branch expansion, branch execution, worktree handling, join
  policy, aggregate report writing, and cleanup.

The runtime input is a validated executable manifest. Runtime execution should
not import arbitrary flow package code.

## 2. Highest-Confidence Keep Decisions

- Compiled-flow graph validation.
- Trace sequence authority.
- Run bootstrap and close rules.
- Checkpoint resume safety.
- Connector capability checks, argv checks, sandbox behavior, and effort/model
  compatibility.
- Catalog-driven flow package boundary.
- Report schema validation owned by flow packages.
- Path-safe run-relative writes.
- Generated surface drift checks.
- Manifest snapshot/hash for resume and audit.

## 3. Highest-Confidence Simplify Decisions

- Split the broad runner into graph, trace, projection, connector, and result
  modules.
- Keep route behavior but centralize alias handling.
- Replace flat optional schematic step bags with discriminated authoring shapes.
- Keep stage safety but move compatibility policy out of deep schema refinement.
- Split fanout into a subsystem instead of another large handler.
- Move Build-specific checkpoint/report policy toward the Build package.
- Keep progress/status as projections but move wording out of the runner.

## 4. Highest-Confidence Demote Decisions

- Treat runtime-proof as an internal fixture unless a current consumer proves
  it is product behavior.
- Demote `change_kind` to compatibility metadata unless a v2 consumer needs it.
- Treat behavioral prose as evidence until converted into parity tests.
- Keep historical methodology labels out of new runtime concepts.

## 5. Highest-Confidence Delete Decisions

- Remove stale `docs/contracts/compiled-flow.md` references in a later generated-surface
  cleanup step; the live contract is `docs/contracts/compiled-flow.md`.
- Delete stale generated outputs only through the generator and drift checks.
- Do not carry old route alias vocabulary into v2 manifests unless review keeps
  it deliberately.

## 6. Unknowns Requiring Review

- Whether Effect should be used at all, and if so only inside runtime services,
  connector cleanup, or fanout cancellation.
- Which consumers still need `change_kind`.
- Whether stage policy is purely structural or also a semantic product check.
- Whether runtime-proof should survive after focused v2 parity fixtures exist.
- How much Build checkpoint policy can move to the Build package without
  changing generated manifests.

## 7. Biggest Risks

- v2 becomes a second runtime that never replaces v1.
- Fanout is recreated as another broad handler.
- Connector safety is loosened to make migration easier.
- Progress/status drift away from trace-derived truth.
- Generated files are patched manually.
- Effect obscures simple run control flow.
- Architecture-transition docs need a scoped terminology exception, while
  product-facing prose remains guarded.

## 8. Proposed First v2 Vertical Slice

Build a plain TypeScript baseline under `src/core-v2/`:

- Minimal executable manifest type and validator.
- Trace store assigning monotonic sequence numbers.
- Path-safe `RunFileStore` using `RunFileRef`.
- Graph runner for a tiny manifest.
- Compose/local executor and stub relay executor.
- Failure path with trace and terminal result.
- Status projection derived from trace.

Use this as the baseline for the Effect comparison. If Effect is tested, keep it
small and side-by-side.

## 9. Effect/Plain TypeScript Spike Recommendation

Start Phase 1 in plain TypeScript. Add a focused Effect prototype only if it can
be compared against the baseline for cleanup safety, connector resources,
fanout cancellation, typed runtime services, error clarity, and testability.

Do not adopt Effect globally during Phase 1.

## 10. Files Changed

- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`
- `docs/architecture/v2-worklog.md`

## 11. Files Inspected

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- `UBIQUITOUS_LANGUAGE.md`
- `docs/generated-surfaces.md`
- `docs/contracts/compiled-flow.md`
- `docs/contracts/connector.md`
- `docs/contracts/run.md`
- `docs/contracts/step.md`
- `docs/contracts/stage.md`
- `docs/contracts/selection.md`
- `docs/contracts/config.md`
- `docs/contracts/continuity.md`
- `src/runtime/runner.ts`
- `src/runtime/compile-schematic-to-flow.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/reducer.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/run-status-projection.ts`
- `src/runtime/run-relative-path.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/runtime/router.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/custom.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/fanout/aggregate.ts`
- `src/runtime/step-handlers/fanout/branch-resolution.ts`
- `src/runtime/step-handlers/fanout/join-policy.ts`
- `src/runtime/step-handlers/fanout/types.ts`
- `src/cli/circuit.ts`
- `src/flows/catalog.ts`
- `src/flows/types.ts`
- representative flow packages under `src/flows/`
- `src/schemas/compiled-flow.ts`
- `src/schemas/flow-schematic.ts`
- `src/schemas/step.ts`
- `src/schemas/route-policy.ts`
- `src/schemas/scalars.ts`
- `specs/behavioral/prose-yaml-parity.md`
- `specs/behavioral/cross-model-challenger.md`
- `specs/behavioral/session-hygiene.md`
- `specs/invariants.json`
- `specs/reports.json`
- representative tests under `tests/contracts/`, `tests/runner/`,
  `tests/unit/`, and `tests/properties/`
- `commands/run.md`
- `.claude-plugin/plugin.json`
- `plugins/circuit/skills/run/SKILL.md`
- representative generated flows under `generated/flows/`
- `scripts/emit-flows.mjs`

Note: `docs/terminology.md` was requested in the Phase 0 reading list, but this
repo currently uses `UBIQUITOUS_LANGUAGE.md` as the terminology source.

## 12. Tests/Commands Run

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed after Phase 0.5 added a narrow
  `docs/architecture/v2-*` exception to the active terminology test.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Phase 0.5 also updated the proposed v2 runtime vocabulary to `trace/`,
`run-files/`, `RunFileRef`, and `RunFileStore`.

## 13. Anything Intentionally Not Changed

- No runtime code changed.
- No `src/core-v2/` code was created.
- No flow schemas changed.
- No flow package behavior changed.
- No generated manifest, command, Claude plugin, or Codex plugin output was
  edited.
- No package dependencies changed.
- No tests were rewritten.
- No old runtime code was deleted.
- Phase 1 was not started.
