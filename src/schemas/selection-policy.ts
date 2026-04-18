import { z } from 'zod';
import { SkillId } from './ids.js';
import { Rigor } from './rigor.js';

export const ProviderScopedModel = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'custom']),
  model: z.string().min(1),
});
export type ProviderScopedModel = z.infer<typeof ProviderScopedModel>;

export const Effort = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
export type Effort = z.infer<typeof Effort>;

export const SkillOverride = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit') }),
  z.object({ mode: z.literal('replace'), skills: z.array(SkillId) }),
  z.object({ mode: z.literal('append'), skills: z.array(SkillId) }),
  z.object({ mode: z.literal('remove'), skills: z.array(SkillId) }),
]);
export type SkillOverride = z.infer<typeof SkillOverride>;

export const SelectionOverride = z.object({
  model: ProviderScopedModel.optional(),
  effort: Effort.optional(),
  skills: SkillOverride.default({ mode: 'inherit' }),
  rigor: Rigor.optional(),
  invocation_options: z.record(z.string(), z.unknown()).default({}),
});
export type SelectionOverride = z.infer<typeof SelectionOverride>;

export const ResolvedSelection = z.object({
  model: ProviderScopedModel.optional(),
  effort: Effort.optional(),
  skills: z.array(SkillId),
  rigor: Rigor.optional(),
});
export type ResolvedSelection = z.infer<typeof ResolvedSelection>;

export const SelectionSource = z.enum([
  'default',
  'user-global',
  'project',
  'workflow',
  'phase',
  'step',
  'invocation',
]);
export type SelectionSource = z.infer<typeof SelectionSource>;

export const SELECTION_PRECEDENCE = [
  'default',
  'user-global',
  'project',
  'workflow',
  'phase',
  'step',
  'invocation',
] as const satisfies readonly SelectionSource[];

export const SelectionResolution = z.object({
  resolved: ResolvedSelection,
  applied: z.array(z.object({ source: SelectionSource, override: SelectionOverride })),
});
export type SelectionResolution = z.infer<typeof SelectionResolution>;

// Back-compat alias used by earlier snapshots; prefer ResolvedSelection at new boundaries.
export const SelectionPolicy = SelectionOverride;
export type SelectionPolicy = SelectionOverride;
