---
contract_target: adapter
contract_version: 0.1
reviewer_model: gpt-5-codex via codex exec
review_kind: adversarial property-auditor
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT (after fold-in)
authored_by: operator + claude-opus-4-7
---

# adapter.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/adapter.md` v0.1 + `src/schemas/adapter.ts` +
`src/schemas/config.ts` (dispatch surface) + `src/schemas/event.ts`
(`DispatchStartedEvent.adapter` + `.resolved_from` retype). The
reviewer's task was an **objection list**, not approval; incorporation
decisions were made by the operator per the narrow-cross-model-challenger
protocol (Knight-Leveson Swiss-cheese, not independent corroboration).

## Verdict chain

`REJECT → incorporated → ACCEPT (after fold-in)`

The reviewer's opening verdict was REJECT on "identity binding": the
contract claimed registry closure, fully-resolved dispatch events, and
audit-sufficient provenance, but the schemas still admitted (a) named
references in the event log, (b) registry-key ↔ descriptor-name
divergence, (c) `constructor`/`toString` prototype-chain closure
bypasses, (d) role vs `resolved_from.role` contradiction, and (e) a
post-condition that overclaimed agreement between `adapter` and
`resolved_from`.

All 5 HIGH + 3 MED + 1 LOW objections are incorporated into v0.1 before
commit (schema fixes + prose tightening).

## Objection list (as returned by Codex)

**1. HIGH — `DispatchStartedEvent.adapter` can still be an unresolved
named reference.** Attack: `adapter: AdapterRef` admits `{kind: 'named',
name: 'gemini'}`; the tests even accept that shape for `AdapterRef`.
An event with an unresolved named reference is not an executor record
and is not replay-sufficient; the post-condition "fully-resolved, not a
reference" is overclaimed by the schema.

**Incorporated in v0.1.** `ResolvedAdapter` added to
`src/schemas/adapter.ts` as a 2-variant discriminated union
(`BuiltInAdapterRef | CustomAdapterDescriptor`).
`DispatchStartedEvent.adapter` retyped from `AdapterRef` to
`ResolvedAdapter`. ADAPTER-I10 is the new owning invariant. Tests for
the ResolvedAdapter type itself + a negative test for `adapter.kind ===
'named'` in the event layer. The `NamedAdapterRef` variant stays on
`AdapterRef` for CLI / config parsing, where pre-resolution pointers
are legal.

**2. HIGH — Registry key and descriptor `name` can diverge.** Attack:
`dispatch.adapters: {gemini: {name: 'ollama', command: [...]}}` parses
— both `gemini` and `ollama` satisfy `AdapterName`. The "registered
exactly once and referenced by name" rule is violated by the two
concurrent identities (registry key vs emitted descriptor name), and
the audit index cannot cross-reference events to the config entry.

**Incorporated in v0.1.** `DispatchConfig.superRefine` extended with
per-entry check: for every `adapters[key]`, assert `descriptor.name ===
key`. Mismatch fails parse at path `['adapters', key, 'name']` with a
clear error. ADAPTER-I11 is the new owning invariant. Negative test
for the divergence + positive test for the matching case.

**3. HIGH — Registry closure has an own-property bypass via
`constructor`.** Attack: `AdapterName`'s regex (`^[a-z][a-z0-9-]*$`)
admits `constructor`, `toString`, `hasOwnProperty`, `__proto__` (wait —
`__proto__` has an underscore, rejected). The closure check used
bracket access: `!cfg.adapters[ref.name]`. On a parsed record,
`cfg.adapters.constructor` resolves through the prototype chain to
`Object.prototype.constructor` (truthy), so a role reference to
`constructor` with an empty `adapters: {}` evades the missing-registry
check.

**Incorporated in v0.1.** `DispatchConfig.superRefine` rewritten to
build `const registered = new Set(Object.keys(cfg.adapters))` and
check membership via `registered.has(...)` — `Object.keys` returns
only own enumerable string keys, and `Set.prototype.has` does not
consult the prototype chain of the set's keys. The `cfg.default`
closure check uses the same set. Negative tests for role, circuit, and
`default` referencing `constructor`, `toString`, and `hasOwnProperty`
with empty registries.

