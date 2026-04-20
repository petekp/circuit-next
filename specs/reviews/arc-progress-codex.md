---
review_target: arc-progress-retrospective
target_kind: arc
arc_target: circuit-next-full-arc-to-date
arc_version: 0.1
target_commit: 682704d
reviewer_model: GPT-5 Codex
review_kind: adversarial arc-retrospective audit
review_date: 2026-04-20
verdict: REJECT pending HIGH fold-ins
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: pending operator disposition
authored_by: Codex
commands_run:
  - git status --short
  - git log --oneline -5
  - rg --files
  - npm run verify
  - npm run audit
  - targeted rg searches across specs/ src/ tests/ scripts/
  - js_repl inventory of artifact ids schema files invariant ids test references
opened_scope:
  - CLAUDE.md
  - README.md
  - PROJECT_STATE.md
  - specs/evidence.md
  - specs/methodology/decision.md
  - specs/adrs/ADR-0002-bootstrap-discipline.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/artifacts.json
  - specs/contracts/*.md (frontmatter + targeted bodies)
  - specs/behavioral/*.md (frontmatter + targeted bodies)
  - src/schemas/*.ts (export surface)
  - scripts/audit.mjs (relevant helper sections)
  - tests/contracts/*.ts (targeted line ranges)
  - specs/reviews/*.md (12 prior review-record frontmatters + bodies where claims depend on them)
skipped_scope:
  - full line-by-line read of every long contract/review record (intentional — this is a targeted adversarial pass over named risk surfaces, not a line-by-line proof)
  - bootstrap/ draft files beyond adversarial-review-codex.md (out of arc-progress scope)
  - specs/domain.md appendix sections unrelated to the HIGH surfaces
---

# Arc Progress Retrospective - Codex Objection List

I ran `git status --short`, `git log --oneline -5`, `rg --files`, `npm run verify`, `npm run audit`, targeted `rg` searches across `specs/`, `src/`, `tests/`, and `scripts/`, and a `js_repl` inventory of artifact ids, schema files, invariant ids, and test references. `npm run verify` passed with 489 tests across 8 files; `npm run audit` reported 10 green / 0 yellow / 0 red.

Coverage opened: I opened `CLAUDE.md`, `README.md`, `PROJECT_STATE.md`, `specs/evidence.md`, `specs/methodology/decision.md`, ADR-0002/0003, `specs/artifacts.json`, the contract and behavioral frontmatter plus targeted bodies, all schema exports, the relevant audit helper sections, all contract-test files at least by targeted line ranges, and all 12 prior review-record frontmatters plus the prior arc/slice review bodies where the current claims depend on them. I did not read every line of every long contract/review record end-to-end; this is a targeted adversarial pass over the named risk surfaces, not a line-by-line proof.

## HIGH

**1. HIGH - `run.projection` is bound to the wrong persisted artifact shape.**

- **Affected claim or artifact** - The authority graph believes `run.projection` owns `<circuit-next-run-root>/state.json (derived snapshot)` and is governed by `src/schemas/run.ts` export `RunProjection`. That conflates the on-disk `state.json` shape with an in-memory validation aggregate `{ log, snapshot }`. This is a second Knight-Leveson correlated-miss class after `config.md`: the graph can be forward/reverse green while the artifact row names the wrong runtime shape.
- **Reproduction path** - `specs/artifacts.json:121-140` assigns `run.projection` to `schema_file: src/schemas/run.ts`, `schema_exports: ["RunProjection"]`, and backing path `state.json`; `src/schemas/run.ts:158-163` defines `RunProjection` as an object containing both `log` and `snapshot`; `src/schemas/snapshot.ts:31-47` defines the actual standalone `Snapshot` shape that `state.json` appears to persist; `scripts/audit.mjs:218-221` allowlists `src/schemas/snapshot.ts` as a shared primitive instead of an artifact-bound schema.
- **Proposed remediation** - Split the authority graph: either add a first-class `run.snapshot` artifact with backing path `<circuit-next-run-root>/state.json`, `schema_file: src/schemas/snapshot.ts`, and `schema_exports: ["Snapshot", "StepState", "SnapshotStatus", "StepStatus"]`, while keeping `run.projection` as an in-memory binding with no persisted backing path; or rename/reframe `run.projection` so the persisted artifact is no longer claimed. Add an artifact-authority test that rejects rows whose `backing_paths` name a persisted JSON file while `schema_exports` names only a wrapper/aggregate shape.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. Fold into Slices 25-28 alongside the authority/frontmatter ledger work; do not enter Phase 2 with `state.json` mapped to a wrapper schema.

**2. HIGH - Manifest immutability is claimed as enforced, but only hash parity is present.**

- **Affected claim or artifact** - The evidence and run contract treat the Workflow manifest snapshot as immutable per run. Current schemas prove only that `manifest_hash` is copied from `run.bootstrapped` into `Snapshot`; they do not persist manifest bytes, bind a manifest path, name a hashing algorithm, or require re-entry byte-match against a stored manifest.
- **Reproduction path** - `specs/evidence.md:46-48` says event log/state and manifest immutability are enforced; `specs/contracts/run.md:17-26` says a Run includes a Workflow manifest snapshot identified by `manifest_hash`; `src/schemas/event.ts:16-24` stores only `manifest_hash` on `RunBootstrappedEvent`; `src/schemas/snapshot.ts:31-44` stores only `manifest_hash` on `Snapshot`; `src/schemas/run.ts:195-200` checks only equality between those two strings.
- **Proposed remediation** - Add a manifest snapshot artifact/contract surface before runtime implementation: e.g. `run.manifest_snapshot` with `backing_paths` for the copied manifest, a `hash_algorithm`, and a bootstrap/re-entry rule that recomputes and compares bytes. At minimum, downgrade current prose from "byte-match enforced" to "hash parity carried; byte-match is Phase 2 entry" and add a Phase 2 property id such as `run.prop.manifest_snapshot_bytes_match_hash`.
- **Fold-in discipline label** - Disposition: Scoped to Phase 2 entry (Slices 29-31), specifically the Slice 30 event-writer/runtime-boundary contract or the Phase 2 entry ceremony. Reopen trigger: any implementation that writes or resumes a run before a persisted manifest snapshot or explicit no-snapshot ADR lands.

**3. HIGH - README/PROJECT_STATE phase consistency is a false green.**

- **Affected claim or artifact** - `npm run audit` reports README/PROJECT_STATE agreement, but the public README still says the project is paused at Slice 7 authority-graph hardening while `PROJECT_STATE.md` says Slice 24 fold-ins landed. The audit checks only numeric phase (`0.5`) and misses stale slice/status text.
- **Reproduction path** - `README.md:3-4` says "Phase 1 contract authorship temporarily paused for Slice 7"; `README.md:28-34` repeats "Phase 0.5 / Slice 7"; `PROJECT_STATE.md:3-23` says Slice 24 fold-ins are landed and the authority graph is 13/13 plane-classified; `scripts/audit.mjs:1012-1052` extracts only numeric phase and returns green when both files say Phase 0.5; `tests/contracts/session-hygiene.test.ts:65-107` mirrors that same phase-only proxy.
- **Proposed remediation** - Update README to the current Slice 24/Phase 1-close-arc state, then strengthen the audit/test proxy to compare a structured current-state token, e.g. `current_slice`, `state_updated_at`, or a frontmatter-like `status_epoch` in both files. If README is intentionally high-level, stop claiming "phase consistency" as PROJECT_STATE freshness and rename the check to "numeric phase string agreement only."
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. Fold into Slice 28's behavioral/audit matrix work or earlier as a doc+audit patch.

**4. HIGH - ADR-0002 citation enforcement is a token-presence proxy, not the citation rule.**

- **Affected claim or artifact** - ADR-0002 requires every design decision to cite evidence/contracts/methodology with an invariant or section reference, and rejects "Circuit does X" as design justification. The audit accepts any disciplined commit body containing broad tokens such as `CLAUDE.md`, `bootstrap/`, `specs/domain.md`, or `ADR-0002`, regardless of whether the cited material supports the actual design decision.
- **Reproduction path** - `specs/adrs/ADR-0002-bootstrap-discipline.md:56-67` states the citation rule and requires evidence/contract/methodology grounding; `scripts/audit.mjs:41-51` defines broad `CITATION_PATTERNS`; `scripts/audit.mjs:379-380` implements `checkCitation` as `some(pattern)`; `scripts/audit.mjs:1158-1168` reports "All slice commits cite specs/, CLAUDE.md, bootstrap/, or an ADR."
- **Proposed remediation** - Split the audit dimension into "citation token present" and "anchored design citation." Require at least one anchored reference for Ratchet-Advance commits: contract invariant id (`RUN-I6`), evidence invariant/section (`specs/evidence.md#...` or `Invariant N`), ADR section, or behavioral invariant id. Add constructed-violation tests showing that a commit body with only "Cites: CLAUDE.md" fails the stronger rule.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. Fold into Slice 28's audit/methodology self-compliance work because this is exactly the green-audit/weak-proxy failure the arc is trying to flush out.

## MED

**1. MED - The trajectory check is not audit-enforced despite being added to the framing gate.**

- **Affected claim or artifact** - `CLAUDE.md` says every slice must restate arc goal, phase goal, and earlier-slice obsolescence before the framing triplet. `npm run audit` still validates only lane plus failure mode / acceptance evidence / alternate framing.
- **Reproduction path** - `CLAUDE.md:80-89` defines the trajectory check and says it comes before the framing triplet; `scripts/audit.mjs:371-376` checks only the three framing fields; `scripts/audit.mjs:1129-1146` reports "All slice commits include failure mode + acceptance evidence + alternate framing" with no trajectory dimension.
- **Proposed remediation** - Add a trajectory audit dimension for commits after the trajectory-check introduction commit: require a `Trajectory check` block and the three labels `Arc goal`, `Phase goal`, and `Earlier-slice obsolescence` before `Failure mode:`. Existing older commits can be grandfathered by commit floor.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. Fold into Slice 28 or the same audit-hardening slice as HIGH #4 above.

**2. MED - Named invariant ids are not consistently tied to tests.**

- **Affected claim or artifact** - The contract/test stack claims named invariants are the trace units, but several invariant ids do not appear anywhere in the current test corpus. Some semantics are likely tested under prose descriptions, but the trace is not machine-visible.
- **Reproduction path** - `specs/contracts/adapter.md:258-271` defines ADAPTER-I8; `specs/contracts/adapter.md:300-310` defines ADAPTER-I11; `specs/behavioral/cross-model-challenger.md:47-53` defines CHALLENGER-I2; `specs/behavioral/cross-model-challenger.md:87-95` defines CHALLENGER-I6; `specs/behavioral/prose-yaml-parity.md:63-74` defines PROSE-YAML-I3. A targeted `rg` over `tests/` found no occurrences of these ids; the closest adapter semantic tests are unlabeled in `tests/contracts/schema-parity.test.ts:3203-3267`.
- **Proposed remediation** - As part of the Slice 25 frontmatter ledger, add `invariant_ids` to contract/track frontmatter and require every non-prose-only invariant id to appear in at least one test name or assertion message. For prose-only invariants, require an explicit `enforcement_state: prose-only-now | audit-only-now | test-enforced | phase2-property`.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. This is aligned with the already-scheduled Slice 25 contract-frontmatter ledger.

**3. MED - `pending_rehome` and `pending-artifact` metadata can rot past the named slice.**

- **Affected claim or artifact** - The repo made the `config.*` miss and the `event.ts` pending-artifact visible, but the visibility metadata is not an expiry. A positive integer `target_slice` / `tracking_slice` will still pass after Slice 26 or Slice 30 unless a human notices.
- **Reproduction path** - `specs/artifacts.json:238-250` marks Config exports as `pending_rehome` to Slice 26; `scripts/audit.mjs:223-244` marks `src/schemas/event.ts` as `pending-artifact` tracking Slice 30; `tests/contracts/artifact-authority.test.ts:739-753` requires `tracking_slice` and `tracking_objection` but not expiry; `tests/contracts/artifact-authority.test.ts:910-955` requires `pending_rehome` shape and pins Slice 26 but does not fail when the current arc passes that slice.
- **Proposed remediation** - Add an expiry rule keyed to `PROJECT_STATE.md` or an explicit arc schedule file: once current slice number is greater than or equal to `target_slice`/`tracking_slice`, the audit must fail unless the pending entry is removed, converted to an artifact row, or renewed by an ADR/review disposition. If current-slice parsing is too brittle, add `expires_before_phase: 2-entry` and fail at phase-transition ceremony.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc for `pending_rehome` (Slice 26), and Scoped to Phase 2 entry (Slices 29-31) for `event.ts` if it survives until the Slice 30 event-writer boundary contract.

**4. MED - Behavioral tracks are marked ratified while enforcement states are mixed and partly future.**

- **Affected claim or artifact** - Behavioral track frontmatter and status read as ratified-v0.1, but `prose-yaml-parity` is explicitly a static anchor/sentinel until the catalog compiler lands, and `cross-model-challenger` still names an unlanded audit dimension. That is acceptable only if the enforcement state is explicit; currently it is split between prose and tests.
- **Reproduction path** - `specs/behavioral/prose-yaml-parity.md:1-14` lists structural compiler/audit enforcement even though the compiler is not landed; `tests/contracts/prose-yaml-parity.test.ts:52-70` says PROSE-YAML-I1..I4 are prose-documentation-only at v0.1 and the test pins only frontmatter/cross-references/sentinel markers; `specs/behavioral/cross-model-challenger.md:10-16` lists a planned audit dimension as NOT LANDED; `specs/behavioral/cross-model-challenger.md:187-192` describes that future audit dimension.
- **Proposed remediation** - Add an enforcement matrix to each behavioral track: per invariant, state `test-enforced`, `audit-enforced`, `static-anchor`, `prose-only`, or `phase2-property`, with the exact file enforcing it. Then add a test that rejects `status: ratified-v0.1` unless every invariant has a declared enforcement state.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. This is the natural Slice 28 behavioral enforcement matrix.

**5. MED - Review records do not carry machine-readable opened-scope evidence.**

- **Affected claim or artifact** - CHALLENGER-I6 admits that a challenger cannot replace authority mapping or evidence, and the track's own failure mode says "reviewing the wrong thing" is mitigated by prompt discipline and operator checking citations. The review record schema does not require commands run, opened scope, or skipped scope, so that mitigation remains manual.
- **Reproduction path** - `specs/behavioral/cross-model-challenger.md:87-95` says challenger output cannot replace structural checks; `specs/behavioral/cross-model-challenger.md:124-129` says the operator verifies Codex read the target files by checking evidence citations; review frontmatter currently requires base keys only via `tests/contracts/cross-model-challenger.test.ts:431-470`, with no opened-scope or commands-run field.
- **Proposed remediation** - Extend arc/contract review records with `commands_run:` and `opened_scope:` frontmatter or required body sections. Add tests that every new review record has non-empty scope, and that arc reviews include an explicit "skipped/not fully read" sentence. This review's preamble follows that pattern manually; make it structural.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc if added to Slice 25 review-record/frontmatter normalization; otherwise Scoped to v0.2 with reopen trigger: first review record whose finding is later invalidated because the reviewer did not actually open the cited surface.

**6. MED - Contract prose still leaks future/stale references that no audit catches.**

- **Affected claim or artifact** - The prior close review flagged "(future)" drift and Slice 23/24 fixed some instances, but the corpus still has stale "future" language on landed or partially landed surfaces. This is a weaker variant of the README false-green problem.
- **Reproduction path** - `specs/contracts/workflow.md:97-100` says the prose-yaml parity contract test is "future" even though `tests/contracts/prose-yaml-parity.test.ts` exists, albeit as a static anchor; `specs/behavioral/cross-model-challenger.md:203-209` says "the five committed challenger records" while listing six contract reviews; `specs/behavioral/cross-model-challenger.md:218-227` says v0.2 will land `tests/contracts/cross-model-challenger.test.ts` even though the frontmatter says it landed and was tightened through Slice 24.
- **Proposed remediation** - Add a stale-reference audit rule for `future`, `not yet`, `planned`, and numeric count claims when the referenced file now exists. Require either a parenthetical enforcement state (`future round-trip`, `LANDED static anchor`) or a tracking issue/slice.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc. Fold into Slice 28's documentation/audit hygiene.

## LOW

**1. LOW - `schemaExportPresent` test names are stale after the regex broadened.**

- **Affected claim or artifact** - The artifact-authority tests still describe `schema_exports` as `export const` existence even though Slice 23 broadened the checker to `export const|type|function|class`. This does not weaken the gate, but it makes the test title/error message lie about what is accepted.
- **Reproduction path** - `tests/contracts/artifact-authority.test.ts:140-153` says every `schema_exports` name is actually "`export const <name>`d"; `scripts/audit.mjs:282-295` says the checker accepts `export const|type|function|class`; `tests/contracts/artifact-authority.test.ts:190-207` confirms function/type/class acceptance.
- **Proposed remediation** - Rename the test and message to "top-level defining export" and remove the `export const`-only wording.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc as opportunistic cleanup in any audit/test wording patch.

**2. LOW - Review frontmatter normalizes required keys but not value vocabulary.**

- **Affected claim or artifact** - The review-record schema now requires `reviewer_model`, `review_kind`, `review_date`, `verdict`, and `authored_by`, but values still drift (`GPT-5 Codex`, `gpt-5-codex via codex exec`, `gpt-5.1 via codex exec`, `operator + claude-opus-4-7`, `Codex`). That may be fine, but the schema should either bless free-form values or normalize them.
- **Reproduction path** - `specs/reviews/arc-phase-1-close-codex.md:8-14`, `specs/reviews/adapter-md-v0.1-codex.md:4-8`, and `specs/reviews/run-md-v0.1-codex.md:4-8` show the value-shape drift; `tests/contracts/cross-model-challenger.test.ts:431-470` checks key presence, not value vocabulary, except `target_kind`.
- **Proposed remediation** - Either add `reviewer_model_id` / `authorship_role` normalized fields while keeping prose fields free-form, or explicitly document that these values are informational strings and not intended for grouping.
- **Fold-in discipline label** - Disposition: Scoped to v0.2 with reopen trigger: any tooling that groups review records by model/authorship or computes challenger coverage from frontmatter values.

**3. LOW - `npm run audit` reports a static test floor beside a runtime test count without a shared name.**

- **Affected claim or artifact** - Audit reports "440 tests at HEAD" while `npm run verify` reports 489 tests. The docblock explains this is a static authored-test floor, not runtime total, but the audit output label still says "tests" without qualification.
- **Reproduction path** - `scripts/audit.mjs:397-407` explains the static floor and dynamic-test gap; `scripts/audit.mjs:1226-1254` prints the contract-test ratchet detail as `${headCount} tests at HEAD`; `npm run verify` on this pass reported 489 runtime tests while audit reported 440.
- **Proposed remediation** - Change the audit label to "static authored-test floor" and print runtime count only in the verify-gate detail if captured. This prevents future reviewers from rediscovering the mismatch as a suspected regression.
- **Fold-in discipline label** - Disposition: Incorporable within Phase 1 close arc as audit-output wording cleanup.

## Meta objections

- The new correlated miss is not "another file missing from the graph" in the same style as `config.md`; it is subtler. `run.projection` is present, classified, contract-bound, reciprocated, and green under audit, but the row binds a persisted path to a wrapper schema rather than the persisted shape. The current authority graph proves path/existence/export consistency, not "this export is the shape actually written at this backing path."
- Several objections above are weaker-proxy failures: audit/test names say "phase consistency," "citation rule," or "contract test ratchet," while the implementation checks a narrower property. The project has been good at documenting caveats once Codex finds them; the remaining risk is that green summary lines are read faster than caveats.
- I am intentionally not treating `npm run verify` or `npm run audit` green as approval. The green gates prove the current machine checks are internally satisfied; several objections attack whether those checks are the right proxies.

## Closing verdict

REJECT pending HIGH fold-ins.

## Operator response (incorporated / scoped / rejected)

Dispositions per CHALLENGER-I4; every objection carries a label and a
slice pointer. The arc-review-expanded plan keeps the pre-ACCEPT arc at
Slices 22-28 but adds two intra-arc fold-in slices (25a, 26a) and
partitions Slice 28 into a doc/audit-hardening batch (28) and a
behavioral-enforcement matrix slice (28b), because Slice 28's originally
planned scope plus the new arc-review fold-ins would exceed the 30-minute
wall-clock discipline. `closing_verdict` flips to `ACCEPT` when the last
in-arc fold-in commits. Phase-2-entry-scoped objections (HIGH #2) do not
block Phase 1 close; they attach to the existing Phase-2-entry slice plan
(29-31) with named reopen triggers. v0.2-scoped objections are recorded
with explicit reopen triggers.

HIGH #1 (`run.projection` binds wrong persisted shape) is the new
correlated-miss instance called out in the Meta section. It deserves its
own fold-in slice because it is artifact-graph surgery, not frontmatter
ratchet. Confirmed on inspection: `specs/artifacts.json:120-138` claims
`run.projection`'s `backing_paths` is `<circuit-next-run-root>/state.json
(derived snapshot)` and `schema_exports` is `["RunProjection"]`, while
`src/schemas/run.ts:158-163` defines `RunProjection` as an in-memory
aggregate `{ log: RunLog, snapshot: Snapshot }` and `src/schemas/snapshot.ts:31-46`
defines the standalone `Snapshot` that a persisted `state.json` would
actually carry. `scripts/audit.mjs:218-221` allowlists `snapshot.ts` as a
`shared-primitive` embedded in `run.projection`, preserving the
wrong-shape binding from detection. The correlated-miss class is
"authority-graph row is forward/reverse green but binds a persisted
backing path to a wrapper/aggregate schema instead of the persisted shape."

### Incorporable within Phase 1 close arc (Slices 25-28b)

- **HIGH #1 — `run.projection` binds persisted shape to wrapper schema.**
  Scheduled for **Slice 26a** (new, inserted between config.md and
  workflow.md v0.2). Add a first-class `run.snapshot` artifact to
  `specs/artifacts.json` with `backing_paths: ["<circuit-next-run-root>/state.json"]`,
  `schema_file: src/schemas/snapshot.ts`, `schema_exports: ["Snapshot",
  "SnapshotStatus", "StepState", "StepStatus"]`, and a description naming
  it the persisted on-disk projection of the RunLog reducer. Reframe
  `run.projection` with empty `backing_paths` and a description naming it
  an in-memory RunLog-to-Snapshot validation aggregate. Remove
  `src/schemas/snapshot.ts` from `audit.mjs`'s `SCHEMA_FILE_ALLOWLIST`
  `shared-primitive` entry (it becomes an artifact-bound schema file).
  Add a new test in `tests/contracts/artifact-authority.test.ts` that
  rejects any artifact row whose `backing_paths` contains a persisted
  `.json` or `.ndjson` path while its `schema_exports` are all wrapper
  shapes (exports whose Zod body composes other artifact-bound schemas
  as required keys). Update `specs/contracts/run.md` prose referencing
  `run.projection` as a persisted artifact.
- **HIGH #3 — README/PROJECT_STATE phase-consistency is a false green.**
  Scheduled for **Slice 28a** (new, the first half of Slice 28). Update
  README to current Slice 24/Phase-1-close-arc state. Either strengthen
  the audit/test phase-consistency check to compare a structured
  current-slice or last-updated token in both files, or rename the audit
  dimension to "numeric phase string agreement only" and stop claiming
  README freshness. Preferred: add a `current_slice` token to both
  README and PROJECT_STATE, audit equality.
- **HIGH #4 — ADR-0002 citation rule is token-presence proxy.**
  Scheduled for **Slice 28a**. Split the audit's citation dimension into
  "citation token present" (today's check, keep as-is) and "anchored
  design citation" (new): require Ratchet-Advance commits to cite at
  least one anchored reference — contract invariant id (e.g. `RUN-I6`),
  evidence invariant/section, ADR section, behavioral invariant id, or
  named schema export. Add a constructed-violation test showing that a
  commit body with only "Cites: CLAUDE.md" fails the anchored rule.
- **MED #1 — Trajectory check not audit-enforced.** Scheduled for
  **Slice 28a** (already on the pre-review plan for Slice 28; pulls
  forward into the audit-hardening half). Add a `TRAJECTORY_PATTERNS`
  dimension to the audit that requires commits after the trajectory-check
  introduction commit (look up the introduction commit) to include
  `Trajectory check` plus `Arc goal`, `Phase goal`, `Earlier-slice
  obsolescence` labels before `Failure mode:`. Grandfather earlier
  commits by commit floor.
- **MED #2 — Named invariant ids not consistently tied to tests.**
  Scheduled for **Slice 25** (pulls into the frontmatter-ledger scope).
  As part of adding `invariant_ids` to contract/track frontmatter, add a
  test requiring every non-prose-only invariant id to appear in at least
  one test name or assertion message. Prose-only invariants require an
  explicit frontmatter `enforcement_state: prose-only-now |
  audit-only-now | test-enforced | phase2-property`. This turns the
  Slice 25 ledger from a pure frontmatter ratchet into an enforcement
  ledger, which is the stronger move.
- **MED #3 — `pending_rehome` / `pending-artifact` can rot past named
  slice.** Scheduled for **Slice 28a**. Add an expiry rule: once the
  current slice number (parsed from `PROJECT_STATE.md` header) is
  greater-than-or-equal-to `target_slice` / `tracking_slice`, the audit
  must fail unless the entry is removed, converted to an artifact row,
  or renewed by explicit ADR/review disposition. If slice parsing is
  brittle, add `expires_before_phase: "2-entry"` and fail at
  phase-transition ceremony. Applies to both `config.*` pending_rehome
  (tracking Slice 26) and `event.ts` pending-artifact (tracking Slice
  30).
- **MED #4 — Behavioral tracks `ratified-v0.1` with mixed enforcement.**
  Scheduled for **Slice 28b** (new, the second half of Slice 28;
  behavioral enforcement matrix). Add per-invariant enforcement state
  (`test-enforced`, `audit-enforced`, `static-anchor`, `prose-only`,
  `phase2-property`) to each behavioral track's frontmatter. Add a test
  that rejects `status: ratified-v0.1` unless every invariant has a
  declared enforcement state. This is the original Slice 28 "behavioral
  enforcement matrix" work, retained under Slice 28b.
- **MED #5 — Review records lack machine-readable opened-scope evidence.**
  Scheduled for **Slice 25** (pulls into the frontmatter-ledger scope).
  Extend review-record frontmatter with `commands_run:` (array) and
  `opened_scope:` (array of paths) plus an explicit "skipped/not fully
  read" body sentence requirement for arc reviews. Add a test in
  `tests/contracts/cross-model-challenger.test.ts` that rejects new
  review records without these fields. This review's preamble follows
  the pattern informally — Slice 25 makes it structural.
- **MED #6 — Stale `future` / `not yet` prose in contracts and tracks.**
  Scheduled for **Slice 28a**. Add an audit rule for tokens `future`,
  `not yet`, `planned`, `tbd`, and numeric count claims (`five
  committed`, `six`, etc.) when the cited file now exists. Require
  either a parenthetical enforcement state (`future round-trip`,
  `LANDED static anchor`) or a `see-issue-N` pointer. Baseline the
  existing stale hits found by this review as the seed.
- **LOW #1 — `schemaExportPresent` test wording stale after regex
  broadening.** Scheduled for **Slice 28a** (opportunistic rename in
  the audit-hardening batch). Rename tests + error messages from
  `export const` wording to "top-level defining export".
- **LOW #3 — Audit static floor vs runtime count label.** Scheduled for
  **Slice 28a**. Change the audit-output label from "tests at HEAD" to
  "static authored-test floor at HEAD" and report verify-gate runtime
  total separately when captured. Prevents future reviewers from
  rediscovering the mismatch as a suspected regression.

### Scoped to Phase 2 entry (Slices 29-31)

- **HIGH #2 — Manifest immutability: hash parity only, no byte-match.**
  Scheduled for **Slice 30** (event-writer boundary contract). Either
  add a `run.manifest_snapshot` artifact/contract surface with
  `backing_paths` for the copied manifest, a `hash_algorithm`, and a
  bootstrap/re-entry rule that recomputes and compares bytes; OR
  downgrade current prose to "hash parity carried; byte-match is Phase 2
  entry" and add a Phase 2 property id such as
  `run.prop.manifest_snapshot_bytes_match_hash`. **Reopen trigger:** any
  implementation that writes or resumes a run before a persisted
  manifest snapshot or explicit no-snapshot ADR lands.

### Scoped to v0.2 (not blocking Phase 1 close)

- **LOW #2 — Review frontmatter value vocabulary drift.** Scheduled as
  a v0.2 schema normalization. Either add `reviewer_model_id` /
  `authorship_role` normalized fields while keeping prose fields
  free-form, or document the values as informational strings not
  intended for grouping. **Reopen trigger:** any tooling that groups
  review records by model/authorship, or any challenger coverage
  computation that reads frontmatter values.

### Rejected (none)

All 13 objections are either incorporable within Phase 1 close, scoped
to Phase 2 entry with named fold-in slice + reopen trigger, or scoped to
v0.2 with reopen trigger. Nothing is rejected as non-applicable.

## Revised Phase 1 close arc plan (post-arc-review)

The pre-arc-review plan had 4 fold-in slices remaining (25, 26, 27, 28).
The arc-review adds two new intra-arc fold-in slices and partitions the
original Slice 28 into two slices to keep each under the 30-minute
wall-clock discipline. Revised plan:

- **Slice 25** (expanded) — Contract frontmatter `invariant_ids`,
  `property_ids`, `preconditions_ref`, `postconditions_ref` ledger
  (original scope) + `enforcement_state` per invariant (MED #2) +
  review-record `commands_run` / `opened_scope` frontmatter (MED #5).
- **Slice 26** — `specs/contracts/config.md` + `config.*` artifact rows
  + remove `pending_rehome` from `adapter.registry` (unchanged scope).
- **Slice 26a** (NEW, arc-review HIGH #1) — `run.snapshot` artifact
  split + audit allowlist update + persisted-path-vs-wrapper-schema
  test + `run.md` prose fix.
- **Slice 27** — `specs/contracts/workflow.md` v0.2 + Codex review
  (unchanged scope).
- **Slice 28** (renamed to Slice 28a; audit/doc hardening batch) —
  README refresh (HIGH #3) + phase-consistency check widening (HIGH
  #3) + citation-rule split (HIGH #4) + trajectory-check audit
  dimension (MED #1) + pending-artifact expiry rule (MED #3) +
  stale-prose audit (MED #6) + `schemaExportPresent` wording (LOW #1) +
  static-floor audit label (LOW #3) + audit-count fix + canary rename +
  MED #9 audit-side CHALLENGER-I3 repetition (from original Slice 28).
- **Slice 28b** (NEW, behavioral enforcement matrix split off from
  original Slice 28) — Per-invariant `enforcement_state` on the three
  behavioral tracks + test rejecting `status: ratified-v0.1` without
  enforcement state declared (MED #4).
- **Phase-transition ceremony slice** (HIGH #10 from Phase 1 close
  review) — README + PROJECT_STATE close-block + entry-criteria + first
  Phase 2 slice target. Lands last in the pre-Phase-2 arc.

Phase 2 entry slices (29-31) unchanged in number. Slice 29 (property
registry scaffold), Slice 30 (event-writer boundary contract, now also
the home for HIGH #2 manifest byte-match decision), Slice 31 (isolation
substrate or Break-Glass ADR).

## Correlated-miss documentation (HIGH #1 companion note)

Codex + Claude both overlooked that `run.projection`'s artifact row at
`specs/artifacts.json:120-138` binds a persisted backing path
(`<circuit-next-run-root>/state.json`) to the in-memory wrapper schema
`RunProjection = { log, snapshot }`, not to the standalone `Snapshot`
shape at `src/schemas/snapshot.ts:31-46` that a persisted `state.json`
actually carries. The authority-graph gate passes because forward
`artifact_ids` resolution works (the contract does include
`run.projection`) and reverse resolution works (the contract reciprocates
the id). It passes because **the gate never checks whether the named
`schema_exports` is the persisted shape versus a wrapper/aggregate over
persisted shapes.** `src/schemas/snapshot.ts` is quietly allowlisted as
a `shared-primitive` in `scripts/audit.mjs:218-221` with the reason
"snapshot shape embedded in run.projection", which preserves the
wrong-shape binding from detection.

This is a concrete **Knight-Leveson correlated-miss** instance distinct
from the earlier `config.md` miss. Where `config.md` was the "artifact
row missing entirely, schemas hid in another artifact's `schema_exports`"
shape, this is the "artifact row exists, classified, contract-bound,
reciprocated, audit-green, but names the wrong runtime shape" shape.
Both instances share the same root cause: Claude and Codex adopted the
existing authority-graph forward-check as ground truth instead of
deriving from `src/schemas/index.ts` exports × their actual on-disk /
in-memory usage.

Slice 26a fold-in lands the artifact-row fix. Slice 28a fold-in lands an
audit-rule reopen: any artifact row with a persisted JSON/NDJSON backing
path whose `schema_exports` body composes other artifact-bound schemas
as required keys (rather than being the persisted shape directly) fails
the test.

