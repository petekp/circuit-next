# Result: Phase 1 — specs/contracts/step.md + close MED-#7

## Changes

### New files
- `specs/contracts/step.md` (181 lines, now ~195 lines after post-review-1 tightening) — the first Phase 1 contract after workflow.md. YAML frontmatter keyed to `src/schemas/step.ts`. STEP-I1..STEP-I7 invariants.

### Modified files
- `src/schemas/gate.ts` — `Gate.source` tightened to kind-bound discriminated unions with literal `ref` per source kind (artifact → `'artifact'`, checkpoint_response → `'response'`, dispatch_result → `'result'`). `.strict()` on every variant. Closes adversarial-review MED #7 + post-review HIGH #1/#2/#3.
- `src/schemas/step.ts` — superRefine at the `Step` discriminated-union level with `Object.hasOwn` + `!== undefined` guard (defense-in-depth). `.strict()` on every variant + nested `writes` objects. Closes post-review HIGH #1/#3 + MED #4.
- `tests/contracts/schema-parity.test.ts` — baseline 33 contract tests → 46 (+13). Existing positive-test sites rewritten to typed source shape. New negatives: gate unknown source.kind, cross-kind source on SchemaSectionsGate, 3× missing-writes-slot rejections, prototype-chain refs (`toString`, `__proto__`), cross-slot refs (checkpoint_response→request, dispatch_result→receipt), surplus-key rejections on step/source/gate.
- `specs/contracts/workflow.md` — MED #7 closure pointer; Evolution v0.2 prose corrected (no longer says "decide gate source tightening" after closure).
- `biome.json` — `.circuit/` added to `files.ignore` (prevents lint from mutating run evidence).
- `PROJECT_STATE.md` — phase state advanced to "Phase 1 — Contract authorship in progress"; test count synced; morning-pickup instructions updated; open questions shrunk (resolved ones moved to Resolved section).

## Verification

- `npm run verify` → tsc clean, biome clean (23 files; `.circuit/` now ignored), vitest 47 tests passing (46 contract + 1 smoke).
- Ratchet check: test count 34 → 47. Strictly advances; Ratchet-Advance lane satisfied.
- `rg "gate\.source"` in src/ tests/ → only structural field access (`step.gate.source.ref`) and test description strings; no bare string literal `gate.source: '...'` remains.
- Independent orchestrator-session re-run of verify (outside the implementer subagent): matches the implementer's reported numbers.

## Adjacent Outputs Delivered

- Tests: +13 contract tests (5 original negatives + 8 post-Codex-review negatives).
- Docs: new `specs/contracts/step.md`; updated `specs/contracts/workflow.md` + `PROJECT_STATE.md` + inline comments in `gate.ts`/`step.ts`.
- Config: `biome.json` scope correction.
- ADR: none. The slice is a tightening (Ratchet-Advance), not a relaxation. Codex's pass-1 answer #5 explicitly confirmed no ADR needed.

## Residual Risks / Debt

- **STEP-I3 superRefine is redundant for current source kinds** (because literal `ref` blocks invalid refs at the Zod layer before superRefine runs). Documented in code + contract prose as defense-in-depth for future flexible sources. Codex pass-2 explicitly approved this.
- **Historical lines in PROJECT_STATE.md retain "34 tests" phrasing** at lines 61, 76 — these describe the overnight event, not current state. "Current status" section reflects 47. Left intentionally to preserve timeline fidelity.
- **`specs/behavioral/` tracks not authored this slice** — session-hygiene, prose-yaml-parity, cross-model-challenger. Follow-up slices.
- **6 remaining Phase 1 contract stubs** — phase.md, run.md, selection.md, adapter.md, continuity.md, skill.md.

## Follow-ups

1. **Next contract.** `run.md` (event-log + replay semantics, user-visible) or `phase.md` (unlocks MED #11 spine_policy decision). Either will reuse the step-contract template.
2. **Property-test harness.** `step.md` reserves `step.prop.*` property ids; Phase 2 authors the `tests/properties/` harness. Codex pass-1 seeded 7 adversarial inputs at `review.md`.
3. **Cross-contract coherence check.** Once 2-3 contracts land, run a dedicated pass proving `workflow.md + step.md + phase.md` compose without leaked assumptions.
4. **Methodology-shift candidate (surfaced by operator mid-slice).** Consider upgrading the cross-model challenger protocol to a two-pass layered model: a stronger model for depth (pre-authorship seam identification at Plan) + Codex for family-diversity correlation hedge. Not landed this slice; belongs in a dedicated `specs/methodology/` update.

## PR Summary

### Title
`feat(phase-1): author step.md contract and tighten Gate.source (MED #7 closed)`

### Summary

- Lands `specs/contracts/step.md` as the first Phase 1 contract after workflow.md, with STEP-I1..STEP-I7 invariants keyed to `src/schemas/step.ts`.
- Closes adversarial-review MED #7 by replacing `Gate.source: z.string()` with kind-bound discriminated source schemas, each with a `z.literal` `ref` (artifact → `'artifact'`, checkpoint_response → `'response'`, dispatch_result → `'result'`).
- Adds `.strict()` across every Step variant, writes object, gate variant, and source object — STEP-I6 enforcement is now backed by Zod rather than prose.
- Adds a `Step`-union `superRefine` with `Object.hasOwn` + undefined guard as defense-in-depth for future flexible sources.
- Extends contract tests from 33 → 46 (+13 contract; +1 positive pair; the rest negatives covering prototype-chain attacks, cross-slot drift, surplus-key rejection).
- Codex cross-model adversarial property-auditor pass completed (two rounds); 3 HIGH + 3 MED + 1 LOW objections all incorporated.

**Lane: Ratchet-Advance.**
- **Failure mode addressed:** Gates accepting opaque `source` strings that silently point to non-existent or wrong-kind writes — the `verdict-enum-bloat` + `prose-as-hidden-policy` anti-patterns named in `specs/domain.md`.
- **Acceptance evidence:** `npm run verify` green; test count advances 34 → 47; Codex adversarial pass-2 confirms HIGH findings closed and regression-audit clean.
- **Alternate framing considered + rejected:** Land step.md as documentation-only, defer MED-#7 fix to a separate slice. Rejected because the negative tests are the strongest invariant encoding; splitting would land a contract whose invariants couldn't yet be enforced.

### Test Plan

- `cd ~/Code/circuit-next && npm run verify` — tsc + biome + vitest all green; 47 tests pass.
- Grep audit: `rg "gate\.source" src/ tests/` — no bare-string literal `gate.source: '...'` outside structural field access and test descriptions.
- Spot-check: construct a manifest with `gate.source = { kind: 'dispatch_result', ref: 'receipt' }` → fails safeParse at the Zod literal layer.
- Spot-check: construct a SynthesisStep with stray `role: 'implementer'` key → fails safeParse via `.strict()`.
