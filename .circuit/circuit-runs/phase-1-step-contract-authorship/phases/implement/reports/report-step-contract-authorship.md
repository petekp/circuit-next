# Implementer Report: Phase 1 — specs/contracts/step.md + close MED-#7

**Slice:** `step-contract-authorship`
**Lane:** Ratchet-Advance
**Date:** 2026-04-18
**Note:** Persisted by orchestrator after harness blocked subagent's Write. Content is verbatim from subagent's final message.

### Files Changed

- `/Users/petepetrash/Code/circuit-next/src/schemas/gate.ts` — **modified.** Replaced opaque `source: z.string().min(1)` on all three gate variants with kind-bound source schemas (`ArtifactSource`, `CheckpointResponseSource`, `DispatchResultSource`). Added a `GateSource` discriminated-union convenience alias. Inline comment documents the bare-slot-name ref grammar (Seam C decision).
- `/Users/petepetrash/Code/circuit-next/src/schemas/step.ts` — **modified.** Wrapped `Step = z.discriminatedUnion(...)` with `.superRefine(...)` that validates `step.gate.source.ref ∈ keys(step.writes)` and issues at path `['gate', 'source', 'ref']`. Variant schemas unchanged — the typed source flows through `gate.ts` automatically.
- `/Users/petepetrash/Code/circuit-next/tests/contracts/schema-parity.test.ts` — **modified.** Rewrote 7 positive-test sites from `source: '<string>'` to `source: { kind, ref }` (Gate discriminates-on-kind, baseSynthesis fixture, 3 sites inside Step discriminated-union tests, 1 inside Workflow graph-closure fixture). Added 6 new tests: `Gate rejects unknown source.kind`, `Gate rejects cross-kind source on SchemaSectionsGate`, `SynthesisStep rejects missing writes slot`, `CheckpointStep rejects missing writes slot`, `DispatchStep rejects missing writes slot`, and `CheckpointStep accepts ref naming a real writes slot` (positive pair). Count: 33 → 39 contract tests.
- `/Users/petepetrash/Code/circuit-next/specs/contracts/step.md` — **created.** New 181-line Step contract with YAML frontmatter (`contract: step`, `status: draft`, `version: 0.1`, `schema_source: src/schemas/step.ts`, `last_updated: 2026-04-18`, `depends_on: [ids, gate, selection-policy]`), STEP-I1..STEP-I7 invariants each with a direct schema locus pointer, pre/post-conditions, 5 reserved Phase-2 property ids (`step.prop.*`), cross-contract dependencies, carry-forward failure modes, and an evolution roadmap (v0.1 → v0.2 → v1.0).
- `/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md` — **modified.** Replaced the "Gate source tightening (Phase 1 open)" section with the closed pointer specified in the handoff, referencing STEP-I3 and STEP-I4 in `specs/contracts/step.md`. `last_updated` already at `2026-04-18`; no change needed.
- `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/phases/implement/batch.json` — **formatted** via `biome check --write`. Whitespace-only; semantics unchanged. Needed to unblock the verify gate because `.circuit/` is not in `biome.json`'s `files.ignore` list and batch.json was the only file with a format delta. See Design Decisions Made.

### Tests Run

All commands run from `/Users/petepetrash/Code/circuit-next`.

- Initial baseline: `npm run test` → **34 pass, 0 fail** (33 contract + 1 smoke).
- After `gate.ts` tightening + `step.ts` superRefine: `npx tsc --noEmit` → **exit 0** (clean).
- After test-site rewrites + new negatives: `npm run test` → **40 pass, 0 fail** (39 contract + 1 smoke).
- Full-slice gate: `npm run verify` (tsc + biome + vitest) → initial failure because `.circuit/...batch.json` was not biome-formatted. After `biome check --write .circuit/.../batch.json`, rerun of `npm run verify` → **all green** (tsc exit 0, biome "No fixes applied", vitest 40/40).
- Ratchet verification: 33 contract + 1 smoke → 39 contract + 1 smoke = **+6 contract tests, ratchet strictly advances** (CHARTER required ≥4 new negatives; landed 5 new negatives + 1 positive pair).
- `rg "gate\.source"` audit: all bare-string references live in documentation prose (`specs/contracts/*.md`, `bootstrap/`, `.circuit/...`) or in structural field-access code (`step.gate.source.ref` in `src/schemas/step.ts`). No test or implementation file carries a string-literal `gate.source` value.

Full final `npm run verify` output:
```
> circuit-next@0.0.1 verify
> npm run check && npm run lint && npm run test

> circuit-next@0.0.1 check
> tsc --noEmit

> circuit-next@0.0.1 lint
> biome check .

Checked 30 files in 8ms. No fixes applied.

> circuit-next@0.0.1 test
> vitest run

 RUN  v2.1.9 /Users/petepetrash/Code/circuit-next

 ✓ tests/unit/smoke.test.ts (1 test) 1ms
 ✓ tests/contracts/schema-parity.test.ts (39 tests) 6ms

 Test Files  2 passed (2)
      Tests  40 passed (40)
```

