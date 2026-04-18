### VERDICT
ISSUES FOUND

### SHIP READINESS
ISSUES_FOUND

I would block merge. The main schema change closes the old opaque-string hole only partially: `gate.source.ref` can still name inherited object properties, optional undefined slots, or the wrong existing write slot for the declared source kind.

### OBJECTIONS

1. Severity: HIGH  
   Claim: STEP-I3’s closure check is unsound because it uses the prototype-walking `in` operator.  
   Evidence: `src/schemas/step.ts:75-78` checks `if (!(slot in writes))`; `src/schemas/gate.ts:11-25` allows any non-empty `ref`.  
   Why it matters: A step with `gate.source.ref: "toString"` or `"__proto__"` will satisfy `slot in writes` even though neither is an actual write slot. That directly violates `specs/contracts/step.md:57-64`, which says the ref names an actual slot in `step.writes`. This is not cosmetic; it means the runtime can be handed a parsed Step whose gate source cannot resolve to a real output.  
   Proposed fix: Replace `slot in writes` with `Object.hasOwn(writes, slot)` or `Object.prototype.hasOwnProperty.call(writes, slot)`, and add negative tests for `"toString"`, `"__proto__"`, and `"constructor"` refs.

2. Severity: HIGH  
   Claim: STEP-I3/STEP-I4 do not bind `source.kind` to the semantic write slot it claims to reference.  
   Evidence: `CheckpointResponseSource.ref` and `DispatchResultSource.ref` are unconstrained strings at `src/schemas/gate.ts:17-25`; STEP-I3 only checks membership in `writes` at `src/schemas/step.ts:75-78`; the original MED #7 proposed `ref: 'writes.response'` / `ref: 'writes.result'` in `bootstrap/adversarial-review-codex.md:121-125`.  
   Why it matters: `CheckpointSelectionGate.source.kind === "checkpoint_response"` can point at `ref: "request"`, and `ResultVerdictGate.source.kind === "dispatch_result"` can point at `ref: "receipt"` or `"request"`. Those are existing slots, so the current check accepts them, but the gate no longer validates the thing its source kind names. This is the biggest hidden assumption in the slice: “existing write slot” is weaker than “the correct write slot for this source kind.”  
   Proposed fix: Make refs literal per source kind: `ArtifactSource.ref = z.literal('artifact')`, `CheckpointResponseSource.ref = z.literal('response')`, `DispatchResultSource.ref = z.literal('result')`. If future gates need alternate slots, introduce explicit source kinds or a separate selector field with its own contract.

3. Severity: HIGH  
   Claim: Optional `writes.artifact` can satisfy STEP-I3 while resolving to `undefined`.  
   Evidence: `CheckpointStep.writes.artifact` is `ArtifactRef.optional()` at `src/schemas/step.ts:45-49`; the refinement only checks key presence at `src/schemas/step.ts:75-78`; `specs/contracts/step.md:112-113` promises the runtime may resolve `gate.source` without a nil check.  
   Why it matters: `{ artifact: undefined }` is a present own key, so the current closure logic accepts it. That breaks the post-condition: the slot “exists” structurally but cannot be consumed as an artifact. The same risk applies to dispatch’s optional artifact at `src/schemas/step.ts:58-63`.  
   Proposed fix: Require `Object.hasOwn(writes, slot) && writes[slot] !== undefined`, and add a regression test with `artifact: undefined`. Better: combine this with the source-kind literal fix so checkpoint gates cannot point at optional artifacts unless a future artifact-source gate explicitly allows it.

