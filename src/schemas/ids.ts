import { z } from 'zod';

const slugPattern = /^[a-z][a-z0-9-]*$/;

export const WorkflowId = z.string().regex(slugPattern).brand<'WorkflowId'>();
export type WorkflowId = z.infer<typeof WorkflowId>;

export const PhaseId = z.string().regex(slugPattern).brand<'PhaseId'>();
export type PhaseId = z.infer<typeof PhaseId>;

export const StepId = z.string().regex(slugPattern).brand<'StepId'>();
export type StepId = z.infer<typeof StepId>;

export const RunId = z.string().uuid().brand<'RunId'>();
export type RunId = z.infer<typeof RunId>;

export const InvocationId = z
  .string()
  .regex(/^inv_[a-f0-9-]+$/)
  .brand<'InvocationId'>();
export type InvocationId = z.infer<typeof InvocationId>;

export const SkillId = z.string().regex(slugPattern).brand<'SkillId'>();
export type SkillId = z.infer<typeof SkillId>;

export const ProtocolId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*@v\d+$/)
  .brand<'ProtocolId'>();
export type ProtocolId = z.infer<typeof ProtocolId>;
