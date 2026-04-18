# Cross-model adversarial review — Phase 1 step contract

You are Codex, running as the cross-model challenger for circuit-next
Phase 1. Your job is an **objection list**, not an approval. Err toward
pressure-testing even when something looks fine. Claude just authored a
contract + schema + tests slice; you are the different model whose
structural bias and training distribution should catch what Claude
rationalized past.

## Mission

Independently review the work that just landed in circuit-next. Pressure-
test STEP-I1..STEP-I7 and the MED-#7 closure. Emit a verdict plus a
categorized objection list.

This is a two-in-one review:
1. **Ship-readiness review** — would this commit block merge?
2. **Property-auditor pass** — what tautologies, hidden assumptions, or
   missing invariants survive? What generator-level adversarial inputs
   would break STEP-I3/STEP-I4 in property tests?

## Authoritative sources to read

Read these before writing anything:

1. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/brief.md`
2. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/plan.md`
3. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/verification.md`
4. `/Users/petepetrash/Code/circuit-next/.circuit/circuit-runs/phase-1-step-contract-authorship/phases/implement/reports/report-step-contract-authorship.md` (implementer's verdict + open questions)
5. `/Users/petepetrash/Code/circuit-next/specs/contracts/step.md` (new contract)
6. `/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md` (MED-#7 closure pointer)
7. `/Users/petepetrash/Code/circuit-next/src/schemas/gate.ts` (diff context)
8. `/Users/petepetrash/Code/circuit-next/src/schemas/step.ts` (diff context)
9. `/Users/petepetrash/Code/circuit-next/tests/contracts/schema-parity.test.ts` (new + rewritten tests)
10. `/Users/petepetrash/Code/circuit-next/specs/domain.md` (domain vocabulary)
11. `/Users/petepetrash/Code/circuit-next/bootstrap/adversarial-review-codex.md` (your prior pass — MED #7 was objection 7)
12. `/Users/petepetrash/Code/circuit-next/CLAUDE.md` (methodology + hard invariants)

## Specific questions the implementer flagged for you

Answer each explicitly in your verdict:

1. **Ref grammar.** The contract chose `gate.source.ref` as a bare slot-
   name (`'artifact'`, `'response'`, `'result'`) instead of your original
   proposal of `'writes.artifact'` (dotted path). Is the bare-name
   grammar ratified, or does it hide a failure mode the dotted prefix
   would have caught? Give a concrete adversarial example either way.

2. **CheckpointStep optional artifact.** STEP-I3 closure uses
   `(slot in writes)`. On a CheckpointStep, `writes.artifact` is
   `ArtifactRef.optional()` — the key may be absent *or* present with
   `undefined`. Should STEP-I3 additionally require
   `writes[ref] !== undefined`? If yes, what's the failure mode the
   current check misses?

3. **Dispatch multi-result disambiguator.** v0.1 defers to v0.2 the case
   where a future dispatch variant produces multiple result-like slots.
   Is that deferral safe, or does v0.1 leak a design assumption that
   should be ratified now?

4. **`.circuit/` biome scope.** `batch.json` under `.circuit/` was
   auto-formatted by the implementer to unblock verify. Cleaner fix is
   adding `.circuit/` to `biome.json`'s `files.ignore`. Should this be
   done now, or is auto-formatting orchestrator artifacts fine?

5. **ADR obligation.** CLAUDE.md §"Hard invariants" #5 requires ADRs for
   any "relaxation of a contract, ratchet floor, or gate." Is this slice
   a tightening (no ADR required) or does STEP-I3's superRefine
   *relax* the prior "anything-goes string" behavior in a way that
   deserves a post-hoc ADR? The slice is Ratchet-Advance lane.

## Structural questions to pressure-test

Beyond the implementer's self-flagged items, audit for:

- **STEP-I1 leak:** Does the kind-variant binding actually close? Can
  you construct a type-valid Step whose `executor`, `kind`, `gate.kind`,
  and `writes` shape disagree?
- **STEP-I3 property counterexamples:** What generator inputs would
  break the closure claim? (E.g., Unicode normalization in slot names,
  prototype-chain `in` operator subtleties, empty-string refs —
  `z.string().min(1)` catches empty, but what about space-only?)
- **STEP-I4 type-layer vs parse-layer mismatch:** Does Zod's
  `z.literal('artifact')` in `ArtifactSource` *actually* constrain the
  TypeScript-inferred type enough that `SchemaSectionsGate` can't at the
  type layer carry a non-`artifact` source? Or does structural typing
  still allow `source: { kind: 'artifact', ref: 'x', stray: true }`?
- **STEP-I6 surplus key rejection:** step.md claims "Zod's strict object
  mode rejects the surplus key when parsing" — but `z.object(...)` is
  NOT strict by default in Zod. Does this claim hold? If not, STEP-I6's
  written enforcement story is wrong.
- **Evolution path:** Is the v0.1 → v0.2 → v1.0 staging credible, or
  does it gloss over decisions that should be made now?
- **Prose/YAML drift risk:** Does step.md accurately describe the
  schema? Spot-check three invariants against the actual Zod source.
- **Carry-forward failure modes:** Does the carry-forward list in
  step.md match the adversarial-review findings you authored
  originally (`bootstrap/adversarial-review-codex.md`)?

## Output format

Emit your response with this exact structure:

```
### VERDICT
One of: CLEAN | ISSUES FOUND

### SHIP READINESS
One of: SHIP_READY | ISSUES_FOUND
Short justification (1-3 sentences).

### OBJECTIONS
Numbered list, each with:
- Severity: HIGH | MED | LOW
- Claim (one sentence)
- Evidence (file:line references)
- Why it matters (one paragraph)
- Proposed fix (concrete, not abstract)

If you have no objections at a given severity, say "None at this severity."

### ANSWERS TO IMPLEMENTER QUESTIONS
One paragraph per question 1-5.

### PROPERTY TEST SEEDS
Concrete adversarial inputs that would exercise STEP-I3/STEP-I4 in a
future property-test harness. Format each as `{input: ..., should_fail: true/false, reason: ...}`.

### OVERALL ASSESSMENT
Two paragraphs: what the slice got right; what the slice left on the table.
```

## Ground rules

- Be specific. "The contract should be stronger" without a claim and
  proposed fix is not an objection; it's noise. Name files, line numbers,
  exact identifiers.
- Do not approve out of politeness. Your job is to find what Claude
  missed. An empty objection list at MED and HIGH is acceptable ONLY if
  you can defend it.
- You are read-only. Do not attempt edits. Do not run destructive
  commands. `rg`, `cat`, `find`, `git log`, `git diff` are fine.
- You may disagree with a design decision even if the work is
  self-consistent. Say so and propose the alternative.
- If you discover scope-creep beyond STEP-I1..I7 (implementer invented
  an 8th invariant or expanded schema outside gate.ts/step.ts), flag it
  as HIGH.
