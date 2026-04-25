# Product-Surface Inventory

Schema: v1
Slice: 27b
Baseline: yes
Note: slice=27b names the original baseline report format; generated_at, head_commit, and evidence summaries reflect the current checkout.
Generated: 2026-04-25T16:48:39.329Z
HEAD: a722ec802cc61e52d9680fbed2eb784335b8fede

**Summary:** 10 / 10 surfaces present, 0 absent.

## Surfaces

| id | category | present | planned slice | evidence |
|---|---|---|---|---|
| `runner.cli_script` | package_scripts | yes | 27d | scripts.circuit:run = "./bin/circuit-next" |
| `plugin.manifest` | plugin_surface | yes | 27d | .claude-plugin/plugin.json parses with name="circuit" version="0.1.0-alpha.2" |
| `plugin.dogfood_workflow_fixture` | plugin_surface | yes | 27d | .claude-plugin/skills/dogfood-run-0/circuit.json parses as non-empty object (9 top-level keys) |
| `runner.entrypoint` | src_runtime | yes | 27c | src/runtime/ contains 12 non-placeholder TS module(s): artifact-schemas.ts, config-loader.ts, event-log-reader.ts, event-writer.ts, manifest-snapshot-writer.ts, reducer.ts, result-writer.ts, router.ts, run-relative-path.ts, runner.ts, selection-resolver.ts, snapshot-writer.ts |
| `runner.event_writer` | src_runtime | yes | 27c | event writer module at src/runtime/event-writer.ts (non-placeholder, exports content) |
| `runner.snapshot_writer` | src_runtime | yes | 27c | snapshot writer module at src/runtime/snapshot-writer.ts (non-placeholder, exports content) |
| `runner.manifest_snapshot` | src_runtime | yes | 27c | manifest snapshot writer module at src/runtime/manifest-snapshot-writer.ts (non-placeholder, exports content); artifact run.manifest_snapshot present; backing file(s): src/schemas/manifest.ts |
| `tests.runner_smoke` | tests_runtime | yes | 27d | 3 test file(s) exercise runner smoke: tests/runner/agent-adapter-smoke.test.ts, tests/runner/codex-adapter-smoke.test.ts, tests/runner/dogfood-smoke.test.ts |
| `tests.event_log_round_trip` | tests_runtime | yes | 27c | 1 test file(s) exercise event-log round-trip: tests/unit/runtime/event-log-round-trip.test.ts |
| `docs.status_alignment` | status_docs | yes | — | current_slice=140 across README.md / PROJECT_STATE.md / TIER.md |

## Surface details

### `runner.cli_script`

- **Description:** npm run circuit:run entrypoint (`dogfood-run-0` dry-run invocation)
- **Category:** package_scripts
- **Planned slice:** 27d
- **Expected evidence:** package.json scripts.circuit:run is a non-placeholder shell command (not echo/true/noop)
- **Present at HEAD:** yes
- **Evidence summary:** scripts.circuit:run = "./bin/circuit-next"

### `plugin.manifest`

- **Description:** Claude Code plugin manifest
- **Category:** plugin_surface
- **Planned slice:** 27d
- **Expected evidence:** .claude-plugin/plugin.json exists, parses as object, declares non-empty name and version
- **Present at HEAD:** yes
- **Evidence summary:** .claude-plugin/plugin.json parses with name="circuit" version="0.1.0-alpha.2"

### `plugin.dogfood_workflow_fixture`

- **Description:** dogfood-run-0 workflow fixture loaded by `npm run circuit:run -- dogfood-run-0`
- **Category:** plugin_surface
- **Planned slice:** 27d
- **Expected evidence:** .claude-plugin/skills/dogfood-run-0/circuit.json parses as a non-empty JSON object
- **Present at HEAD:** yes
- **Evidence summary:** .claude-plugin/skills/dogfood-run-0/circuit.json parses as non-empty object (9 top-level keys)

### `runner.entrypoint`

