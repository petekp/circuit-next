import { z } from 'zod';
import { SkillId } from './ids.js';

/**
 * SkillDescriptor — docs/contracts/skill.md v0.1.
 *
 * Authority: artifact id `skill.descriptor` in specs/artifacts.json
 * (greenfield surface). Represents the compiled catalog entry for a
 * circuit-next plugin skill — the part a selection resolver can bind by
 * `SkillId` and a catalog compiler can enumerate. This is NOT the
 * Claude Code `SKILL.md` YAML frontmatter shape; that upstream format is
 * an external-protocol INPUT to the catalog compiler, and the catalog
 * compiler emits `SkillDescriptor` as an internal projection. The field
 * sets differ (CC's frontmatter uses `name`/`description`/`trigger`;
 * circuit-next's descriptor uses `id`/`title`/`description`/`trigger`
 * plus `capabilities` and `domain`).
 */

export const SkillDomain = z.enum(['coding', 'design', 'research', 'ops', 'domain-general']);
export type SkillDomain = z.infer<typeof SkillDomain>;

/**
 * SKILL-I6 — raw-input own-property guard (prototype-chain defense).
 * Mirrors continuity.ts CONT-I12 and run.ts. Required catalog fields MUST be
 * own on the raw input; inherited values through the prototype chain are
 * rejected BEFORE Zod's own property access.
 */
const descriptorOwnPropertyGuard = z.custom<unknown>((raw) => {
  if (raw === null || typeof raw !== 'object') return true;
  const guarded = ['id', 'title', 'description', 'trigger'] as const;
  for (const f of guarded) if (!Object.hasOwn(raw, f)) return false;
  return true;
}, 'skill descriptor has inherited (not own) required field; prototype-chain smuggle rejected');

const SkillDescriptorBody = z
  .object({
    id: SkillId,
    title: z.string().min(1),
    description: z.string().min(1),
    trigger: z.string().min(1),
    /**
     * SKILL-I4 — `capabilities`, when present, is a non-empty array of
     * non-empty strings. A catalog entry that has not DECLARED any
     * capabilities should simply omit the field (undefined); an empty
     * list `[]` is an ambiguity bug and rejected.
     */
    capabilities: z.array(z.string().min(1)).min(1).optional(),
    domain: SkillDomain.default('domain-general'),
  })
  .strict();

export const SkillDescriptor = descriptorOwnPropertyGuard.pipe(SkillDescriptorBody);
export type SkillDescriptor = z.infer<typeof SkillDescriptor>;
