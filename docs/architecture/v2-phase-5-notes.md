# v2 Phase 5 Notes

## 1. Authoring Changes Made

Phase 5 started with two low-risk authoring simplifications:

- `StepExecution` is now a discriminated union keyed by `kind`.
- block execution/stage compatibility policy moved out of
  `flow-schematic.ts` into `flow-schematic-policy.ts`.

These changes make the authoring shape less dependent on flat optional fields
and move policy tables out of deep schema refinement code.

## 2. Compiler Changes Made

No compiler output behavior changed. `compileSchematicToFlow(...)` still emits
the same compiled-flow shape from the same schematic fields.

## 3. Schema Changes Made

`src/schemas/flow-schematic.ts` now models execution kinds as explicit variants:

- compose
- relay
- verification
- checkpoint
- sub-run
- fanout

Relay-specific fields live only on relay execution. Sub-run-specific fields
live only on sub-run execution.

## 4. Behavior Preserved

Existing active schematics still parse. Compiler tests still pass. Generated
flow drift remains clean.

The only intentionally accepted change is error wording for invalid execution
objects: strict discriminated variants now report missing required fields or
unrecognized keys instead of the old manual cross-field messages.

## 5. Generated Manifest Changes

None.

## 6. Intentional Differences

No generated runtime behavior changed.

## 7. Tests Added or Updated

Existing schematic tests were updated to assert the new discriminated validation
surface for invalid relay execution objects. Existing compiler and flow-kind
policy tests cover generated-shape preservation and compatibility policy.

## 8. Remaining Old Authoring Concepts

The following simplifications remain deferred:

- report-ref-first authoring that derives common write paths;
- moving Build checkpoint report policy fully into the Build flow package;
- broader route vocabulary cleanup beyond the existing centralized
  `route-policy.ts` alias map.

These are deferred because they can affect generated manifests and flow-owned
writer contracts. They should be tackled only with manifest-equivalence tests
or documented generated-output differences.
