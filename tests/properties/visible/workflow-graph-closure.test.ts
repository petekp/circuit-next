// Property tests for the five workflow graph closure invariants:
//
//   workflow.prop.route_target_closure   (WF-I4)
//   workflow.prop.entry_mode_reachability (WF-I2)
//   workflow.prop.phase_step_closure     (WF-I3)
//   workflow.prop.terminal_target_coverage (WF-I8)
//   workflow.prop.no_dead_steps          (WF-I9)
//
// The example-based test at tests/contracts/workflow-graph-schema.test.ts
// pins one accept + one reject witness per invariant. This file adds
// width: a deterministic generator emits diverse Workflow payloads,
// each property's predicted answer is computed from the spec, and the
// assertion is that `Workflow.safeParse` agrees with the prediction
// across the whole sample.
//
// Each describe block isolates one law: the spec is built so every
// other closure invariant is satisfied, and the law-of-interest is the
// unique dimension being varied. That keeps the rejection signal
// attributable to exactly one invariant ID — important because Zod's
// superRefine reports all violations, not just the first.

import { describe, expect, it } from 'vitest';

import { Workflow } from '../../../src/index.js';

// Mirrors src/schemas/workflow.ts:9. Duplicated rather than imported
// because TERMINAL_ROUTE_TARGETS is module-private to the schema; the
// property test should be able to fail if the schema's terminal set
// silently changes.
const TERMINAL_TARGETS = ['@complete', '@stop', '@escalate', '@handoff'] as const;
type TerminalTarget = (typeof TERMINAL_TARGETS)[number];

// mulberry32: small, deterministic, well-distributed 32-bit PRNG.
// Chosen over a vanilla LCG because LCG low bits have very short
// period — `rng() % 2` was constant for the seed values used here,
// silently zeroing the accept/reject branches.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function nextInt(rng: () => number, mod: number): number {
  // Uses the upper 32 bits via float multiply rather than `%` to
  // dodge low-bit modulus bias on weaker generators.
  return Math.floor((rng() / 0x100000000) * mod);
}

function nextBool(rng: () => number): boolean {
  return (rng() & 0x80000000) !== 0;
}

function pick<T>(rng: () => number, choices: readonly T[]): T {
  const idx = nextInt(rng, choices.length);
  const value = choices[idx];
  if (value === undefined) {
    throw new Error('pick() called on empty choices');
  }
  return value;
}

interface GraphSpec {
  readonly stepIds: readonly string[];
  // pass-route target per step id; either a step id or a terminal label.
  readonly passTargets: ReadonlyMap<string, string>;
  // entry_modes start_at values; first becomes 'default'.
  readonly entryStartAts: readonly string[];
  // phase.steps[] entries for the single declared phase.
  readonly phaseStepRefs: readonly string[];
}

function buildStep(id: string, passTarget: string): Record<string, unknown> {
  return {
    id,
    title: `Step ${id}`,
    executor: 'orchestrator',
    kind: 'synthesis',
    protocol: `step-${id}@v1`,
    reads: [],
    writes: { artifact: { path: `artifacts/${id}.md`, schema: `${id}@v1` } },
    gate: {
      kind: 'schema_sections',
      source: { kind: 'artifact', ref: 'artifact' },
      required: ['Heading'],
    },
    routes: { pass: passTarget },
  };
}

function buildWorkflow(spec: GraphSpec): Record<string, unknown> {
  return {
    schema_version: '2',
    id: 'build',
    version: '2026-04-27',
    purpose: 'Workflow graph closure property fixture.',
    entry: {
      signals: { include: ['feature'], exclude: [] },
      intent_prefixes: ['develop:'],
    },
    entry_modes: spec.entryStartAts.map((startAt, i) => ({
      name: i === 0 ? 'default' : `mode-${i}`,
      start_at: startAt,
      rigor: 'standard',
      description: 'Property fixture entry mode.',
    })),
    phases: [
      {
        id: 'frame-phase',
        title: 'Frame',
        canonical: 'frame',
        steps: [...spec.phaseStepRefs],
      },
    ],
    steps: spec.stepIds.map((id) => {
      const target = spec.passTargets.get(id);
      if (target === undefined) {
        throw new Error(`spec missing passTarget for step '${id}'`);
      }
      return buildStep(id, target);
    }),
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'property fixture isolating frame phase',
    },
  };
}