### Completion Claim

**CLEAN**

All six sub-slices landed. `npm run verify` green. Test count strictly advanced (33→39 contract, 34→40 overall). MED-#7 closed with direct schema-enforcement backing (STEP-I3 superRefine + STEP-I4 kind-bound types). `specs/contracts/step.md` is the first Phase 1 contract with complete YAML frontmatter, seven ratified invariants, and a forward roadmap. No commit created — orchestrator will commit.

### Design Decisions Made

1. **Formatted `.circuit/.../batch.json` to unblock verify.**
   - Prescription: "Work directly in [circuit-next]" and "Run exactly once after all changes land: `npm run verify`."
   - What I did: After the first `verify` reported a biome format violation in `.circuit/.../batch.json` (an orchestrator artifact I did not create or modify directly), I ran `biome check --write` on that single file to auto-fix the whitespace delta.
   - Why: The verify gate is non-negotiable per handoff. Alternative was adding `.circuit` to `biome.json`'s `files.ignore` — that expands scope and changes lint policy globally, which the handoff did not authorize. Format-only fix is the most conservative option. Flag for Codex: should `.circuit/` be in biome ignore list permanently?

2. **Exported `GateSource` discriminated-union alias in addition to the kind-bound variant sources.**
   - Prescription: Handoff says "Export a `GateSource` discriminated union alias as a convenience type." CHARTER Seam A doesn't require it.
   - What I did: Exported both individual source schemas and a combined `GateSource` alias.
   - Why: Handoff explicitly requested it; gives future callers a single type-safe handle over the source space without coupling to a gate variant.

3. **Added one positive pair beyond the ≥4 negatives.**
   - Prescription: Handoff prescribes exactly 4 new negative tests. CHARTER Slice 4 says "minimum 4" with an optional 5th.
   - What I did: Added 5 negatives (`Gate rejects unknown source.kind`, `Gate rejects cross-kind source on SchemaSectionsGate`, and the 3 variant-specific missing-slot rejections) plus 1 positive pair for CheckpointStep writes-slot closure.
   - Why: The positive pair anchors the negatives — proves the superRefine isn't uniformly rejecting. Cost: +1 test. The Gate-level cross-kind-source test exercises Zod's `discriminatedUnion('kind', [...])` at the source level, giving runtime proof of the type-layer binding from Seam A.

4. **Reused `baseSynthesis` fixture with spread rather than introducing variant-specific fixtures.**
   - Prescription: Handoff and CHARTER don't specify test-object layout.
   - What I did: Kept the existing `baseSynthesis` spread pattern, substituting typed source shapes. Matches adjacent Workflow tests spreading from `okFrameStep`.
   - Why: Minimal-delta approach preserves test-file readability and keeps the semantic change (string → typed source) visible in review diff.

5. **step.md length: 181 lines (handoff target 120-180).**
   - Prescription: "Target length: 120-180 lines."
   - What I did: Landed at 181 lines (1 over upper bound).
   - Why: STEP-I1..I7 encodes more schema-boundary content per invariant than workflow.md's WF-I1..I7. Overage is 1 line; tightening would drop substantive content.

### Open Questions

- **Ref grammar decision (Seam C "named design choice").** Adversarial review proposed `ref: 'writes.artifact'` (dotted path). CHARTER Seam C chose bare slot-name (`'artifact'`) because `kind` already scopes the namespace. Explicitly flagged for Codex at Review phase. Codex should either ratify the bare-name grammar or surface a specific failure mode where the dotted prefix would have caught a real bug.

- **`.circuit/` in biome scope.** `biome.json`'s `files.ignore` covers `node_modules`, `dist`, `coverage`, `bootstrap` — not `.circuit`. Formatted the offending file to unblock verify; cleaner fix is adding `.circuit` to `files.ignore`. Unclear whether orchestrator artifacts should be lint-scoped — defer to orchestrator design.

- **CheckpointStep writes slot `artifact` is optional.** STEP-I3 closure allows `gate.source.ref = 'artifact'` on a CheckpointStep even though `writes.artifact` is `ArtifactRef.optional()`, which may be `undefined` at runtime. Current `in writes` check passes when the key is declared but value is undefined. Should STEP-I3 additionally require `writes[ref] !== undefined`? Defer to Codex.

- **Dispatch multi-result disambiguator.** CHARTER Seam C flags that a future dispatch step producing multiple result-like slots would need a secondary disambiguator, not a grammar change. step.md v0.2 section captures this. Codex may object that v0.1 should define it now; I deferred per handoff's "do NOT invent invariants beyond STEP-I1..STEP-I7."

- **No ADR filed for the schema breaking change.** Per CLAUDE.md Hard Invariant #5 ("ADR required for any relaxation of a contract, ratchet floor, or gate"), a Ratchet-Advance that tightens is arguably not a "relaxation." Handoff did not prescribe ADR. Worth clarifying at Review.
