import { z } from 'zod';
import { SkillId } from './ids.js';

export const SkillDescriptor = z.object({
  id: SkillId,
  title: z.string().min(1),
  description: z.string().min(1),
  trigger: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  domain: z
    .enum(['coding', 'design', 'research', 'ops', 'domain-general'])
    .default('domain-general'),
});
export type SkillDescriptor = z.infer<typeof SkillDescriptor>;
