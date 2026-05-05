# Circuit v2 Connector And Materializer Ownership Plan

Phase 4.18 is a planning checkpoint. It does not move connector subprocess
modules, relay materialization, registry code, selector behavior, or checkpoint
resume ownership.

The low-risk helper moves are complete:

- relay data/hash lives in `src/shared/connector-relay.ts`;
- connector parsing/model helpers live in `src/shared/connector-helpers.ts`;
- `src/runtime/connectors/shared.ts` is now a compatibility re-export surface.

The remaining connector files are production safety boundaries, not cheap
namespace cleanup.

## Current Files

| File | Current consumers | Safety contract | On-disk / trace contract | Evidence | Disposition |
|---|---|---|---|---|---|
| `src/runtime/connectors/claude-code.ts` | retained relay selection, core-v2 relay bridge, connector smoke tests, old runner tests | Owns Claude CLI argv, tool-surface restrictions, timeout and process-group kill behavior, stdout/stderr caps, provider/model/effort compatibility, JSON extraction at connector edge | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/runner/agent-connector-smoke.test.ts`, `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/explore-e2e-parity.test.ts`, `tests/contracts/connector-schema.test.ts`, full `npm run verify` | Keep in `src/runtime/connectors/` until a dedicated connector-safety move is reviewed |
| `src/runtime/connectors/codex.ts` | core-v2 relay bridge, retained relay selection, Codex connector contract tests, Codex smoke tests | Owns Codex CLI argv, read-only sandbox policy, forbidden argv checks, version capture, JSONL parse discipline, timeout and process-group kill behavior, provider/model/effort compatibility | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/contracts/codex-connector-schema.test.ts`, `tests/runner/codex-connector-smoke.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, full `npm run verify` | Keep in `src/runtime/connectors/` until a dedicated connector-safety move is reviewed |
| `src/runtime/connectors/custom.ts` | core-v2 relay bridge, retained relay selection, custom connector tests | Owns configured command invocation, prompt-file transport, temp-dir lifecycle, timeout and process-group kill behavior, output-size caps, JSON extraction at connector edge | Produces the shared `RelayResult` shape; writes temporary prompt/output files only, then removes the temp directory | `tests/runner/custom-connector-runtime.test.ts`, CLI custom connector precedence tests, full `npm run verify` | Keep in `src/runtime/connectors/` until custom connector execution policy is reviewed |
| `src/runtime/connectors/relay-materializer.ts` | retained relay handler tests, relay provenance tests, run-relative path tests, live smoke roundtrip tests | Owns translation from validated connector result to trace entries and durable relay slots; cross-checks role/provenance consistency | Writes request, receipt, result, and optional report files; emits the durable relay transcript sequence | `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, `tests/runner/runner-relay-provenance.test.ts`, `tests/runner/run-relative-path.test.ts`, `tests/runner/materializer-schema-parse.test.ts` | Keep until a materialization-contract plan proves byte-for-byte and trace-shape parity after a move |
| `src/runtime/connectors/shared.ts` | retained runtime imports, tests that still use the old connector surface | No subprocess behavior; compatibility only | No direct writes or trace entries | `tests/runner/connector-shared-compat.test.ts`, full `npm run verify` | Keep as a wrapper until old-path imports are migrated or intentionally retained |

## Source Fingerprint Coverage

Connector smoke fingerprints bind the source files that materially affect live
connector evidence.

Codex relay fingerprint coverage includes:

- `src/runtime/connectors/codex.ts`;
- `src/shared/connector-relay.ts`;
- `src/shared/connector-helpers.ts`;
- `src/runtime/connectors/shared.ts`;
- `src/runtime/connectors/relay-materializer.ts`;
- `src/runtime/runner.ts`;
- `src/runtime/registries/report-schemas.ts`.

Claude/agent Explore smoke fingerprint coverage includes:

- `src/runtime/connectors/claude-code.ts`;
- `src/shared/connector-relay.ts`;
- `src/shared/connector-helpers.ts`;
- `src/runtime/connectors/shared.ts`;
- `src/runtime/connectors/relay-materializer.ts`;
- `src/runtime/runner.ts`;
- `src/runtime/registries/report-schemas.ts`.

That coverage means changing helper, connector, materializer, runner call-site,
or report-schema behavior invalidates the smoke evidence. Keep these lists in
sync with any future connector or materializer move.

## Why Not Move The Subprocess Modules Now

The subprocess modules are capability boundaries. Moving them risks changing:

- argv construction;
- sandbox or permission behavior;
- provider/model/effort compatibility;
- timeout and process cleanup behavior;
- stdout/stderr caps;
- JSON extraction timing;
- custom connector temp-file lifecycle;
- source fingerprint evidence.

A future move needs a dedicated packet that proves the new path preserves those
contracts. It should include real or controlled connector smoke evidence and
contract tests, not just import rewrites.

## Why Not Move The Materializer Now

`relay-materializer.ts` owns the durable relay transcript and on-disk relay slot
shape. A move can affect:

- request/receipt/result/report file paths;
- run-relative path containment;
- trace entry order and sequence numbers;
- request and result hashes;
- role/provenance cross-validation;
- schema-validated report materialization assumptions.

That is more than namespace cleanup. A future materializer move should start
with explicit golden trace/on-disk contract tests, then move the file with a
compatibility wrapper.

## Recommended Position

Recommendation for this checkpoint:

```text
A. Keep connector subprocess and relay materializer modules in
   src/runtime/connectors for now.
```

Do not start options B, C, or D yet:

```text
B. Move relay materializer to a neutral connector/materialization module.
C. Move connector subprocess modules to a neutral connector module.
D. Move registries to a neutral flow-package index module.
```

Options B and C need a connector-safety review. Option D belongs to the registry
ownership plan.

## Future Move Requirements

Before moving connector subprocess modules or relay materialization, require:

- full import graph for connector and materializer references;
- unchanged connector source fingerprint coverage;
- static connector contract tests;
- custom connector execution tests;
- materializer trace/on-disk tests;
- run-relative path containment tests;
- core-v2 relay tests;
- retained relay handler tests;
- CLI v2 runtime tests;
- `npm run verify`;
- `git diff --check`.

Old runtime deletion is still not approved.
