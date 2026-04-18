import { z } from 'zod';

export const Rigor = z.enum(['lite', 'standard', 'deep', 'tournament', 'autonomous']);
export type Rigor = z.infer<typeof Rigor>;

// Rigor tiers that require explicit governance gates for consequential decisions.
// `autonomous` is included because auto-resolved checkpoints increase rather than
// decrease the blast radius of a wrong gate.
export const CONSEQUENTIAL_RIGORS: readonly Rigor[] = ['deep', 'tournament', 'autonomous'];

export const isConsequentialRigor = (r: Rigor): boolean => CONSEQUENTIAL_RIGORS.includes(r);
