---
name: slice-27a-spike-mining
description: Slice 27a Discovery-lane read-only mining of spike/kernel-replay — event / reducer / manifest lessons to inform Slice 27c runtime boundary framing. Not a product-evidence claim; not a challenger review.
type: discovery
slice_id: 27a
lane: discovery
target_branch: spike/kernel-replay
target_commit: c5558941721ed562a6c39b0df08e080415bd6ae9
target_commits_mined:
  - c555894 spike: kernel v0.1.1 — event-store, validator, reducer, property tests
  - 9cc760d spike: incorporate Codex trace.md challenger (6 HIGH + 5 MED + 1 LOW)
  - 8b0e7ba spike: draft principles + trace contract (pre-challenger)
base_commit: 9e3dd8b
mining_date: 2026-04-20
wall_clock_minutes: 60
mined_by: claude-opus-4-7
product_evidence_claim: none
adversarial_review: not-applicable
---

# Slice 27a — Spike/Kernel-Replay Mining Inventory

## Purpose

Read-only harvest of event / reducer / manifest lessons from the abandoned
`spike/kernel-replay` branch. Input for **Slice 27c runtime-boundary framing**.
Not a product-evidence claim; not a challenger review; not an architecture
adoption. `spike/kernel-replay` disposition remains **abandoned-and-mined**
per `specs/plans/arc-remediation-plan-codex.md` §Q1.

## Scope and constraints

- **Lane:** Discovery.
- **Wall-clock:** 60 minutes.
- **Forbidden:** code cherry-picks, architecture adoption by inertia, any
  claim that the spike is product evidence.
- **Allowed:** prose inventory of lessons that can inform 27c scoping.

## Spike shape at a glance

Three commits beyond `main`, 18 files, +1883 lines. Adds one top-level source
tree `src/kernel/` (9 files) and one test tree `tests/properties/kernel/`
(3 files) plus one unit roundtrip. No contract in `specs/contracts/`; the spike
lives entirely at the runtime layer. Extends `specs/domain.md` with a
`Trace vocabulary` section (RunTrace, EventId, SequenceNumber, EventHash,
ManifestHash, TerminalEvent, ProjectionFunction) referencing an unwritten
`specs/contracts/trace.md`.

## Event-model lessons

1. **Narrow 4-kind discriminated union.** Spike enumerates
   `run.bootstrapped | step.completed | gate.evaluated | run.closed`.
   Production `Event` (at `src/schemas/event.ts`) enumerates 11 kinds. The
   spike deliberately narrowed to the minimum cardinality needed to prove
   its invariants (append-only chain, bootstrap-once, reducer determinism).
   **Lesson for 27c:** a dry-run dogfood workflow can exercise a narrow
   subset of the 11-kind enum in tests. 27c must state the subset at
   framing, not redraw the enum.

2. **Uniform base shape.** Every spike event carries
   `{ run_id, event_id, seq, prev_event_hash }`. This matches the production
   `Base` extract pattern in `src/schemas/event.ts`. No new insight — the
   uniform-base decision is already codified in production.

3. **Branded primitive triplet + two novelties.** Spike brands
   `EventId` (UUID), `SequenceNumber` (non-negative int), `EventHash`
   (`/^[0-9a-f]{64}$/`) — all consistent with production primitives — and
   adds `ManifestHash` and `ReducerFingerprint` (both `hexHash64`).
   `ManifestHash` is already implied by 27c's SHA-256 manifest deliverable.
   **`ReducerFingerprint` is novel and non-obvious:** it pins the SHA-256 of
   the reducer source into the bootstrap event, so a replay that sees a
   drifted fingerprint refuses to derive a snapshot. **Lesson for 27c:**
   out of scope — including `ReducerFingerprint` would count against the
   fastest-falsifier ≤2 boundary and expands past the minimal runtime
   deliverables. Candidate for a post-27c Discovery item if replay
   determinism becomes a real concern in Phase 1.5 or Phase 2.

