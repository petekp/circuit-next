# Strategic assessment request — circuit-next Phase 1

Hello. I'm reaching past Claude (the orchestrator that has been driving
this project) and Codex (the cross-model challenger we've been using) to
ask you — a stronger model — for independent judgment on where this
project actually is and what we should do next.

Please do not assume this is a code-writing task. It's a strategic
assessment. We want your read on the project's foundations, the
methodology we've been applying, the quality of the work done so far,
and where additional rigor would actually change outcomes versus where
it would just be ceremony. If your best use of this invocation is a
written critique rather than patches, we want the critique.

## Who is asking and why

I'm a product designer who has grown into software over ~10 years of
self-teaching. I ship primarily through AI-assisted coding with Claude
Code (orchestrator) and Codex CLI (challenger). I've been building a
small but ambitious project called **circuit-next**, which is a
methodology-applied rewrite of my existing plugin **circuit**. The
rewrite is not a refactor — it's an attempt to land a rigorous,
type-first, property-backed foundation before reimplementing the runtime.

I want to use you for the slices where depth and insight matter more
than family-diversity (the Claude/Codex pairing already hedges family
correlation per Knight-Leveson 1986). I'm especially interested in
whether the foundations I've laid will hold up under serious pressure,
or whether they've been over-stamped by models that share training
distribution and confirmation bias.

## The two projects

### circuit (existing, stable)

The original Claude Code plugin. Installed and used daily. It turns
common developer/creative workflows (explore, build, repair, migrate,
sweep) into event-backed automations with an implement/review/converge
worker loop, continuity system, and skill catalog.

GitHub: **https://github.com/petekp/circuit**

Treat this as a **read-only reference** for circuit-next's direction —
the patterns that work, the prose/YAML drift that doesn't, the places
the compiler-generated surfaces sprawled past comprehension. Look
especially at the commit history, `CIRCUITS.md`, `commands/`, the
`runtime/` engine under `scripts/runtime/engine/src/`, and the
`CLAUDE.md` warnings (compiler-owned files, plugin cache sync) that
encode pain the rewrite is trying to prevent.

### circuit-next (in-progress, methodology rewrite)

GitHub: **https://github.com/petekp/circuit-next**

Four commits on `main`, working tree clean. Public. The run artifacts
for the just-landed Phase 1 slice are committed under
`.circuit/circuit-runs/phase-1-step-contract-authorship/` — you can
read every artifact I've referenced below directly there (brief, plan,
implementation-handoff, verification, both review artifacts,
implementer report, result).

Structure:

```
circuit-next/
├── CLAUDE.md                        # agent guide (<300 lines; enforced)
├── PROJECT_STATE.md                 # live status snapshot
├── README.md
├── biome.json / tsconfig / package.json
├── bootstrap/                       # Phase 0 evidence drafts (read-only reference now)
│   ├── evidence-draft-claude.md     # Claude's blind internal extraction of circuit
│   ├── evidence-draft-codex.md      # Codex's blind internal extraction of circuit
│   ├── prior-art-audit.md           # audit of 4 in-repo circuit docs against external evidence
│   ├── adversarial-review-codex.md  # Codex's Tier 0 skeleton review: 6 HIGH + 7 MED + 1 LOW
│   └── abstraction-inventory.md
├── specs/
│   ├── evidence.md                  # Phase 0 closure synthesis
│   ├── domain.md                    # ubiquitous-language glossary (Phase 1)
│   ├── risks.md
│   ├── adrs/
│   │   └── ADR-0001-methodology-adoption.md
│   ├── contracts/
│   │   ├── workflow.md              # first Phase 1 contract (v0.1 draft)
│   │   └── step.md                  # just landed: second Phase 1 contract + MED #7 closure
│   ├── behavioral/                  # empty; tracks to author: session-hygiene, prose-yaml-parity, cross-model-challenger
│   └── methodology/                 # symlinks to the tournament-mode methodology decision artifacts
├── src/
│   └── schemas/                     # ~16 Zod + TS schemas, ~700 LOC, architecture-first type skeleton
│       ├── workflow.ts / step.ts / gate.ts / phase.ts / event.ts / ...
│       └── index.ts
└── tests/
    ├── contracts/schema-parity.test.ts   # 46 contract tests
    └── unit/smoke.test.ts                # 1 smoke test
```

## The methodology we're applying

Full decision record is at `specs/methodology/decision.md` (the symlink
resolves to a tournament-mode Explore artifact; it's the authoritative
source). Four pillars:

1. **Contract-First core.** Truth lives in executable specs +
   property tests authored before implementation.
2. **Tiny-Step Ratcheting + lane discipline.** Every slice declares one
   of six lanes (Ratchet-Advance, Equivalence Refactor, Migration
   Escrow, Discovery, Disposable, Break-Glass). Slices ≤ 30 min
   wall-clock. Ratchets must not regress.
3. **Architecture-First types at module boundaries.** `tsc --strict` is
   the first-line defense against local-coherence/global-incoherence.
