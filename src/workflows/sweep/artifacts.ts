import { z } from 'zod';
import { VerificationCommand, VerificationResult } from '../../schemas/verification.js';

const SWEEP_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'sweep.brief': 'sweep.brief@v1',
  'sweep.analysis': 'sweep.analysis@v1',
  'sweep.queue': 'sweep.queue@v1',
  'sweep.batch': 'sweep.batch@v1',
  'sweep.verification': 'sweep.verification@v1',
  'sweep.review': 'sweep.review@v1',
} as const;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

export const SweepType = z.enum(['cleanup', 'quality', 'coverage', 'docs-sync']);
export type SweepType = z.infer<typeof SweepType>;

export const SweepConfidence = z.enum(['low', 'medium', 'high']);
export type SweepConfidence = z.infer<typeof SweepConfidence>;

export const SweepRisk = z.enum(['low', 'medium', 'high']);
export type SweepRisk = z.infer<typeof SweepRisk>;

export const SweepBrief = z
  .object({
    objective: z.string().min(1),
    sweep_type: SweepType,
    scope: z.string().min(1),
    success_criteria: NonEmptyStringArray,
    scope_exclusions: z.array(z.string().min(1)),
    out_of_scope: z.array(z.string().min(1)),
    high_risk_boundaries: z.array(z.string().min(1)),
    verification_command_candidates: z.array(VerificationCommand).min(1),
  })
  .strict();
export type SweepBrief = z.infer<typeof SweepBrief>;

export const SweepCandidate = z
  .object({
    id: z.string().min(1),
    category: z.string().min(1),
    path: z.string().min(1),
    description: z.string().min(1),
    confidence: SweepConfidence,
    risk: SweepRisk,
  })
  .strict();
export type SweepCandidate = z.infer<typeof SweepCandidate>;

export const SweepAnalysis = z
  .object({
    verdict: z.literal('accept'),
    summary: z.string().min(1),
    candidates: z.array(SweepCandidate).min(1),
  })
  .strict()
  .superRefine((analysis, ctx) => {
    const seen = new Set<string>();
    for (const [index, candidate] of analysis.candidates.entries()) {
      if (seen.has(candidate.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidates', index, 'id'],
          message: `duplicate candidate id: ${candidate.id}`,
        });
      }
      seen.add(candidate.id);
    }
  });
export type SweepAnalysis = z.infer<typeof SweepAnalysis>;

export const SweepAction = z.enum(['act', 'prove-then-act', 'prove', 'defer']);
export type SweepAction = z.infer<typeof SweepAction>;

export const SweepQueueItem = z
  .object({
    candidate_id: z.string().min(1),
    action: SweepAction,
    rationale: z.string().min(1),
  })
  .strict();
export type SweepQueueItem = z.infer<typeof SweepQueueItem>;

export const SweepQueue = z
  .object({
    classified: z.array(SweepQueueItem).min(1),
    to_execute: z.array(z.string().min(1)),
    deferred: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((queue, ctx) => {
    const classifiedIds = new Set(queue.classified.map((item) => item.candidate_id));
    const seenClassified = new Set<string>();
    for (const [index, item] of queue.classified.entries()) {
      if (seenClassified.has(item.candidate_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['classified', index, 'candidate_id'],
          message: `duplicate classified candidate_id: ${item.candidate_id}`,
        });
      }
      seenClassified.add(item.candidate_id);
    }
    for (const [index, id] of queue.to_execute.entries()) {
      if (!classifiedIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to_execute', index],
          message: `to_execute references unclassified candidate_id: ${id}`,
        });
      }
    }
    for (const [index, id] of queue.deferred.entries()) {
      if (!classifiedIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deferred', index],
          message: `deferred references unclassified candidate_id: ${id}`,
        });
      }
    }
    const executeSet = new Set(queue.to_execute);
    const deferredSet = new Set(queue.deferred);
    for (const id of executeSet) {
      if (deferredSet.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to_execute'],
          message: `candidate_id appears in both to_execute and deferred: ${id}`,
        });
      }
    }
  });
export type SweepQueue = z.infer<typeof SweepQueue>;