**4. HIGH — Role provenance can contradict the event's own role.**
Attack: `DispatchStartedEvent` carries `role: DispatchRole` and
`resolved_from: DispatchResolutionSource`. The `role` variant of
`DispatchResolutionSource` independently carries `role: DispatchRole`.
Nothing binds the two. An event with `role: 'researcher'` and
`resolved_from: {source: 'role', role: 'reviewer'}` parses successfully
and reports "dispatched as researcher because the reviewer role config
won" — incoherent provenance.

**Incorporated in v0.1.** The `Event` discriminated union wrapped in a
cross-variant `superRefine` that — for `ev.kind === 'dispatch.started'`
and `ev.resolved_from.source === 'role'` — requires `ev.resolved_from.role
=== ev.role`. Refinement hoisted to the union level (not the variant)
because `z.discriminatedUnion` cannot admit `ZodEffects` members;
mirrors the `Step` pattern where the gate↔writes cross-field check
lives on the union. Negative test for the contradiction + positive
test for the matching case + positive test that the binding only
applies when `source === 'role'`.

**5. HIGH — The event post-condition overclaims adapter/provenance
agreement.** Attack: The contract stated that `(adapter,
resolved_from)` is audit-sufficient and lets an auditor reconstruct
which config file entry chose the adapter. But the schema only
validates the two fields independently; nothing rejects an event with
`resolved_from: {source: 'circuit', workflow_id: 'explore'}` paired
with an adapter that, per the actual resolver, came from a role
override. Property-id `adapter.prop.resolved_from_agrees_with_
resolution` already acknowledges this is resolver-level work, but the
post-condition was worded as if schema acceptance proved it now.

**Incorporated in v0.1** by narrowing the post-condition prose. The
post-condition now explicitly says: "v0.1 validates shape, not
resolver agreement; `adapter`↔`resolved_from` binding is Phase 2
property `adapter.prop.resolved_from_agrees_with_resolution`." Same
honesty discipline as RUN-I6's `projection_is_a_function` caveat and
SEL-HIGH #3's `resolved_matches_applied_composition` caveat.

**6. MED — `default` and `explicit` provenance remain category-only
under config layering.** Attack: ADAPTER-I7 says the resolution source
carries "the disambiguator identifying which entry within the category
contributed." But `{source: 'default'}` and `{source: 'explicit'}`
carry no disambiguator. In a layered config model, multiple `default`
entries exist pre-merge (user-global, project, invocation); the event
cannot say which layer's default won. The prose "the exact config file
entry" is not true for those two categories.

**Incorporated in v0.1** by narrowing the prose. A "Scope caveat"
paragraph in ADAPTER-I7 now explicitly states that the `default`,
`explicit`, and `auto` variants are singleton-at-v0.1 by design, with
rationale: `default` loses intra-merge layer provenance (the merged
Config is a single value); `explicit` is recoverable from the
invocation event elsewhere in the run log; `auto` has no heuristic
yet (Phase 2). v0.2 revisits based on real audit needs. The contract
no longer claims those three identify the specific contributing layer
or heuristic branch.

**7. MED — Auto rationale is promised and then structurally
forbidden.** Attack: ADAPTER-I7 prose said auto selection "records the
selection-rationale at runtime." The auto variant of
`DispatchResolutionSource` is only `{source: 'auto'}`, and the test
suite rejects `reason` or `rationale` as surplus keys on it. The prose
claim is structurally unachievable.

**Incorporated in v0.1.** ADAPTER-I7 prose updated to remove the
"selection-rationale is recorded" claim — the auto variant is now
described as "the Phase 2 heuristic selects" with no runtime-rationale
claim. The Evolution section's v0.2 list adds "decide whether
`{source: 'auto', heuristic_id, rationale}` should be promoted" with
rationale that it requires the heuristic to actually exist first.

**8. MED — The load-bearing `AdapterReference` parser is not
exported.** Attack: The contract treated `AdapterReference` as a
"registry-layer reference that refuses inline custom descriptors" —
an independently-rejected runtime surface. But in code, only the
inferred TypeScript type was exported; the Zod parser was a file-local
`const`. A future caller that needs to validate a registry-layer
reference cannot import the parser and may reach for `AdapterRef`,
which admits inline custom descriptors — silently relaxing ADAPTER-I5.