4. Severity: MED  
   Claim: STEP-I6’s enforcement story is false because Zod objects are not strict by default.  
   Evidence: `specs/contracts/step.md:81-88` says Zod strict object mode rejects surplus `role`; `src/schemas/step.ts:15-66` uses plain `z.object(...).extend(...)` with no `.strict()` / `z.strictObject`; `package.json:18-20` uses Zod 3, where plain objects strip unknown keys.  
   Why it matters: A synthesis or checkpoint input with `role: "researcher"` is accepted and stripped, not rejected. The parsed output is clean, but the contract says “runtime MUST reject” violations at `specs/contracts/step.md:37-39`, and the property roster says no extra keys at `specs/contracts/step.md:131-133`. The prose currently promises stricter behavior than the schema enforces.  
   Proposed fix: Either add `.strict()` / `z.strictObject` to Step variants, nested `writes`, and gate source objects, with negative tests for surplus keys, or revise STEP-I6 and the property text to say unknown keys are stripped rather than rejected.

5. Severity: MED  
   Claim: `.circuit/` should not be in Biome’s verification scope.  
   Evidence: `biome.json:3-5` ignores `node_modules`, `dist`, `coverage`, and `bootstrap`, but not `.circuit`; the implementer report says `.circuit/.../batch.json` was formatted only to unblock verify at `report-step-contract-authorship.md:61-64`.  
   Why it matters: Orchestrator run state is volatile operational data, not source. Having `npm run verify` fail because an untracked `.circuit` JSON artifact is unformatted makes the gate nondeterministic and pressures agents to mutate run evidence just to satisfy lint.  
   Proposed fix: Add `.circuit` to `biome.json.files.ignore`, then rerun `npm run verify`. Do not use formatter writes against run artifacts as the normal path.

6. Severity: MED  
   Claim: The slice did not update the live project state and leaves contradictory closure text.  
   Evidence: The brief requires `PROJECT_STATE.md` update at `brief.md:90-91`; `CLAUDE.md:79-80` says `PROJECT_STATE.md` is the live snapshot; current `PROJECT_STATE.md:49-50`, `PROJECT_STATE.md:89-95`, and `PROJECT_STATE.md:174-176` still say `step.md` and MED #7 are pending. Also, `workflow.md:99-108` says MED #7 is closed, while `workflow.md:112-114` still says v0.2 should decide gate source tightening.  
   Why it matters: This is a contract-authorship slice; stale state and contradictory evolution text are exactly the prose-drift failure mode the project is trying to burn down. It will mislead the next agent about whether MED #7 remains open.  
   Proposed fix: Update `PROJECT_STATE.md` to reflect `step.md` landed, MED #7 closed or partially closed pending this review, and remaining contracts. Update `workflow.md` evolution to say v0.2 should add property tests and resolve any challenger follow-ups, not “decide gate source tightening.”

7. Severity: LOW  
   Claim: STEP-I4 overstates TypeScript exactness for source objects.  
   Evidence: `specs/contracts/step.md:66-74` says the gate/source kind cannot drift at the type layer; `src/schemas/gate.ts:11-25` uses plain object schemas that infer structural object types.  
   Why it matters: TypeScript does constrain the `source.kind` literal for normal `SchemaSectionsGate` assignments, but structural typing still allows extra fields when values flow through variables, and Zod strips those extras unless made strict. This is not the core MED #7 failure, but the prose should not imply exact object identity.  
   Proposed fix: Narrow the prose to “the `source.kind` literal is constrained,” or make the source schemas strict and add tests for surplus source keys.

### ANSWERS TO IMPLEMENTER QUESTIONS

1. Ref grammar: I do not ratify the current bare-name grammar as implemented. Bare names can be fine, but only if `source.kind` constrains the allowed ref: artifact → `artifact`, checkpoint_response → `response`, dispatch_result → `result`. The concrete adversarial example is a dispatch step with `gate.source: { kind: 'dispatch_result', ref: 'receipt' }`; the current closure accepts it because `receipt` exists, while the original dotted literal proposal `writes.result` would have caught it.

