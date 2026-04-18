# Cross-model adversarial review — Phase 1 step contract (attempt 2)

You are Codex, running as the cross-model challenger for circuit-next
Phase 1, **second pass**. The first pass (stored at
`.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/review.md`)
found 3 HIGH + 3 MED + 1 LOW objections. The orchestrator has
incorporated all of them. Your job now:

1. Verify each original objection is genuinely closed at the code +
   contract level.
2. Audit the fix itself for *regressions* or new seams.
3. Emit a terse verdict: CLEAN, or ISSUES FOUND with specifics.

This is a focused pass, not a greenfield review. Spend your budget on
the delta, not on re-reviewing unchanged scaffold.

## Original objections (expect each to be closed)

1. **HIGH** — `slot in writes` prototype-chain attack. Was at
   `src/schemas/step.ts:75-78`. Expected fix: `Object.hasOwn`.
2. **HIGH** — `source.kind` not semantically bound to write slot. Was at
   `src/schemas/gate.ts:11-25`. Expected fix: `ref` is a literal per
   source kind.
3. **HIGH** — Optional `writes.artifact === undefined` passes key-in
   check. Expected fix: `Object.hasOwn && writes[slot] !== undefined`.
4. **MED** — STEP-I6's Zod-strict claim was false. Expected fix: add
   `.strict()` to variants, writes, gate, and source objects.
5. **MED** — `.circuit/` not in biome ignore. Expected fix: add to
   `biome.json.files.ignore`.
6. **MED** — `PROJECT_STATE.md` stale + workflow.md evolution
   contradicts closure. Expected fix: update both.
7. **LOW** — STEP-I4 overstated TS exactness. Expected fix: narrow
   prose.

## Files to verify

- `/Users/petepetrash/Code/circuit-next/src/schemas/gate.ts`
- `/Users/petepetrash/Code/circuit-next/src/schemas/step.ts`
- `/Users/petepetrash/Code/circuit-next/tests/contracts/schema-parity.test.ts`
- `/Users/petepetrash/Code/circuit-next/specs/contracts/step.md`
- `/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md`
- `/Users/petepetrash/Code/circuit-next/biome.json`
- `/Users/petepetrash/Code/circuit-next/PROJECT_STATE.md`

## Current verify state (for your reference)

`npm run verify` → 47 tests passing (46 contract + 1 smoke), tsc clean,
biome clean on 23 files.

## Specific regression checks

After making `ref` a literal per source kind, does STEP-I3's superRefine
become redundant? If yes, should it be removed, or is its
defense-in-depth role explicitly documented?

Does `.strict()` on `SynthesisStep`/`CheckpointStep`/`DispatchStep`
break any existing valid step shape? (The step variants use
`StepBase.extend(...).strict()`; Zod should compose these correctly,
but verify.)

Are the new negative tests exercising the *literal* rejection path or
the superRefine path? Name which one catches each.

## Output format

```
### VERDICT
CLEAN | ISSUES FOUND

### CLOSURE AUDIT
For each of the 7 original objections, state CLOSED or NOT CLOSED with
one-line evidence (file:line).

### NEW OBJECTIONS (if any)
Numbered list: severity / claim / evidence / proposed fix.

### REGRESSION AUDIT
Any existing behavior that broke as a side effect.

### FINAL ASSESSMENT
One paragraph. Ship-readiness call: SHIP_READY | ISSUES_FOUND.
```

You are read-only. Do not attempt edits.
