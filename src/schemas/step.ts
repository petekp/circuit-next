import { z } from 'zod';
import {
  CheckpointSelectionGate,
  FanoutAggregateGate,
  ResultVerdictGate,
  SchemaSectionsGate,
} from './gate.js';
import { ProtocolId, StepId, WorkflowId } from './ids.js';
import { RunRelativePath } from './primitives.js';
import { Rigor } from './rigor.js';
import { SelectionOverride } from './selection-policy.js';
import { VerificationCommand } from './verification.js';

export const DispatchRole = z.enum(['researcher', 'implementer', 'reviewer']);
export type DispatchRole = z.infer<typeof DispatchRole>;

export const ArtifactRef = z.object({
  path: RunRelativePath,
  schema: z.string().min(1),
});
export type ArtifactRef = z.infer<typeof ArtifactRef>;

const StepBase = z.object({
  id: StepId,
  title: z.string().min(1),
  protocol: ProtocolId,
  reads: z.array(RunRelativePath).default([]),
  routes: z.record(z.string(), z.string()).refine((m) => Object.keys(m).length > 0, {
    message: 'Step must declare at least one route (including `@complete`).',
  }),
  selection: SelectionOverride.optional(),
  budgets: z
    .object({
      max_attempts: z.number().int().positive().max(10),
      wall_clock_ms: z.number().int().positive().optional(),
    })
    .optional(),
});

// `.strict()` rejects surplus keys (no `role` on synthesis/checkpoint, no
// stray fields on writes); this backs STEP-I6 and LOW #7 tightening.
export const SynthesisStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('synthesis'),
  writes: z
    .object({
      artifact: ArtifactRef,
    })
    .strict(),
  gate: SchemaSectionsGate,
}).strict();
export type SynthesisStep = z.infer<typeof SynthesisStep>;

export const VerificationStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('verification'),
  writes: z
    .object({
      artifact: ArtifactRef,
    })
    .strict(),
  gate: SchemaSectionsGate,
}).strict();
export type VerificationStep = z.infer<typeof VerificationStep>;