- **Description:** src/runtime/ module hosting the runner entrypoint(s)
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** src/runtime/ contains at least one .ts file with an `export` and >=40 non-comment non-whitespace characters
- **Present at HEAD:** yes
- **Evidence summary:** src/runtime/ contains 12 non-placeholder TS module(s): artifact-schemas.ts, config-loader.ts, event-log-reader.ts, event-writer.ts, manifest-snapshot-writer.ts, reducer.ts, result-writer.ts, router.ts, run-relative-path.ts, runner.ts, selection-resolver.ts, snapshot-writer.ts

### `runner.event_writer`

- **Description:** Append-only events.ndjson writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** src/runtime/event-writer.ts exists with >=40 non-comment non-whitespace characters and an `export` token. The writer surface is runtime code, not a data shape — the event-log DATA artifact is `run.log` at specs/artifacts.json.
- **Present at HEAD:** yes
- **Evidence summary:** event writer module at src/runtime/event-writer.ts (non-placeholder, exports content)

### `runner.snapshot_writer`

- **Description:** Reducer-derived state.json writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** src/runtime/snapshot-writer.ts exists with >=40 non-comment non-whitespace characters and an `export` token. The writer surface is runtime code, not a data shape — the snapshot DATA artifact is `run.snapshot` at specs/artifacts.json.
- **Present at HEAD:** yes
- **Evidence summary:** snapshot writer module at src/runtime/snapshot-writer.ts (non-placeholder, exports content)

### `runner.manifest_snapshot`

- **Description:** manifest.snapshot.json byte-match writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** src/runtime/manifest-snapshot-writer.ts exists (>=40 non-comment chars, exports) AND specs/artifacts.json has a row whose id matches /manifest.?snapshot/ with a non-empty schema_file. Detection requires both the runtime module and the data-artifact row, because the byte-match gate is a runtime/data pair.
- **Present at HEAD:** yes
- **Evidence summary:** manifest snapshot writer module at src/runtime/manifest-snapshot-writer.ts (non-placeholder, exports content); artifact run.manifest_snapshot present; backing file(s): src/schemas/manifest.ts

### `tests.runner_smoke`

- **Description:** Runner smoke test exercising at least one dogfood step end-to-end
- **Category:** tests_runtime
- **Planned slice:** 27d
- **Expected evidence:** A tests/ file whose path matches /tests\/runner\/.*smoke\.test\.ts$/ or /tests\/.*runner[-_]smoke\.test\.ts$/ and contains an it/test/describe block
- **Present at HEAD:** yes
- **Evidence summary:** 3 test file(s) exercise runner smoke: tests/runner/agent-adapter-smoke.test.ts, tests/runner/codex-adapter-smoke.test.ts, tests/runner/dogfood-smoke.test.ts

### `tests.event_log_round_trip`

- **Description:** events.ndjson append → parse → reduce → derive state.json round-trip test
- **Category:** tests_runtime
- **Planned slice:** 27c
- **Expected evidence:** A tests/ file whose filename matches /event[-_]?log[-_]?round[-_]?trip\.test\.ts$/ and contains an it/test/describe block
- **Present at HEAD:** yes
- **Evidence summary:** 1 test file(s) exercise event-log round-trip: tests/unit/runtime/event-log-round-trip.test.ts

### `docs.status_alignment`

- **Description:** README.md / PROJECT_STATE.md / TIER.md current_slice markers present and in agreement
- **Category:** status_docs
- **Planned slice:** —
- **Expected evidence:** All three files carry a well-formed <!-- current_slice: <id> --> marker in the status-header zone, and the ids agree
- **Present at HEAD:** yes
- **Evidence summary:** current_slice=140 across README.md / PROJECT_STATE.md / TIER.md

## Delta rule

Per `specs/plans/phase-1-close-revised.md` §Slice 27b, slices 27c and 27d acceptance must rerun `npm run inventory` and assert expected runtime surfaces flip from `present: false` to `present: true`. Placeholder rows — empty files, echo-only scripts, JSON missing required fields, test files with no `it/test/describe` block, or artifact rows without non-empty repo-local schema/backing files — are rejected by the detectors in `scripts/inventory.mjs`.
