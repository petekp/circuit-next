---
name: arc-remediation-plan-codex
description: Arc-level remediation calendar for the Codex arc-progress review and same-session follow-up findings.
type: review-response
date: 2026-04-19
related_commits: [7bbec5d, 682704d, 8f0b092]
---

# Arc Remediation Plan - Codex

## Summary

This plan sequences the 13 objections recorded in
`specs/reviews/arc-progress-codex.md` plus four same-session follow-up
findings that were not yet recorded in a review file:

1. absolute symlinks under `specs/methodology/`;
2. missing `.strict()` on `Config` and `LayeredConfig`;
3. undecided `spike/kernel-replay` branch disposition;
4. the contract-test ratchet comparing against `HEAD~1` instead of a pinned
   floor.

The operator dispositions in `arc-progress-codex.md` are binding. This plan
does not re-litigate them. It preserves the accepted Phase 1 close fold-ins,
keeps manifest byte-match in Slice 30, keeps review-frontmatter value
normalization in v0.2, and adds only the minimum additional slices required to
close the follow-up findings without hiding them inside already-overloaded
work.

Revised calendar summary:

- Phase 1 close remediation: Slices 25, 25a, 26, 26a, 27, 27a, 28a, 28b,
  28c, 28d.
- Phase 2 entry: Slices 29, 30, 31.
- v0.2 scoped hygiene: Slice 32.

The decisive new branch disposition is: **`spike/kernel-replay` is
abandoned-and-mined.** It must not be merged wholesale or kept as an implicit
future direction. Slice 27a mines reusable lessons, records them in repo
artifacts, and then deletes or archives the branch reference.

## Constraints (operator dispositions + any ADR bindings)

### Binding operator dispositions

The 13 findings from `specs/reviews/arc-progress-codex.md` have already been
dispositioned by the operator:

- 11 are incorporable within the Phase 1 close arc.
- HIGH #2 is scoped to Phase 2 entry, specifically Slice 30, with a reopen
  trigger if any runtime writes or resumes a run before manifest byte-match or
  an explicit no-snapshot ADR lands.
- LOW #2 is scoped to v0.2, with a reopen trigger if any tooling groups review
  records by model/authorship values or computes challenger coverage from
  those values.
- 0 are rejected.

This plan treats those calls as constraints, not as open questions.

### ADR and methodology constraints

- **ADR-0003, Authority-Graph Gate.** No contract may proceed over an
  `unknown-blocking` artifact. Successor-to-live is not greenfield. Authority
  mapping must be machine-enforced, not prose-only. The cross-model challenger
  is adversarial lint, not independent corroboration.
- **ADR-0002, Bootstrap Discipline.** Design claims need anchored evidence.
  Slice commits must not rely on broad citation tokens as design authority.
  Audit output must not overstate what a proxy actually checks.
- **ADR-0001 / `specs/methodology/decision.md`.** Phase 1 is contract
  authorship. Phase 2 is implementation through lane discipline. Ratchets must
  be versioned floors, not moving-window theater. Discovery and Disposable
  lanes are allowed, but must not silently promote into product architecture.
- **Recent slice context.** Slice 23 and Slice 24 hardened reverse authority,
  review linkage, typed grandfathering, and Slice 24 challenger fold-ins.
  Commit `7bbec5d` is doc-only and records the first broader arc-progress
  adversarial pass.

### Required ADR addenda

The following findings require ADR addenda because they change durable
methodology or authority-graph semantics:

- **ADR-0001 addendum, methodology artifact portability.** Thesis:
  methodology tournament artifacts required by the repo must be vendored or
  otherwise clone-portable; host-local `.circuit` run roots may be cited as
  provenance but not symlinked as required content.
- **ADR-0002 addendum, pinned ratchet floors.** Thesis: ratchet floors are
  committed manifests or tags, never `HEAD~1` moving windows.
- **ADR-0003 addendum, persisted shape binding.** Thesis: an authority-graph
  row with a persisted JSON/NDJSON backing path must bind to the persisted
  shape, not only to an aggregate or wrapper over that shape.
- **ADR-0003 addendum, manifest snapshot authority.** Thesis: a run manifest
  snapshot is either a first-class authority-graph artifact with byte-match
  semantics or an explicit no-snapshot design decision before runtime writes.

### Council dispositions (2026-04-19)