4. **Terminal set as data + predicate.** Spike has
   `TERMINAL_KINDS = new Set(['run.closed'])` and `isTerminal(event)`. The
   production contract draft has three terminal kinds
   (`run.closed`, `run.aborted`, `run.escalated`). Spike narrowed to one.
   **Lesson for 27c:** enforcement needs an explicit data structure + pure
   predicate, not a string match — 27c can pick the narrow single-kind set
   for dry-run and expand later without reshuffling the runtime-boundary
   invariants.

## Event-store lessons

5. **Append-only is a writer contract, not a schema property.** Spike uses
   `atomicAppendLine(path, line)` built on `openSync('a') + writeSync`.
   Readers parse NDJSON line-by-line with explicit offset tracking. **Lesson
   for 27c:** the append-only property test must exercise the *writer*
   (prove no overwrite/truncation of prior events), not just the *schema*
   (which cannot see overwrites).

6. **Malformed-tail durable vs transient distinction.** Only the last line
   of `events.ndjson` is allowed to be malformed — it can be a transient
   partial write. Any non-last malformed line throws
   `TraceValidationError('malformed_tail_durable')` and requires operator
   repair. **Lesson for 27c:** crash-safety surface wants this distinction
   on day one. The plan deliverables don't list it explicitly; 27c framing
   should decide whether to include it in v1 or defer to a post-27c
   hardening slice.

7. **Newline hygiene at the writer.** `appendRaw` rejects lines containing
   `\n`. NDJSON correctness is preserved at write time, not parse time.

8. **Path safety as a named primitive.** Spike has `safeJoin(runRoot, rel)`
   that rejects absolute paths and `..` traversal, raising `PathSafetyError`.
   Runtime-boundary needs equivalent discipline. **Lesson for 27c:** if
   path safety lands as a new helper under `src/runtime/`, it is a **module
   file**, not a `src/schemas/*.ts` file, so it does not count against the
   fastest-falsifier ≤2 schema-file tripwire. Worth calling out at 27c
   framing.

9. **Atomic write + write-once-read-only for manifest.** Spike uses a
   tmp-file-rename `atomicWrite` for non-append writes and
   `writeOnceReadOnly` (best-effort `0o444` + caller discipline) for
   `manifest.json`. The bytes-match plan language in 27c makes sense only
   if the writer commits to stable bytes — atomic + write-once is the way.

## Reducer lessons

10. **`reduce = fold(step)` decomposition.** `reduce(events)` folds
    `step(prior, event)` left-to-right. `step` is total over the 4 event
    kinds. Bootstrap requires `prior === null`; non-bootstrap events
    require `prior !== null`. **Lesson for 27c:** this is the
    "reducer-derived snapshot" pattern the plan calls for. Decomposability
    is directly testable as a property:
    `reduce([...H, e]) === step(reduce(H), e)`.

11. **Snapshot shape DIFFERS from production.** Spike's `Snapshot` is
    `{ run_id, manifest_hash, kernel_version, trace_contract_version,
    reducer_fingerprint, last_seq, last_event_id, steps, is_terminal }`
    with `steps: Record<StepId, StepSnapshot>` and a narrow
    `StepSnapshot = { step_id, artifact_path, gate_verdict, evidence_path }`.
    **Production `Snapshot` (at `src/schemas/snapshot.ts`) has richer
    status machinery — `SnapshotStatus`, `StepStatus`, `StepState`.**
    **Lesson for 27c — load-bearing:** 27c must reconcile with production
    `Snapshot` (already artifact-bound to `<run-root>/state.json` per
    Slice 26a), not with the spike's narrower shape. Importing the spike
    reducer directly would silently regress the Slice 26a artifact
    binding. **This is the single most tempting cherry-pick to refuse.**

12. **Reducer purity invariants as property tests.** Spike proves
    (a) byte-identical snapshots across repeated `reduce(events)` calls,
    (b) invariance under `Date.now` / `Math.random` perturbation,
    (c) step-decomposition (`reduce(H+e) === step(reduce(H), e)`).
    **Lesson for 27c:** these are exactly the three properties the
    runtime-boundary acceptance should carry.

## Manifest lessons