2. CheckpointStep optional artifact: Yes, STEP-I3 should additionally reject `writes[ref] === undefined`. The current check misses `{ writes: { request: 'req', response: 'resp', artifact: undefined }, gate.source.ref: 'artifact' }`, which passes key presence but violates the contract’s “runtime may resolve without nil check” post-condition.

3. Dispatch multi-result disambiguator: Deferral is only safe if v0.1 explicitly ratifies “dispatch_result means the single `result` slot.” Current v0.1 does the opposite: it permits any existing dispatch write slot. That leaks the design assumption now. Either lock `dispatch_result.ref` to `result` in v0.1 or add the disambiguator before claiming MED #7 closed.

4. `.circuit/` biome scope: Add `.circuit/` to `biome.json` now. Auto-formatting orchestrator artifacts is not fine as a standing practice because it mutates run evidence and makes verification sensitive to untracked operational state.

5. ADR obligation: No ADR is required for the intended tightening. Replacing “anything-goes string” with typed source objects plus stronger validation is Ratchet-Advance, not a relaxation under `CLAUDE.md:136`. If the team intentionally keeps the weaker “any existing slot” interpretation, that decision should be documented, but the schema tightening itself does not require a relaxation ADR.

### PROPERTY TEST SEEDS

`{input: {kind: 'synthesis', writes: {artifact: {path: 'a.md', schema: 's@v1'}}, gate: {kind: 'schema_sections', source: {kind: 'artifact', ref: 'toString'}, required: ['x']}}, should_fail: true, reason: 'prototype-chain key is not an own writes slot'}`

`{input: {kind: 'synthesis', writes: {artifact: {path: 'a.md', schema: 's@v1'}}, gate: {kind: 'schema_sections', source: {kind: 'artifact', ref: '__proto__'}, required: ['x']}}, should_fail: true, reason: 'prototype-chain key passes `in` today'}`

`{input: {kind: 'checkpoint', writes: {request: 'req.json', response: 'resp.json'}, gate: {kind: 'checkpoint_selection', source: {kind: 'checkpoint_response', ref: 'request'}, allow: ['continue']}}, should_fail: true, reason: 'checkpoint_response must not point at request'}`

`{input: {kind: 'dispatch', executor: 'worker', role: 'researcher', writes: {request: 'r.json', receipt: 'c.json', result: 's.json'}, gate: {kind: 'result_verdict', source: {kind: 'dispatch_result', ref: 'receipt'}, pass: ['ok']}}, should_fail: true, reason: 'dispatch_result must point at result, not receipt'}`

`{input: {kind: 'checkpoint', writes: {request: 'req.json', response: 'resp.json', artifact: undefined}, gate: {kind: 'checkpoint_selection', source: {kind: 'checkpoint_response', ref: 'artifact'}, allow: ['continue']}}, should_fail: true, reason: 'present optional key with undefined is not resolvable'}`

`{input: {kind: 'schema_sections', source: {kind: 'artifact', ref: 'artifact', stray: true}, required: ['Objective']}, should_fail: true, reason: 'only if STEP-I4/STEP-I6 intend strict object rejection; currently Zod strips stray'}`

`{input: {kind: 'schema_sections', source: {kind: 'dispatch_result', ref: 'result'}, required: ['Objective']}, should_fail: true, reason: 'cross-kind source on gate variant should remain rejected'}`

### OVERALL ASSESSMENT

The slice gets the broad direction right. Moving `Gate.source` from an opaque string to a discriminated source object is the right ratchet, and putting the cross-field check on the Step union is the right Zod placement. The new negative tests are also aimed at the right seam: they prove unknown source kinds, cross-kind gate sources, and missing write slots fail.

What it leaves on the table is the adversarial part of MED #7: not just “does this string exist somewhere,” but “does this source resolve to the exact output the gate claims to validate.” The current implementation has three survivable-looking tautologies: `in` means actual slot, optional key means usable value, and source kind plus any existing ref means semantic pairing. Tighten those before merge and this becomes a much stronger Phase 1 contract slice.