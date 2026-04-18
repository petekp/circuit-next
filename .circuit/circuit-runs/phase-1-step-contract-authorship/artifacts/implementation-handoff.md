# Implementation Handoff: specs/contracts/step.md + MED-#7 tightening

**Project root:** `/Users/petepetrash/Code/circuit-next`

**Lane:** Ratchet-Advance (advances typed-invariant density + test count ratchet).

**Mission.** Land the first Phase 1 contract (`specs/contracts/step.md`) and
simultaneously close adversarial-review MED objection #7 by tightening
`Gate.source` from `z.string()` to a typed kind-bound discriminated union
with runtime ref-closure validation.

Follow the plan in `CHARTER.md` exactly. The STEP-I invariant roster in
CHARTER.md Slice 5 is the authorized set. Do NOT invent additional
invariants. Any novel observation becomes a deferred follow-up, not a
scope expansion.

## Ordered work (6 sub-slices, one commit)

### Sub-slice 1: Tighten `src/schemas/gate.ts`

Introduce three kind-bound source schemas and wire each gate variant:

```ts
const ArtifactSource = z.object({
  kind: z.literal('artifact'),
  ref: z.string().min(1),
});
const CheckpointResponseSource = z.object({
  kind: z.literal('checkpoint_response'),
  ref: z.string().min(1),
});
const DispatchResultSource = z.object({
  kind: z.literal('dispatch_result'),
  ref: z.string().min(1),
});

// Each gate variant pairs with ONE source schema at the type boundary:
SchemaSectionsGate:      source = ArtifactSource
CheckpointSelectionGate: source = CheckpointResponseSource
ResultVerdictGate:       source = DispatchResultSource
```

Export a `GateSource` discriminated union alias as a convenience type.

### Sub-slice 2: superRefine on `Step` in `src/schemas/step.ts`

Add a `.superRefine` to the `Step = z.discriminatedUnion(...)` expression.
Inside the refinement, assert that `step.gate.source.ref` names a key in
`step.writes`. Use the pattern already present in
`src/schemas/workflow.ts` — `z.ZodIssueCode.custom` with
`path: ['gate', 'source', 'ref']`.

### Sub-slice 3: Update existing positive tests

In `tests/contracts/schema-parity.test.ts`, rewrite every `source: '<string>'`
occurrence inside gate/step test objects to the typed form. Per plan grep
audit, sites are at lines 91, 98, 155-159, 177, 191, 201, 211, 225-229.

Valid slot names per variant:
- Synthesis: `'artifact'` (the step writes `{ artifact: ArtifactRef }`)
- Checkpoint: `'response'` or `'request'` or `'artifact'` — but the gate
  is `checkpoint_selection` so source.kind is `checkpoint_response`, and
  the semantically correct ref is `'response'`.
- Dispatch: `'result'` (gate is `result_verdict`, source.kind is
  `dispatch_result`, ref is `'result'`).

### Sub-slice 4: Add new negative tests

At the end of the `Step discriminated union` describe block (or in a new
describe block adjacent to it), add these negative cases:

1. `it('Gate rejects unknown source.kind')` — construct a gate with
   `source: { kind: 'bogus', ref: 'artifact' }` and expect `safeParse`
   failure.
2. `it('SynthesisStep rejects gate.source.ref naming a missing writes slot')`
   — valid `source.kind: 'artifact'` but `ref: 'missing-slot'`, expect
   failure.
3. `it('CheckpointStep rejects gate.source.ref naming a missing writes slot')`
   — analogous for checkpoint_response + missing ref.
4. `it('DispatchStep rejects gate.source.ref naming a missing writes slot')`
   — analogous for dispatch_result + missing ref.

Each test must use `safeParse(...)` and assert `.success === false`.

### Sub-slice 5: Author `specs/contracts/step.md`

Create `specs/contracts/step.md` modeled after `specs/contracts/workflow.md`.

