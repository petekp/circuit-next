# Plan: Author specs/contracts/step.md + close MED-#7

## Approach

Three coordinated edits land in one commit under lane **Ratchet-Advance**:

1. **Schema tightening first** (`src/schemas/gate.ts` + `src/schemas/step.ts`)
   — the schema is the enforcement mechanism the contract document will
   reference. Doing schemas first means the step.md invariants can point
   at concrete schema loci.
2. **Contract document** (`specs/contracts/step.md`) — written against the
   tightened schema with concrete line references.
3. **Negative contract tests** (`tests/contracts/schema-parity.test.ts`) —
   authored after the schema changes, cover each new invariant, and bring
   existing gate-using positive tests onto the new typed-source shape.

Fourth edit: update `specs/contracts/workflow.md`'s "Gate source tightening
(Phase 1 open)" section to mark MED #7 closed, pointing at `step.md`.

Out-of-order framing note: Although methodology leans "contract before
schema", in this slice the schema edit IS the contract statement. The
step.md document is the human-readable invariant index keyed to a schema
that already enforces them. This is architecturally honest: types are the
hardest contract form, and step.md's job is to surface them for human
review.

## Seam proof (Deep rigor)

### Seam A — Kind-bound GateSource per gate variant (compile-time pairing)

**Risk:** If `GateSource` is a single shared discriminated union that all
three gate variants embed identically, TypeScript will accept
`SchemaSectionsGate` holding a `dispatch_result` source at the type layer.
That re-creates the MED #7 bug one layer down.

**Proof — design resolves this at the type boundary:**

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

export const SchemaSectionsGate = z.object({
  kind: z.literal('schema_sections'),
  source: ArtifactSource,             // kind literal is fixed at variant
  required: z.array(z.string().min(1)).min(1),
});
export const CheckpointSelectionGate = z.object({
  kind: z.literal('checkpoint_selection'),
  source: CheckpointResponseSource,
  allow: z.array(z.string().min(1)).min(1),
});
export const ResultVerdictGate = z.object({
  kind: z.literal('result_verdict'),
  source: DispatchResultSource,
  pass: z.array(z.string().min(1)).min(1),
});

export const Gate = z.discriminatedUnion('kind', [
  SchemaSectionsGate,
  CheckpointSelectionGate,
  ResultVerdictGate,
]);
```

`tsc --strict` now enforces: any literal `Gate` value whose kind is
`schema_sections` MUST have `source.kind === 'artifact'` at the type layer,
not merely at runtime. Mismatches fail to compile.

### Seam B — superRefine at the Step discriminated-union layer

**Risk:** Zod `discriminatedUnion` requires `ZodObject`-shaped variants.
Adding `.superRefine(...)` to a variant returns `ZodEffects`, which
invalidates discriminatedUnion membership.

**Resolution:** place the writes-slot-closure refinement at the Step union
level, narrow by `data.kind` inside the refinement:

```ts
export const Step = z
  .discriminatedUnion('kind', [SynthesisStep, CheckpointStep, DispatchStep])
  .superRefine((step, ctx) => {
    const slot = step.gate.source.ref;
    const writes = step.writes as Record<string, unknown>;
    if (!(slot in writes)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gate', 'source', 'ref'],
        message: `gate.source.ref "${slot}" does not name a slot in step.writes (available: ${Object.keys(writes).join(', ')})`,
      });
    }
  });
