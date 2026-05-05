# v2 Phase 4 Notes

## 1. Complex Flows Migrated

Phase 4 extended the opt-in core-v2 path across the representative complex
behaviors that were intentionally deferred after simple-flow parity:

- Explore default path parity.
- Explore tournament fanout parity with dynamic relay branches and
  aggregate-only join.
- Migrate sub-run parity through the Build child-flow boundary.
- Sweep default path parity, including recovery-route-capable graph shape.

This does not route production CLI execution through v2. The current runtime
remains the product path until later checkpoint approval.

## 2. Fanout Subsystem Structure

Fanout is split under `src/core-v2/fanout/`:

- `branch-expansion.ts` resolves static and dynamic branches.
- `branch-execution.ts` executes relay and sub-run branches.
- `join-policy.ts` evaluates aggregate-only, pick-winner, and disjoint-merge
  decisions.
- `aggregate-report.ts` writes the aggregate body.
- `worktree.ts` owns the default git worktree runner.

The v2 fanout executor coordinates those pieces without becoming a second
large fanout handler.

## 3. Sub-run Behavior Preserved

The v2 sub-run executor now preserves the load-bearing parent/child boundary:

- child run ids are fresh and distinct from the parent run id;
- child run folders are siblings of the parent run folder;
- child flows are resolved from raw compiled-flow bytes;
- parent trace records `sub_run.started` and `sub_run.completed`;
- child `reports/result.json` is copied into the parent `writes.result` slot;
- parent admission checks the child result verdict against `check.pass`;
- admitted child verdicts can propagate to the parent `reports/result.json`.

Nested checkpoint resume remains intentionally deferred.

## 4. Connector Safety Status

Phase 4 added explicit core-v2 connector resolver safety checks:

- auto/default/role/circuit connector resolution;
- connector identity preservation for named custom connectors;
- read-only connector rejection for implementer roles;
- custom connector read-only and argv validation through the current schemas;
- provider/model compatibility checks for `claude-code` and `codex`;
- connector effort allowlist checks.

The real subprocess connector implementations remain in the old runtime for
now. v2 relay/fanout tests use injected connectors so Phase 4 can prove runtime
shape without changing production subprocess behavior.

## 5. Tests Added

- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/parity/sweep-v2.test.ts`

Existing core-v2 and simple parity tests were kept passing.

## 6. Differences From Old Runtime

- v2 trace is still intentionally smaller than the current `TraceEntry` schema,
  though Phase 4 added sub-run, fanout, check, report-written, and relay-shaped
  trace kinds needed by complex parity.
- v2 relay execution still uses injected/stub connectors in tests rather than
  production subprocess calls.
- v2 fanout proves branch expansion, branch execution, aggregate writing, join
  policy, and cleanup behavior, but does not yet perform a real disjoint merge
  into the parent worktree.
- v2 sub-run rejects divergent `writes.report` materialization, matching the
  current narrow v1 behavior.

## 7. Manifest Snapshot Support

The v2 compiled-flow path now writes `manifest.snapshot.json` from the raw
compiled-flow bytes supplied to `runCompiledFlowV2`.

The snapshot support preserves the current hash contract:

- `manifest_hash` is computed from the same raw bytes that are executed.
- `run.bootstrapped.data.manifest_hash` matches the snapshot hash.
- `reports/result.json.manifest_hash` matches the snapshot hash.
- snapshot bytes can be decoded and parsed through the current `CompiledFlow`
  schema before resume/sub-run use.
- mismatched run id, flow id, hash, or non-compiled-flow bytes are rejected
  loudly.

Resume remains intentionally deferred. The new reader is a narrow validation
boundary for future resume and child-run snapshot checks, not a resume
implementation.

## 8. Risks Before Authoring/Schema Simplification

- Trace schema convergence should continue before v2 becomes the default run
  path.
- Real connector subprocess parity still needs a focused slice before old
  runtime deletion.
- Resume and nested checkpoint handling remain old-runtime responsibilities.
- Generated surfaces were not changed in Phase 4 and still depend on the
  existing v1 emit path.
