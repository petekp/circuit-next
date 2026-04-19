---
review_target: phase-1-close
target_kind: arc
arc_target: phase-1-full-arc
arc_version: 0.1
phase_1_baseline: f5a6241
phase_1_head: 6b70b5e
reviewer_model: GPT-5 Codex
review_kind: adversarial methodology close-gate audit
review_date: 2026-04-19
verdict: REJECT pending HIGH fold-ins
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: REJECT pending HIGH fold-ins
authored_by: Codex
---

# Phase 1 Close Gate - Codex Objection List

This is an objection list, not an approval. A green local gate means one
adversarial read failed to find enough machine-visible contradictions; it
does not certify Phase 1 closable under a shared Claude/Codex training
distribution.

Commands observed during this audit:

- `git log --format='%h %s' f5a6241..HEAD`
- `npm run audit` - 10 green / 0 yellow / 0 red, with README and
  PROJECT_STATE agreeing on Phase 0.5.
- `npm run test` - 8 files, 445 tests passed.

## HIGH

**1. HIGH - Contract frontmatter does not meet the methodology's own
Phase 1 shape.**

- Affected claim or artifact: Phase 1 completeness. `CLAUDE.md` and
  `specs/methodology/decision.md` define contract authorship as YAML
  frontmatter enumerating invariants, pre/postconditions, and
  `property_ids`.
- Reproduction path: `CLAUDE.md:52-55` and
  `specs/methodology/decision.md:22-24` state the frontmatter
  requirement. Current contracts carry `contract`, `status`, `version`,
  `schema_source`, review link, and `artifact_ids`, but not structured
  invariant ids, preconditions, postconditions, or `property_ids`; see
  for example `specs/contracts/run.md:1-13`,
  `specs/contracts/selection.md:1-13`, and
  `specs/contracts/workflow.md:1-11`.
- Proposed remediation: add a structural frontmatter ratchet for every
  `specs/contracts/*.md`: `invariant_ids`, `property_ids`,
  `preconditions_ref`, and `postconditions_ref` at minimum, or else
  author an ADR explicitly downgrading the frontmatter requirement from
  "enumerates" to "body sections enumerate." Add a contract test that
  parses those keys and proves every listed invariant/property id appears
  in the body exactly once.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**2. HIGH - `workflow.md` is explicitly still a skeleton.**

- Affected claim or artifact: Phase 1 completeness and the "8 contracts
  bound" closure claim.
- Reproduction path: `specs/contracts/workflow.md:8` says the
  grandfathered skeleton will get a proper review "when the contract
  gains non-skeleton invariants." Its body has only seven compact
  workflow invariants (`specs/contracts/workflow.md:22-40`), while later
  contracts and tests have already changed the workflow surface
  (`src/schemas/workflow.ts:26-47` includes `spine_policy` and
  `default_selection`). The same file still calls phase and selection
  dependencies future work at `specs/contracts/workflow.md:79-86`.
- Proposed remediation: land `workflow.md` v0.2 before Phase 2 entry:
  fold in post-selection and post-phase reality, add the missing
  workflow-specific invariants for reachability/dead steps/default
  selection/catalog serialization, and record a real
  `specs/reviews/workflow-md-v0.2-codex.md` challenger pass. Do not close
  Phase 1 with the word "skeleton" in the workflow review rationale.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**3. HIGH - Config/layered config is a load-bearing surface with no
contract and no honest artifact id.**

- Affected claim or artifact: Phase 1 completeness, authority graph
  closure, and Phase 2 implementation readiness.
- Reproduction path: `specs/evidence.md:33` says configuration
  precedence is first-class, and `specs/evidence.md:89` names existing
  config discovery as a carry-forward failure. `src/schemas/config.ts`
  exports `Config`, `CircuitOverride`, `ConfigLayer`, and
  `LayeredConfig` at `src/schemas/config.ts:115-140`, but there is no
  `specs/contracts/config.md` and no `config.*` artifact in
  `specs/artifacts.json`. Instead, `adapter.registry` claims broad
  schema exports including `Config`, `ConfigLayer`, and `LayeredConfig`
  at `specs/artifacts.json:220-233`, while `selection.override` also
  names the same config backing paths at `specs/artifacts.json:147-167`.
