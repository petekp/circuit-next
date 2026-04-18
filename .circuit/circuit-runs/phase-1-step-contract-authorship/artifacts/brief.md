# Brief: Author specs/contracts/step.md (Phase 1, first contract slice)

## Objective

Produce `specs/contracts/step.md`, the densest-invariants architecture contract
document for the **Step** module (`src/schemas/step.ts`). In the same slice,
tighten the schema to incorporate **adversarial-review MED objection #7** by
replacing opaque `Gate.source: z.string()` with a typed discriminated union
tied to step-kind-specific write slots, and add the matching negative
contract tests.

This is the first post-`workflow.md` contract. It lands the cross-contract
hook that `workflow.md` already depends on (`depends_on: [step, ...]`) and
unblocks `phase.md`, `selection.md`, and `run.md` authoring in follow-up
slices.

## Scope

**In scope (this slice):**
- Author `specs/contracts/step.md` following `specs/contracts/workflow.md`
  template (YAML frontmatter + Invariants + Pre/Post-conditions + Property
  ids + Cross-contract dependencies + Failure modes + Evolution).
- Tighten `src/schemas/gate.ts`: replace `source: z.string().min(1)` on
  `SchemaSectionsGate`, `CheckpointSelectionGate`, `ResultVerdictGate` with
  a discriminated union `GateSource` of shape
  `{ kind: 'artifact' | 'checkpoint_response' | 'dispatch_result'; ref: string }`,
  kind-bound per gate variant.
- Add a step-level `superRefine` in `src/schemas/step.ts` enforcing that
  `gate.source.ref` names a slot that exists on the step's `writes` object.
- Extend `tests/contracts/schema-parity.test.ts` with negative cases:
  (1) unknown `gate.source.kind`; (2) `gate.source.ref` naming a missing
  `writes.*` slot on each step variant; (3) cross-kind mismatch
  (e.g., `dispatch_result` ref on a Synthesis step).
- Update `specs/contracts/workflow.md` "Gate source tightening (Phase 1
  open)" section: mark the MED #7 decision as closed with a pointer to
  `step.md` v0.1.

**Out of scope (deferred to follow-up slices):**
- `phase.md`, `run.md`, `selection.md`, `adapter.md`, `continuity.md`,
  `skill.md` contract stubs.
- Behavioral tracks: `session-hygiene.md`, `prose-yaml-parity.md`,
  `cross-model-challenger.md`.
- MED #11 (workflow `spine_policy`) — deferred to `phase.md`.
- MED on `isConsequentialRigor` including `autonomous` — separate slice.
- Tier 2+ tooling: property suites under `tests/properties/*`, mutation
  testing, hidden-pool rotation.
- Any modifications to `~/Code/circuit` (read-only reference).

## Output Types

- [x] **Docs** — new `specs/contracts/step.md`; updated
  `specs/contracts/workflow.md` MED-#7 pointer.
- [x] **Code** — `src/schemas/gate.ts` union tightening; `src/schemas/step.ts`
  `superRefine` for gate.source ref closure.
- [x] **Tests** — contract tests for each new invariant (positive + negative).
- [ ] **ADRs** — not required; this is a typed strengthening, not a
  contract relaxation. (If Codex's challenger pass surfaces an objection
  that merits contract-relaxation or new ratchet framing, an ADR under
  `specs/adrs/` may be added at Review phase.)
- [ ] **Config** — N/A.

## Success Criteria

1. `specs/contracts/step.md` exists with YAML frontmatter
   (`contract: step`, `status: draft`, `version: 0.1`,
   `schema_source: src/schemas/step.ts`, `last_updated: 2026-04-18`,
   `depends_on: [ids, gate, selection-policy]`).
2. Invariants enumerated as `STEP-I1..STEP-IN`, each pointing to the exact
   schema locus that enforces it, mirroring `workflow.md`'s style.
3. `Gate.source` is a typed discriminated union in `src/schemas/gate.ts`:
   - `SchemaSectionsGate.source.kind === 'artifact'`
   - `CheckpointSelectionGate.source.kind === 'checkpoint_response'`
   - `ResultVerdictGate.source.kind === 'dispatch_result'`
4. `src/schemas/step.ts` adds a `superRefine` (at the `Step` discriminated
   union level, or per-variant) that rejects any step whose
   `gate.source.ref` does not name an actual slot on that variant's
   `writes` object.
5. New negative contract tests in `tests/contracts/schema-parity.test.ts`
   cover: unknown source kind; missing writes slot reference; cross-kind
   mismatch.
6. `npm run verify` passes: `tsc --noEmit` + `biome check` + `vitest`,
   with test count strictly advancing (ratchet).
