# PROJECT_STATE — circuit-next

**Last updated:** 2026-04-19 (Slice 12: control-plane/data-plane split)
**Phase:** 0.5 — Slice 8 Continuity Contract **closed**. Authority-graph
gate (Slice 7) now exercised end-to-end against a successor-to-live
artifact. Phase 1 contract authorship resumed under the gate. Slice 12
introduces the plane dimension (ADR-0004) on the authority graph; 10 of
13 artifacts classified, 3 explicitly deferred to a v2 schema slice.
Phase 0 Evidence Loop closed. Six Phase 1 contracts landed pre-pause:
`step.md` (MED #7 closed), `phase.md` (MED #11 closed + Codex objections
folded in — v0.1 MED #7 now closed by selection.md SEL-I9), `run.md`
(HIGH #1/#2 + MEDs #3-7 + LOWs #8-10 folded in), `selection.md` (Codex
REJECT → ACCEPT: 6 HIGH + 4/5 MED + 1 LOW folded in; MED #9 scoped to
v0.2), `adapter.md` (Codex REJECT → ACCEPT: 5 HIGH + 3 MED + 1 LOW all
folded in; `ResolvedAdapter` split, registry-key parity, own-property
closure, role binding, `AdapterReference` export), plus `workflow.md`
skeleton. Bootstrap discipline (ADR-0002) codified; `.circuit/`
gitignored; drift-visibility audit (`npm run audit`) now enforces
authority-graph classification + compatibility posture + README/PROJECT_STATE
phase consistency (ADR-0003).

**Slice 7 decision block:**
- Phase 1 contract authorship is paused until Slice 7 lands.
- Slice 7 introduces ADR-0003 Authority-Graph Gate, `specs/artifacts.json`
  (authoritative authority graph, 12 artifact ids enumerated),
  `specs/artifacts.md` (human companion), contract `artifact_ids`
  frontmatter binding, `ControlPlaneFileStem` path-safe primitive,
  README/PROJECT_STATE phase consistency audit, and clean-break
  successor-to-live classification for continuity.
- circuit-next will **not** directly parse old Circuit continuity records
  through normal runtime paths. Old Circuit continuity is reference
  evidence and possible future migration-source input, not a runtime
  compatibility requirement. Reference characterization captured at
  `specs/reference/legacy-circuit/continuity-characterization.md`.
- `specs/contracts/continuity.md` remains **un**drafted in this slice;
  non-goal enforced. It unblocks after Slice 7 commits because the gate
  now guarantees `continuity.record` and `continuity.index` are
  classified and characterized.

**Tier:** 0 — scaffold complete, validated, committed. Tests: 252 were
green pre-Slice-7, but pre-Slice-7 they did not enforce authority-graph
coverage or successor-to-live compatibility posture. Slice 7 adds
`tests/contracts/primitives.test.ts` (+27) and
`tests/contracts/artifact-authority.test.ts` (+17) for a post-slice total
near 296.

## One-minute read

`circuit-next` now has a rigorously-validated Tier 0 foundation. The
Contract-First + Tiny-Step-Ratcheting + Architecture-First + cross-model-
challenger methodology (`specs/methodology/decision.md`) has been applied
end-to-end during this bootstrap: external prior-art was surveyed, internal
Circuit was extracted blind, the 4 in-repo prior-art docs were audited
against independent evidence, a type skeleton was drafted, adversarially
challenged by Codex, and hardened with compiler-enforced invariants.

Everything the user asked for overnight is in place:

- Tier 0 directory scaffold with CLAUDE.md, PROJECT_STATE.md, ADR-0001
- 4-worker parallel evidence pass (Claude + Codex × external + internal)
- Synthesized `specs/evidence.md` with labeled invariants + seams
- Architecture-first TypeScript type skeleton under `src/schemas/`
- Contract-first Zod schemas with 251 contract + 1 smoke = 252 tests (baseline 34 → +218 across Phase 1 slices: step-contract + phase/spine + run-contract with transitive strict, prototype-chain defense, and projection binding + selection triplet + adapter/dispatch surface with ResolvedAdapter split and registry-key parity)
- Validation/verification infrastructure: tsc --strict, biome, vitest, all green
- Adversarial-review findings (6 HIGH objections) incorporated into the skeleton
- Phase 1 contract stubs: `specs/domain.md` + `specs/contracts/workflow.md`
- Prior-art audit (`bootstrap/prior-art-audit.md`) of the 4 Circuit docs

The skeleton is **deliberately minimal** (~700 lines of TS across 15 schema
files + 14 types) — digestible in one sitting. Nothing is "finished"; every
schema has clear Phase 1 / Phase 2 expansion points.

## How to pick this up in the morning

```bash
cd ~/Code/circuit-next
cat PROJECT_STATE.md          # this file
cat specs/evidence.md          # the Phase 0 synthesis — read second
npm install                     # if not already
npm run verify                  # tsc + biome + vitest; should all pass
```

Then in order of importance:

1. Read `specs/evidence.md` — the Phase 0 closure artifact.
2. Skim `bootstrap/adversarial-review-codex.md` — the objections Codex raised against the skeleton. 6 HIGH are incorporated; see below for what's deferred.
3. Read `src/schemas/workflow.ts`, `src/schemas/step.ts`, and `src/schemas/event.ts` — the three most consequential schemas. Verify they match your mental model.
4. Run `npm run test` — 47 tests should pass (46 contract + 1 smoke). Every test encodes an invariant from the methodology. Skim the test names to see what's enforced.
5. Read `specs/contracts/workflow.md` as an example Phase 1 contract. Phase 1 authors the remaining contracts (step, selection, adapter, continuity, skill, run, phase, behavioral tracks) in the same shape.
6. Decide what Phase 1 batch to start with. Recommended: `specs/contracts/step.md` next (the invariants are the densest).

## What happened overnight — timeline

- **Scaffold** (~20 min): directory tree, `package.json`/`tsconfig.json`/ `biome.json`, CLAUDE.md, PROJECT_STATE.md (draft), ADR-0001, `specs/risks.md`, methodology symlinks, git init + first commit.
- **Parallel worker dispatch**: 4 evidence workers launched in parallel — Claude + Codex × external prior art + blind internal Circuit extraction. Two codex workers completed in ~5-7 min each; two Claude Agents completed in ~10 min each.
- **Orchestrator work while workers ran**: compiled `bootstrap/abstraction-inventory.md` from top-level Circuit docs; read methodology decision in detail.
- **External synthesis** (`analyze-ext`/artifacts/analysis.md): 51 + 41 sources across both drafts synthesized into evidence brief with 10 hard invariants + 8 seams.
- **Type skeleton draft** (15 schemas, 13 `.ts` files): Workflow, Phase, Step, Gate, Event, Snapshot, Config, SelectionPolicy, SkillDescriptor, LaneDeclaration, AdapterRef, ContinuityRecord, IDs (branded), Rigor, Role.
- **Validation wiring**: tsc strict, biome, vitest with initial 13 parity tests — all green.
- **Adversarial review** (`bootstrap/adversarial-review-codex.md`): Codex attacked the skeleton; 6 HIGH + 7 MED + 1 LOW objections. Verdict: `NEEDS ADJUSTMENT`.
- **Skeleton hardening**: incorporated 6 HIGH + 3 MED objections directly into schemas. Step became a discriminated union; Workflow got graph-closure superRefine; Lane got attached to RunBootstrappedEvent + Snapshot; SelectionPolicy added SkillOverride with inherit/replace/append/remove; Event log got richer for replay; DispatchConfig got adapter registry with closure validation; Continuity became discriminated union; isConsequentialRigor includes autonomous; provider-scoped models replaced marketing enum; Effort uses OpenAI 6-tier. 34 tests including negative cases for graph violations. All green.
- **Commit**: second commit `tier0: architecture-first type skeleton + adversarial-review fixes` with all schemas + tests + adversarial review artifact.
- **Prior-art audit** (`bootstrap/prior-art-audit.md`): audited the 4 in-repo Circuit docs against the independent external + internal evidence.
- **Final synthesis** (`specs/evidence.md`): master Phase 0 closure artifact combining all streams.
- **Phase 1 kickoff** (partial): `specs/domain.md` ubiquitous-language glossary + `specs/contracts/workflow.md` first contract.
- **Final commit** + continuity save (this step).

## Status checklist — what the user asked for

- [x] Tier 0 scaffold with CLAUDE.md <300 lines, PROJECT_STATE, ADR-0001, specs/methodology/ links, git init
- [x] External prior-art survey (Claude + Codex, independent drafts, synthesized)
- [x] Blind internal extraction of existing Circuit (Claude + Codex, independent drafts)
- [x] Prior-art audit of 4 in-repo docs against external + internal evidence
- [x] `specs/evidence.md` Phase 0 closure artifact
- [x] Architecture-first type skeleton (schemas + types) compiling under `tsc --strict`
- [x] Contract-first Zod schemas with 34 parity + negative tests
- [x] Validation/verification infrastructure (tsc, biome, vitest) all green
- [x] Cross-model challenger pass (Codex adversarial review on the skeleton)
- [x] Incorporate HIGH adversarial findings; defer MED/LOW with rationale
- [x] `specs/domain.md` ubiquitous-language glossary (Phase 1 draft)
- [x] `specs/contracts/workflow.md` as first Phase 1 contract (example)
- [x] git commits on every meaningful milestone
- [x] Methodology applied end-to-end (contract-first + architecture-first + tiny-step-ratcheting + cross-model challenger)

## What is NOT done (intentional deferral)

### Deferred to Phase 1 contract authorship

- All core contracts authored. Remaining Phase 1 work:
  `tests/contracts/session-hygiene.test.ts`,
  `tests/contracts/prose-yaml-parity.test.ts`,
  `tests/contracts/cross-model-challenger.test.ts` — three behavioral
  track tests, planned locations named in the tracks themselves.

### Closed this session (Phase 1, first contract slice + autonomy arc slices 1-12)

- **Slice 12 — control-plane / data-plane split on the authority graph (ADR-0004, Ratchet-Advance lane).** New `plane` dimension on `specs/artifacts.json`, orthogonal to `surface_class` and `compatibility_policy`. Closes ADR-0003 latent root cause #3 ("control-plane / data-plane confusion" — previously unaddressed). 10/13 artifacts classified: control-plane (`workflow.definition`, `step.definition`, `phase.definition`, `skill.descriptor`), data-plane (`run.log`, `run.projection`, `selection.resolution`, `adapter.resolved`, `continuity.record`, `continuity.index`). 3 explicitly deferred via `PLANE_DEFERRED_IDS` allowlist: `selection.override`, `adapter.registry`, `adapter.reference` (genuinely per-layer mixed-trust artifacts whose classification requires per-layer plane representation, scoped to v2 schema evolution). `scripts/audit.mjs` adds three class-conditional rules: required-or-deferred (every artifact must declare `plane` or appear in the allowlist; closes HIGH #1 "optional plane as silent escape hatch"), data-plane trust-boundary-detail (prose must name an unnegated origin token from `{operator-local, engine-computed, model-authored}` — `mixed` removed per HIGH #3 as cardinality-not-origin; negation-window check added per HIGH #2 to reject "never operator-local"-style substring false positives), control-plane path-derivation ban (plugin-authored static content must not derive identity from filesystem paths, per MED #6). Audit summary split to distinguish surface-class classification from plane classification (LOW #10). Codex cross-model adversarial pass: opening NEEDS ADJUSTMENT → closing ACCEPT after fold-in of 5 HIGH + 3 MED + 2 LOW; MED #9 (external-protocol plane) scoped to v0.2 since no external-protocol artifacts exist today. Full record at `specs/reviews/adr-0004-plane-split-codex.md`. +26 contract tests in `tests/contracts/artifact-authority.test.ts` (390 tests total, up from 364 post-Slice-11). v2 schema evolution owes: promote `plane` to structurally required; classify or re-ID the 3 deferred mixed-layer artifacts; decide external-protocol plane story before any external-protocol artifact lands.
- **Slice 11 — schema_exports existence hardening in `scripts/audit.mjs`, Ratchet-Advance lane.** New `schemaExportPresent(schemaSrc, name)` helper (regex `/^export const <name>\b/m`, word-boundary enforced) run over every `schema_exports` entry of every artifact with a `schema_file`. Audit fails red if the declared export is not actually `export const`'d from the named file. First run immediately caught real drift: `adapter.reference` claimed to export `AdapterReference` from `src/schemas/adapter.ts` but the identifier lives in `src/schemas/config.ts`. Fix: moved `AdapterReference` to `adapter.registry.schema_exports` (the artifact whose schema_file IS config.ts). +14 contract tests in `tests/contracts/artifact-authority.test.ts` — positive coverage across the repo plus 8 constructed-violation guards (substring rejection, re-export rejection, commented-out rejection, `export function` form rejection with v0.2 scope note, etc.). `scripts/audit.mjs` bottom `main()` invocation wrapped in `import.meta.url === file://${process.argv[1]}` guard so the helper is safely importable from tests (without the guard, importing the module shells out to `npm run verify` → vitest → re-import → fork bomb; observed in practice during slice authoring). `scripts/audit.d.mts` type declarations committed; `tsconfig.json` includes `scripts/**/*.d.mts`.
- **`specs/behavioral/{session-hygiene,prose-yaml-parity,cross-model-challenger}.md`** (v0.1, slice 10, **Ratchet-Advance lane**) — three behavioral tracks with real content (not placeholder prose). `session-hygiene.md` codifies SESSION-I1..I6: CLAUDE.md ≤300 lines, PROJECT_STATE freshness, compaction disabled, slices ≤30 min, citation rule, .circuit/ gitignore. `prose-yaml-parity.md` codifies PROSE-YAML-I1..I4: YAML is authority, prose regions are compiler-owned + delimited, one-direction authorship, SkillDescriptor projections. `cross-model-challenger.md` codifies CHALLENGER-I1..I6: objection list not approval, ratchet-changing surfaces only, recorded-not-conversational, explicit fold-in discipline, `/codex` not `codex:rescue`, cannot replace authority mapping/fixtures/differential tests. Each track names failure modes + planned test location + cross-references. `.gitkeep` removed.
- **`specs/contracts/skill.md`** (v0.1, slice 9, **Ratchet-Advance lane**) — Skill contract with SKILL-I1..I6 covering `skill.descriptor` (greenfield, compiled catalog projection). Closes the selection/adapter/skill dispatch-time triplet on the authoring side. Schema: `SkillDescriptor` wrapped with `descriptorOwnPropertyGuard.pipe(...)` for prototype-chain defense (SKILL-I6, mirrors CONT-I12/RUN MED #3); `.strict()` at descriptor boundary (SKILL-I5); closed `SkillDomain` enum with `domain-general` default (SKILL-I3); `capabilities` optional + non-empty when present (SKILL-I4); structurally-only `SkillId` brand with explicit nominal-not-runtime caveat (SKILL-I1). Codex cross-model adversarial pass: REJECT → ACCEPT after fold-in of 1 HIGH + 5 MED + 2 LOW with no deferrals. HIGH #1 (external-protocol vs greenfield confusion) reframed: `backing_paths` points to compiled catalog projection, not SKILL.md YAML; upstream CC frontmatter deferred to future `skill.frontmatter` (external-protocol) artifact. Full record at `specs/reviews/skill-md-v0.1-codex.md`. +18 contract tests across SKILL-I1..I6.
- **`specs/contracts/continuity.md`** (v0.1, slice 8, **Ratchet-Advance lane**) — Continuity contract with CONT-I1..I12 covering both `continuity.record` and `continuity.index` aggregates. `record_id` uses `ControlPlaneFileStem` (CONT-I1, path-safe primitive); new `ContinuityIndex` aggregate with `PendingRecordPointer` + `AttachedRunPointer` (CONT-I9..I11, closes index-aggregate HIGH); transitive `.strict()` at every depth (CONT-I8); safety-boolean non-contradiction via per-variant `.refine()` on `resume_contract` (CONT-I6 — closes pre-authoring carryover #7); run-attached provenance with `current_phase`+`current_step`+`runtime_status`+`runtime_updated_at` (CONT-I7 — closes pre-authoring carryover #8); raw-input own-property guards on `ContinuityRecord` + `ContinuityIndex` via `z.custom.pipe(...)` (CONT-I12 — closes Codex HIGH #1, prototype-chain defense mirroring `RunLog`). Authority-graph fix: `continuity.index.identity_fields=[]` (singleton) + `path_derived_fields=["pending_record.record_id"]` (dotted nested); `specs/artifacts.md` relaxation of the subset rule (closes Codex HIGH #2). Audit hardening: `DANGLING_REFERENCE_POLICIES` closed enum `[n/a, unknown-blocking, error-at-resolve, warn, allow]` validated by `scripts/audit.mjs`; `continuity.record=n/a`, `continuity.index=error-at-resolve` (closes Codex MED #5). LOW #6 coverage additions: string `schema_version: "1"` rejection on both record + index, `AttachedRunPointer` surplus-key rejection, pending-pointer path-separator + parent-traversal rejection. +37 contract tests (227 → 264). Full Codex record at `specs/reviews/continuity-md-v0.1-codex.md`. MED #3 (pointer-kind denormalization) + MED #4 (split-brain resolver precedence) scoped to v0.2 as resolver-level concerns with named Phase 2 property ids (`continuity.prop.index_pointer_kind_matches_record`, `continuity.prop.index_pointer_run_id_coherence`).
- **Slice 7 — Authority-Graph Gate (ADR-0003, Ratchet-Advance lane).** Artifact authority graph + `ControlPlaneFileStem` path-safe primitive + audit authority-graph dimension + contract-frontmatter `artifact_ids` binding + README/PROJECT_STATE phase-consistency audit + clean-break `successor-to-live` classification for continuity + reference characterization at `specs/reference/legacy-circuit/continuity-characterization.md`. Closes the pre-authoring structural failure mode: imagine-and-draft on a live surface without characterization.

- **`specs/contracts/adapter.md`** (v0.1, slice 6, **Ratchet-Advance lane**) — Adapter contract with ADAPTER-I1..I11. `BuiltInAdapter` closed 3-variant enum (`agent`/`codex`/`codex-isolated`) with declared semantic distinctions (same-process vs sandboxed isolation); `AdapterName` regex + `RESERVED_ADAPTER_NAMES` reservation set; `CustomAdapterDescriptor.command` tightened to `z.array(z.string().min(1)).min(1)` (element-level non-empty); `AdapterRef` stays the 3-variant pre-resolution union; `AdapterReference` in `config.ts` promoted from `z.union` to `z.discriminatedUnion` with per-variant `.strict()` AND exported (Codex MED #8). `DispatchResolutionSource` 5-variant discriminated union added; `DispatchStartedEvent.resolved_from` retyped from flat `z.enum` to the discriminated union — closes the category-only-provenance gap pre-emptively for `role`/`circuit` (same shape as SEL-I7). `DispatchConfigBody.strict()` + `DispatchConfig.superRefine` extended with reserved-name disjointness (ADAPTER-I2), own-property-only closure via `new Set(Object.keys(...))` (Codex HIGH #3 — blocks the `constructor`/`toString`/`hasOwnProperty` prototype-chain bypass), and registry-key ↔ descriptor-name parity (ADAPTER-I11 / Codex HIGH #2). `ResolvedAdapter` 2-variant discriminated union added (`BuiltInAdapterRef | CustomAdapterDescriptor`); `DispatchStartedEvent.adapter` retyped from `AdapterRef` to `ResolvedAdapter` — named references are pre-resolution pointers and MUST NOT appear in the event log (ADAPTER-I10 / Codex HIGH #1). `Event` discriminated union wrapped in cross-variant `superRefine` enforcing `role === resolved_from.role` binding when `resolved_from.source === 'role'` (ADAPTER-I7 binding / Codex HIGH #4) — mirrors the `Step` pattern for cross-field refinements on discriminated unions. Prose honesty fold-ins: post-condition `adapter`↔`resolved_from` agreement scoped to Phase 2 property (Codex HIGH #5); `{source: 'default'|'explicit'|'auto'}` explicitly singleton-at-v0.1 with v0.2 revisit rationale (Codex MED #6); auto-rationale claim removed (Codex MED #7); cwd/env/path semantics deferred to Phase 2 with property ids (Codex LOW #9). +56 contract tests (196 → 252). Codex cross-model adversarial property-auditor pass (2026-04-19): opening verdict REJECT → incorporated → ACCEPT. Full record at `specs/reviews/adapter-md-v0.1-codex.md`. All 5 HIGH + 3 MED + 1 LOW folded in directly; no Codex deferrals to v0.2.
- **`specs/contracts/selection.md`** (v0.1, slice 5, **Ratchet-Advance lane**) — Selection contract with SEL-I1..SEL-I9. `SELECTION_PRECEDENCE` 7-tuple + compile-time enum parity (`_compileTimeSelectionSourceParity`); `SelectionOverride.strict()` with JSON-safe `invocation_options` (recursive `JsonObject` schema: null|bool|finite-number|string|array|record; rejects functions, Dates, NaN, Infinity — Codex MED #10); `SkillOverride` 4-variant discriminated union with per-variant unique-skills refinement (Codex MED #8); `ResolvedSelection.strict()` now carries `invocation_options` (Codex HIGH #4 — flipped from v0.1 drafting because adapters consume invocation_options at dispatch time); discriminated-union `applied[]` entries with required `phase_id`/`step_id` on phase/step variants (Codex HIGH #1 + HIGH #2 — category-only-provenance + overlapping-phases attacks closed); `SelectionResolution.superRefine` enforces category-level precedence (SEL-I6), identity-keyed uniqueness (SEL-I7), and ghost-provenance rejection (`overrideContributes` predicate — Codex MED #7); `Phase.selection: SelectionOverride.optional()` closes phase.md v0.1 Codex MED #7; legacy `Workflow.default_skills` + `CircuitOverride.skills` channels removed (Codex HIGH #5 — every skill contribution now flows through typed `SkillOverride`); back-compat `SelectionPolicy` alias removed. +61 contract tests (135 → 196). Codex cross-model adversarial property-auditor pass (2026-04-19): opening verdict REJECT → incorporated → ACCEPT. Full record at `specs/reviews/selection-md-v0.1-codex.md`. Phase 2 property ids added: `selection.prop.resolved_matches_applied_composition` (HIGH #3 cache-vs-truth binding), `selection.prop.config_layer_precompose_is_right_biased` (HIGH #6), `selection.prop.overlapping_phase_composition_well_defined` (HIGH #2 composition layer), `selection.prop.resolved_skills_are_unique_and_order_is_documented` (MED #8 composition layer). Scalar tombstone semantics (MED #9) scoped to v0.2.
- **`specs/contracts/run.md`** (v0.1, slice 4, **Ratchet-Advance lane**) — Run contract with RUN-I1..RUN-I8. New aggregate schema `RunLog` (z.custom own-property guard piped into `z.array(Event).min(1).superRefine`) enforces: first-event-is-bootstrap, 0-based contiguous `sequence`, `run_id` consistency, bootstrap singleton, closure singleton with no-post-closure events. Defense-in-depth own-property guard on `run_id`/`kind`/`sequence` blocks prototype-chain smuggle (Codex MED #3). New aggregate `RunProjection` binds `RunLog` to `Snapshot` with exact `events_consumed === log.length` equality (Codex HIGH #2 closed — prefix snapshots rejected), bootstrap-frozen field parity (`run_id`, `workflow_id`, `manifest_hash`, `rigor`, `lane`, `invocation_id`), and a closure-to-status mapping made total by construction at compile time via `type ClosedSnapshotStatus = Exclude<SnapshotStatus, 'in_progress'>` + `OutcomeStatusEquality` bidirectional guard (Codex MED #6 closed). `.strict()` applied transitively across `LaneDeclaration` (6 variants), `AdapterRef` (3 variants), `CustomAdapterDescriptor`, `ProviderScopedModel`, `SkillOverride` (4 variants), `SelectionOverride`, `ResolvedSelection`, `SelectionResolution.applied[]` entries + all 11 event variants + `Snapshot` + `StepState` (Codex HIGH #1 + LOW #9 closed). `RunClosedOutcome` + `SnapshotStatus` promoted to exported enums. Lane equality reimplemented as structural field-by-field comparator (no JSON.stringify assumptions). +69 contract tests (65 → 134). Codex cross-model adversarial property-auditor pass completed — 2 HIGH + 5 MED + 3 LOW folded in (incorporated or honestly scoped to Phase 2 property ids: `run.prop.recorded_at_sanity`, `run.prop.close_outcome_semantic_adequacy`, `run.prop.boundary_own_property_defense`, `run.prop.projection_is_a_function`). Full record at `specs/reviews/run-md-v0.1-codex.md`.
- **`specs/contracts/phase.md`** (v0.1, slice 3) — Phase contract with PHASE-I1..I4: non-empty steps, `.strict()` surplus-key rejection, canonical-enum closure, and **spine policy enforcement** (MED #11). `Workflow.spine_policy` is now a required discriminated union: `mode: 'strict'` requires all 7 canonical phases; `mode: 'partial'` requires explicit `omits` + rationale ≥20 chars. Silent skip of `review` or `verify` is rejected at parse time. +14 contract tests (46 → 60).
- **`npm run audit`** — drift-visibility audit command (`scripts/audit.mjs`). Walks recent commits, checks 8 discipline dimensions (lane, framing triplet, citation rule, Circuit-smell, gitignore compliance, test ratchet, PROJECT_STATE freshness, verify gate). Exits non-zero on red. The enforcement mechanism ADR-0002 promised. First run: 8 green / 0 yellow / 0 red against HEAD.
- **ADR-0002** — *Bootstrap Discipline*: codifies that `circuit-next` is built via the existing Circuit as harness (classic bootstrap), with four rules against design contamination (citation rule, gitignore rule, harness-vs-template distinction, enforcement via audit). Closes the "Circuit does X" silent-justification risk.
- `.circuit/` added to `.gitignore` going forward; `phase-1-step-contract-authorship` run preserved via negative rule as historical audit trail of the first Phase 1 slice.
- `specs/contracts/step.md` authored (STEP-I1..STEP-I7; v0.1).
- Adversarial-review MED #7 (gate `source` as typed reference) **closed** — `Gate.source` is a typed discriminated union with literal `ref` per source kind; `.strict()` rejects surplus keys; `superRefine` adds `Object.hasOwn` + undefined defense-in-depth.
- Codex cross-model adversarial property-auditor pass completed against step.md/gate.ts/step.ts — 3 HIGH + 3 MED + 1 LOW incorporated (prototype-chain attack, cross-slot drift, optional-undefined, strict-mode prose, biome scope, project-state sync, TS exactness prose).
- `biome.json` ignores `.circuit/` (no more formatter writes against run state).

### Deferred to Phase 2 implementation

- Container isolation / distinct-UID sandbox
- `tests/properties/visible/` visible property tests
- `tests/properties/hidden/` hidden pool + opaque rotation
- Mutation testing gate
- Anti-Goodhart ratchet machinery (quarantine, versioned floors,
  fingerprinting, meta-ratchets)
- Solo-approval protocol for ratchet weakening
- Registry-lookup install wrapper (firewalled network)
- Plugin manifest at `.claude-plugin/plugin.json` + the plugin surface
  itself (commands, agents, hooks, skills, MCP)
- Any actual workflow implementation (no workflow runs yet; that's Phase 2+)

## The schemas — exact shape

All under `src/schemas/`. Every file has `<60 lines` where possible;
most are ~30-40.

| File | Exports | Purpose |
|---|---|---|
| `ids.ts` | `WorkflowId`, `PhaseId`, `StepId`, `RunId`, `InvocationId`, `SkillId`, `ProtocolId` | Branded IDs |
| `rigor.ts` | `Rigor`, `CONSEQUENTIAL_RIGORS`, `isConsequentialRigor` | 5-tier rigor enum |
| `role.ts` | `Role` (alias of `DispatchRole`) | Dispatch-only roles |
| `adapter.ts` | `BuiltInAdapter`, `RESERVED_ADAPTER_NAMES`, `AdapterName`, `AdapterRef`, `ResolvedAdapter`, `CustomAdapterDescriptor`, `DispatchResolutionSource` (all `.strict()`; slice 6 adds `ResolvedAdapter` split + `DispatchResolutionSource` disambiguated 5-variant union) | Adapter identity + dispatch-resolution provenance |
| `lane.ts` | `Lane`, `LaneDeclaration`, `MigrationEscrowLane`, `BreakGlassLane` (all variants `.strict()` via slice 4) | Lane framing |
| `gate.ts` | `Gate`, `SchemaSectionsGate`, `CheckpointSelectionGate`, `ResultVerdictGate` | Step gates |
| `skill.ts` | `SkillDescriptor` | Skill registry entry |
| `selection-policy.ts` | `SelectionOverride`, `ResolvedSelection`, `SelectionResolution`, `SkillOverride`, `ProviderScopedModel`, `Effort`, `SelectionSource`, `SELECTION_PRECEDENCE`, `AppliedEntry`, `JsonObject`, `_compileTimeSelectionSourceParity` (all `.strict()` via slice 4; slice 5 adds discriminated-union applied entries with phase_id/step_id disambiguators + ghost-provenance rejection + JSON-safe invocation_options + unique-skills refinement) | Per-layer selection + identity-keyed applied chain |
| `step.ts` | `Step` (discriminated union), `SynthesisStep`, `CheckpointStep`, `DispatchStep`, `DispatchRole`, `ArtifactRef` | Step variants |
| `phase.ts` | `Phase`, `CanonicalPhase`, `SpinePolicy` | Phase spine |
| `workflow.ts` | `Workflow`, `EntryMode`, `EntrySignals` | Workflow definition + graph closure |
| `event.ts` | `Event` (discriminated union, 11 kinds, each `.strict()`), `RunClosedOutcome` | Append-only event log |
| `snapshot.ts` | `Snapshot`, `StepState`, `StepStatus`, `SnapshotStatus` (all `.strict()`) | Derived state |
| `run.ts` | `RunLog`, `RunProjection` (slice 4, Phase 1) | Run aggregate + log-to-snapshot projection binding |
| `config.ts` | `Config`, `DispatchConfig`, `AdapterReference` (exported via slice 6), `LayeredConfig`, `ConfigLayer`, `CircuitOverride` | User/project/invocation config |
| `continuity.ts` | `ContinuityRecord` (discriminated union), `StandaloneContinuity`, `RunBackedContinuity`, `GitState`, `ContinuityNarrative` | Cross-session handoff |

All are re-exported through `src/schemas/index.ts` and `src/index.ts`.

## Contract tests

`tests/contracts/schema-parity.test.ts` — 46 contract tests (baseline 34
after overnight, +12 from the Phase 1 step-contract slice covering gate-
source literals, strict-mode surplus-key rejection, prototype-chain +
cross-slot drift rejection). Plus 1 smoke test at `tests/unit/smoke.test.ts`.
Each test encodes one invariant from `specs/evidence.md` or the landed
contracts. Notable ones:

- Rigor rejects unknown tiers
- `isConsequentialRigor` includes `autonomous` (adversarial-review fix)
- Role rejects `orchestrator` (executor, not a dispatch role)
- Migration-escrow lane requires expiry + restoration plan
- Break-glass lane requires post-hoc ADR deadline
- Step discriminated union rejects orchestrator+dispatch, worker without role, mismatched gate kinds
- Workflow graph rejects dangling entry_modes.start_at, phase-step refs, route targets, duplicate step ids
- Event log requires lane on bootstrap
- Snapshot requires lane + manifest_hash
- DispatchConfig validates adapter-name closure (named adapter must be in `dispatch.adapters`)
- Continuity record enforces standalone vs run-backed discriminants

`tests/unit/smoke.test.ts` — one smoke test.

## Run-state pointers

- External-evidence Explore run: `.circuit/circuit-runs/external-prior-art-evidence-pass-survey-academic-f/`
  - `artifacts/brief.md`, `artifacts/analysis.md`
  - `phases/analyze-ext/external-evidence.md` (Claude, 287 lines, 51 sources)
  - `phases/analyze-cdx/external-evidence.md` (Codex, 160 lines, 41 sources)
- Phase 0 internal-evidence Explore run: `.circuit/circuit-runs/phase-0-evidence-loop-for-circuit-next-blind-cross/`
  - `artifacts/brief.md`
  - `phases/analyze-int-claude/prompt.md` (prompt)
  - `phases/analyze-int-codex/prompt.md` (prompt)
  - `phases/adversarial-review/prompt.md` (prompt for Codex skeleton review)
- Tournament methodology artifacts: `.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/` (symlinked under `specs/methodology/`)

## Invocation id

This overnight run chains to invocation id `inv_ec9c950f-6044-4799-a293-e514fcb95656` from the `/circuit:run` directive that started the session.

## Open questions

1. **Next contract: `continuity.md` or `skill.md`?** `continuity.md` governs cross-session handoff records (invoked by every resume); the shape is already live in `src/schemas/continuity.ts` and `.circuit/control-plane/continuity-records/` — a contract there closes the remaining cross-session resume semantics. `skill.md` is less densely constrained but is load-bearing for the catalog compiler. Recommended: `continuity.md` next — the resume path is the first thing operators hit and the current schema is mature enough to author invariants against.
2. **Default-layer provenance promotion (adapter.md v0.2, Codex MED #6 deferral).** Should `{source: 'default'}` carry the `ConfigLayer` that contributed the winning default (user-global/project/invocation)? v0.1 scopes this as singleton-by-design. v0.2 decides driven by audit needs; if operators need to answer "which config layer's default actually won", add the disambiguator.
3. **Auto-resolution rationale (adapter.md v0.2, Codex MED #7 deferral).** Should `{source: 'auto'}` be promoted to `{source: 'auto', heuristic_id, rationale}`? Currently forbidden by `.strict()`; the Phase 2 auto-detect heuristic does not exist yet. Landing this requires the heuristic to exist AND the event to be replay-sufficient for auto-picked adapters.
4. **Phase 2 property harness location.** Deferred property ids now span five contracts: run (4 props), phase (4 props), selection (6 props), adapter (5 props — `resolution_is_total_and_first_match_wins`, `resolved_from_agrees_with_resolution`, `registry_closure_preserved_under_config_merge`, `custom_command_direct_exec_semantics`, `reserved_name_disjointness_across_layer_merge`). All need `tests/properties/visible/` per CLAUDE.md §Where things live. Not blocking Phase 1 authorship, but Phase 2 setup cost grows with each slice.
5. **Scalar tombstone semantics** (selection.md v0.1 Codex MED #9 deferred to v0.2). Should `SelectionOverride` allow explicit reset of `model`/`effort`/`rigor` to adapter-default? Skills have `{mode: 'replace', skills: []}` as the clear op; scalars have no analog. Adding a tombstone sentinel is a material design change and should be evidence-driven.

### Resolved this session

- ~~Start Phase 1 with step.md or run.md?~~ → step.md landed first; gate.source tightening (MED #7) folded in.
- ~~Accept the type skeleton as-is, or rerun adversarial review?~~ → Rerun happened inside the step.md slice (Codex read the tightened schema + new contract + tests); 3 HIGH + 3 MED + 1 LOW incorporated.
- ~~Spine policy (MED #11)?~~ → Closed in phase.md v0.1 via `Workflow.spine_policy` discriminated union.
- ~~Run contract (run.md)?~~ → Closed in run.md v0.1. All 10 Codex objections either incorporated or converted to Phase 2 property ids with explicit rationale.
- ~~Selection contract (selection.md)?~~ → Closed in selection.md v0.1. Codex opening verdict REJECT → ACCEPT after fold-in (6 HIGH + 4/5 MED + 1 LOW incorporated; MED #9 deferred to v0.2 with rationale). Closes phase.md v0.1 Codex MED #7 via SEL-I9.
- ~~Phase-level selection design: explicit field or canonical-conditional derivation?~~ → Closed in selection.md v0.1 SEL-I9 (explicit `Phase.selection: SelectionOverride.optional()`, symmetric with Step and Workflow). Canonical-conditional remains a v0.2 consideration if evidence justifies.
- ~~Next contract: adapter.md or continuity.md?~~ → adapter.md landed. Codex REJECT → ACCEPT after fold-in (5 HIGH + 3 MED + 1 LOW all incorporated; no deferrals). Introduces `ResolvedAdapter` split from `AdapterRef`, registry-key/descriptor-name parity, own-property-only closure checks, role ↔ resolved_from.role binding.
- ~~Keep `agent` as a built-in adapter alias?~~ → Closed in adapter.md v0.1 ADAPTER-I1: `agent`, `codex`, and `codex-isolated` are three distinct built-ins with declared semantic roles (same-process Anthropic subagent; same-process Codex CLI; sandboxed/worktree Codex CLI). Not interchangeable; choosing between `codex` and `codex-isolated` is a correctness-of-isolation decision. Adversarial-review note that `codex-isolated` is "the real name" and `codex` is an alias is REJECTED — they are semantically distinct isolation regimes.

## If something is wrong

If `npm run verify` fails when you wake up, that's a high-priority signal.
The architecture is not structurally sound. Possible reasons:
- A schema file got corrupted (unlikely — git tracks everything)
- Node version mismatch (requires `>=20`; check `node -v`)
- A background process wrote something unexpected (check `git status`)

If evidence drafts look wrong or missed something material, the full source
traces are in the Run directories (see above). Workers cited everything with
file:line paths or URLs.

## Methodology trace

This bootstrap is itself an exercise of the methodology. You can audit it:

- **Contract-first**: schemas + contract tests authored before any runtime code.
- **Tiny-step ratcheting**: two commits so far — scaffold, then hardened skeleton. Each is reversible. Next commit will add contract stubs + final PROJECT_STATE.md.
- **Architecture-first**: `tsc --strict` is the compiler ratchet; 34 negative tests encode the invariants the methodology asks for.
- **Narrow cross-model challenger**: Codex reviewed the type skeleton exactly once, produced an objection list (not approval), operator (me) decided what to incorporate vs defer. Knight-Leveson Swiss-cheese, not independent corroboration.

Every lane declaration is still implicit (Tier 0 scaffold work is
Discovery-lane). Phase 1 contract authorship should begin with an explicit
Ratchet-Advance lane declaration in the commit for the first contract.