- Proposed remediation: add `specs/contracts/config.md` and authority
  artifacts such as `config.layer`, `config.layered`, and
  `config.file` (or an ADR explaining the exact alternative). The
  contract must own layer discovery, source path policy, strictness of
  `Config` and `LayeredConfig`, merge order, and the split between
  selection and dispatch subrecords. Until then, Phase 2 should not
  start with selection, adapter, or command dispatch implementation.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**4. HIGH - The authority graph is one-way: omitted artifacts and lying
`artifact.contract` fields can pass.**

- Affected claim or artifact: ADR-0003 authority-graph gate closure.
- Reproduction path: `scripts/audit.mjs:520-545` checks that every
  contract frontmatter `artifact_ids` value exists in the graph. It does
  not check the reverse: every artifact with non-null `contract` points to
  an existing contract whose frontmatter includes that artifact id. It
  also does not check that every exported load-bearing schema has an
  artifact row or an explicit exemption. This is how the config surface in
  objection #3 can hide behind `adapter.registry`.
- Proposed remediation: add a reverse authority-graph test and audit
  rule: for each artifact row, `contract` must exist and reciprocally
  include `artifact.id`, unless `contract: null` is paired with
  `surface_class: unknown-blocking` or an explicit pre-contract status.
  Add a schema-export coverage ledger for `src/schemas/index.ts` exports:
  each export is either bound to an artifact, declared primitive/internal,
  or explicitly out of runtime authority.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**5. HIGH - The property harness is not merely deferred; the contracts
themselves say v0.2 Phase 1 owes it.**

- Affected claim or artifact: Phase 1 closability and Phase 2 entry.
- Reproduction path: `tests/properties/visible/` and
  `tests/properties/hidden/` contain only `.gitkeep`; `tests/mutation/`
  does not exist. The contracts reserve 63 unique `*.prop.*` ids across
  the spec stack. Several evolution sections place ratification in
  Phase 1 v0.2, not after Phase 1: `specs/contracts/run.md:360-370`,
  `specs/contracts/selection.md:505-526`,
  `specs/contracts/adapter.md:575-590`,
  `specs/contracts/phase.md:239-251`, and
  `specs/contracts/step.md:203-209`.
- Proposed remediation: before Phase 2 implementation, land a visible
  property registry and harness scaffold under `tests/properties/visible/`
  that maps every reserved property id to owning contract, artifact ids,
  implementation prerequisite, and status. Add a test that fails on
  unregistered property ids. Full property bodies can be slice-scoped,
  but the registry debt cannot remain implicit.
- Fold-in discipline label: Scoped to Phase 2 entry.

**6. HIGH - Phase 2's required isolation substrate is absent, so
"implementation begins" would violate hard invariants.**

- Affected claim or artifact: Phase 2 readiness and Tier 2+ tooling
  deferral.
- Reproduction path: Phase 2 requires a container with distinct UID and
  read-only mounts for `specs/`, visible properties, mutation tests,
  behavioral specs, and CI at `CLAUDE.md:58-61`. The hard invariants
  repeat the implementer-container constraints at `CLAUDE.md:148-152`.
  Current repo has no `tests/mutation/`, no container/devcontainer
  definition, no isolation script, and no CI mount policy in
  `package.json:10-18`.
- Proposed remediation: define Phase 2 entry as a substrate slice before
  product implementation: container or distinct-UID runner, read-only
  mounts, hidden-pool non-mount proof, `tests/mutation/` placeholder, and
  a smoke test or script proving the implementer cannot write protected
  paths. If the team deliberately starts without it, record a
  Break-Glass or methodology-relaxation ADR with challenger review.
- Fold-in discipline label: Scoped to Phase 2 entry.

**7. HIGH - The likely first implementation surface, event writing and
replay, is not fully specified.**

- Affected claim or artifact: "what should Phase 2 start with" default,
  `run.log`, and `run.projection`.