export const CheckpointPolicy = z
  .object({
    prompt: z.string().min(1),
    choices: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1).optional(),
            description: z.string().min(1).optional(),
          })
          .strict(),
      )
      .min(1),
    safe_default_choice: z.string().min(1).optional(),
    safe_autonomous_choice: z.string().min(1).optional(),
    build_brief: z
      .object({
        scope: z.string().min(1),
        success_criteria: z.array(z.string().min(1)).min(1),
        verification_command_candidates: z.array(VerificationCommand).min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    const choiceIds = new Set<string>();
    for (const [index, choice] of policy.choices.entries()) {
      if (choiceIds.has(choice.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['choices', index, 'id'],
          message: `duplicate checkpoint choice '${choice.id}'`,
        });
      }
      choiceIds.add(choice.id);
    }
    for (const [field, value] of [
      ['safe_default_choice', policy.safe_default_choice],
      ['safe_autonomous_choice', policy.safe_autonomous_choice],
    ] as const) {
      if (value !== undefined && !choiceIds.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must reference a declared checkpoint choice`,
        });
      }
    }
  });
export type CheckpointPolicy = z.infer<typeof CheckpointPolicy>;

export const CheckpointStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('checkpoint'),
  policy: CheckpointPolicy,
  writes: z
    .object({
      request: RunRelativePath,
      response: RunRelativePath,
      artifact: ArtifactRef.optional(),
    })
    .strict(),
  gate: CheckpointSelectionGate,
}).strict();
export type CheckpointStep = z.infer<typeof CheckpointStep>;

export const DispatchStep = StepBase.extend({
  executor: z.literal('worker'),
  kind: z.literal('dispatch'),
  role: DispatchRole,
  writes: z
    .object({
      artifact: ArtifactRef.optional(),
      request: RunRelativePath,
      receipt: RunRelativePath,
      result: RunRelativePath,
    })
    .strict(),
  gate: ResultVerdictGate,
}).strict();
export type DispatchStep = z.infer<typeof DispatchStep>;

// Sub-run nests a complete workflow run inside the parent run. The child
// run gets its own RunId (no nesting in run identity); RUN-I3 forbids cross-
// run event smuggling, so audit linkage flows through dedicated sub_run.*
// events at the parent step boundary, not through shared event scope.
//
// `workflow_ref` points to a registered recipe by id + entry mode. Inline
// child workflow definitions are intentionally out of scope — they would
// require recursive Workflow schema, recipe-loader changes, and manifest
// rescoping. Sibling references cover Migrate (Build as inner executor),
// tournament (parallel attempts at one workflow), and crucible patterns.
//
// Child rigor is independent of parent rigor — a deep parent can run a
// lite child for a fast inner check, or vice versa.
export const WorkflowRef = z
  .object({
    workflow_id: WorkflowId,
    entry_mode: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, { message: 'entry_mode must be a kebab-case slug' }),
    // Optional pin to a specific recipe version. Default is the version
    // resolved by the recipe loader at child-bootstrap time.
    version: z.string().min(1).optional(),
  })
  .strict();
export type WorkflowRef = z.infer<typeof WorkflowRef>;

export const SubRunStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('sub-run'),
  workflow_ref: WorkflowRef,
  // Goal string handed to the child workflow at bootstrap. Templating is
  // a runtime concern (e.g., `$upstream_artifact.field` substitution) that
  // resolves before child bootstrap; the schema accepts a plain string.
  goal: z.string().min(1),
  rigor: Rigor,
  writes: z
    .object({
      // The child run's terminal result.json copied into the parent's
      // run-root after the child closes. The parent gate reads this slot.
      result: RunRelativePath,
      // Optional materialized child artifact (e.g., child build-result.json
      // republished verbatim into a parent slot for downstream readers).
      artifact: ArtifactRef.optional(),
    })
    .strict(),
  gate: ResultVerdictGate,
}).strict();
export type SubRunStep = z.infer<typeof SubRunStep>;

// Fanout: N parallel branches, each a sub-run shape, each running in its
// own ephemeral git worktree. The worktree-per-branch coordination strategy
// generalises across consumer patterns (Migrate disjoint batches, tournament
// parallel attempts at one problem, crucible parallel exploration) where
// upfront file-claims would only fit Migrate. Worktrees also isolate build
// state (node_modules, framework caches), not just source files.
//
// Children of a fanout are sub-run shapes only. A future widening to
// per-branch dispatch / synthesis is non-breaking; restricting now keeps
// the surface narrow until a real consumer demands the variation.

// FanoutBranchId regex: kebab-case slug used for static branches and
// post-substitution validation of dynamic templates. Worktree paths and
// per-branch artifact directories derive from this id, so it must be
// filesystem-safe.
const FANOUT_BRANCH_ID_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export const FanoutBranch = z
  .object({
    // Branch identifier; unique across the fanout's branches. Used to
    // derive the per-branch worktree name and the per-branch result
    // directory under `writes.branches_dir/<branch_id>/`.
    branch_id: z
      .string()
      .min(1)
      .max(64)
      .regex(FANOUT_BRANCH_ID_REGEX, { message: 'branch_id must be a kebab-case slug' }),
    workflow_ref: WorkflowRef,
    goal: z.string().min(1),
    rigor: Rigor,
    // Per-branch selection override — useful for tournament-style fanouts
    // where the variation is in adapter / model selection, not workflow.
    selection: SelectionOverride.optional(),
  })
  .strict();
export type FanoutBranch = z.infer<typeof FanoutBranch>;

// FanoutBranchTemplate is the dynamic-fanout authoring shape: same
// fields as FanoutBranch, but `branch_id` and `goal` accept `$item` /
// `$item.<key>` placeholders that the runtime substitutes per item.
// Post-substitution the runtime parses each expanded branch through
// FanoutBranch (strict regex), so authoring placeholders that resolve
// to invalid kebab-case ids fail loudly at runtime, not at parse time.
export const FanoutBranchTemplate = z
  .object({
    branch_id: z.string().min(1).max(64),
    workflow_ref: WorkflowRef,
    goal: z.string().min(1),
    rigor: Rigor,
    selection: SelectionOverride.optional(),
  })
  .strict();
export type FanoutBranchTemplate = z.infer<typeof FanoutBranchTemplate>;

// Note: cross-field refinements (static branch_id uniqueness, dynamic
// template `$item` requirement) are hoisted to the Step union refinement
// at the bottom of this file. `discriminatedUnion('kind', [...])` requires
// ZodObject members; wrapping these variants in `.superRefine(...)` would
// produce ZodEffects and break discrimination.
export const FanoutBranchesStatic = z
  .object({
    kind: z.literal('static'),
    // Author lists every branch upfront. Used by tournaments (N attempts at
    // one workflow, varying selection / rigor) and small fixed crucibles.
    branches: z.array(FanoutBranch).min(1).max(64),
  })
  .strict();
export type FanoutBranchesStatic = z.infer<typeof FanoutBranchesStatic>;

export const FanoutBranchesDynamic = z
  .object({
    kind: z.literal('dynamic'),
    // Branches computed at runtime from an upstream artifact. Authors
    // declare the source artifact + a JSONPath-like dotted path to the
    // iterable + a template branch with `$item.<field>` placeholders.
    // Runtime expands the template per item at fanout.start time and
    // re-parses each expansion through FanoutBranch (strict regex).
    //
    // Used by Migrate where batch count is determined by inventory.
    source_artifact: RunRelativePath,
    items_path: z.string().min(1),
    template: FanoutBranchTemplate,
    // Hard cap to prevent runaway fanouts when the source artifact is
    // unexpectedly large.
    max_branches: z.number().int().positive().max(256).default(16),
  })
  .strict();
export type FanoutBranchesDynamic = z.infer<typeof FanoutBranchesDynamic>;

export const FanoutBranches = z.discriminatedUnion('kind', [
  FanoutBranchesStatic,
  FanoutBranchesDynamic,
]);
export type FanoutBranches = z.infer<typeof FanoutBranches>;

export const FanoutConcurrency = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unbounded') }).strict(),
  z
    .object({
      kind: z.literal('bounded'),
      max: z.number().int().positive().max(64),
    })
    .strict(),
]);
export type FanoutConcurrency = z.infer<typeof FanoutConcurrency>;

// `abort-all` mirrors test-runner default — first child failure stops the
// rest. `continue-others` lets Migrate-style fanouts complete what batches
// they can and surface a partial-failure aggregate.
export const FanoutFailurePolicy = z.enum(['abort-all', 'continue-others']);
export type FanoutFailurePolicy = z.infer<typeof FanoutFailurePolicy>;

export const FanoutStep = StepBase.extend({
  executor: z.literal('orchestrator'),
  kind: z.literal('fanout'),
  branches: FanoutBranches,
  // Default bounded(4) keeps disk and rate-limit pressure sane on
  // unattended runs. Authors who know their parallelism budget can opt
  // into unbounded explicitly.
  concurrency: FanoutConcurrency.default({ kind: 'bounded', max: 4 }),
  on_child_failure: FanoutFailurePolicy.default('abort-all'),
  writes: z
    .object({
      // Parent directory under which the runtime materialises each
      // branch's result.json at `<branches_dir>/<branch_id>/result.json`.
      // The directory is runtime-owned; recipe authors declare its location.
      branches_dir: RunRelativePath,
      // Aggregate artifact summarising all child results, built by the
      // runtime after join. This is the slot the gate reads.
      aggregate: ArtifactRef,
    })
    .strict(),
  gate: FanoutAggregateGate,
}).strict();
export type FanoutStep = z.infer<typeof FanoutStep>;

// Step variants must be `ZodObject`-shaped for `discriminatedUnion`; the
// cross-field `gate.source.ref` closure check lives at the union level so
// the variant schemas stay ZodObject. See CHARTER.md Seam B and
// `docs/contracts/step.md` STEP-I3.
//
// `Object.hasOwn` closes Codex review HIGH #1 (prototype-chain `in` attack).
// The `!== undefined` guard closes HIGH #3 (optional slot present-but-
// undefined). Note: HIGH #1/#2/#3 are already structurally prevented by
// gate.ts's literal `ref` per source kind; this refinement is defense-in-
// depth for any future source kind that relaxes the `ref` literal.
export const Step = z
  .discriminatedUnion('kind', [
    SynthesisStep,
    VerificationStep,
    CheckpointStep,
    DispatchStep,
    SubRunStep,
    FanoutStep,
  ])
  .superRefine((step, ctx) => {
    const slot = step.gate.source.ref;
    const writes = step.writes as Record<string, unknown>;
    if (!Object.hasOwn(writes, slot) || writes[slot] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gate', 'source', 'ref'],
        message: `gate.source.ref "${slot}" does not resolve to a usable slot in step.writes (available: ${Object.keys(writes).join(', ')})`,
      });
    }
    if (step.kind === 'checkpoint') {
      const policyChoiceIds = step.policy.choices.map((choice) => choice.id).sort();
      const gateChoiceIds = [...step.gate.allow].sort();
      if (policyChoiceIds.join('\0') !== gateChoiceIds.join('\0')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', 'allow'],
          message: 'checkpoint gate.allow must exactly match policy.choices ids',
        });
      }
      if (step.writes.artifact !== undefined) {
        if (step.writes.artifact.schema !== 'build.brief@v1') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', 'artifact', 'schema'],
            message: 'checkpoint artifact writing currently supports only build.brief@v1',
          });
        }
        if (step.policy.build_brief === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['policy', 'build_brief'],
            message: 'checkpoint artifact writing build.brief@v1 requires policy.build_brief',
          });
        }
      }
    }
    if (step.kind === 'fanout') {
      // Static fanout: branch_ids must be unique. The runtime derives
      // worktree names and per-branch artifact directories from branch_id;
      // a duplicate would silently collide on disk.
      if (step.branches.kind === 'static') {
        const seen = new Set<string>();
        for (let i = 0; i < step.branches.branches.length; i++) {
          const branch = step.branches.branches[i];
          if (branch === undefined) continue;
          if (seen.has(branch.branch_id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['branches', 'branches', i, 'branch_id'],
              message: `duplicate branch_id '${branch.branch_id}'`,
            });
          } else {
            seen.add(branch.branch_id);
          }
        }
      }
      // Dynamic fanout: template.branch_id must contain `$item` so per-
      // item expansion produces unique ids. Without the placeholder every
      // expanded branch would share an id and collide on disk.
      if (step.branches.kind === 'dynamic') {
        if (!step.branches.template.branch_id.includes('$item')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branches', 'template', 'branch_id'],
            message:
              'dynamic fanout template.branch_id must contain `$item` placeholder so per-item expansion produces unique branch ids',
          });
        }
      }
    }
  });
export type Step = z.infer<typeof Step>;

export const RouteMap = StepBase.shape.routes;
export type RouteMap = z.infer<typeof RouteMap>;
