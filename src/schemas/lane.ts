import { z } from 'zod';

export const Lane = z.enum([
  'ratchet-advance',
  'equivalence-refactor',
  'migration-escrow',
  'discovery',
  'disposable',
  'break-glass',
]);
export type Lane = z.infer<typeof Lane>;

const LaneBase = z.object({
  failure_mode: z.string().min(1),
  acceptance_evidence: z.string().min(1),
  alternate_framing: z.string().min(1),
});

export const MigrationEscrowLane = LaneBase.extend({
  lane: z.literal('migration-escrow'),
  expires_at: z.string().datetime(),
  restoration_plan: z.string().min(1),
}).strict();
export type MigrationEscrowLane = z.infer<typeof MigrationEscrowLane>;

export const BreakGlassLane = LaneBase.extend({
  lane: z.literal('break-glass'),
  post_hoc_adr_deadline_at: z.string().datetime(),
}).strict();
export type BreakGlassLane = z.infer<typeof BreakGlassLane>;

export const StandardLane = LaneBase.extend({
  lane: z.enum(['ratchet-advance', 'equivalence-refactor', 'discovery', 'disposable']),
});
export type StandardLane = z.infer<typeof StandardLane>;

export const LaneDeclaration = z.discriminatedUnion('lane', [
  StandardLane.extend({ lane: z.literal('ratchet-advance') }).strict(),
  StandardLane.extend({ lane: z.literal('equivalence-refactor') }).strict(),
  StandardLane.extend({ lane: z.literal('discovery') }).strict(),
  StandardLane.extend({ lane: z.literal('disposable') }).strict(),
  MigrationEscrowLane,
  BreakGlassLane,
]);
export type LaneDeclaration = z.infer<typeof LaneDeclaration>;