- Reproduction path: `specs/evidence.md:29` makes event-sourced runs
  the durability model, while `specs/evidence.md:90` flags the legacy
  unlocked append race. `specs/contracts/run.md:48-156` constrains a
  parsed `RunLog` and `RunProjection`, but it does not specify the event
  writer's append protocol, lock/atomicity policy, fsync or temp-file
  behavior, hash chaining, crash recovery, idempotency, or concurrent
  writer semantics. `specs/artifacts.json:89-104` says the engine writes
  `events.ndjson`, but there is no writer contract.
- Proposed remediation: do not start Phase 2 with command-dispatch
  routing. Start with a Phase 2 entry contract or run.md v0.2 addition for
  the runtime event writer/reducer boundary: append exclusivity,
  sequence allocation, durable-write semantics, manifest hash handling,
  and replay determinism. Then the first implementation slice can be a
  minimal event writer plus reducer with `run.prop.*` acceptance tests.
- Fold-in discipline label: Scoped to Phase 2 entry.

**8. HIGH - Behavioral-track enforcement is too cosmetic to support a
strong closure claim.**

- Affected claim or artifact: Behavioral-track promise coverage.
- Reproduction path: The three behavioral tests exist and pass, but much
  of the named behavior is still static prose anchoring. `session` tests
  assert compaction-disabled and 30-minute slice text presence at
  `tests/contracts/session-hygiene.test.ts:109-134`, not harness state or
  wall-clock behavior. `prose-yaml` tests assert frontmatter,
  cross-reference strings, invariant-id presence, and absence of one
  marker family at `tests/contracts/prose-yaml-parity.test.ts:52-69` and
  `tests/contracts/prose-yaml-parity.test.ts:156-199`, not YAML/prose
  round-trip. The track itself admits no parity check ships because the
  compiler has not been authored at `specs/behavioral/prose-yaml-parity.md:144-155`.
- Proposed remediation: reword Phase 1 close state to say behavioral
  v0.1 is "static reservation plus audit hooks", not enforcement. Add a
  behavioral enforcement matrix with each invariant mapped to one of:
  executable now, audit-only now, prose-only now, v0.2-on-compiler,
  Phase-2-entry. If Phase 2's first implementation touches catalog
  compiler or generated docs, `prose-yaml` v0.2 must land first.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**9. HIGH - The grandfathered-review mechanism weakens the challenger
gate and is generic enough to bypass it on future contracts.**

- Affected claim or artifact: Grandfathered-contract hazard,
  CHALLENGER-I3, and `step.md` / `workflow.md`.
- Reproduction path: `tests/contracts/cross-model-challenger.test.ts:401-429`
  accepts any contract with `codex_adversarial_review_grandfathered` and
  a rationale longer than 20 characters. The track spec makes the option
  generic at `specs/behavioral/cross-model-challenger.md:133-140`.
  `workflow.md` uses it while explicitly saying the proper review waits
  until non-skeleton invariants exist (`specs/contracts/workflow.md:8`).
- Proposed remediation: restrict grandfathering to an explicit allowlist
  of `step.md` and, if still accepted, `workflow.md`; require
  `grandfathered_source_ref` with a resolvable commit/path, a
  `grandfathered_scope` field, and an `expires_on_contract_change: true`
  assertion. New contracts must fail if they use the grandfathered field.
  `workflow.md` should leave the allowlist only after a proper review lands.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**10. HIGH - The phase-transition ceremony has not happened; the live
state still says Phase 0.5.**

- Affected claim or artifact: Phase 1 closure and Phase 2 entry ceremony.
- Reproduction path: `README.md:28-34` says current phase is
  "Phase 0.5 / Slice 7 - authority-graph hardening" and Phase 1 is
  paused. `PROJECT_STATE.md:3-11` says the same phase and describes
  Phase 1 as resumed, not closed. `npm run audit` is green specifically
  because both files agree on Phase 0.5, not because either file says
  Phase 1 is closed.
- Proposed remediation: add a Phase 1 close block and Phase 2 entry
  block to README and PROJECT_STATE, with exact entry criteria:
  property registry scaffold, config contract decision, workflow
  v0.2/proper review, Phase 2 isolation substrate, and first-slice
  target. Add a close-review artifact pointer to PROJECT_STATE.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

## MED

