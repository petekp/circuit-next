import { z } from 'zod';

export const Depth = z.enum(['lite', 'standard', 'deep', 'tournament', 'autonomous']);
export type Depth = z.infer<typeof Depth>;

// Depth tiers that require explicit governance checks for consequential decisions.
// `autonomous` is included because auto-resolved checkpoints increase rather than
// decrease the blast radius of a wrong check.
export const CONSEQUENTIAL_RIGORS: readonly Depth[] = ['deep', 'tournament', 'autonomous'];

export const isConsequentialDepth = (r: Depth): boolean => CONSEQUENTIAL_RIGORS.includes(r);