13. **SHA-256 over JCS canonical encoding** is the spike's manifest hash
    algorithm. Canonical bytes are produced by `canonicalize(value)`:
    UTF-8, NFC-normalized strings, duplicate keys rejected, non-finite
    numbers rejected, integers outside IEEE-754 safe range rejected, keys
    sorted by NFC-normalized UTF-16. **Lesson for 27c — this is a genuine
    fork:** the plan language at
    `specs/plans/phase-1-close-revised.md` §Slice 27c says *"SHA-256 over
    the **exact persisted manifest snapshot bytes** unless the slice lands
    a stricter ADR."* The spike chose JCS canonicalization, which is the
    stricter option. 27c must decide at framing: raw-bytes match (simpler;
    depends on the writer producing the same bytes deterministically) vs
    JCS canonical (stricter; cross-platform safe; adds a canonical-JSON
    helper module). If 27c picks JCS, an ADR is required.

14. **Genesis hash convention.** Spike's bootstrap-event `prev_event_hash`
    is `sha256(canonical({run_id, kernel_version, trace_contract_version}))`.
    Not zero; not empty; not a fixed well-known seed. **Lesson for 27c:**
    only relevant if 27c adopts hash chaining — the plan deliverables list
    does **not** include `prev_event_hash` or hash-chain validation, so
    this is out of scope. Record for post-27c if the runtime boundary
    grows hash chaining later.

15. **`prev_event_hash` self-exclusion.** `hashEvent(event)` strips the
    event's own `prev_event_hash` before hashing, to avoid self-reference.
    Subtle correctness detail — only relevant if 27c adopts hash chaining.

## History-validator lessons

16. **Three-layer validation pipeline.**
    `validateHistoryStructure` (run_id uniformity, seq contiguity,
    bootstrap-first + bootstrap-unique, terminal-absorption, unique
    event_ids) + `validateHashChain` + `validateManifest` (manifest hash
    drift + reducer fingerprint drift). Each layer is separately testable.
    **Lesson for 27c:** keep the boundary-validation checks composable and
    orthogonal; do not bundle them into a single `isValid()` predicate.

17. **13 named error codes** in `TraceErrorCode` union (lock_contention,
    malformed_tail_durable, malformed_tail_transient, manifest_drift,
    mixed_run_id, bootstrap_missing/not_first/duplicate, sequence_gap,
    sequence_not_monotonic, duplicate_event_id, hash_chain_mismatch,
    terminal_absorption, unknown_event_kind, shape_invalid,
    reducer_fingerprint_drift, transition_invalid). **Lesson for 27c:**
    error naming is dense; the runtime boundary would benefit from a
    similar enumerated taxonomy. 27c can start with a narrower set and
    grow it.

## Test-ergonomics lessons

18. **`buildTrace` + `rechain` helpers.** One builder for straightforward
    sequences; one rechain helper that recomputes prev hashes after
    mutations. Makes negative tests tractable. **Lesson for 27c:** property
    test ergonomics benefit from this helper pattern. The helper itself is
    test-only code; it does not cross the runtime boundary.

## What 27c specifically gains from mining (summary)

| Lesson | 27c deliverable it informs |
|---|---|
| 5, 7, 8, 9 | Append-only event writer — path safety, newline hygiene, atomic writes |
| 10, 12 | Reducer-derived snapshot writer — decomposability property, purity properties |
| 13 | SHA-256 manifest byte-match — **decide raw-bytes vs JCS at framing** |
| 11 | Snapshot reconciliation — **DO NOT inherit spike's Snapshot shape** |
| 16, 17 | Validation pipeline and error taxonomy — compose orthogonally |
| 18 | Test helpers — `buildTrace`/`rechain`-style ergonomics |

## Forbidden cherry-picks (what 27c must NOT import)

- **`src/kernel/reducer.ts` reducer implementation.** The production
  `Snapshot` (at `src/schemas/snapshot.ts`, artifact-bound to
  `<run-root>/state.json` by Slice 26a) has richer status machinery than
  the spike's shape. Inheriting the spike reducer would regress the
  Slice 26a artifact binding. 27c authors a new reducer against production
  `Snapshot`.
