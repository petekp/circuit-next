# Product-Surface Inventory

Schema: v1
Slice: 27b
Baseline: yes
Generated: 2026-04-20T21:24:32.242Z
HEAD: 1cc98496f0e32f46400a912171536cce1d7c5734

**Summary:** 1 / 10 surfaces present, 9 absent.

## Surfaces

| id | category | present | planned slice | evidence |
|---|---|---|---|---|
| `runner.cli_script` | package_scripts | no | 27d | scripts.circuit:run absent or empty |
| `plugin.manifest` | plugin_surface | no | 27d | .claude-plugin/plugin.json missing |
| `plugin.dogfood_workflow_fixture` | plugin_surface | no | 27d | .claude-plugin/skills/dogfood-run-0/circuit.json missing |
| `runner.entrypoint` | src_runtime | no | 27c | src/runtime/ missing; no runner entrypoint |
| `runner.event_writer` | src_runtime | no | 27c | no specs/artifacts.json row matches /event.?writer/ for event writer |
| `runner.snapshot_writer` | src_runtime | no | 27c | no specs/artifacts.json row matches /snapshot.?writer/ for snapshot writer |
| `runner.manifest_snapshot` | src_runtime | no | 27c | no specs/artifacts.json row matches /manifest.?snapshot/ for manifest snapshot |
| `tests.runner_smoke` | tests_runtime | no | 27d | no test file matches /(?:^\|\/)tests\/runner\/[^/]*smoke\.test\.ts$\|(?:^\|\/)tests\/[^/]+\/runner[-_]smoke\.test\.ts$/ (runner smoke) |
| `tests.event_log_round_trip` | tests_runtime | no | 27c | no test file matches /event[-_]?log[-_]?round[-_]?trip\.test\.ts$/ (event-log round-trip) |
| `docs.status_alignment` | status_docs | yes | — | current_slice=27b across README.md / PROJECT_STATE.md / TIER.md |

## Surface details

### `runner.cli_script`

- **Description:** npm run circuit:run entrypoint (`dogfood-run-0` dry-run invocation)
- **Category:** package_scripts
- **Planned slice:** 27d
- **Expected evidence:** package.json scripts.circuit:run is a non-placeholder shell command (not echo/true/noop)
- **Present at HEAD:** no
- **Evidence summary:** scripts.circuit:run absent or empty

### `plugin.manifest`

- **Description:** Claude Code plugin manifest
- **Category:** plugin_surface
- **Planned slice:** 27d
- **Expected evidence:** .claude-plugin/plugin.json exists, parses as object, declares non-empty name and version
- **Present at HEAD:** no
- **Evidence summary:** .claude-plugin/plugin.json missing

### `plugin.dogfood_workflow_fixture`

- **Description:** dogfood-run-0 workflow fixture loaded by `npm run circuit:run -- dogfood-run-0`
- **Category:** plugin_surface
- **Planned slice:** 27d
- **Expected evidence:** .claude-plugin/skills/dogfood-run-0/circuit.json parses as a non-empty JSON object
- **Present at HEAD:** no
- **Evidence summary:** .claude-plugin/skills/dogfood-run-0/circuit.json missing

### `runner.entrypoint`

- **Description:** src/runtime/ module hosting the runner entrypoint(s)
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** src/runtime/ contains at least one .ts file with an `export` and >=40 non-comment non-whitespace characters
- **Present at HEAD:** no
- **Evidence summary:** src/runtime/ missing; no runner entrypoint

### `runner.event_writer`

- **Description:** Append-only events.ndjson writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** specs/artifacts.json has a row whose id matches /event.?writer/ AND its schema_file or repo-local backing_paths resolve to a non-empty file
- **Present at HEAD:** no
- **Evidence summary:** no specs/artifacts.json row matches /event.?writer/ for event writer

### `runner.snapshot_writer`

- **Description:** Reducer-derived state.json writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** specs/artifacts.json has a row whose id matches /snapshot.?writer/ AND its schema_file or repo-local backing_paths resolve to a non-empty file
- **Present at HEAD:** no
- **Evidence summary:** no specs/artifacts.json row matches /snapshot.?writer/ for snapshot writer

### `runner.manifest_snapshot`

- **Description:** manifest.snapshot.json byte-match writer surface
- **Category:** src_runtime
- **Planned slice:** 27c
- **Expected evidence:** specs/artifacts.json has a row whose id matches /manifest.?snapshot/ AND its schema_file resolves to a non-empty file
- **Present at HEAD:** no
- **Evidence summary:** no specs/artifacts.json row matches /manifest.?snapshot/ for manifest snapshot

### `tests.runner_smoke`

- **Description:** Runner smoke test exercising at least one dogfood step end-to-end
- **Category:** tests_runtime
- **Planned slice:** 27d
- **Expected evidence:** A tests/ file whose path matches /tests\/runner\/.*smoke\.test\.ts$/ or /tests\/.*runner[-_]smoke\.test\.ts$/ and contains an it/test/describe block
- **Present at HEAD:** no
- **Evidence summary:** no test file matches /(?:^|\/)tests\/runner\/[^/]*smoke\.test\.ts$|(?:^|\/)tests\/[^/]+\/runner[-_]smoke\.test\.ts$/ (runner smoke)

### `tests.event_log_round_trip`

- **Description:** events.ndjson append → parse → reduce → derive state.json round-trip test
- **Category:** tests_runtime
- **Planned slice:** 27c
- **Expected evidence:** A tests/ file whose filename matches /event[-_]?log[-_]?round[-_]?trip\.test\.ts$/ and contains an it/test/describe block
- **Present at HEAD:** no
- **Evidence summary:** no test file matches /event[-_]?log[-_]?round[-_]?trip\.test\.ts$/ (event-log round-trip)

### `docs.status_alignment`

- **Description:** README.md / PROJECT_STATE.md / TIER.md current_slice markers present and in agreement
- **Category:** status_docs
- **Planned slice:** —
- **Expected evidence:** All three files carry a well-formed <!-- current_slice: <id> --> marker in the status-header zone, and the ids agree
- **Present at HEAD:** yes
- **Evidence summary:** current_slice=27b across README.md / PROJECT_STATE.md / TIER.md

## Delta rule

Per `specs/plans/phase-1-close-revised.md` §Slice 27b, slices 27c and 27d acceptance must rerun `npm run inventory` and assert expected runtime surfaces flip from `present: false` to `present: true`. Placeholder rows — empty files, echo-only scripts, JSON missing required fields, test files with no `it/test/describe` block, or artifact rows without non-empty repo-local schema/backing files — are rejected by the detectors in `scripts/inventory.mjs`.