4. **Narrow cross-model challenger.** Codex produces an *objection list*
   (not approval) for any ratchet change, contract relaxation, escrow,
   discovery promotion, or gate loosening. One Swiss-cheese layer, not
   independent corroboration.

Tier 0 is minimal scaffold. Tier 2+ (container isolation, mutation
testing, property suites, anti-Goodhart ratchet machinery, hidden test
pool) is explicitly deferred until after Phase 1 ratifies contracts.

## The slice that just landed

The first real Phase 1 contract slice:

- **Contract:** `specs/contracts/step.md` — STEP-I1..STEP-I7 invariants
  for the Step module.
- **Schema tightening:** `Gate.source` moved from `z.string()` to a
  typed kind-bound discriminated union, with `ref` as a `z.literal` per
  source kind (artifact → `'artifact'`, checkpoint_response →
  `'response'`, dispatch_result → `'result'`). `.strict()` on every
  variant. Defense-in-depth `superRefine` at the `Step` union level
  with `Object.hasOwn` + undefined guard.
- **Tests:** baseline 33 contract → 46 (+13). Mix of literal-layer
  negatives and `.strict()` surplus-key negatives.
- **Codex cross-model challenger ran twice.** First pass raised 3 HIGH
  + 3 MED + 1 LOW objections, all incorporated. Second pass ratified
  closure with a single stale-docs residual (fixed post-review).

The Codex review artifact (`specs/contracts/../review.md` in run root)
is worth reading — it's a concrete sample of our current challenger
quality. Key context: all three HIGHs were **conceptual** not
implementation bugs. They should have been caught at Plan, not Review.
That is the specific weakness I want your judgment on.

## What I'm asking you to do

Produce an honest, independent assessment. The deliverable is whatever
format you believe will be highest-signal. Your brief, in priority
order:

1. **Audit the foundations.** Read `specs/evidence.md`, `specs/domain.md`,
   `specs/contracts/workflow.md`, `specs/contracts/step.md`, and the
   schemas. Attack them for:
   - Tautologies (terms or invariants that cannot discriminate a bad
     case from a good one).
   - Cherry-picked convergence in the evidence synthesis.
   - Missing distinctions the domain glossary needs to make.
   - Invariant gaps — things the contracts should forbid but don't.
   - Cross-contract composition failures (workflow.md and step.md each
     read fine alone; do they compose?).
   - Places where circuit's lived experience (visible in
     https://github.com/petekp/circuit) was not inherited correctly.

2. **Evaluate the methodology.** Four pillars, stated above. Are any of
   them ceremony? Are any too thin? Does the "narrow cross-model
   challenger" pattern actually work when Claude and Codex both miss
   the same conceptual seams? Propose concrete adjustments if they
   would pay for themselves.

3. **Recommend the optimal next move for Phase 1.** Remaining contract
   stubs: `phase.md`, `run.md`, `selection.md`, `adapter.md`,
   `continuity.md`, `skill.md`. Plus three behavioral tracks
   (`session-hygiene.md`, `prose-yaml-parity.md`,
   `cross-model-challenger.md`). Tell me the order that maximizes
   falsifiability and minimizes rework, and justify it. You may
   propose merging or splitting contracts, or authoring one
   differently than the workflow.md/step.md template suggests.

4. **Identify what you would have caught at Plan.** Read the Plan-
   phase artifact for the step slice
   (`.circuit/circuit-runs/phase-1-step-contract-authorship/artifacts/plan.md`)
   and the Codex review that followed. Which objections would you have
   surfaced *before* implementation? This is calibration data for how
   much value a stronger-model pre-authorship pass would actually add.

5. **Surface blindspots.** Things Claude and Codex may both have missed
   because of shared training distribution, or because the methodology
   itself is suppressing them. Examples: concurrent-run semantics,
   error-message catalog, operator-facing error surfaces, security /
   sandbox escape paths, failure modes during continuity resume, the
   `events.ndjson is authority, state.json is projection` claim's
   failure modes under partial writes. These are hypotheses, not
   prescriptions.

## Non-constraints

Do **not** treat this as a checkbox list. Skip anything that's not
high-signal. Combine categories if the honest structure differs from
what I've suggested. Disagree with the framing if you think the
question is wrong. Propose a different deliverable shape if my
requested one is the wrong vehicle for what you actually want to say.

The only thing I care about: that you tell me what you actually see,
not what you think I want to hear. Err toward sharper criticism than
polite agreement. The goal is to catch problems now, while circuit-
next is still cheap to reshape, rather than during Phase 2
implementation when it won't be.

## Format of your response

You pick the shape. Structured lists + file:line citations are usually
highest-signal here. Proofs-of-claim (concrete adversarial inputs,
constructed counterexamples) carry more weight than abstract
objections. Property-test seeds and generator sketches are welcome. A
direct "here's what I'd do differently and why" paragraph is welcome.

If there are things you'd need to see that aren't in the repos — tell
me what, and I'll get it to you.

Thank you. I'll read your whole response before responding.
