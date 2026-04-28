import { z } from 'zod';

export const RuntimeProofCompose = z
  .object({
    summary: z.string().min(1),
  })
  .strict();
export type RuntimeProofCompose = z.infer<typeof RuntimeProofCompose>;