- **`ReducerFingerprint` primitive.** Out of scope for 27c — adding it
  trips the fastest-falsifier boundary (it would add a third
  `src/schemas/*.ts` file beyond `manifest.ts` and `result.ts`, or force
  the boundary to migrate under `src/kernel/` or `src/runtime/`). Defer
  to a post-27c Discovery slice if replay determinism becomes a real
  concern.
- **`kernel_version` + `trace_contract_version` event-level fields.**
  Production event schema does not have them. These would be a new
  contract amendment, not a runtime-boundary concern. Defer.
- **The 4-kind narrow `Event` union.** The 11-kind production enum is
  authoritative. 27c tests can exercise a subset but must not redraw the
  enum.
- **`RunTrace` / `TerminalEvent` / `ProjectionFunction` domain terms.**
  Production `specs/domain.md` uses `RunLog` and `Snapshot`. Importing
  these spike-only terms without contract backing would violate the
  ubiquitous-language discipline.
- **`specs/contracts/trace.md`** (referenced by the spike's domain
  additions but never written). 27c is a runtime-boundary slice; contract
  authorship is the Phase 1 concern that is now closed. Do not open a
  new contract to carry 27c deliverables.

## Decisions 27c must make at framing (informed by mining)

1. **Manifest hash algorithm: raw persisted bytes vs JCS canonical.** Spike
   chose JCS. Plan language allows either, with a stricter ADR required for
   JCS. 27c must state the choice at framing.
2. **Malformed-tail policy.** Spike distinguishes durable vs transient.
   Plan deliverables do not mention it. 27c should decide to include or
   defer.
3. **Path-safety primitive placement.** If 27c authors a `safeJoin`
   equivalent, is it in `src/runtime/` or elsewhere? Not a schema file,
   so not a fastest-falsifier tripwire, but worth naming.
4. **Subset of the 11-kind event enum exercised by the dry-run.** Spike
   used 4. 27c must state its subset and what the dry-run proves about it.
5. **Genesis/prev-event-hash.** Plan deliverables do not include hash
   chaining. 27c should confirm that decision explicitly at framing so the
   exclusion is visible.

## Non-lessons (what mining did NOT surface)

- **Workflow fixture shape.** Spike has no workflow or manifest fixture.
  27d dogfood fixture is still untouched ground.
- **Dispatch adapter boundary.** Spike has no dispatch. 27d dry-run
  adapter design is still untouched ground.
- **Result artifact (`result.json`).** Spike has no result artifact.
  27c's `run.result` row is still untouched ground.
- **`circuit:run` CLI entry point.** Spike has no CLI. 27b/27d still
  untouched ground.

## Fastest-falsifier boundary re-check (for 27c framing)

The Fastest-Falsifier Checkpoint at Slice 26a (per
`PROJECT_STATE.md` and `specs/plans/phase-1-close-revised.md`
§Fastest-Falsifier) pins 27c scope at ≤2 new `specs/artifacts.json` rows
and ≤2 new `src/schemas/*.ts` files. Mining reconfirms the count:

- Rows: `run.manifest_snapshot`, `run.result` — 2.
- Schema files: `manifest.ts`, `result.ts` — 2.

Mining surfaced **no lesson that forces a third row or schema file.**
`ReducerFingerprint`, `EventHash`/`prev_event_hash`, canonical-JSON
helpers, and path-safety primitives are all out of scope for 27c, or live
under `src/runtime/` as module files rather than schema files.

**Tripwire status: still at the ≤2 boundary, still clear.** Any 27c
framing that discovers a need for a third row/schema file (e.g., splitting
`run.result` into `step.result` + `run.result`) trips retroactively and
forks to one Discovery slice for the minimum runtime architecture scaffold,
per the plan's existing guardrail.

## Close

Mining complete. Output is this inventory. No code cherry-picks; no
architecture adoption; no product-evidence claim. The spike branch remains
abandoned. Slice 27b (product-surface inventory baseline) is the next
Ratchet-Advance slice.
