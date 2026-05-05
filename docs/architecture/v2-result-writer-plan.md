# Circuit v2 Result Writer Plan

Phase 4.24 is a planning checkpoint. It does not move result writer code.
Phase 4.25 implements the path-only extraction recommended here.

The result boundary is smaller than connector subprocesses or registries, but
it is still user-visible. Both runtimes write `reports/result.json`; parent
sub-run and fanout readers consume child result files; `runs show`, CLI output,
operator summaries, generated commands, release proofs, and tests treat the
file as the durable close report.

## Files In Scope

| File | Current role | Current consumers | Disposition |
|---|---|---|---|
| `src/runtime/result-writer.ts` | Retained runtime writer for `reports/result.json`; owns `resultPath(...)` and `writeResult(...)`. | Retained runner, retained status projection, retained sub-run/fanout handlers, retained tests. | Keep for now. Candidate future slice may move only the path helper. |
| `src/core-v2/run/result-writer.ts` | v2 writer wrapper over `RunFileStore.writeJson('reports/result.json', ...)`. | `src/core-v2/run/graph-runner.ts`; v2 tests and parity tests. | Keep separate. Lifecycle is owned by v2 graph runner. |
| `src/schemas/result.ts` | Shared `RunResult` schema and user-visible result contract. | CLI, flow packages, retained runtime tests, v2 tests, release tests, operator summary. | Keep as the canonical shape. |
| `src/runtime/run-status-projection.ts` | Adds `result_path` for retained and v2 run folders. | `runs show`, CLI status tests. | Keep as cross-runtime status infrastructure. |
| `src/runtime/step-handlers/sub-run.ts` | Reads child `reports/result.json` and copies it into parent writes. | Retained sub-run fallback and tests. | Keep with retained handler. |
| `src/runtime/step-handlers/fanout.ts` | Reads child `reports/result.json` and copies it into branch result slots. | Retained fanout fallback and tests. | Keep with retained handler. |
| `src/core-v2/executors/sub-run.ts` | Reads child v2 or retained `RunResult` through `RunResult.parse`. | v2 sub-run. | Keep v2-owned. |
| `src/core-v2/fanout/branch-execution.ts` | Copies child `RunResult` into branch result slots. | v2 fanout. | Keep v2-owned. |

## User-Visible Contract

The universal run result is:

```text
<run-folder>/reports/result.json
```

It parses through `RunResult` and carries:

```text
schema_version
run_id
flow_id
goal
outcome
summary
closed_at
trace_entries_observed
manifest_hash
reason?
verdict?
```

This file is distinct from flow-specific close reports such as
`reports/build-result.json`, `reports/fix-result.json`, and
`reports/explore-result.json`.

## v1 And v2 Semantics

| Field / behavior | Retained runtime | core-v2 | Same? |
|---|---|---|---|
| Path | `resultPath(runFolder)` returns `<run-folder>/reports/result.json`. | `RunFileStore.writeJson('reports/result.json', ...)` resolves the same path. | Yes. |
| Schema shape | `writeResult(...)` parses through `RunResult` before writing. | `GraphRunResultV2` / `RunResultV2` mirrors `RunResult`; tests parse output through `RunResult`. | Effectively yes, but v2 writer itself does not call `RunResult.parse`. |
| `run_id` | Supplied by retained invocation or checkpoint resume. | Supplied by v2 options or generated UUID. | Yes. |
| `flow_id` | `flow.id` from retained compiled flow. | `context.flow.id` from executable v2 manifest. | Yes. |
| `goal` | Operator goal from invocation or resumed bootstrap. | Operator goal from v2 context. | Yes. |
| `outcome` | Derived from terminal route mapping in retained runner. | Derived by v2 graph runner close logic. | Yes for supported v2 modes; retained modes still use v1. |
| `summary` | `buildSummary(...)` counts completed v1 trace steps and names flow/version/goal. | `resultSummary(...)` says outcome and optional terminal target. | Intentionally different today. |
| `closed_at` | Same timestamp as retained `run.closed.recorded_at`. | `context.now().toISOString()` after appending v2 `run.closed`. | Equivalent enough for closed runs. |
| `trace_entries_observed` | Length of retained trace after `run.closed` is pushed. | Length of v2 trace after `run.closed` append. | Yes. |
| `manifest_hash` | Raw manifest snapshot hash from retained runner. | Hash from raw v2 `manifestBytes` when available, otherwise v2 fallback hash. | Yes for CLI default selector, which passes raw bytes. |
| `reason` | Mirrors retained close reason when present. | Mirrors v2 close reason when present. | Yes. |
| `verdict` | Latest admitted result-verdict relay/sub-run on complete runs only. | Latest admitted relay/sub-run verdict unless an entry marks `data.admitted === false`. | Similar, but not identical enough to merge blindly. |
| Checkpoint waiting | Retained runner returns `checkpoint_waiting` without writing `reports/result.json`. | v2 does not own checkpoint waiting/resume. | Retained-only. |

