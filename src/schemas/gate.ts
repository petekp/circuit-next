import { z } from 'zod';

// Gate sources are typed refs, not opaque strings (adversarial-review MED #7).
// Each gate variant is kind-bound to exactly one source schema so a
// SchemaSectionsGate cannot carry a dispatch_result source at the type layer
// or at parse time. The `ref` field is a Zod literal per source kind — NOT an
// arbitrary string — so the source kind + ref pair names exactly one write
// slot: artifact → 'artifact', checkpoint_response → 'response',
// dispatch_result → 'result'. This closes Codex review HIGH #1 (prototype-
// chain `in` attack) and HIGH #2 (cross-slot drift) at the type boundary.
// See `specs/contracts/step.md` STEP-I3 and STEP-I4.
//
// `.strict()` is applied on every variant so surplus keys are rejected, not
// stripped (Codex review MED #4 / STEP-I6 enforcement story).

export const ArtifactSource = z
  .object({
    kind: z.literal('artifact'),
    ref: z.literal('artifact'),
  })
  .strict();
export type ArtifactSource = z.infer<typeof ArtifactSource>;

export const CheckpointResponseSource = z
  .object({
    kind: z.literal('checkpoint_response'),
    ref: z.literal('response'),
  })
  .strict();
export type CheckpointResponseSource = z.infer<typeof CheckpointResponseSource>;

export const DispatchResultSource = z
  .object({
    kind: z.literal('dispatch_result'),
    ref: z.literal('result'),
  })
  .strict();
export type DispatchResultSource = z.infer<typeof DispatchResultSource>;

// Convenience alias for callers that want the full source space; individual
// gate variants below constrain to a single kind at the type boundary.
export const GateSource = z.discriminatedUnion('kind', [
  ArtifactSource,
  CheckpointResponseSource,
  DispatchResultSource,
]);
export type GateSource = z.infer<typeof GateSource>;

export const SchemaSectionsGate = z
  .object({
    kind: z.literal('schema_sections'),
    source: ArtifactSource,
    required: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type SchemaSectionsGate = z.infer<typeof SchemaSectionsGate>;

export const CheckpointSelectionGate = z
  .object({
    kind: z.literal('checkpoint_selection'),
    source: CheckpointResponseSource,
    allow: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CheckpointSelectionGate = z.infer<typeof CheckpointSelectionGate>;

export const ResultVerdictGate = z
  .object({
    kind: z.literal('result_verdict'),
    source: DispatchResultSource,
    pass: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ResultVerdictGate = z.infer<typeof ResultVerdictGate>;

export const Gate = z.discriminatedUnion('kind', [
  SchemaSectionsGate,
  CheckpointSelectionGate,
  ResultVerdictGate,
]);
export type Gate = z.infer<typeof Gate>;
