---
contract_target: skill
contract_version: 0.1
reviewer_model: gpt-5-codex via codex exec
review_kind: adversarial property-auditor
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT (all objections folded into v0.1)
authored_by: operator + claude-opus-4-7
---

# skill.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/skill.md` v0.1 + `src/schemas/skill.ts` + the
`SkillDescriptor` portion of `tests/contracts/schema-parity.test.ts`.
The reviewer's task was an **objection list**, not approval.

## Verdict chain

`REJECT → incorporated → ACCEPT (all objections folded in)`

1 HIGH + 5 MED + 2 LOW. All 8 folded into v0.1. No deferrals to v0.2.

## Objection list (as returned by Codex)

**1. HIGH — `skill.descriptor` not honestly greenfield if backed by
Claude Code `SKILL.md` frontmatter.** Attack: the contract claimed
greenfield but `backing_paths` listed
`<plugin>/skills/<skill-id>/SKILL.md (YAML frontmatter)`, which is an
external CC-plugin protocol. The field sets diverge (`name` vs `id`,
no `title` upstream, no `capabilities`/`domain` upstream). ADR-0003
defines `external-protocol` for exactly this case. Not v0.2-scopable —
ADR-0003 requires honest classification before the contract is accepted.

**Incorporated in v0.1 by reframing.** `skill.descriptor` governs the
compiled catalog OUTPUT, not the upstream SKILL.md INPUT. Changes:
- `backing_paths` updated to
  `<plugin>/catalog/skills.json (compiled catalog projection, one
  SkillDescriptor per skill)`.
- Contract prose explicitly disclaims the SKILL.md binding: "The
  descriptor is NOT the Claude Code SKILL.md YAML frontmatter. CC's
  frontmatter is an external-protocol INPUT to the catalog compiler;
  this contract governs the compiler's internal OUTPUT shape."
- New v0.2 reopen condition: introduce a separate `skill.frontmatter`
  artifact (external-protocol) for the CC-side input shape if/when the
  catalog compiler lands.
- Schema JSDoc updated to match.

**2. MED — Catalog closure overclaimed in post-condition.** Attack: the
contract said accepted `id` is "safe to use as an identity key against
`SelectionOverride.skills[]`", but neither `SkillDescriptor.safeParse`
nor `SelectionOverride.safeParse` validates existence closure. Only
structural shape agreement is proven.

**Incorporated in v0.1.** Post-condition reworded: "`id` has the same
**structural** `SkillId` shape as `SelectionOverride.skills[]`; the two
agree on id FORMAT. **Existence closure** ... is NOT proven by
`SkillDescriptor.safeParse` or `SelectionOverride.safeParse`. That is
catalog-compiler work and is reserved as Phase 2 property
`skill.prop.id_closure_under_selection`."

**3. MED — `trigger` free-form while already treated as resolver
input.** Attack: if a selection resolver ever tokenizes `trigger`,
free-form prose becomes hidden policy.

**Incorporated in v0.1.** New scope caveat on SKILL-I2: "In v0.1,
`trigger` is opaque prose. **No deterministic runtime resolver may
parse its syntax.**" v0.2 reopen conditions expanded to name: (a) any
runtime resolver code branches on `trigger` syntax; (b) selection
accuracy data motivates structured grammar; (c) build-time NLP cost
becomes a bottleneck.

**4. MED — `capabilities?: non-empty[]` preserves ambiguity.** Attack:
rejecting `[]` while allowing omission still doesn't distinguish "no
capabilities declared" from "author forgot."

**Incorporated in v0.1.** SKILL-I4 prose tightened from "claims no
capabilities" to "omission means capabilities are **not declared**. It
does NOT mean the skill has no capabilities." Also added a semantic-
asymmetry note comparing to `SelectionOverride.skills` where `[]` is
meaningful under non-`inherit` modes.

**5. MED — `SkillId` brand prose overstates runtime separation.**
Attack: the contract said the brand prevents accidental substitution,
but all four id brands share the same regex. Brands are TypeScript-only
after parse.

**Incorporated in v0.1.** SKILL-I1 adds an explicit "Brand scope
caveat": "`SkillId` is TypeScript-nominal only: it shares the runtime
regex with `WorkflowId`, `PhaseId`, and `StepId`. ... the regex itself
does NOT distinguish them ... JSON, YAML, and explicit casts erase the
brand."

**6. MED — Required descriptor fields can be satisfied through the
prototype chain.** Attack: `.strict()` rejects surplus own keys but
Zod reads inherited required fields during parse. Same attack surface
as continuity CONT-I12 and run RUN MED #3.

**Incorporated in v0.1.** New invariant SKILL-I6 added. `z.custom`
pre-parse guard wraps `SkillDescriptor` (`descriptorOwnPropertyGuard
.pipe(SkillDescriptorBody)`) and rejects inherited `id`, `title`,
`description`, `trigger`. Four negative tests added using
`Object.create(...)` per field.

**7. LOW — Code comment mislabels SKILL-I4 as SKILL-I5.** Evidence:
`src/schemas/skill.ts` capabilities JSDoc said "SKILL-I5 —
capabilities," but capabilities is SKILL-I4.

**Incorporated in v0.1.** Comment corrected in schema rewrite; also
SKILL-I6 added with its own comment for the own-property guard.

**8. LOW — Evolution missing realistic reopen conditions.** Attack:
v0.2 only named repeated extension need, trigger cost, and unresolved-
skill bugs. Missed: CC frontmatter mismatch, catalog compiler shipping,
resolver branching on `trigger`, `capabilities` becoming routing input.

**Incorporated in v0.1.** v0.2 section expanded with four explicit
reopen-condition entries: typed extension slots, structured trigger
(with three sub-conditions), catalog-level closure property, upstream
SKILL.md mapping contract, and `capabilities` as resolver/filter
input.

## Fold-in discipline

Every Codex objection closed in v0.1 at the appropriate layer:
- Schema changes: SKILL-I6 own-property guard on `SkillDescriptor`
  (via `descriptorOwnPropertyGuard.pipe(SkillDescriptorBody)`).
- Authority-graph changes: `skill.descriptor.backing_paths` moved from
  SKILL.md to compiled catalog file.
- Prose changes: HIGH #1 reframe, MED #2 post-condition narrowing,
  MED #3 scope caveat on trigger, MED #4 tightened capabilities
  semantics, MED #5 brand scope caveat, LOW #8 expanded v0.2 reopen
  conditions.
- Comment fix: LOW #7 (SKILL-I5 → SKILL-I4 label correction folded
  into schema rewrite).
- Tests: +4 own-property guard tests for SKILL-I6.

No Codex objection deferred to v0.2. No silent post-condition changes.

## Verification

Post-fold-in: `npm run verify` green; `npm run audit` 10 green / 0
yellow / 0 red. SkillDescriptor test count rose by +18 from pre-Slice-9
baseline (new SKILL-I1..I6 coverage).
