---
contract_target: selection
contract_version: 0.1
reviewer_model: gpt-5.1 via codex exec (codex-cli 0.118.0)
review_kind: adversarial property-auditor
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT (after fold-in)
authored_by: operator + claude-opus-4-7
---

# selection.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/selection.md` v0.1 + `src/schemas/selection-policy.ts`
+ the schema extension at `src/schemas/phase.ts` (`Phase.selection`). The
reviewer's task was an **objection list**, not approval; incorporation
decisions were made by the operator per the narrow-cross-model-challenger
protocol (Knight-Leveson Swiss-cheese, not independent corroboration).

## Verdict chain

`REJECT → incorporated → ACCEPT (after fold-in)`

The reviewer's opening verdict was REJECT — not on syntax, but on
"identity and binding": the category-only provenance trace cannot
identify the concrete contributing layer, cannot represent overlapping
phase selections, and does not bind `resolved` to the claimed source of
truth.

All 6 HIGH and 5 MED objections are either incorporated into v0.1 before
commit (schema + prose tightening) or honestly scoped to Phase 2 property
ids / v0.2 evolution with rationale. The 1 LOW is prose-only.

## Objection list (as returned by Codex)

**1. HIGH — Category-only provenance is not independently auditable.**
Attack: `SelectionResolution.applied[]` entries are only `{source,
override}`. `source: 'phase'` does not name WHICH phase, `source: 'step'`
does not name which step. The contract claims the chain is independently
auditable; it is not. A workflow can have many phases and many steps
each carrying selection; a `source: 'phase'` entry points at no concrete
field.