7. Cross-model challenger (Codex via `/codex` skill) runs an adversarial
   property-auditor pass over `step.md` + changed schemas + new tests.
   Each objection is either incorporated in this slice or recorded as a
   deferred decision with rationale in the commit body / an ADR stub.
8. Commit message declares **Lane: Ratchet-Advance** with failure mode,
   acceptance evidence, and alternate framing per methodology §Lane
   discipline.
9. `PROJECT_STATE.md` is updated to reflect Phase 1 progress: step.md
   landed, MED #7 closed, remaining contract stubs listed.

## Constraints

**Hard invariants (from CLAUDE.md + methodology):**
- Lane declaration mandatory. This slice is **Ratchet-Advance** (advances
  the "typed invariant density" ratchet; test count ratchet advances).
- Cross-model challenger via `/codex` skill (pipes to `codex exec`), never
  `codex:rescue` subagent. Challenger produces an **objection list**, not
  an approval.
- `CLAUDE.md` ≤ 300 lines — N/A for this slice (no edits to `CLAUDE.md`).
- No `--no-verify` / skip-hooks.
- All gates (`npm run check`, `npm run lint`, `npm run test`) must pass
  before commit.
- Compaction remains disabled; treat session as long-horizon.

**Methodology invariants (pillars):**
- Contract-first: the contract doc + negative tests are authored in this
  slice *before* any Phase 2 implementation touches the run engine. The
  schema tightening is a refinement of existing Tier 0 scaffold, not
  implementation.
- Architecture-first: `tsc --strict` must remain clean; the
  discriminated-union approach leans on the type system to enforce the
  invariant at the compile boundary.
- Tiny-step lane discipline: one contract + one MED fix + matching tests
  in one commit. ≤30 min wall-clock target (Deep rigor may extend for
  challenger pass).

**Design constraints:**
- The typed `GateSource` ref is a **slot-name** string
  (`'artifact'`, `'response'`, `'result'`), **not** a dotted path like
  `'writes.artifact'`. Rationale: the `kind` already scopes the ref to a
  write slot; the `writes.` prefix would be redundant and couple the ref
  grammar to a specific field name. (If Codex's pass objects, we revisit.)
- Kind-bound union per gate variant is preferred over a single free
  `GateSource` shared across gates, because it lets TypeScript infer the
  valid `kind` literal per step variant at the type boundary (compile-time
  enforcement of the kind↔variant pairing, in addition to runtime
  `superRefine`).

## Verification Commands

```bash
cd /Users/petepetrash/Code/circuit-next && npm run verify
```

Expected signals:
- `tsc --noEmit` exits 0.
- `biome check` exits 0.
- `vitest` reports **all existing tests still pass** plus **≥3 new
  negative tests** for gate-source invariants. Test count advances
  monotonically (ratchet).

Additional manual checks (not scripted this slice):
- `rg 'gate\.source' src/ tests/ specs/` — no remaining references to
  `gate.source` as a plain string outside contract doc prose.
- `specs/contracts/step.md` header frontmatter parses as valid YAML.

## Out of Scope

- **Other contract stubs** — phase.md, run.md, selection.md, adapter.md,
  continuity.md, skill.md. Tracked as remaining debt; authored in
  follow-up slices.
- **Behavioral tracks** — session-hygiene.md, prose-yaml-parity.md,
  cross-model-challenger.md under `specs/behavioral/`. Follow-up slices.
- **MED #11 (spine_policy)** — belongs in `phase.md` authorship.
- **MED on rigor.autonomous** — separate slice; orthogonal.
- **`~/Code/circuit`** — read-only reference; no edits.
- **Tier 2 tooling** — container isolation, property suites, mutation
  testing, hidden-pool rotation: all deferred per ADR-0001.
- **Runtime engine changes** — Phase 2. This slice is pure contract +
  schema + tests.

## Risks / adversarial framing (alternate framing — Nguyen 2024 anchoring defense)

- **Alternate framing:** "Just land step.md as a documentation-only doc;
  defer gate.source tightening to a dedicated MED-#7 slice." Rejected
  because the MED-#7 fix is a one-commit typed strengthening whose
  negative tests *are* the strongest form of invariant encoding for
  step.md. Splitting them would land a step.md whose invariants cannot
  yet be enforced, weakening the contract's proof surface.
- **Failure mode addressed:** Gates accepting `source` strings that
  silently point to non-existent or wrong-kind writes — the exact
  `verdict-enum-bloat` and `prose-as-hidden-policy` anti-patterns named
  in `domain.md`.
- **Acceptance evidence:** All three new negative tests fail on the
  pre-fix schema, pass after the fix; `tsc --strict` rejects hand-crafted
  invalid `GateSource` shapes at compile time.