```

This keeps the outer union type clean and co-locates the cross-field
closure check with the type it constrains.

### Seam C — Ref grammar: slot-name vs dotted path

**Decision:** `ref` is a bare slot-name (`'artifact'`, `'response'`,
`'result'`). Rationale: `kind` already scopes the ref's namespace to the
step's `writes` object; `writes.` prefix would be redundant and couple the
grammar to a specific TypeScript field name. If we later add a per-slot
disambiguator (e.g., a dispatch step producing multiple `result` slots),
the ref remains a slot-name; we'd introduce a secondary field, not change
the grammar.

**Risk accepted:** The adversarial-review proposed literal `ref: 'writes.artifact'`.
Deviating re-exposes the objection. Mitigation: flag this to Codex in the
Review phase as a named design choice, so the auditor can explicitly
challenge or ratify it.

### Seam D — Breaking existing positive tests

**Risk:** Current positive tests set `gate.source` as a plain string. After
the tightening, those shapes fail safeParse. Without update, `npm run
test` goes red and the ratchet regresses.

**Resolution:** Update all 7 positive-test sites
(`tests/contracts/schema-parity.test.ts` lines 91, 98, 157, 177, 191, 201,
211, 228 per grep) to the typed `{kind, ref}` form as part of this slice.
Test count strictly advances because we add ≥3 new negative tests on top.

No characterization tests exist to preserve equivalence — this is
Ratchet-Advance, not Equivalence Refactor. The semantic shift (strings →
typed refs) is the ratchet.

## Slices

Single commit, but ordered work internally:

### Slice 1: Tighten gate.ts with kind-bound sources

**Files:** `src/schemas/gate.ts`

**Change:** Introduce `ArtifactSource`, `CheckpointResponseSource`,
`DispatchResultSource`. Replace each gate variant's `source: z.string()`
with the kind-bound source schema. Export `GateSource` discriminated union
as a convenience alias.

**Verification:** `npx tsc --noEmit` compiles. `biome check src/schemas/gate.ts`
passes. (Tests will still be red — expected mid-slice.)

### Slice 2: Add superRefine to Step union for ref closure

**Files:** `src/schemas/step.ts`

**Change:** Wrap `Step = z.discriminatedUnion(...)` with `.superRefine(...)`
as shown in Seam B. No other step.ts edits — the typed source flows
through existing variant schemas unchanged.

**Verification:** `npx tsc --noEmit` compiles. The existing
`Step.safeParse(...)` call sites in tests still resolve to the same
inferred type.

### Slice 3: Update existing positive tests to typed source shape

**Files:** `tests/contracts/schema-parity.test.ts`

**Change:** Rewrite gate sources at lines 91, 98, 155-159, 177, 191, 201,
211, 225-229 from `source: '<string>'` to
`source: { kind: '<correct-kind>', ref: '<slot-name>' }`. Adjust any test
that asserts the string form.

**Verification:** `npm run test` — all existing 34 tests pass under new
shape.

### Slice 4: Add new negative contract tests for MED-#7

**Files:** `tests/contracts/schema-parity.test.ts`

**New tests (minimum 4):**

1. `Gate rejects unknown source.kind` — e.g.,
   `{ kind: 'schema_sections', source: { kind: 'bogus', ref: 'artifact' }, required: ['x'] }`.
2. `SynthesisStep rejects gate.source.ref that does not name a writes slot`
   — source.kind=artifact but ref='missing'.
3. `CheckpointStep rejects gate.source.ref that does not name a writes slot`
   — source.kind=checkpoint_response but ref='nope'.
4. `DispatchStep rejects gate.source.ref that does not name a writes slot`
   — source.kind=dispatch_result but ref='ghost'.
5. (Optional, if compile-time already rejects:) `Cross-kind mismatch
   rejected at runtime` — construct via `as unknown as Gate` cast to
   simulate bypass, assert `Step.safeParse(...)` still fails. If cast
   cannot bypass, document that the type system already prevents
   construction.

**Verification:** `npm run test` reports count ≥ 38.

### Slice 5: Author specs/contracts/step.md

**Files:** `specs/contracts/step.md` (new)

**Content (section outline):**
- YAML frontmatter: contract=step, status=draft, version=0.1,
  schema_source=src/schemas/step.ts, last_updated=2026-04-18,
  depends_on=[ids, gate, selection-policy].
- Preamble (one paragraph): Step is the atomic unit; three variants;
  discriminated on `kind`.
- Ubiquitous language pointer to `specs/domain.md#core-types`.
- Invariants: STEP-I1..STEP-IN (see roster below).
- Pre-conditions.
- Post-conditions.
- Property ids (reserved for Phase 2).
- Cross-contract dependencies (gate, selection-policy, workflow).
- Failure modes (carry-forward items from evidence).
- Evolution (v0.1 → v0.2 → v1.0).