**Incorporated in v0.1.** `applied[]` is now a discriminated union on
`source`. The `phase` and `step` variants require `phase_id: PhaseId`
and `step_id: StepId` respectively. The config-layer variants (default,
user-global, project, invocation) and the `workflow` variant stay
singleton-identified by their source label, because (a) there is one
contributing instance per run, and (b) intra-layer provenance within a
config file is pre-composed (see HIGH #6 fold-in). SEL-I7 is
correspondingly relaxed: duplicate-source rejection is now keyed on
*identity* (source + disambiguator where required), not bare source.

**2. HIGH — Multiple applicable phase selections cannot be represented.**
Attack: Two phases can legally list the same step (the "every step has
exactly one phase" property is explicitly deferred to Phase 2 per
`phase.md` reserved properties). If both phases carry `selection`, both
are applicable, but SEL-I7 under the v0.1 drafting forbade two `phase`
entries.

**Incorporated in v0.1** via the same discriminated-union fold-in for
HIGH #1. An applied chain with two distinct `phase` entries (different
`phase_id`s) is now legal. Overlapping-phase *composition* semantics
(which phase's override wins when both apply to the same step) is
reducer-level and scoped to the Phase 2 property
`selection.prop.overlapping_phase_composition_well_defined`.

**3. HIGH — `resolved` can contradict `applied` while still parsing.**
Attack: The schema validates order and uniqueness but does NOT bind
`resolved` to `applied`. A resolution with `resolved.effort: 'high'`
paired with an applied chain whose only override sets `effort: 'low'`
parses. The contract's post-conditions prose ("Every field in resolved
either matches the last non-empty contributor") overclaims what the
schema enforces.

**Incorporated in v0.1** by tightening post-condition prose to
explicitly scope the binding check to Phase 2. The post-condition now
reads: "This is the Phase 2 property
`selection.prop.resolved_matches_applied_composition`; the v0.1 schema
does NOT enforce consistency between `resolved` and `applied`." Same
honesty discipline as RUN-I6's caveats.

**4. HIGH — Invocation options disappear from the dispatch audit
surface.** Attack: `invocation_options` was intentionally excluded from
`ResolvedSelection` in v0.1 drafting (framed as "per-layer metadata,
not effective state"). But adapters consume invocation_options at
dispatch time; two runs with different invocation_options but identical
model/effort/skills/rigor produce different adapter behavior with
indistinguishable `DispatchStartedEvent`s. The event log becomes
insufficient for audit and replay.

**Incorporated in v0.1.** `ResolvedSelection` now carries
`invocation_options: JsonObject`. SEL-I5's framing is flipped:
invocation_options ARE effective-state data at dispatch time; per-layer
invocation_options live in `applied[i].override.invocation_options`;
the merge (right-biased by precedence) produces the resolved
invocation_options. `DispatchStartedEvent.resolved_selection` picks up
the field transitively.

**5. HIGH — Legacy skill channels bypass `SkillOverride`.** Attack:
`Workflow.default_skills: SkillId[]` and
`Config.circuits[*].skills: string[]` (not even `SkillId`) are untyped
skill arrays that bypass the `SkillOverride` discipline the contract
claims closes skill-override ambiguity. The config channel is worse —
it accepts arbitrary strings.

**Incorporated in v0.1.** Both channels are removed. `Workflow.default_skills`
→ express seed skill set via `Workflow.default_selection.skills = {mode:
'replace', skills: [...]}`. `CircuitOverride.skills` → same treatment
inside `CircuitOverride.selection.skills`. Pre-release, no external
consumers (CLAUDE.md bias against legacy support). Schema migration is
a delete, not a rewrite.

**6. HIGH — Config-layer selection has unspecified intra-layer
precedence.** Attack: `Config.defaults.selection` and
`Config.circuits[workflow].selection` both live inside the same config
file (project or user-global). The applied trace has ONE `project` entry
and SEL-I7 forbids duplicates. The contract never defines whether
circuit-specific config is pre-composed, becomes a `workflow` entry, or
gets its own source.

**Incorporated in v0.1** as a documented pre-compose semantics.
`Config.circuits[workflow_id].selection` is merged INTO
`Config.defaults.selection` within the SAME config layer (right-biased
by specificity: circuit-specific wins) BEFORE that merged override
enters the applied chain. The chain gets one entry with `source:
'project'` (or `'user-global'`) carrying the merged result. Intra-layer
provenance within a config file is lost at the chain level; it's a
visible scope caveat in SEL-I1 and a Phase 2 property
(`selection.prop.config_layer_precompose_is_right_biased`).

**7. MED — Empty overrides create ghost provenance.** Attack:
`SelectionOverride.safeParse({})` succeeds and the v0.1 tests explicitly
accept chains of empty overrides. But the contract defines `applied` as
the trace of layers that "contributed". An empty override contributes
nothing; admitting it fabricates provenance.

**Incorporated in v0.1.** `SelectionResolution.superRefine` now
rejects applied entries whose override is "empty" (all fields at
schema defaults: no model, no effort, no rigor, `skills: {mode:
'inherit'}`, `invocation_options: {}`). The predicate
`overrideContributes` is defined in-schema; tests include the ghost-
provenance adversarial case from the review.

**8. MED — Skill "set algebra" uses arrays without uniqueness or
order semantics.** Attack: The contract claims set-algebra composition
but accepts duplicate skills in both `SkillOverride.skills` and
`ResolvedSelection.skills`. Set has uniqueness; array has order;
neither canonical rule is documented.

**Incorporated in v0.1.** Skill arrays in `SkillOverride` (all three
non-`inherit` variants) and `ResolvedSelection` now `.refine` to
reject duplicates at parse time. Canonical *order* is reducer-level
(the resolver can preserve authored order within each layer + append
order across layers); bit-equality against a sorted order is tracked
as Phase 2 property `selection.prop.resolved_skills_are_unique_and_
order_is_documented`.

**9. MED — No reset/tombstone semantics for scalar fields.** Attack:
Skills have `{mode: 'replace', skills: []}` to clear back to empty.
Scalars (model, effort, rigor) and invocation_options have no reset;
once a lower layer sets them, a higher layer can only override with a
different value or inherit.

**Scoped to v0.2** with explicit rationale in Evolution. Adding
tombstone sentinels is a material design change (adds a second
"null-like" value to every scalar type) and should be driven by
evidence from real workflows. The contract now names the gap; v0.2
will decide.

**10. MED — `invocation_options` accepts non-JSON runtime values.**
Attack: Pre-condition says overrides come from YAML/TOML/JSON, but
`z.record(z.unknown())` accepts functions, Dates, undefined, and
symbols. Those cannot be authored in those formats and may not
serialize/replay.

**Incorporated in v0.1.** `invocation_options` is now typed as
`JsonObject` — a recursive schema admitting only null, boolean, number,
finite-safe, string, arrays of JSON, records of JSON. Negative tests
cover functions, Dates, undefined, and NaN.

**11. MED — Domain vocabulary contradicts the schema split.**
Attack: `domain.md` defines "Resolved selection" as recording `applied`,
but `ResolvedSelection` does not; `SelectionResolution` does.
`SelectionResolution` is missing from the glossary.

**Incorporated in v0.1.** `specs/domain.md` now clearly separates
**Resolved selection** (= `ResolvedSelection`, the effective record)
from **Selection resolution** (= `SelectionResolution`, the pair
`{resolved, applied}` with provenance).

**12. LOW — SEL-I9 is claimed enforced in the wrong place.** Attack:
The invariants preamble says "all invariants are enforced via
`src/schemas/selection-policy.ts`". SEL-I9 is enforced in
`src/schemas/phase.ts`. The preamble over-claims.

**Incorporated in v0.1.** The preamble now reads: "All invariants are
enforced via `src/schemas/selection-policy.ts` and — for the
cross-schema invariants — the schema files named per invariant; tested
in `tests/contracts/schema-parity.test.ts`." SEL-I9's enforcement
location is explicitly `src/schemas/phase.ts`.

## Missing negative tests identified by review

The reviewer flagged these as gaps in v0.1 test coverage:

- `resolved` contradicting `applied` — NOT added as a test (schema-
  level scope admission per HIGH #3; Phase 2 property).
- `source: 'phase'` without identifiable phase declaration — ADDED:
  applied entry with `source: 'phase'` now requires `phase_id` at the
  schema layer; tests cover the missing-phase_id case.
- Duplicate skill ids — ADDED: tests for `SkillOverride.safeParse({mode:
  'replace', skills: ['tdd', 'tdd']})` and
  `ResolvedSelection.safeParse({skills: ['tdd', 'tdd']})` both reject.
- Conflicts between `default_skills` and `default_selection.skills` —
  closed by HIGH #5 removing `default_skills` entirely.
- Conflicts between `Config.defaults.selection` and
  `CircuitOverride.selection` — scoped by HIGH #6 pre-compose
  semantics. Not a runtime error, a documented composition rule.
- Non-JSON `invocation_options` — ADDED: negative tests for functions,
  Dates, undefined, NaN.
- Overlapping phases with competing selections — schema admits the
  pattern (HIGH #2 fold-in); composition semantics scoped to Phase 2
  property.

## Fold-in discipline

Each incorporated fix is cross-referenced in `specs/contracts/selection.md`
v0.1 by the HIGH/MED number. `Evolution` section v0.1 notes the full
verdict chain. Phase 2 property ids added:
- `selection.prop.overlapping_phase_composition_well_defined` (HIGH #2)
- `selection.prop.config_layer_precompose_is_right_biased` (HIGH #6)
- `selection.prop.resolved_skills_are_unique_and_order_is_documented`
  (MED #8)

The scalar-tombstone design decision (MED #9) is v0.2 scope; named in
Evolution with rationale for deferral.