**11. MED - Cross-contract prose contains stale post-slice state.**

- Affected claim or artifact: Future-reader trust in the contract stack.
- Reproduction path: `specs/contracts/phase.md:195-205` still says
  Phase does not carry `selection` and selection.md is not yet authored,
  while `src/schemas/phase.ts:16-27` and
  `specs/contracts/selection.md:195-214` say `Phase.selection` landed.
  `specs/contracts/workflow.md:79-86` calls phase and selection future
  dependencies. `specs/contracts/adapter.md:437-439` says
  `DispatchStartedEvent.adapter: AdapterRef`, but the same contract says
  the event now carries `ResolvedAdapter` at
  `specs/contracts/adapter.md:349-353`.
- Proposed remediation: run a cross-contract stale-reference sweep as
  part of Phase 1 close. Add an audit/test that rejects "(future)" and
  "not yet authored" references to contracts that now exist unless the
  phrase is in an explicit historical/evolution section.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**12. MED - Behavioral specs still describe their landed tests as future
work.**

- Affected claim or artifact: Behavioral-track promise coverage.
- Reproduction path: `specs/behavioral/session-hygiene.md:14-15`,
  `specs/behavioral/prose-yaml-parity.md:13-15`, and
  `specs/behavioral/cross-model-challenger.md:14-16` still mark the test
  files as future. Their Evolution sections also say the tests land in
  v0.2 or when Tier 2 starts at
  `specs/behavioral/session-hygiene.md:149-159` and
  `specs/behavioral/cross-model-challenger.md:195-205`.
- Proposed remediation: update all three behavioral tracks to separate
  "landed v0.1 tests" from "v0.2 enforcement still owed." This is a
  documentation fold-in, not a new design.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**13. MED - The audit's contract-test ratchet counts only one test file.**

- Affected claim or artifact: Audit green claim and anti-Goodhart
  ratchet credibility.
- Reproduction path: `scripts/audit.mjs:241-250` hardcodes
  `tests/contracts/schema-parity.test.ts` as the count source. Audit
  output reports "282 tests at HEAD" while `npm run test` reports 445
  total tests across 8 files. Deleting behavioral contract tests would
  not be reflected in the audit's test-count ratchet, though `verify`
  would still run whatever remains.
- Proposed remediation: change the audit ratchet to count every
  committed `tests/**/*.test.ts` test, or parse Vitest JSON output.
  Report schema-parity and total separately if the schema file remains a
  separate ratchet.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**14. MED - Prose/YAML sentinel coverage is intentionally narrow, but the
closure claim does not keep that humility visible enough.**

- Affected claim or artifact: Sentinel-coverage illusion in the
  prose-yaml track.
- Reproduction path: `tests/contracts/prose-yaml-parity.test.ts:175-180`
  catches only `CIRCUIT:BEGIN|END` and `SKILL:BEGIN|END` HTML comments.
  The track allows target-file-appropriate marker styles at
  `specs/behavioral/prose-yaml-parity.md:50-58`, and the arc review
  explicitly scoped broader marker grammar to v0.2 at
  `specs/reviews/behavioral-arc-slices-14-16-codex.md:260-271`.
- Proposed remediation: keep the deferral, but rename the test and
  PROJECT_STATE language to "single-family marker canary", not "no
  catalog compiler markers exist." When the catalog compiler lands, add
  a marker-registry grammar test before committing any generated region.
- Fold-in discipline label: Scoped to v0.2.

**15. MED - ADR reopen conditions do not catch the omitted-artifact class
that this audit found.**

- Affected claim or artifact: ADR-0003 and ADR-0005 reopen discipline.
- Reproduction path: ADR-0003's reopen conditions at
  `specs/adrs/ADR-0003-authority-graph-gate.md:252-263` cover
  unknown-blocking execution, true model diversity, and continuity
  reclassification. ADR-0005's triggers at
  `specs/adrs/ADR-0005-v2-plane-required.md:210-245` are stronger for
  mixed-layer provenance, but neither creates a general trigger for
  "load-bearing schema/config surface exists without an artifact row."
