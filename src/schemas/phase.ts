import { z } from 'zod';
import { PhaseId, StepId } from './ids.js';

export const CanonicalPhase = z.enum([
  'frame',
  'analyze',
  'plan',
  'act',
  'verify',
  'review',
  'close',
]);
export type CanonicalPhase = z.infer<typeof CanonicalPhase>;

export const Phase = z.object({
  id: PhaseId,
  title: z.string().min(1),
  canonical: CanonicalPhase.optional(),
  steps: z.array(StepId).min(1),
});
export type Phase = z.infer<typeof Phase>;
