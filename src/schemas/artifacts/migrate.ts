import { z } from 'zod';
import { RunResult } from '../result.js';
import { BuildVerification, BuildVerificationCommand } from './build.js';

const MIGRATE_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'migrate.brief': 'migrate.brief@v1',
  'migrate.inventory': 'migrate.inventory@v1',
  'migrate.coexistence': 'migrate.coexistence@v1',
  'migrate.batch': 'migrate.batch@v1',
  'migrate.verification': 'migrate.verification@v1',
  'migrate.review': 'migrate.review@v1',
} as const;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

// MigrateBrief — operator-facing scope of the migration: source, target,
// success criteria, coexistence appetite, and the verification command
// budget the post-batch Verify step will run.
export const MigrateBrief = z
  .object({
    objective: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    scope: z.string().min(1),
    success_criteria: NonEmptyStringArray,
    coexistence_appetite: z.enum(['none', 'short-window', 'open-ended']),
    rollback_plan: z.string().min(1),
    verification_command_candidates: z.array(BuildVerificationCommand).min(1),
  })
  .strict();
export type MigrateBrief = z.infer<typeof MigrateBrief>;

// MigrateInventoryItem — one migration target the runtime knows about.
// `path` is repository-relative; `category` lets the recipe narrate
// why the item is in scope (e.g., "import-site", "config-file",
// "test-only").
export const MigrateInventoryItem = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();
export type MigrateInventoryItem = z.infer<typeof MigrateInventoryItem>;

// MigrateBatchPlan — a named group of inventory items the Build child
// will migrate in one sub-run. v0 produces a single batch covering all
// inventory items. A future fanout-over-batches slice will produce N
// batches and dispatch them in parallel branches.
export const MigrateBatchPlan = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    item_ids: NonEmptyStringArray,
    rationale: z.string().min(1),
  })
  .strict();
export type MigrateBatchPlan = z.infer<typeof MigrateBatchPlan>;

export const MigrateInventory = z
  .object({
    summary: z.string().min(1),
    items: z.array(MigrateInventoryItem).min(1),
    batches: z.array(MigrateBatchPlan).min(1),
  })
  .strict()
  .superRefine((inventory, ctx) => {
    const itemIds = new Set<string>();
    for (const [index, item] of inventory.items.entries()) {
      if (itemIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: `duplicate inventory item id: ${item.id}`,
        });
      }
      itemIds.add(item.id);
    }
    const batchIds = new Set<string>();
    for (const [batchIndex, batch] of inventory.batches.entries()) {
      if (batchIds.has(batch.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['batches', batchIndex, 'id'],
          message: `duplicate batch id: ${batch.id}`,
        });
      }
      batchIds.add(batch.id);
      for (const [itemIndex, itemId] of batch.item_ids.entries()) {
        if (!itemIds.has(itemId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['batches', batchIndex, 'item_ids', itemIndex],
            message: `batch '${batch.id}' references unknown inventory item id: ${itemId}`,
          });
        }
      }
    }
  });
export type MigrateInventory = z.infer<typeof MigrateInventory>;

// MigrateCoexistence — the strategy for old + new running side-by-side
// while batches are in flight. Captures switchover triggers, the
// observable signal that proves coexistence is healthy, and the
// rollback path the operator can take at any cutover boundary.
export const MigrateCoexistence = z
  .object({
    strategy: z.string().min(1),
    switchover_criteria: NonEmptyStringArray,
    health_signals: NonEmptyStringArray,
    rollback_path: z.string().min(1),
    risks: z.array(z.string().min(1)),
  })
  .strict();
export type MigrateCoexistence = z.infer<typeof MigrateCoexistence>;

// MigrateBatch — the sub-run handler copies the child Build's
// result.json verbatim into the parent's writes.result slot. The shape
// at that path is exactly RunResult; MigrateBatch re-exports it so
// downstream readers (close-writer, tests) have a typed alias to parse
// against. The `verdict` field on the child RunResult is what the
// parent gate.pass admits — derived inside the child by
// deriveTerminalVerdict from its own review dispatch.
export const MigrateBatch = RunResult;
export type MigrateBatch = z.infer<typeof MigrateBatch>;

// MigrateVerification — same shape as BuildVerification (command list,
// pass/fail per command, overall_status). Re-exported so the migrate
// recipe's verify step can read against a migrate-namespaced contract
// without forcing every workflow to re-author the verification shape.
export const MigrateVerification = BuildVerification;
export type MigrateVerification = z.infer<typeof MigrateVerification>;

export const MigrateReviewVerdict = z.enum([
  'cutover-approved',
  'cutover-with-followups',
  'cutover-blocked',
  'reject',
]);
export type MigrateReviewVerdict = z.infer<typeof MigrateReviewVerdict>;

export const MigrateReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type MigrateReviewFinding = z.infer<typeof MigrateReviewFinding>;

export const MigrateReview = z
  .object({
    verdict: MigrateReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(MigrateReviewFinding),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (review.verdict !== 'cutover-approved' && review.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: `findings must be non-empty when verdict is '${review.verdict}'`,
      });
    }
  });
export type MigrateReview = z.infer<typeof MigrateReview>;

export const MigrateResultOutcome = z.enum(['complete', 'cutover-deferred', 'reverted', 'failed']);
export type MigrateResultOutcome = z.infer<typeof MigrateResultOutcome>;

export const MigrateResultArtifactId = z.enum([
  'migrate.brief',
  'migrate.inventory',
  'migrate.coexistence',
  'migrate.batch',
  'migrate.verification',
  'migrate.review',
]);
export type MigrateResultArtifactId = z.infer<typeof MigrateResultArtifactId>;

export const MigrateResultArtifactPointer = z
  .object({
    artifact_id: MigrateResultArtifactId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = MIGRATE_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.artifact_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for artifact_id '${pointer.artifact_id}'`,
      });
    }
  });
export type MigrateResultArtifactPointer = z.infer<typeof MigrateResultArtifactPointer>;

export const MigrateResult = z
  .object({
    summary: z.string().min(1),
    outcome: MigrateResultOutcome,
    verification_status: z.enum(['passed', 'failed']),
    review_verdict: MigrateReviewVerdict,
    batch_count: z.number().int().nonnegative(),
    artifact_pointers: z.array(MigrateResultArtifactPointer).length(6),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<MigrateResultArtifactId>();
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
    for (const artifactId of MigrateResultArtifactId.options) {
      if (!seen.has(artifactId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers'],
          message: `missing artifact_id '${artifactId}'`,
        });
      }
    }
  });
export type MigrateResult = z.infer<typeof MigrateResult>;