- Proposed remediation: add an ADR-0003 addendum: the authority graph
  reopens when a schema export, backing path, or runtime writer/reader is
  discovered without an artifact id or explicit exemption. This directly
  covers config/layered config and future plugin manifest surfaces.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**16. MED - Phase 0 closure audit is diffuse, not a recorded entry
ceremony.**

- Affected claim or artifact: Phase-transition ceremony precedent.
- Reproduction path: ADR-0001 says Phase 0 closes with adversarial
  auditor review before Phase 1 at
  `specs/adrs/ADR-0001-methodology-adoption.md:31-33`. The repo has
  `specs/evidence.md` as the closure artifact and
  `bootstrap/adversarial-review-codex.md` as a type-skeleton review, but
  no dedicated `specs/reviews/phase-0-close-*.md` style record. `rg`
  finds no close-gate artifact other than this one.
- Proposed remediation: do not repeat this ambiguity at Phase 2. Add a
  minimal Phase 2 entry ceremony now: close artifact path, accepted
  deferrals, blocked deferrals, first slice, and substrate requirements.
  Optionally add a retrospective note to PROJECT_STATE explaining what
  counted as Phase 0's adversarial close audit.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**17. MED - All contracts and behavioral tracks still say
`status: draft`.**

- Affected claim or artifact: Phase 1 closure state.
- Reproduction path: every file under `specs/contracts/*.md` and
  `specs/behavioral/*.md` carries `status: draft`; confirmed by `rg
  '^status: draft$' specs/contracts specs/behavioral`.
- Proposed remediation: either change closable contracts/tracks to
  `status: active` / `ratified-v0.1`, or write a short status taxonomy
  saying `draft` is intentionally retained until Phase 2 properties land.
  The current state makes "Phase 1 closed" read as "all drafts accepted
  without changing their lifecycle state."
- Fold-in discipline label: Incorporable within Phase 1 close slice.

**18. MED - Knight-Leveson correlated failure has a concrete instance:
Claude and Codex both followed the listed contract set and missed config
as a first-class contract.**

- Affected claim or artifact: Challenger caveat recurring.
- Reproduction path: The evidence names config precedence as
  load-bearing (`specs/evidence.md:33`, `specs/evidence.md:89`), but the
  Phase 1 owed-contract list in `specs/evidence.md:144-156` does not
  include config. The later reviews attacked selection/adapter details,
  yet still left `specs/contracts/config.md (future)` in
  `specs/contracts/adapter.md:317-319` and
  `specs/contracts/selection.md:379-381`.
- Proposed remediation: treat this as the exemplar correlated-miss in
  the close artifact. Add a contract inventory test generated from
  `src/schemas/index.ts` and `specs/evidence.md` hard invariants, not
  just from the contracts already known to exist.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

## LOW

**19. LOW - `schema_exports` existence checking is intentionally narrow
and should be named as such in close state.**

- Affected claim or artifact: Authority graph audit precision.
- Reproduction path: `scripts/audit.mjs:126-140` only accepts
  `export const <name>` as an export definition. The constructed tests
  explicitly reject `export function` at
  `tests/contracts/artifact-authority.test.ts:186-190` as v0.2 scope.
- Proposed remediation: no immediate change needed if all schema exports
  remain `export const`. Add a close-state note that this audit dimension
  is intentionally schema-constant-shaped, not a general TypeScript export
  resolver.
- Fold-in discipline label: Scoped to v0.2.

**20. LOW - Several line-number citations inside contracts are brittle
and already at risk of rot.**

- Affected claim or artifact: Future-reader evidence quality.
- Reproduction path: `specs/contracts/step.md:26-28` cites
  `src/schemas/step.ts:L68-L83`; many other contracts use line-ish prose.
  As schemas evolve, these claims can go stale without tests noticing.
- Proposed remediation: prefer symbol citations (`src/schemas/step.ts`
  `Step`) over line citations in normative contracts, or add a
  "line refs are illustrative" convention.
- Fold-in discipline label: Scoped to v0.2.

**21. LOW - `README.md` layout still advertises `.claude-plugin/` as
Phase 1+ while PROJECT_STATE says the plugin surface is Phase 2+.**