**Incorporated in v0.1.** `AdapterReference` is now `export const`,
re-exported through `src/schemas/index.ts` (wildcard), and has direct
contract tests covering: accepts builtin variant, accepts named
variant, rejects inline custom variant (ADAPTER-I5), rejects surplus
keys.

**9. LOW — Custom command execution semantics leave cwd/env as ambient
folklore.** Attack: ADAPTER-I3 specified direct exec + appended
PROMPT_FILE/OUTPUT_FILE arguments but did not say anything about cwd,
environment inheritance, PATH resolution for relative `command[0]`,
timeouts, or stdin. Built-ins got explicit isolation prose; custom
adapters did not. The contract was silent on what "direct exec"
actually inherits from.

**Incorporated in v0.1** by adding a "Scope caveat" paragraph to
ADAPTER-I3 that explicitly defers cwd, env, PATH, stdin, and timeout
semantics to Phase 2. The v0.1 contract now claims only the
**structural shape** of `command` (non-empty argv of non-empty
strings, direct exec, positional PROMPT_FILE/OUTPUT_FILE appended).
The Phase 2 property
`adapter.prop.custom_command_direct_exec_semantics` ratifies the
literal-passing semantics; a new v0.2 property
`adapter.prop.custom_command_environment_isolation` (named in
ADAPTER-I3 prose) will ratify the runtime isolation policy once Tier
2+ implementer isolation exists.

## Missing negative tests identified by review

The reviewer flagged these as gaps in v0.1 test coverage (all added):

- `Event.safeParse` rejects `dispatch.started.adapter.kind === 'named'` — ADDED.
- `DispatchConfig.safeParse` rejects `adapters.gemini.name === 'ollama'` — ADDED.
- `DispatchConfig.safeParse` rejects role, circuit, and `default` references
  to `constructor`/`toString`/`hasOwnProperty` with empty registries — ADDED.
- `Event.safeParse` rejects `role: 'researcher'` with `resolved_from:
  {source: 'role', role: 'reviewer'}` — ADDED.
- `AdapterReference` is exported and directly rejects `{kind: 'custom',
  ...}` — ADDED.
- Custom command property tests for literal shell metacharacters,
  whitespace-only elements, relative executable policy, cwd/env
  inheritance — Phase 2 property
  `adapter.prop.custom_command_direct_exec_semantics` +
  `adapter.prop.custom_command_environment_isolation` (named but not
  implemented; test-harness landing is Phase 2).
- Event migration posture: explicitly pre-release, no existing event
  logs. Covered by the one migration-guard test rejecting the
  pre-ADAPTER-I7 flat-enum shape on `resolved_from`. No multi-version
  migration fixture needed at v0.1.
- `DispatchResolutionSource` auto variant structured rationale —
  intentionally not added; the claim was removed from prose per MED #7.

## Fold-in discipline

Each incorporated fix is cross-referenced in `specs/contracts/adapter.md`
v0.1 by the HIGH/MED/LOW number. `Evolution` section v0.1 notes the
full verdict chain. New invariants landed: ADAPTER-I10 (HIGH #1),
ADAPTER-I11 (HIGH #2). Schema-level fold-ins: `ResolvedAdapter` type,
registry-key/descriptor-name parity check, own-property-only closure
check, cross-variant role binding on `Event` superRefine,
`AdapterReference` export. Prose fold-ins: HIGH #5 post-condition
honesty narrowing, MED #6 default/explicit/auto singleton scope, MED
#7 auto-rationale claim removed, LOW #9 cwd/env deferred to Phase 2
with property ids.

No deferrals to v0.2 for Codex objections — every HIGH/MED/LOW closed
in v0.1 either at the schema layer or via prose honesty. The three
v0.2 consideration items listed in Evolution (layer-disambiguator on
`default`, structured `auto` rationale, cwd/env property test harness)
are operator-chosen scope decisions, not un-folded Codex objections.