**Planned invariant roster:**
- STEP-I1 — Kind-variant binding: `kind`, `executor`, `gate.kind`, and
  `writes` shape are coupled per variant.
- STEP-I2 — Non-empty routes: every step declares ≥1 route target.
- STEP-I3 — Gate source closure (MED-#7 closed): `gate.source.ref` names
  an actual slot in `writes`.
- STEP-I4 — Gate kind matches variant:
  SynthesisStep → schema_sections + artifact source;
  CheckpointStep → checkpoint_selection + checkpoint_response source;
  DispatchStep → result_verdict + dispatch_result source.
- STEP-I5 — Budget bounds: `budgets.max_attempts` ∈ [1, 10] when present.
- STEP-I6 — Role only on dispatch: only `DispatchStep` carries a
  `DispatchRole`; synthesis and checkpoint steps have no role field.
- STEP-I7 — Protocol required: all steps carry a `ProtocolId`.

### Slice 6: Close MED-#7 in workflow.md

**Files:** `specs/contracts/workflow.md`

**Change:** Replace the "Gate source tightening (Phase 1 open)" paragraph
with a closed-pointer: *"Closed in step.md v0.1 (STEP-I3 + STEP-I4). See
`specs/contracts/step.md`."* Update `last_updated` to 2026-04-18.

## Verification Commands

```bash
cd /Users/petepetrash/Code/circuit-next && npm run verify
```

Run after each slice completes where practical (Slices 1-2 will be red
until Slice 3 lands; Slices 4+ must be green).

Full-slice gate before commit:

```bash
cd /Users/petepetrash/Code/circuit-next && \
  npm run verify && \
  rg -n "gate\.source" src/ tests/ specs/ && \
  wc -l specs/contracts/step.md
```

Expected:
- `npm run verify` green.
- `rg` reports `gate.source` references only in `specs/contracts/*.md`
  documentation prose (not in code/tests as a bare string literal).
- `specs/contracts/step.md` line count reasonable (expect ~120-180 lines,
  comparable to `workflow.md`'s 114).

## Rollback Triggers

- Any seam proof breaks during Slice 1-2: the discriminated-union level
  `.superRefine` approach is unviable in current Zod version → stop,
  restart via Explore to evaluate alternatives.
- Existing tests cannot be mechanically ported to new shape (Slice 3):
  indicates deeper coupling than expected → stop, scope down step.md to
  documentation-only, defer schema change to dedicated MED-#7 slice.
- Codex adversarial pass surfaces a HIGH objection invalidating STEP-I3
  or STEP-I4: abort Review phase, restart Plan with revised seam.
- Test count regresses (impossible given new negatives + preserved
  positives): stop and diagnose before commit.

## Adjacent-Output Checklist

- [x] **Tests:** Required — adding ≥4 new negative tests + updating 7
  positive test sites. Covered in Slices 3-4.
- [x] **Docs:** Required — new `specs/contracts/step.md`; update to
  `specs/contracts/workflow.md` MED-#7 section; update to
  `PROJECT_STATE.md` (Phase 1 progress). Covered in Slices 5-6 + Close.
- [x] **Config:** N/A — no config schema touched.
- [x] **Migrations:** N/A — no runtime state, no persisted data.
- [x] **Observability:** N/A — no runtime yet.
- [x] **Compatibility:** Breaking change to `Gate.source` shape at schema
  level. Acceptable per CLAUDE.md "Bias towards not worrying about legacy
  support or backwards compat"; circuit-next has no external consumers.
  Existing Circuit (`~/Code/circuit`) is unaffected (read-only reference).

## Dispatch plan for Act phase

This slice is a coordinated set of contract + schema + test edits, not
worker-parallelizable. Act will dispatch a single **implementer** via
the workers adapter with CHARTER = this `plan.md` + the slice roster
above, expected relay headings `### Files Changed`, `### Tests Run`,
`### Completion Claim`.

Implementer should NOT invent variants; only the STEP-I roster above is
authorized for this slice. Anything novel becomes a deferred follow-up.