- Affected claim or artifact: Phase-transition clarity.
- Reproduction path: `README.md:65` labels `.claude-plugin/` as
  "deferred to Phase 1+", while `PROJECT_STATE.md:168-180` lists the
  plugin manifest and plugin surface as Phase 2 implementation deferrals.
- Proposed remediation: align README layout text to "Phase 2+" or add a
  note that the directory can exist in Phase 1 but plugin implementation
  is Phase 2.
- Fold-in discipline label: Incorporable within Phase 1 close slice.

## Phase 2 start objection

The default Phase 2 start should not be command dispatch, adapter routing,
or catalog compiler implementation. The first Phase 2 slice should be a
Phase 2 entry substrate slice: property registry scaffold, isolation
runner/read-only mount proof, and event-writer/reducer contract closure.
Only after that should implementation touch runtime event writing. The
first product implementation slice should then be the minimal run event
writer plus reducer, because every later surface depends on durable,
replayable run state.

## Closing verdict

`REJECT pending HIGH fold-ins`

## Operator response (incorporated / scoped / rejected)

Dispositions per CHALLENGER-I4; every objection carries a label and a slice
pointer. Fold-ins land across Slices 22-31; the closing_verdict updates
when the last in-Phase-1-close fold-in commits. Phase 2-entry-scoped
objections and v0.2-scoped objections do NOT block Phase 1 close per their
label, but each is recorded as a named follow-up with trigger conditions.

### Incorporable within Phase 1 close slice (Slices 22-28)

- **HIGH #1 — Contract frontmatter invariant_ids/property_ids/pre/post refs.**
  Scheduled for Slice 25. Add `invariant_ids`, `property_ids`,
  `preconditions_ref`, `postconditions_ref` to every `specs/contracts/*.md`
  frontmatter + a contract test parsing those keys and proving every
  listed id appears in the body exactly once. No ADR downgrade — the
  methodology's frontmatter requirement stands.
- **HIGH #2 — workflow.md skeleton → v0.2.** Scheduled for Slice 27. Fold
  in post-selection + post-phase reality; add reachability / dead-steps /
  default-selection / catalog-serialization invariants; dispatch Codex →
  `specs/reviews/workflow-md-v0.2-codex.md`. Remove grandfathered
  declaration on close; update Slice 24 allowlist accordingly.
- **HIGH #3 — config.md missing contract + authority rows.** Scheduled
  for Slice 26. Author `specs/contracts/config.md` + add `config.layer`,
  `config.layered`, `config.file` (or named equivalents) to
  `specs/artifacts.json`. Move `Config` / `ConfigLayer` / `LayeredConfig`
  schema_exports off `adapter.registry` onto the new config artifacts.
  Correlated-miss instance named here per MED #18; see §Correlated-miss
  documentation.
- **HIGH #4 — Authority graph is one-way.** Scheduled for Slice 23. Add
  reverse audit rule + contract test: every `artifacts.json` row's
  `contract` field resolves to an existing contract AND that contract's
  frontmatter `artifact_ids` reciprocates. Add a schema-export coverage
  ledger test for `src/schemas/index.ts`.
- **HIGH #8 — Behavioral-track enforcement cosmetic.** Scheduled for
  Slice 28. Reword "pinned" to "reserved v0.1 discipline + audit hooks";
  add enforcement matrix mapping each invariant to executable-now /
  audit-only-now / prose-only-now / v0.2-on-compiler / Phase-2-entry.
  MED #14 sentinel-canary rename folded in same slice.
- **HIGH #9 — Grandfathered mechanism too generic.** Scheduled for Slice
  24. Add `GRANDFATHERED_CONTRACT_ALLOWLIST` set (step.md, workflow.md
  only); new contracts fail if they carry `codex_adversarial_review_
  grandfathered`. Require `grandfathered_source_ref`, `grandfathered_scope`,
  `expires_on_contract_change: true` additional fields.
- **HIGH #10 — Phase-transition ceremony.** Scheduled for the FINAL
  slice of this arc (once Slices 22-31 land). Add a Phase 1 close block +
  Phase 2 entry block to README + PROJECT_STATE with exact entry
  criteria: property-registry scaffold landed, config contract landed,
  workflow.md v0.2 landed, Phase 2 isolation substrate decision
  recorded, first Phase 2 slice target named. Add a close-review
  artifact pointer to PROJECT_STATE.