// Linear-chain base spec over N steps: a → b → ... → @complete, single
// entry at a, all step ids declared in the phase. Every closure
// invariant is satisfied; mutators below break exactly one dimension.
function chainBase(n: number): GraphSpec {
  if (n < 1) throw new Error('chainBase requires n >= 1');
  const stepIds = Array.from({ length: n }, (_, i) => String.fromCharCode(0x61 + i));
  const passTargets = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    const here = stepIds[i];
    if (here === undefined) continue;
    const next = stepIds[i + 1];
    passTargets.set(here, next ?? '@complete');
  }
  const first = stepIds[0];
  if (first === undefined) throw new Error('chainBase produced empty step list');
  return {
    stepIds,
    passTargets,
    entryStartAts: [first],
    phaseStepRefs: stepIds,
  };
}

describe('workflow.prop.route_target_closure (WF-I4)', () => {
  // Property: for every step's pass route target T, T ∈ stepIds ∪ TERMINAL_TARGETS,
  // else Workflow.safeParse rejects.
  it('rejects exactly when some pass route target is neither a known step id nor a terminal label', () => {
    const rng = mulberry32(0xc105e01); // closure01 — fixed seed, deterministic
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 200; i++) {
      const n = 2 + nextInt(rng, 4); // 2..5 steps
      const base = chainBase(n);
      const passTargets = new Map(base.passTargets);

      // Decide whether to inject a violation (50/50). When violating,
      // pick one step and replace its pass target with an unknown id.
      // The sound branch leaves the chain intact — replacing an
      // intermediate step's pass with a terminal would orphan its
      // successors and trip WF-I9 instead of testing WF-I4.
      const inject = nextBool(rng);
      const violated = inject;
      if (inject) {
        const victim = pick(rng, base.stepIds);
        passTargets.set(victim, `nowhere-${i}`);
      }

      const spec: GraphSpec = { ...base, passTargets };
      const result = Workflow.safeParse(buildWorkflow(spec));

      if (violated) {
        rejectedCount++;
        expect(
          result.success,
          `case ${i}: violation was injected (unknown route target) but Workflow.safeParse accepted`,
        ).toBe(false);
        if (!result.success) {
          // The violation message comes from the WF-I4 loop in the
          // Zod superRefine. Ensure the rejection mentions the
          // route-target-closure failure mode.
          const msg = JSON.stringify(result.error.issues);
          expect(msg, `case ${i}: rejection should cite the unknown route target`).toContain(
            'not @complete/@stop/@escalate/@handoff',
          );
        }
      } else {
        acceptedCount++;
        // Sound graph: must accept. (chainBase + sound retarget keeps
        // every other invariant satisfied.)
        expect(
          result.success,
          `case ${i}: sound graph rejected unexpectedly: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    }

    // Anti-vacuity: confirm both branches actually exercised.
    expect(acceptedCount, 'no accept cases generated — generator is biased').toBeGreaterThan(50);
    expect(rejectedCount, 'no reject cases generated — generator is biased').toBeGreaterThan(50);
  });
});

describe('workflow.prop.entry_mode_reachability (WF-I2)', () => {
  // Property: every entry_modes[].start_at must be a declared step id.
  // (This is the "reachability" of the entry mode into the step graph
  // — without this closure, WF-I9's BFS would seed from a phantom
  // node.) Inject a second entry mode whose start_at is varied.
  it('rejects exactly when some entry_mode.start_at is not a declared step id', () => {
    const rng = mulberry32(0xc105e02);
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 200; i++) {
      const n = 2 + nextInt(rng, 4);
      const base = chainBase(n);

      // First entry mode is always the valid 'a' from chainBase. Add
      // a second entry mode that may or may not be valid.
      const inject = nextBool(rng);
      const violated = inject;
      const secondStartAt = inject ? `phantom-${i}` : pick(rng, base.stepIds); // any declared step is sound

      const spec: GraphSpec = {
        ...base,
        entryStartAts: [...base.entryStartAts, secondStartAt],
      };
      const result = Workflow.safeParse(buildWorkflow(spec));

      if (violated) {
        rejectedCount++;
        expect(result.success, `case ${i}: phantom entry start_at accepted unexpectedly`).toBe(
          false,
        );
        if (!result.success) {
          const issuePaths = result.error.issues.map((issue) => issue.path.join('.'));
          expect(
            issuePaths.some((p) => p === 'entry_modes.1.start_at'),
            `case ${i}: rejection should pin to entry_modes[1].start_at; got paths ${JSON.stringify(issuePaths)}`,
          ).toBe(true);
        }
      } else {
        acceptedCount++;
        // Adding a second entry mode whose start_at is a real step
        // can render a previously-unreachable step reachable, so the
        // graph stays sound. But: the second entry mode duplicates
        // the entry-mode name slot. We assigned 'mode-1' earlier;
        // 'default' stays unique. Should accept.
        expect(
          result.success,
          `case ${i}: sound multi-entry graph rejected: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    }

    expect(acceptedCount, 'no accept cases generated — generator is biased').toBeGreaterThan(50);
    expect(rejectedCount, 'no reject cases generated — generator is biased').toBeGreaterThan(50);
  });
});

describe('workflow.prop.phase_step_closure (WF-I3)', () => {
  // Property: for every phase, every entry in phase.steps[] must be a
  // declared step id.
  it('rejects exactly when some phase.steps[] entry is not a declared step id', () => {
    const rng = mulberry32(0xc105e03);
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 200; i++) {
      const n = 2 + nextInt(rng, 4);
      const base = chainBase(n);

      const inject = nextBool(rng);
      const violated = inject;
      // Build phase step refs: take the base (all step ids), and
      // either keep them or append a phantom id.
      const phaseStepRefs = inject
        ? [...base.phaseStepRefs, `ghost-${i}`]
        : [...base.phaseStepRefs];

      const spec: GraphSpec = { ...base, phaseStepRefs };
      const result = Workflow.safeParse(buildWorkflow(spec));

      if (violated) {
        rejectedCount++;
        expect(result.success, `case ${i}: phantom phase.step ref accepted unexpectedly`).toBe(
          false,
        );
      } else {
        acceptedCount++;
        expect(
          result.success,
          `case ${i}: sound phase rejected: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    }

    expect(acceptedCount, 'no accept cases generated — generator is biased').toBeGreaterThan(50);
    expect(rejectedCount, 'no reject cases generated — generator is biased').toBeGreaterThan(50);
  });
});

describe('workflow.prop.terminal_target_coverage (WF-I8)', () => {
  // Property: every step's pass-route chain reaches some terminal
  // label (@complete/@stop/@escalate/@handoff).
  //
  // Generator: chainBase (every step routes forward, last to
  // @complete — every step reaches @complete by construction). Reject
  // mutation: replace one step's pass with itself (self-loop) — that
  // step's pass chain now never reaches a terminal. Accept mutation:
  // re-target the LAST step (which routes to @complete in the base)
  // to a different terminal label — still sound. Other-step
  // re-targets would orphan their successors (WF-I9 cross-talk), so
  // we restrict the sound mutation to the last step only.
  it('rejects exactly when some step cannot reach any terminal route target', () => {
    const rng = mulberry32(0xc105e08);
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 200; i++) {
      const n = 2 + nextInt(rng, 4); // 2..5 steps
      const base = chainBase(n);
      const passTargets = new Map(base.passTargets);

      const inject = nextBool(rng);
      const violated = inject;
      if (inject) {
        // Self-loop on a non-last step. The last step in chainBase
        // already routes to @complete; self-looping it would replace
        // the only terminal in the chain — WF-I8 would still fire
        // but we'd also lose anti-vacuity diversity. Pick from the
        // first n-1 steps so the chain has a stable terminal anchor.
        const victim = pick(rng, base.stepIds.slice(0, n - 1));
        passTargets.set(victim, victim);
      } else {
        // Sound: re-target the last step's pass to a different
        // terminal. The forward chain a→b→...→last is preserved;
        // every step still reaches a terminal.
        const last = base.stepIds[n - 1];
        if (last !== undefined) {
          passTargets.set(last, pick(rng, TERMINAL_TARGETS as readonly TerminalTarget[]));
        }
      }

      const spec: GraphSpec = { ...base, passTargets };
      const result = Workflow.safeParse(buildWorkflow(spec));

      if (violated) {
        rejectedCount++;
        expect(result.success, `case ${i}: self-loop step accepted unexpectedly`).toBe(false);
        if (!result.success) {
          // Self-loop trips both WF-I8 (no terminal reach) and WF-I11
          // (pass chain cycles). Either citation is fine — the
          // property is "self-loop is rejected", not "WF-I8 fires
          // alone". Match either invariant code.
          const msg = JSON.stringify(result.error.issues);
          expect(
            /WF-I8|WF-I11/.test(msg),
            `case ${i}: rejection should cite WF-I8 or WF-I11; got ${msg}`,
          ).toBe(true);
        }
      } else {
        acceptedCount++;
        expect(
          result.success,
          `case ${i}: sound terminal re-target rejected: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    }

    expect(acceptedCount, 'no accept cases generated — generator is biased').toBeGreaterThan(50);
    expect(rejectedCount, 'no reject cases generated — generator is biased').toBeGreaterThan(50);
  });
});

describe('workflow.prop.no_dead_steps (WF-I9)', () => {
  // Property: every declared step is reachable from at least one
  // entry_modes[].start_at by following pass-route edges.
  //
  // Generator: chainBase (entry='a' covers every chain step). Reject
  // mutation: append an extra orphan step 'orphan' to steps[] and to
  // phase.steps[] (so WF-I3 still passes). It routes to @complete (so
  // WF-I8 is fine for it), but no chain step routes into it and no
  // entry_mode starts there — it is unreachable. WF-I9 fires.
  it('rejects exactly when some declared step is unreachable from any entry_mode.start_at', () => {
    const rng = mulberry32(0xc105e09);
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < 200; i++) {
      const n = 2 + nextInt(rng, 4);
      const base = chainBase(n);

      const inject = nextBool(rng);
      const violated = inject;

      let spec: GraphSpec;
      if (inject) {
        const orphanId = `orphan-${i}`;
        const passTargets = new Map(base.passTargets);
        passTargets.set(orphanId, '@complete');
        spec = {
          stepIds: [...base.stepIds, orphanId],
          passTargets,
          entryStartAts: base.entryStartAts,
          phaseStepRefs: [...base.phaseStepRefs, orphanId],
        };
      } else {
        // Sound: leave the chain alone. Every step reachable from
        // entry, no orphans declared.
        spec = base;
      }

      const result = Workflow.safeParse(buildWorkflow(spec));

      if (violated) {
        rejectedCount++;
        expect(result.success, `case ${i}: orphan step accepted unexpectedly`).toBe(false);
        if (!result.success) {
          const msg = JSON.stringify(result.error.issues);
          expect(msg, `case ${i}: WF-I9 violation should be cited`).toContain('WF-I9');
        }
      } else {
        acceptedCount++;
        expect(
          result.success,
          `case ${i}: sound chain rejected: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    }

    expect(acceptedCount, 'no accept cases generated — generator is biased').toBeGreaterThan(50);
    expect(rejectedCount, 'no reject cases generated — generator is biased').toBeGreaterThan(50);
  });
});