YAML frontmatter (exact):
```yaml
---
contract: step
status: draft
version: 0.1
schema_source: src/schemas/step.ts
last_updated: 2026-04-18
depends_on: [ids, gate, selection-policy]
---
```

Required sections (see CHARTER.md Slice 5 for outline):
- `# Step Contract`
- Ubiquitous language pointer to `specs/domain.md#core-types`
- `## Invariants` — enumerate STEP-I1..STEP-I7 from CHARTER.md, each with
  a one-paragraph description and a direct schema-locus reference
  (e.g., `src/schemas/step.ts:L42-L52`).
- `## Pre-conditions`
- `## Post-conditions`
- `## Property ids (reserved for Phase 2 testing)` — list 3-5 property
  names following `workflow.md`'s `step.prop.*` naming.
- `## Cross-contract dependencies`
- `## Failure modes (carried from evidence)` — carry-forward of
  verdict-enum-bloat and role/executor confusion.
- `## Evolution` — v0.1 (this draft), v0.2 (Phase 1 iteration),
  v1.0 (Phase 2 ratified).

Target length: 120-180 lines, comparable to `workflow.md` (114).

### Sub-slice 6: Close MED-#7 in `specs/contracts/workflow.md`

Replace the existing "Gate source tightening (Phase 1 open)" paragraph
with:

```markdown
## Gate source tightening

Adversarial-review MED objection #7 is **closed in step.md v0.1**. Gate
sources are typed per gate variant: `SchemaSectionsGate.source` is
`ArtifactSource`, `CheckpointSelectionGate.source` is
`CheckpointResponseSource`, `ResultVerdictGate.source` is
`DispatchResultSource`. The `Step` discriminated union validates
`gate.source.ref` against the step variant's `writes` slots via
`superRefine`. See `specs/contracts/step.md` invariants STEP-I3 and
STEP-I4.
```

Update `workflow.md`'s `last_updated` to `2026-04-18`.

## Verification command (run once after all six sub-slices land)

```bash
cd /Users/petepetrash/Code/circuit-next && npm run verify
```

Expected: all three gates green (tsc, biome, vitest). Test count ≥ 38.

## Required report sections

Your report at `reports/report-{slice_id}.md` MUST have these headings in
this order:

### Files Changed
- Bullet list of every file you created or modified, absolute paths.

### Tests Run
- Exact commands you ran (including directory).
- Pass/fail per command.
- Test count before → after.

### Completion Claim
- One of exactly these verdicts (worker-level, adapter-level):
  - `CLEAN` — all sub-slices landed, verify green, no residual issues.
  - `ISSUES FOUND` — landed partial work; specify remaining gaps.

### Design Decisions Made
- List every judgment call you made beyond the handoff prescription.
- For each: what the prescription said, what you did, why.

### Open Questions
- Anything ambiguous that deserves Codex challenger scrutiny at Review.

## Hard constraints

- Do NOT modify `~/Code/circuit` (read-only reference).
- Do NOT modify files outside `/Users/petepetrash/Code/circuit-next`.
- Do NOT use `--no-verify` or skip any git hook. If a hook fails, fix and
  re-stage — do not bypass.
- Do NOT invent new step kinds, new gate kinds, or new invariants beyond
  STEP-I1..STEP-I7.
- Do NOT delete any existing test case; only update or add.
- Test count must strictly advance (current 34 + smoke 1 → ≥ 38 + smoke).

## Source of truth

- `CHARTER.md` (this run's plan.md).
- `/Users/petepetrash/Code/circuit-next/CLAUDE.md`.
- `/Users/petepetrash/Code/circuit-next/specs/evidence.md`.
- `/Users/petepetrash/Code/circuit-next/specs/domain.md`.
- `/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md` (template).
- `/Users/petepetrash/Code/circuit-next/bootstrap/adversarial-review-codex.md` (MED-#7 full text at line 121).