- **MED #11 — Cross-contract stale prose.** Scheduled for Slice 22 (this
  slice). Sweep `phase.md`, `workflow.md`, `adapter.md`, `selection.md`
  for "(future)" or "not yet authored" references to contracts now
  authored; rewrite to present tense.
- **MED #12 — Behavioral specs say landed tests are future.** Scheduled
  for Slice 22 (this slice). Update `session-hygiene.md`,
  `prose-yaml-parity.md`, `cross-model-challenger.md` `planned_tests`
  frontmatter + §Evolution to reflect that v0.1 tests HAVE landed.
- **MED #13 — Audit test-count ratchet counts one file.** Scheduled for
  Slice 28. Change `scripts/audit.mjs` contract-test-ratchet dimension
  to count every `tests/contracts/*.test.ts`; report schema-parity
  count + total count separately.
- **MED #15 — ADR reopen conditions miss omitted-artifact class.**
  Scheduled for Slice 23. Add an ADR-0003 addendum: authority graph
  reopens when a schema export, backing path, or runtime writer/reader
  surfaces without an artifact id.
- **MED #16 — Phase 0 close ceremony diffuse.** Scheduled for Slice 22
  (this slice). Add a retrospective note to PROJECT_STATE.md §What
  happened overnight explaining what counted as the Phase 0 adversarial
  close audit (`bootstrap/adversarial-review-codex.md` + Phase 0
  synthesis in `specs/evidence.md`). Phase 2 entry ceremony template
  established by this review record.
- **MED #17 — All contracts / behavioral tracks say status: draft.**
  Scheduled for Slice 22 (this slice). Either bump `status: draft` to
  `status: ratified-v0.1` on closable contracts / tracks, OR add a
  short status taxonomy explaining draft-is-intentional-until-Phase-2.
  Preferred: bump to `ratified-v0.1` on the six Codex-reviewed
  contracts + three behavioral tracks; step.md and workflow.md stay
  draft until their v0.2 review lands.
- **MED #18 — Config as correlated-miss exemplar.** Scheduled for Slice
  22 (this slice). Add a §Correlated-miss documentation subsection to
  this review record naming the Claude+Codex shared failure to catch
  config.md. Slice 26 lands the contract + test; Slice 23 lands the
  audit dimension that would have caught it.
- **LOW #21 — README .claude-plugin/ label stale.** Scheduled for Slice
  22 (this slice). Align README layout section to "deferred to
  Phase 2+" instead of "Phase 1+".

### Scoped to Phase 2 entry (Slices 29-31)

- **HIGH #5 — Property-test harness registry debt.** Scheduled for
  Slice 29. Land `tests/properties/visible/` with a registry mapping
  every reserved property_id (63 across contracts) to owning contract
  / artifact ids / prerequisite / status. Test fails on unregistered
  ids. Full property bodies land slice-scoped in Phase 2; registry
  debt closes here.
- **HIGH #6 — Phase 2 isolation substrate.** Scheduled for Slice 31.
  Either scaffold container/devcontainer + distinct-UID runner +
  read-only-mount proof + hidden-pool non-mount proof + `tests/mutation/`
  placeholder, OR author a Break-Glass / methodology-relaxation ADR
  with challenger review explaining the deferral. Phase 2 first product
  slice does not begin until one or the other lands.
- **HIGH #7 — Event writer contract missing.** Scheduled for Slice 30.
  Author `run.md` v0.2 addition (or separate runtime-writer contract)
  covering append exclusivity, sequence allocation, durable-write
  semantics (fsync / temp-file / hash chaining), manifest-hash
  handling, crash recovery / idempotency / concurrent-writer semantics,
  and replay determinism. Dispatch Codex.

### Scoped to v0.2 (not blocking Phase 1 close)

- **MED #14 — Sentinel-coverage illusion.** Already called out in the
  Slice 15 track §Evolution as v0.2 scope (catalog compiler landing).
  Folded into Slice 28 wording change only: test name + PROJECT_STATE
  prose rename from "no markers exist" to "single-family marker
  canary". No grammar expansion.
