import { z } from 'zod';
import { StepId, WorkflowId } from './ids.js';
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
    // Codex HIGH #5 fold-in — legacy skill channels removed. Seed skill set
    // is now expressed through `default_selection.skills = {mode: 'replace',
    // skills: [...]}` so every skill contribution flows through the typed
    // `SkillOverride` operations (SEL-I3). Closes the untyped-bypass path.
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
    // WF-I10 (Slice 27 v0.2, Codex challenger HIGH #1 fold-in). Every step's
    // `routes` must contain a `pass` key. The GateEvaluatedEvent `outcome`
    // field at `src/schemas/event.ts` is `z.enum(['pass', 'fail'])` — uniform
    // across all three gate kinds — so the runtime's route pick on a
    // successful gate outcome looks up `routes['pass']`. A fixture whose
    // routes use author-friendly aliases like `{ success: '@complete' }`
    // would pass WF-I8 (terminal reachable via the `success` edge) and
    // still stall at runtime because `routes['pass']` is undefined on the
    // actual gate outcome. This invariant is the parse-time version of
    // that binding; `fail`-route presence is intentionally deferred to
    // v0.3 / Phase 2 (failure-path handling is not part of the narrow
    // dogfood-run-0 proof and the runtime abort-vs-stall behaviour on a
    // missing `fail` route is not yet specified).
    if (!Object.hasOwn(step.routes, 'pass')) {
      issueAt(
        ctx,
        ['steps', i, 'routes'],
        `WF-I10: step '${step.id}' is missing a 'pass' route key — gate.evaluated emits outcome ∈ {pass, fail} uniformly, so routes must contain 'pass' to route on a successful gate outcome`,
      );
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

  // WF-I8 + WF-I9 (Slice 27, workflow.md v0.2). Graph reachability
  // checks for dogfood-run-0 structural safety. Both checks require
  // that earlier closure invariants already hold structurally: step
  // ids must be unique (otherwise adjacency cannot be keyed), every
  // route target must be either a terminal label or a known step
  // (otherwise the reachability traversal would visit nonexistent
  // nodes), AND every `entry_mode.start_at` must be a known step id
  // (otherwise WF-I9's BFS would seed from nonexistent nodes, giving
  // misleading coverage). Each of those preconditions is already
  // flagged by the WF-I1 / WF-I4 / WF-I2 loops above; when any is
  // malformed, we skip the reachability pass so a single WF-I2
  // violation does not cascade into noisy WF-I9 errors (Codex
  // challenger MED #4 fold-in — WF-I2's test must remain uniquely
  // provable).
  const noDuplicateIds = stepIds.size === wf.steps.length;
  const adjacency = new Map<string, string[]>();
  let allRouteTargetsKnown = true;
  for (const step of wf.steps) {
    if (step === undefined) continue;
    const targets = Object.values(step.routes);
    adjacency.set(step.id as unknown as string, targets);
    for (const t of targets) {
      if (TERMINAL_ROUTE_TARGETS.has(t)) continue;
      if (!stepIds.has(t)) {
        allRouteTargetsKnown = false;
      }
    }
  }
  let allEntryStartsKnown = true;
  for (const mode of wf.entry_modes) {
    if (mode === undefined) continue;
    if (!stepIds.has(mode.start_at as unknown as string)) {
      allEntryStartsKnown = false;
    }
  }

  if (noDuplicateIds && allRouteTargetsKnown && allEntryStartsKnown) {
    // WF-I8 terminal reachability: iterative fixpoint from steps that
    // route directly to a terminal. A step reaches a terminal iff some
    // outgoing route is either a terminal label or a step already
    // known to reach a terminal.
    const terminalReaching = new Set<string>();
    for (const [sid, targets] of adjacency) {
      for (const t of targets) {
        if (TERMINAL_ROUTE_TARGETS.has(t)) {
          terminalReaching.add(sid);
          break;
        }
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [sid, targets] of adjacency) {
        if (terminalReaching.has(sid)) continue;
        for (const t of targets) {
          if (terminalReaching.has(t)) {
            terminalReaching.add(sid);
            changed = true;
            break;
          }
        }
      }
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step === undefined) continue;
      if (!terminalReaching.has(step.id as unknown as string)) {
        issueAt(
          ctx,
          ['steps', i],
          `WF-I8: step '${step.id}' cannot reach any terminal route target (@complete/@stop/@escalate/@handoff) through its routes graph — run bootstrapped from this step (or routed here) could never emit run.closed`,
        );
      }
    }

    // WF-I9 no dead steps: BFS from every entry_mode.start_at, union
    // reachable set. Any step not reached is a silent declaration
    // error (author intended it to execute, but no route path leads
    // there from any entry).
    const reachableFromEntry = new Set<string>();
    const queue: string[] = [];
    for (const mode of wf.entry_modes) {
      if (mode === undefined) continue;
      queue.push(mode.start_at as unknown as string);
    }
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === undefined) continue;
      if (reachableFromEntry.has(cur)) continue;
      reachableFromEntry.add(cur);
      const targets = adjacency.get(cur) ?? [];
      for (const t of targets) {
        if (TERMINAL_ROUTE_TARGETS.has(t)) continue;
        if (stepIds.has(t)) queue.push(t);
      }
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step === undefined) continue;
      if (!reachableFromEntry.has(step.id as unknown as string)) {
        issueAt(
          ctx,
          ['steps', i],
          `WF-I9: step '${step.id}' is not reachable from any entry_mode.start_at via the routes graph — declared but dead`,
        );
      }
    }
  }
});
export type Workflow = z.infer<typeof Workflow>;