## Close Outcomes

| Outcome | Retained runtime | core-v2 supported modes |
|---|---|---|
| `complete` | Writes `reports/result.json`; emits completed progress. | Writes `reports/result.json`; emits completed progress. |
| `aborted` | Writes `reports/result.json`; reason should explain failure. | Writes `reports/result.json`; reason should explain failure. |
| `stopped` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent stopped, but unsupported retained modes still own many rich routes. |
| `handoff` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent handoff, but handoff/resume product behavior is retained. |
| `escalated` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent escalated, but unsupported retained modes still own many rich routes. |
| `checkpoint_waiting` | Returned to caller; no `reports/result.json` is written. | Not v2-owned. |

## Result Consumer Inventory

The Phase 4.24 inventory ran:

```bash
rg -n "resultPath|writeRunResult|writeResult|result-writer|reports/result.json|RunResult" \
  README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json
```

Consumers classify as:

| Consumer group | Examples | Ownership |
|---|---|---|
| User/host command text | `commands/review.md`, `commands/build.md`, `plugins/circuit/skills/*/SKILL.md` | Product surface; result path wording must stay stable. |
| Contracts/specs | `specs/reports.json`, flow contracts, release proof index | Schema and release evidence; update only with generated/drift checks. |
| Retained runtime writer/readers | `src/runtime/result-writer.ts`, `src/runtime/runner.ts`, `src/runtime/run-status-projection.ts`, retained sub-run/fanout handlers | Retained execution and compatibility. |
| core-v2 writer/readers | `src/core-v2/run/result-writer.ts`, `src/core-v2/run/graph-runner.ts`, v2 sub-run/fanout executors | v2 execution. |
| Shared consumers | `src/shared/operator-summary-writer.ts`, `src/schemas/result.ts` | Cross-runtime shape or presentation. |
| CLI output | `src/cli/circuit.ts` | Product output path and `RunResult` parsing. |
| Tests/oracles | `tests/runner/*`, `tests/core-v2/*`, `tests/parity/*`, release tests | Mixed: retained behavior, v2 behavior, and cross-runtime parity. |

## Ownership Decision

Implemented in Phase 4.25:

```text
Move only the shared result path constant/helper to a neutral module.
```

Target:

```text
src/shared/result-path.ts
```

Shape:

```ts
export const RUN_RESULT_RELATIVE_PATH = 'reports/result.json';
export function runResultPath(runFolder: string): string;
```

Phase 4.25 behavior:

- keep `src/runtime/result-writer.ts` as the retained writer;
- make `resultPath(...)` delegate to the shared helper for compatibility;
- use `RUN_RESULT_RELATIVE_PATH` in `src/core-v2/run/result-writer.ts`;
- use `runResultPath(...)` in retained/v2 progress and CLI result-path output;
- do not merge `writeResult(...)` and `writeRunResultV2(...)`.

Why not merge the writers now:

- retained runtime and v2 construct summaries differently;
- verdict admission logic is similar but not identical;
- retained checkpoint waiting intentionally does not write `result.json`;
- v2 uses `RunFileStore` and async path validation;
- retained runtime writes synchronously and validates through `RunResult.parse`;
- trace/status/progress ownership has not been narrowed yet.

## Required Tests For A Future Path-Only Move

Run at least:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/runner/runtime-smoke.test.ts
npx vitest run tests/runner/terminal-outcome-mapping.test.ts
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/runner/cli-v2-runtime.test.ts
npm run test:fast
npm run check-flow-drift
npm run verify
git diff --check
```

Also add a compatibility test if the shared helper is introduced:

```text
runtime resultPath(runFolder) === shared runResultPath(runFolder)
shared relative constant === "reports/result.json"
```

## Non-Goals

Do not do any of these in the path-only slice:

- merge retained and v2 result writers;
- change `RunResult`;
- change result summary wording;
- change verdict derivation;
- change checkpoint waiting behavior;
- change CLI output;
- change `runs show`;
- move trace/status/progress ownership;
- delete `src/runtime/result-writer.ts`.

## Deletion Status

No result writer deletion is approved.

After a path-only move, `src/runtime/result-writer.ts` would still remain live
because retained runtime still owns fallback execution, checkpoint waiting and
resume, arbitrary fixtures, `composeWriter`, and old runner/handler tests.