- **LOW #19 — schema_exports narrow (export const only).** Scheduled
  as close-state documentation note. No audit code change — when
  `export function` forms appear in a schema module, that commit adds
  coverage. The narrowness is honest about today; broadening
  pre-emptively is speculation.
- **LOW #20 — Line citations brittle.** Scheduled as v0.2 convention
  note. Prefer symbol citations (`src/schemas/step.ts Step`) over
  `src/schemas/step.ts:L68-L83` in normative contracts. Existing line
  citations stay; new authorship uses symbol citations.

### Rejected (none)

All 21 objections are either incorporable within Phase 1 close, scoped to
Phase 2 entry with named fold-in slices, or scoped to v0.2 with reopen
triggers. Nothing is rejected as non-applicable.

## Correlated-miss documentation (MED #18)

Codex + Claude both overlooked `specs/contracts/config.md` as a first-class
Phase 1 contract, despite `specs/evidence.md:33` naming configuration
precedence as load-bearing and `specs/evidence.md:89` flagging existing
config discovery as a carry-forward failure. The Phase 1 owed-contract
list in `specs/evidence.md:144-156` omits config. Adversarial passes on
`selection.md` and `adapter.md` both left `specs/contracts/config.md
(future)` references intact (see `specs/contracts/adapter.md:317-319`,
`specs/contracts/selection.md:379-381`) without flagging the missing
contract. The `config` surface was silently absorbed into
`adapter.registry` via broad `schema_exports` at
`specs/artifacts.json:220-233`.

This is a concrete **Knight-Leveson correlated-miss** instance — both
Claude and Codex followed the existing contract list as the ground-truth
Phase 1 inventory rather than deriving the inventory from
`src/schemas/index.ts` + `specs/evidence.md` hard invariants. The audit's
forward-only authority-graph check (HIGH #4) was the enabling condition:
a reverse check would have flagged `config.ts` exports landing in
`adapter.registry`'s schema_exports as a shape incongruence.

Slice 26 (HIGH #3 fold-in) lands the contract + authority rows. Slice 23
(HIGH #4 fold-in) lands the reverse check + schema-export coverage
ledger. The combination closes the correlated-miss concretely and
prevents a second instance with a different load-bearing schema.

## Going-forward rule (Phase 2 entry criteria)

Phase 2 implementation cannot begin until:

1. Slices 22-28 (in-close fold-ins) have landed and this review's
   `closing_verdict` has flipped to `ACCEPT`.
2. Slice 29 (property registry scaffold) has landed — every reserved
   `*.prop.*` id is registered with an owning contract and status.
3. Slice 30 (event-writer boundary contract) has landed + Codex review.
4. Slice 31 (Phase 2 isolation substrate) has landed EITHER as a
   working runner + proof artifacts OR as a named Break-Glass ADR with
   challenger review.
5. Phase-transition ceremony (HIGH #10) — README + PROJECT_STATE
   updated with close block + entry criteria + first-slice target.

Slices 29-31 are the **Phase 2 entry prerequisites**. Phase 1 closes
when 22-28 close; Phase 2 opens when 29-31 close.

## Review-about-the-review meta-notes

- Codex wrote this review record directly to
  `specs/reviews/arc-phase-1-close-codex.md` via its filesystem
  capability. Frontmatter written by Codex matches the unified
  arc-review shape (target_kind: arc, review_target, arc_target,
  etc.) established by Slice 20 — a reassuring consistency signal.
- All 21 objections are inline-disposed with a fold-in label by
  Codex; the Slice 19 per-objection disposition parser accepts the
  review record green.
- Knight-Leveson reminder: MED #18 is a NAMED correlated-miss
  instance. Claude + Codex BOTH missed config.md during the full
  Phase 1 arc despite both reading `specs/evidence.md`. That is the
  kind of failure the methodology's fourth pillar explicitly warns
  about. Phase 2+ should look for additional correlated-miss
  instances proactively — perhaps an external human reviewer + fresh
  model family + schema-derived inventory checks.