export const SweepBatchItemStatus = z.enum(['acted', 'reverted', 'partial']);
export type SweepBatchItemStatus = z.infer<typeof SweepBatchItemStatus>;

export const SweepBatchItemResult = z
  .object({
    candidate_id: z.string().min(1),
    status: SweepBatchItemStatus,
    evidence: z.string().min(1),
  })
  .strict();
export type SweepBatchItemResult = z.infer<typeof SweepBatchItemResult>;

export const SweepBatchVerdict = z.enum(['accept', 'partial', 'reverted']);
export type SweepBatchVerdict = z.infer<typeof SweepBatchVerdict>;

export const SweepBatch = z
  .object({
    verdict: SweepBatchVerdict,
    summary: z.string().min(1),
    changed_files: z.array(z.string().min(1)),
    items: z.array(SweepBatchItemResult).min(1),
  })
  .strict()
  .superRefine((batch, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of batch.items.entries()) {
      if (seen.has(item.candidate_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'candidate_id'],
          message: `duplicate item candidate_id: ${item.candidate_id}`,
        });
      }
      seen.add(item.candidate_id);
    }
    const allReverted = batch.items.every((item) => item.status === 'reverted');
    const anyActed = batch.items.some((item) => item.status === 'acted');
    const anyReverted = batch.items.some((item) => item.status === 'reverted');
    const expectedVerdict =
      allReverted && batch.items.length > 0
        ? 'reverted'
        : anyReverted || !anyActed
          ? 'partial'
          : 'accept';
    if (batch.verdict !== expectedVerdict) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `verdict must be '${expectedVerdict}' for the observed item statuses`,
      });
    }
  });
export type SweepBatch = z.infer<typeof SweepBatch>;

export const SweepVerification = VerificationResult;
export type SweepVerification = z.infer<typeof SweepVerification>;

export const SweepReviewVerdict = z.enum([
  'clean',
  'minor-injections',
  'critical-injections',
  'reject',
]);
export type SweepReviewVerdict = z.infer<typeof SweepReviewVerdict>;

export const SweepReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type SweepReviewFinding = z.infer<typeof SweepReviewFinding>;

export const SweepReview = z
  .object({
    verdict: SweepReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(SweepReviewFinding),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (review.verdict !== 'clean' && review.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: `findings must be non-empty when verdict is '${review.verdict}'`,
      });
    }
  });
export type SweepReview = z.infer<typeof SweepReview>;

export const SweepResultOutcome = z.enum(['complete', 'partial', 'reverted', 'failed']);
export type SweepResultOutcome = z.infer<typeof SweepResultOutcome>;

export const SweepResultArtifactId = z.enum([
  'sweep.brief',
  'sweep.analysis',
  'sweep.queue',
  'sweep.batch',
  'sweep.verification',
  'sweep.review',
]);
export type SweepResultArtifactId = z.infer<typeof SweepResultArtifactId>;

export const SweepResultArtifactPointer = z
  .object({
    artifact_id: SweepResultArtifactId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = SWEEP_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.artifact_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for artifact_id '${pointer.artifact_id}'`,
      });
    }
  });
export type SweepResultArtifactPointer = z.infer<typeof SweepResultArtifactPointer>;

export const SweepResult = z
  .object({
    summary: z.string().min(1),
    outcome: SweepResultOutcome,
    verification_status: z.enum(['passed', 'failed']),
    review_verdict: SweepReviewVerdict,
    deferred_count: z.number().int().nonnegative(),
    artifact_pointers: z.array(SweepResultArtifactPointer).length(6),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<SweepResultArtifactId>();
    for (const [index, pointer] of result.artifact_pointers.entries()) {
      if (seen.has(pointer.artifact_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers', index, 'artifact_id'],
          message: `duplicate artifact_id '${pointer.artifact_id}'`,
        });
      }
      seen.add(pointer.artifact_id);
    }
    for (const artifactId of SweepResultArtifactId.options) {
      if (!seen.has(artifactId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers'],
          message: `missing artifact_id '${artifactId}'`,
        });
      }
    }
  });
export type SweepResult = z.infer<typeof SweepResult>;
