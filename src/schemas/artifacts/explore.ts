import { z } from 'zod';

export const ExploreBrief = z
  .object({
    subject: z.string().min(1),
    task: z.string().min(1),
    success_condition: z.string().min(1),
  })
  .strict();
export type ExploreBrief = z.infer<typeof ExploreBrief>;

export const ExploreEvidenceCitation = z
  .object({
    source: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();
export type ExploreEvidenceCitation = z.infer<typeof ExploreEvidenceCitation>;

export const ExploreAspect = z
  .object({
    name: z.string().min(1),
    summary: z.string().min(1),
    evidence: z.array(ExploreEvidenceCitation).min(1),
  })
  .strict();
export type ExploreAspect = z.infer<typeof ExploreAspect>;

export const ExploreAnalysis = z
  .object({
    subject: z.string().min(1),
    aspects: z.array(ExploreAspect).min(1),
  })
  .strict();
export type ExploreAnalysis = z.infer<typeof ExploreAnalysis>;

export const ExploreSynthesisAspect = z
  .object({
    aspect: z.string().min(1),
    contribution: z.string().min(1),
  })
  .strict();
export type ExploreSynthesisAspect = z.infer<typeof ExploreSynthesisAspect>;

export const ExploreSynthesis = z
  .object({
    verdict: z.string().min(1),
    subject: z.string().min(1),
    recommendation: z.string().min(1),
    success_condition_alignment: z.string().min(1),
    supporting_aspects: z.array(ExploreSynthesisAspect).min(1),
  })
  .strict();
export type ExploreSynthesis = z.infer<typeof ExploreSynthesis>;
