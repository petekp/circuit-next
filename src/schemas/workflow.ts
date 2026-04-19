import { z } from 'zod';
import { SkillId, StepId, WorkflowId } from './ids.js';
import { Lane } from './lane.js';
import { CANONICAL_PHASES, type CanonicalPhase, Phase, SpinePolicy } from './phase.js';
import { Rigor } from './rigor.js';
import { SelectionOverride } from './selection-policy.js';
import { Step } from './step.js';

const TERMINAL_ROUTE_TARGETS = new Set(['@complete', '@stop', '@escalate', '@handoff']);

export const EntrySignals = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
});
export type EntrySignals = z.infer<typeof EntrySignals>;

export const EntryMode = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  start_at: StepId,
  rigor: Rigor,
  description: z.string().min(1),
  default_lane: Lane.optional(),
});
export type EntryMode = z.infer<typeof EntryMode>;

const WorkflowBody = z
  .object({
    schema_version: z.literal('2'),
    id: WorkflowId,
    version: z.string().min(1),
    purpose: z.string().min(1),
    entry: z
      .object({
        signals: EntrySignals,
        intent_prefixes: z.array(z.string()).default([]),
      })
      .strict(),
    entry_modes: z.array(EntryMode).min(1),
    phases: z.array(Phase).min(1),
    steps: z.array(Step).min(1),
    spine_policy: SpinePolicy,
    default_skills: z.array(SkillId).default([]),
    default_selection: SelectionOverride.optional(),
  })
  .strict();

const issueAt = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

export const Workflow = WorkflowBody.superRefine((wf, ctx) => {
  const stepIds = new Set<string>();
  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    if (step === undefined) continue;
    if (stepIds.has(step.id as unknown as string)) {
      issueAt(ctx, ['steps', i, 'id'], `duplicate step id: ${step.id}`);
    } else {
      stepIds.add(step.id as unknown as string);
    }
  }

  const phaseIds = new Set<string>();
  for (let i = 0; i < wf.phases.length; i++) {
    const phase = wf.phases[i];
    if (phase === undefined) continue;
    if (phaseIds.has(phase.id as unknown as string)) {
      issueAt(ctx, ['phases', i, 'id'], `duplicate phase id: ${phase.id}`);
    } else {
      phaseIds.add(phase.id as unknown as string);
    }
    for (let j = 0; j < phase.steps.length; j++) {
      const sid = phase.steps[j];
      if (sid === undefined) continue;
      if (!stepIds.has(sid as unknown as string)) {
        issueAt(ctx, ['phases', i, 'steps', j], `phase references unknown step: ${sid}`);
      }
    }
  }

  const entryModeNames = new Set<string>();
  for (let i = 0; i < wf.entry_modes.length; i++) {
    const mode = wf.entry_modes[i];
    if (mode === undefined) continue;
    if (entryModeNames.has(mode.name)) {
      issueAt(ctx, ['entry_modes', i, 'name'], `duplicate entry mode: ${mode.name}`);
    } else {
      entryModeNames.add(mode.name);
    }
    if (!stepIds.has(mode.start_at as unknown as string)) {
      issueAt(
        ctx,
        ['entry_modes', i, 'start_at'],
        `entry mode start_at references unknown step: ${mode.start_at}`,
      );
    }
  }

  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    if (step === undefined) continue;
    for (const [label, target] of Object.entries(step.routes)) {
      if (TERMINAL_ROUTE_TARGETS.has(target)) continue;
      if (!stepIds.has(target)) {
        issueAt(
          ctx,
          ['steps', i, 'routes', label],
          `route target is not @complete/@stop/@escalate/@handoff and not a known step: ${target}`,
        );
      }
    }
  }

  // PHASE-I5: canonical uniqueness. Two phases sharing the same defined
  // canonical label create structural ambiguity about which is "the" canonical
  // phase; rejecting at parse time avoids a silent-convention bug later.
  const canonicalSeenAt = new Map<CanonicalPhase, number>();
  for (let i = 0; i < wf.phases.length; i++) {
    const phase = wf.phases[i];
    if (phase === undefined) continue;
    if (phase.canonical === undefined) continue;
    const prior = canonicalSeenAt.get(phase.canonical);
    if (prior !== undefined) {
      issueAt(
        ctx,
        ['phases', i, 'canonical'],
        `duplicate canonical '${phase.canonical}' — also declared by phase at index ${prior}`,
      );
    } else {
      canonicalSeenAt.set(phase.canonical, i);
    }
  }

  // PHASE-I4: spine policy enforcement (declaration layer). Every non-omitted
  // canonical phase must appear as a Phase.canonical somewhere in wf.phases.
  const declaredCanonicals = new Set<CanonicalPhase>(canonicalSeenAt.keys());
  const omits = new Set<CanonicalPhase>();
  if (wf.spine_policy.mode === 'partial') {
    // MED #6.b: omits must be pairwise unique. Duplicates imply a typo or
    // misunderstanding; both deserve a loud parse failure rather than silent
    // set-collapse semantics.
    const seenOmits = new Set<CanonicalPhase>();
    for (let i = 0; i < wf.spine_policy.omits.length; i++) {
      const o = wf.spine_policy.omits[i];
      if (o === undefined) continue;
      if (seenOmits.has(o)) {
        issueAt(
          ctx,
          ['spine_policy', 'omits', i],
          `duplicate omit: '${o}' is listed more than once`,
        );
      } else {
        seenOmits.add(o);
      }
      omits.add(o);
    }
  }
  // MED #6.a: omits must be disjoint from declared canonicals. A canonical
  // cannot be both declared and omitted; that's self-contradictory bookkeeping.
  for (const o of omits) {
    if (declaredCanonicals.has(o)) {
      issueAt(
        ctx,
        ['spine_policy', 'omits'],
        `canonical '${o}' is both declared as a Phase.canonical AND listed in spine_policy.omits — omits must be disjoint from declared canonicals`,
      );
    }
  }
  for (const canonical of CANONICAL_PHASES) {
    if (omits.has(canonical)) continue;
    if (!declaredCanonicals.has(canonical)) {
      issueAt(
        ctx,
        ['phases'],
        `spine_policy requires canonical phase '${canonical}' — declare a Phase with canonical: '${canonical}', or move it into spine_policy.omits with a rationale`,
      );
    }
  }
});
export type Workflow = z.infer<typeof Workflow>;
