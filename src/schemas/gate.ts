import { z } from 'zod';

export const SchemaSectionsGate = z.object({
  kind: z.literal('schema_sections'),
  source: z.string().min(1),
  required: z.array(z.string().min(1)).min(1),
});
export type SchemaSectionsGate = z.infer<typeof SchemaSectionsGate>;

export const CheckpointSelectionGate = z.object({
  kind: z.literal('checkpoint_selection'),
  source: z.string().min(1),
  allow: z.array(z.string().min(1)).min(1),
});
export type CheckpointSelectionGate = z.infer<typeof CheckpointSelectionGate>;

export const ResultVerdictGate = z.object({
  kind: z.literal('result_verdict'),
  source: z.string().min(1),
  pass: z.array(z.string().min(1)).min(1),
});
export type ResultVerdictGate = z.infer<typeof ResultVerdictGate>;

export const Gate = z.discriminatedUnion('kind', [
  SchemaSectionsGate,
  CheckpointSelectionGate,
  ResultVerdictGate,
]);
export type Gate = z.infer<typeof Gate>;