The four Open Questions originally surfaced at the bottom of this plan were
dispositioned through a Claude + Codex council on 2026-04-19, evaluated under
the operator directive: optimize for maximum project autonomy. All four
converged; Q4 had a minor framing split resolved in favor of the
disposition-preserving option.

- **Q1 (spike/kernel-replay disposition):** `abandoned-and-mined`. Rationale:
  deleting the branch closes a live decision surface; `deferred-with-expiry`
  relocates operator attention to a future date and still requires judgment
  then.
- **Q2 (specs/methodology/ resolution):** inline as committed Markdown with
  a `provenance` frontmatter field on each file citing the original
  `.circuit/circuit-runs/...` run-root path as non-operative provenance.
  Rationale: an autonomous authority graph must live in the repo;
  external-reference creates a second source of truth outside git, CI, and
  agent read surface.
- **Q3 (broader-pass filename convention):** positional/numeric
  (`arc-progress-slice-<N>-codex.md`). Rationale: mechanically derivable from
  `git log` without judgment calls; sorts chronologically in directory
  listings; no per-pass naming taste debate.
- **Q4 (LOW #2 tightening path):** preload OPTIONAL normalized
  `reviewer_model_id` / `authorship_role` fields in Slice 25's review-record
  schema work; make them REQUIRED and backfill existing records in Slice 32.
  Rationale: retires the AR-L2 reopen-trigger watch immediately (autonomy
  win) while preserving the operator's v0.2 disposition as the tightening
  point.

## Finding-to-Slice Mapping

| Finding | Binding disposition | Slice | Lane | Concrete plan | ADR addendum |
|---|---:|---:|---|---|---|
| AR-H1: `run.projection` binds persisted `state.json` to wrapper schema | Accepted, Phase 1 close | 26a | Ratchet-Advance | Split `run.snapshot` from in-memory `run.projection`; remove `snapshot.ts` shared-primitive allowlist; add persisted-path-vs-wrapper guard | ADR-0003 persisted shape binding |
| AR-H2: manifest immutability proves hash parity only | Scoped to Phase 2 entry | 30 | Ratchet-Advance | Add `run.manifest_snapshot` artifact and byte-match contract, or land explicit no-snapshot ADR before any runtime writer/resume path | ADR-0003 manifest snapshot authority |
| AR-H3: README/PROJECT_STATE consistency is a false green | Accepted, Phase 1 close | 28a | Ratchet-Advance | Refresh README; compare structured `current_slice` or `status_epoch`, or rename the audit check to its narrower numeric-phase meaning | None; implements existing ADR-0003 audit honesty |
| AR-H4: ADR-0002 citation enforcement is token presence | Accepted, Phase 1 close | 28a | Ratchet-Advance | Split citation-token check from anchored-design-citation check; Ratchet-Advance commits require invariant/ADR/section/schema-export anchors | None; implements ADR-0002 |
| AR-M1: trajectory check is not audit-enforced | Accepted, Phase 1 close | 28a | Ratchet-Advance | Require `Trajectory check`, `Arc goal`, `Phase goal`, and `Earlier-slice obsolescence` after the introduction commit | None |
| AR-M2: invariant ids not consistently tied to tests | Accepted, Phase 1 close | 25 | Ratchet-Advance | Add invariant/property ledger and require non-prose-only invariant ids to appear in test names or assertions | None |
| AR-M3: `pending_rehome` and `pending-artifact` can rot past slice | Accepted for close arc / Phase 2 entry split | 28a | Ratchet-Advance | Add expiry keyed to current slice or phase-entry ceremony; fail when target/tracking slice has arrived without resolution or renewal | None |
| AR-M4: behavioral tracks ratified with mixed enforcement states | Accepted, Phase 1 close | 28b | Ratchet-Advance | Add per-invariant enforcement matrix and reject `ratified-v0.1` without declared enforcement state | None |
| AR-M5: review records lack machine-readable opened scope | Accepted, Phase 1 close | 25 | Ratchet-Advance | Add `commands_run`, `opened_scope`, and skipped-scope requirement for new arc/review records | None |
| AR-M6: stale `future` / count prose in contracts and tracks | Accepted, Phase 1 close | 28a | Ratchet-Advance | Add stale-reference audit for future/planned/count claims when referenced files exist | None |
| AR-L1: `schemaExportPresent` test wording stale | Accepted, opportunistic Phase 1 close | 28a | Ratchet-Advance | Rename test and messages from `export const` to top-level defining export | None |
| AR-L2: review frontmatter value vocabulary drift | Scoped to v0.2 (optional fields preloaded in 25 per council) | 25 (optional) + 32 (required) | Ratchet-Advance | Slice 25 preloads optional `reviewer_model_id` / `authorship_role` fields (retires reopen-trigger watch); Slice 32 makes them required and backfills existing review records | None unless grouping becomes methodology-significant |
| AR-L3: static authored-test floor label is confused with runtime count | Accepted, opportunistic Phase 1 close | 28a | Ratchet-Advance | Rename audit detail to `static authored-test floor`; report runtime count only when sourced from verify output | None |
| FUP-1: `specs/methodology/` absolute symlinks are host-local | New follow-up | 25a | Ratchet-Advance | Inline the five methodology artifacts into the repo, or replace them with a documented external-reference model; add absolute-symlink guard | ADR-0001 methodology artifact portability |
| FUP-2: `Config` and `LayeredConfig` lack `.strict()` | New follow-up | 26 | Ratchet-Advance | Add `.strict()` to both schemas and negative surplus-key tests under config contract work | None |
| FUP-3: `spike/kernel-replay` is decision-by-inaction | New follow-up | 27a | Discovery | Disposition is abandoned-and-mined: inventory reusable lessons, record them, then delete/archive branch; no wholesale merge | None |
| FUP-4: contract-test ratchet uses `HEAD~1` sliding window | New follow-up | 28c | Ratchet-Advance | Replace moving comparison with committed ratchet manifest or tag-backed floor; floor changes require explicit ratchet-advance commit | ADR-0002 pinned ratchet floors |

## Revised Arc Calendar

### Slice 25 - Contract and review trace ledger

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-M2, AR-M5.
- **Why this lane:** The slice adds durable machine-readable trace fields and
  fails future reviews/contracts that omit them. That is a ratchet, not a
  refactor.
- **Work:**
  - Add `invariant_ids`, `property_ids`, `preconditions_ref`, and
    `postconditions_ref` ledger coverage to contracts/tracks.
  - Add `enforcement_state` for prose-only, audit-only, test-enforced, and
    phase2-property invariants.
  - Require non-prose-only invariant ids to appear in at least one test name or
    assertion message.
  - Extend review-record requirements with `commands_run`, `opened_scope`, and
    explicit skipped-scope disclosure for arc reviews.
  - Preload OPTIONAL `reviewer_model_id` and `authorship_role` normalized
    fields into the review-record schema (per Q4 council disposition). This
    retires the AR-L2 reopen-trigger watch immediately; Slice 32 makes them
    required and backfills.
- **Acceptance evidence:** targeted contract tests plus full `npm run verify`
  and `npm run audit`.

### Slice 25a - Methodology artifact portability

- **Lane:** Ratchet-Advance.
- **Findings closed:** FUP-1.
- **Why this lane:** A cloneability failure invalidates the repo as an
  authority surface. The slice must leave behind a guard that prevents
  reintroducing absolute host-local symlinks.
- **Work:**
  - Preferred implementation: replace the five absolute symlinks in
    `specs/methodology/` with committed Markdown copies of the referenced
    artifacts.
  - Record provenance in each copied file or in a companion index, including
    original run-root path as non-operative provenance.
  - Add an audit/test guard that rejects absolute symlinks under `specs/`,
    especially links into `/Users/.../.circuit/circuit-runs/...`.
  - Add ADR-0001 portability addendum.
- **Acceptance evidence:** `git ls-files -s specs/methodology` shows regular
  files or repo-relative links only; audit/test rejects a constructed absolute
  symlink fixture.

### Slice 26 - Config contract and strict-key closure

- **Lane:** Ratchet-Advance.
- **Findings closed:** FUP-2, and the already-scheduled `config.*`
  `pending_rehome` fold-in.
- **Why this lane:** The slice turns hidden config schemas into first-class
  artifact rows and tightens unknown-key rejection at the config boundary.
- **Work:**
  - Author `specs/contracts/config.md`.
  - Add `config.*` artifact rows and remove the `adapter.registry`
    `pending_rehome` entries.
  - Add `.strict()` to `Config` and `LayeredConfig`; inspect nested config
    objects for matching strict-key posture.
  - Add negative tests showing surplus keys fail at both top-level config and
    layered-config boundaries.
- **Acceptance evidence:** config contract tests, authority graph audit, full
  verify/audit.

### Slice 26a - Run snapshot artifact split

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-H1.
- **Why this lane:** This closes a correlated-miss class in the
  authority-graph gate and adds a structural guard against repeating it.
- **Work:**
  - Add first-class `run.snapshot` artifact for
    `<circuit-next-run-root>/state.json` bound to `src/schemas/snapshot.ts`.
  - Reframe `run.projection` as in-memory aggregate with no persisted backing
    path.
  - Remove `src/schemas/snapshot.ts` from the shared-primitive allowlist.
  - Add persisted-path-vs-wrapper-schema test/audit guard.
  - Add ADR-0003 persisted-shape addendum.
- **Acceptance evidence:** authority graph tests prove `state.json` is bound to
  `Snapshot`, not only to `RunProjection`.

### Slice 27 - Workflow v0.2 contract and review

- **Lane:** Ratchet-Advance.
- **Findings closed:** none directly from the 17-item list; this preserves the
  pre-existing arc calendar.
- **Why this lane:** Workflow remains a contract-authorship surface, and the
  Codex review of workflow v0.2 is part of the existing Phase 1 close plan.
- **Work:**
  - Complete `specs/contracts/workflow.md` v0.2.
  - Run and record a Codex challenger review.
  - Apply accepted fold-ins or disposition them per CHALLENGER-I4.
- **Acceptance evidence:** workflow contract tests, recorded review, verify,
  audit.

### Slice 27a - `spike/kernel-replay` branch disposition

- **Lane:** Discovery.
- **Findings closed:** FUP-3.
- **Why this lane:** The branch is a spike, not canonical implementation. It
  is materially divergent from main and would delete much of the authority
  plane if merged wholesale. Mining it is evidence extraction; promotion into
  implementation requires later Phase 2 contracts.
- **Disposition:** abandoned-and-mined.
- **Work:**
  - Inventory the branch at `c555894` and record which ideas, tests, or naming
    choices are reusable for Phase 2.
  - Copy only non-operative lessons into a repo document such as
    `specs/reference/spikes/kernel-replay.md` or an equivalent Phase 2 notes
    file.
  - Explicitly mark the branch as not a merge candidate.
  - Delete the local branch or archive its commit hash in the spike notes.
  - Do not cherry-pick runtime code into main in this slice.
- **Acceptance evidence:** branch disposition document committed; `git branch`
  no longer shows an active undecided local `spike/kernel-replay`, or the
  branch remains only as an archived reference named in the document.

### Slice 28a - Audit and documentation hardening batch

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-H3, AR-H4, AR-M1, AR-M3, AR-M6, AR-L1, AR-L3.
- **Why this lane:** These are all green-audit/weak-proxy failures. The slice
  tightens the audit, test names, and status docs so the repo says exactly
  what is enforced.
- **Work:**
  - Refresh README from stale Slice 7 status to current Phase 1 close-arc
    status.
  - Add structured README/PROJECT_STATE freshness token, or rename the check
    to numeric phase agreement only.
  - Split citation-token presence from anchored design citation enforcement.
  - Add trajectory-check audit dimension with a commit floor.
  - Add expiry for `pending_rehome` and `pending-artifact`.
  - Add stale-prose audit for `future`, `not yet`, `planned`, and stale count
    claims.
  - Rename `schemaExportPresent` wording to top-level defining export.
  - Rename audit output to `static authored-test floor` for the existing test
    floor label.
- **Acceptance evidence:** constructed violation tests for each audit
  hardening rule plus full verify/audit.

### Slice 28b - Behavioral enforcement matrix

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-M4.
- **Why this lane:** `ratified-v0.1` becomes meaningful only if every
  invariant has a declared enforcement state.
- **Work:**
  - Add per-invariant enforcement matrix to behavioral tracks.
  - Require every `ratified-v0.1` behavioral track invariant to declare one of
    `test-enforced`, `audit-enforced`, `static-anchor`, `prose-only`, or
    `phase2-property`.
  - Point each enforced invariant to the exact file that enforces it.
- **Acceptance evidence:** contract test rejects ratified behavioral tracks
  with missing enforcement states.

### Slice 28c - Pinned ratchet floor

- **Lane:** Ratchet-Advance.
- **Findings closed:** FUP-4.
- **Why this lane:** A moving-window ratchet is not a ratchet. The slice turns
  the authored-test floor into a durable baseline that cannot silently absorb
  a bad commit.
- **Work:**
  - Add a committed ratchet floor manifest, for example
    `specs/ratchets/contract-test-floor.json`, with floor commit, count method,
    count, scope, and update protocol.
  - Change `scripts/audit.mjs` from `HEAD` vs `HEAD~1` to `HEAD` vs the pinned
    manifest floor.
  - Require any floor decrease, retire, or replacement to cite a ratchet
    advance or ADR-style disposition.
  - Add ADR-0002 pinned-floor addendum.
- **Acceptance evidence:** audit fails a constructed floor regression even
  when the previous commit already contains the lower count.

### Slice 28d - Phase 1 close ceremony and next broader adversarial pass

- **Lane:** Ratchet-Advance.
- **Findings closed:** no single finding; this gates convergence and activates
  the standing broader-review cadence.
- **Why this lane:** It updates the project control plane and blocks phase
  transition if the broader adversarial pass shows Phase 1 is still expanding.
- **Work:**
  - Update README and PROJECT_STATE with close-block, current-slice token,
    entry criteria, and Slice 29 target.
  - Run full verify/audit.
  - Dispatch the next broader adversarial pass over the remediated Phase 1
    close arc.
  - Record the review under the new path convention described below.
  - Apply the early-exit criterion below before starting Slice 29.
- **Acceptance evidence:** broader pass returns within the accepted threshold;
  otherwise Phase 2 is paused.

### Slice 29 - Phase 2 property registry scaffold

- **Lane:** Ratchet-Advance.
- **Findings closed:** none directly from the 17-item list; this preserves the
  existing Phase 2 entry plan.
- **Why this lane:** It creates the registry that lets Phase 2 properties bind
  to contract ids and artifact ids without ad hoc naming.
- **Work:**
  - Scaffold property id registry and visible property-test location.
  - Bind property ids to contract invariant ids and artifact ids.
  - Carry forward phase2-property entries from Slice 25 and Slice 28b.
- **Acceptance evidence:** registry tests and verify/audit.

### Slice 30 - Event-writer boundary and manifest snapshot

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-H2, plus any surviving `event.ts`
  `pending-artifact` expiry from AR-M3.
- **Why this lane:** Runtime run writing/resume cannot start while manifest
  immutability is only hash parity prose.
- **Work:**
  - Author event-writer/runtime-boundary contract.
  - Add `run.manifest_snapshot` artifact with backing path, hash algorithm,
    byte-copy semantics, and re-entry byte-match rule.
  - If the operator rejects a manifest snapshot artifact, land an explicit
    no-snapshot ADR before any runtime writer exists.
  - Remove or convert the `event.ts` pending-artifact allowlist.
  - Add ADR-0003 manifest-snapshot addendum.
- **Acceptance evidence:** tests prove manifest hash is tied to persisted bytes
  or an explicit no-snapshot ADR blocks byte-match claims.

### Slice 31 - Isolation substrate or Break-Glass ADR

- **Lane:** Ratchet-Advance by default; Break-Glass only if isolation cannot
  be made available and the operator explicitly records that degradation.
- **Findings closed:** none directly from the 17-item list; this preserves the
  existing Phase 2 entry plan.
- **Why this lane:** The methodology's implementation phase assumes isolation
  and hidden-test boundaries. If that cannot land, the deviation is not normal
  work; it is a methodology exception.
- **Work:**
  - Land the isolation substrate or formalize the degraded mode.
  - Keep hidden/visible property-pool and implementer-boundary assumptions
    explicit.
- **Acceptance evidence:** either isolation smoke test or Break-Glass ADR with
  deadline and restoration plan.

### Slice 32 - v0.2 review frontmatter value normalization

- **Lane:** Ratchet-Advance.
- **Findings closed:** AR-L2.
- **Why this lane:** The operator explicitly scoped this to v0.2. It should
  not block Phase 1 close or Phase 2 entry unless tooling starts reading these
  values semantically.
- **Work:**
  - Make `reviewer_model_id` and `authorship_role` (preloaded optional in
    Slice 25) REQUIRED in the review-record schema.
  - Backfill existing review records with normalized values for
    `reviewer_model_id` and `authorship_role`.
  - Remove any remaining free-form fallback for these fields.
- **Acceptance evidence:** review-record tests reject records missing
  normalized fields; every existing review record validates against the
  tightened schema.

## Methodology Convergence Section (pillar 2)

Phase 1 is currently at risk of expanding under the label "methodology
hardening." This plan treats the expansion as warranted only through Slice
28c, because the remaining accepted Phase 1 close findings are about whether
the contract/audit apparatus can be trusted at all:

- cloneability of methodology authority files;
- config strict-key closure before config becomes first-class;
- authority-graph persisted-shape correctness;
- doc/audit proxy honesty;
- behavioral enforcement states;
- pinned ratchet floors.

**Hard scope cap:** no additional Phase 1 methodology-hardening slices after
Slice 28c. Slice 28d may close, verify, and run the broader adversarial pass,
but it must not add new hardening scope unless one of these Break-Glass
conditions fires:

1. a finding shows the repo cannot be cloned or interpreted by another
   machine;
2. a finding shows the authority graph can be green while binding the wrong
   persisted artifact shape;
3. a finding shows a ratchet can silently absorb a regression;
4. the early-exit criterion below triggers.

All other new findings after Slice 28c are triaged to Phase 2 entry, v0.2, or
the stabilization arc described in the early-exit section. This is the point
where Phase 1 must become convergent rather than self-extending.

Convergence criteria for starting Slice 29:

- all accepted Phase 1 close findings in this plan are closed through Slice
  28c;
- AR-H2 remains explicitly scoped to Slice 30 and no runtime writer/resume
  path exists yet;
- AR-L2 remains explicitly scoped to Slice 32 and no review-grouping tooling
  consumes the drifting values;
- the Slice 28d broader adversarial pass returns 5 or fewer HIGH findings;
- no repeat HIGH appears in cloneability, persisted-shape authority, or pinned
  ratchet semantics.

## Adversarial-Pass Cadence (pillar 3)

The pass at `7bbec5d` is the first broader adversarial pass. It should become
standing practice, separate from per-slice challenger reviews.

### Interval

- Run a broader pass at every phase transition.
- During active implementation, run one every 6 slices or every 14 calendar
  days, whichever happens first.
- Run an immediate broader pass after any Break-Glass slice or after two
  consecutive per-slice challenger reviews open with `REJECT pending HIGH
  fold-ins`.

### Scope rotation

- **Arc-progress review** is the default. It covers the current arc calendar,
  operator dispositions, recent slice commits, review records, audit/test
  proxy claims, and PROJECT_STATE/README freshness.
- **Full-repo review** is required at phase transitions. It includes
  cloneability, symlinks, artifact authority, schemas, tests, scripts, review
  records, and status docs.
- **Methodology-only review** runs every third broader pass or whenever a slice
  touches methodology artifacts, ADR-0001/0002/0003, lane semantics, challenger
  policy, ratchet floors, or audit governance.

### Output path convention

The existing first pass remains at:

- `specs/reviews/arc-progress-codex.md`

Future broader passes use stable, non-overwriting paths:

- `specs/reviews/arc-progress-slice-<last-slice>-codex.md`
- `specs/reviews/full-repo-progress-slice-<last-slice>-codex.md`
- `specs/reviews/methodology-progress-slice-<last-slice>-codex.md`

Each broader pass should include frontmatter fields for:

- `scope_kind`;
- `previous_broader_review`;
- `commands_run`;
- `opened_scope`;
- `skipped_scope`;
- `high_count`;
- `operator_response_required: true`.

Slice 25's review-record scope work should make these fields structural for
new broad reviews.

## Early-Exit Criterion (pillar 4)

The next broader adversarial pass is the Slice 28d phase-close pass. If it
returns **more than 5 HIGH findings**, Phase 1 is declared **not converged**.

Immediate consequences:

1. Do not start Slice 29.
2. Pause Phase 2 entry and mark PROJECT_STATE as `Phase 1 stabilization`.
3. Fork a bounded methodology-stabilization arc with a maximum of 3 slices.
4. Only Discovery and Ratchet-Advance lanes are allowed in that stabilization
   arc.
5. No runtime/product implementation may land during stabilization.

Exit from stabilization requires a new broader pass with:

- 2 or fewer HIGH findings;
- 0 repeat HIGH findings in cloneability, authority-graph persisted-shape
  binding, ratchet floors, or manifest immutability;
- operator response dispositions recorded for every objection.

If stabilization also returns more than 5 HIGH findings, reopen ADR-0001 and
`specs/methodology/decision.md` before further work. At that point the
contract-first approach is not treated as the default path for `circuit-next`
until the operator explicitly recommits to it or replaces it.

## Open Questions for Operator

All four original open questions were dispositioned in the 2026-04-19 Claude +
Codex council; see **Council dispositions (2026-04-19)** above for the
recommendations and rationale. No open questions remain at plan-commit time.
