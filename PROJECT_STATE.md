# PROJECT_STATE — circuit-next

**Last updated:** 2026-04-18 (overnight autonomous run in progress)
**Phase:** 0 — Evidence Loop
**Tier:** 0 — scaffold

## One-minute read

`circuit-next` is a ground-up rewrite of the Circuit Claude Code plugin
(`~/Code/circuit`) driven by an explicit methodology: Contract-First core +
Tiny-Step-Ratcheting lane discipline + Architecture-First types at boundaries
+ narrow cross-model challenger. The methodology itself was chosen through a
tournament-rigor Circuit Explore with adversarial stress-testing (artifacts
symlinked into `specs/methodology/`).

Right now we are in **Phase 0 — Evidence Loop**, running four parallel
evidence workers (Claude + Codex × external-literature + internal-extraction-of-Circuit)
and scaffolding the Tier 0 architectural stub. Output lands at
`specs/evidence.md` and a minimal type/schema skeleton under `src/`. Nothing
is functional yet; the type skeleton compiles and the schemas validate — that
is the whole point of this stage.

## What is in place

Tier 0 scaffold:

- `CLAUDE.md` — agent session guide, <300 lines, lane discipline, verification commands
- `PROJECT_STATE.md` — this file
- `README.md`
- `package.json`, `tsconfig.json` (strict), `biome.json`
- `.gitignore`
- `specs/methodology/` — symlinks to tournament artifacts (brief, analysis, decision, plan, result)
- `specs/adrs/ADR-0001-methodology-adoption.md` — formal methodology adoption
- `specs/risks.md` — accepted + open risks from the tournament decision
- Empty dirs with `.gitkeep`: `bootstrap/`, `specs/contracts/`, `specs/behavioral/`, `src/types/`, `src/schemas/`, `tests/contracts/`, `tests/properties/{visible,hidden}/`, `tests/unit/`, `.claude-plugin/`

## What is running right now (if you are reading this overnight)

Four parallel evidence workers:

1. **Worker A** — Claude external prior-art researcher. Literature + OSS reference projects. Writing to the current external-evidence Explore run under `.circuit/circuit-runs/external-prior-art-evidence-pass-*/phases/analyze-ext/external-evidence.md`.
2. **Worker B** — Codex external prior-art researcher (cross-model challenger). Same targets as Worker A, independent pass. Writing to same run under `.../analyze-cdx/external-evidence.md`.
3. **Worker C** — Claude blind internal extraction of existing Circuit (`~/Code/circuit`). Writes to `bootstrap/evidence-draft-claude.md`. Blind to the 4 in-repo prior-art docs.
4. **Worker D** — Codex blind internal extraction of existing Circuit. Writes to `bootstrap/evidence-draft-codex.md`. Blind to the 4 in-repo prior-art docs.

## What happens when workers complete

Claude orchestrator (this session) synthesizes:

- External: `.circuit/circuit-runs/external-prior-art-evidence-pass-*/artifacts/analysis.md`
- Internal (+ prior-art audit): `specs/evidence.md`

Then the Architecture-First type skeleton at `src/types/` and matching Zod
schemas at `src/schemas/` get drafted, covering: workflow, phase, step, event,
snapshot, config (user/project/invocation precedence), skill descriptor,
model/effort policy. Deliberately minimal — designed so you can read it
tomorrow and understand every line.

Finally, an adversarial Codex worker attacks the type skeleton for hidden
assumptions. Findings are incorporated or documented as deferred.

## What the user asked for overnight

Direct quote (2026-04-17 late): *"I'd love to have a very simple foundation
for circuit-next in place — the foundational architecture, even if it's just
the schemas and types that still need to be fleshed out (this would be ideal
actually; I'd like things to be digestible enough and not too far developed,
so I can more easily keep up and not lose the plot) — that's been rigorously
validated using our new methodology. Ensure that the codebase is fully
equipped with all the validation/verification techniques we discussed, the
methodology synthesizing contract-first, tiny-step-ratcheting,
architecture-first, and plurality of minds."*

Translating to concrete deliverables for morning:

- [x] Tier 0 directory tree + base config files
- [x] CLAUDE.md (methodology-aware, <300 lines)
- [x] PROJECT_STATE.md (this file)
- [x] ADR-0001 documenting methodology adoption
- [x] specs/risks.md
- [x] Tournament methodology artifacts linked under specs/methodology/
- [ ] External evidence pass complete (Workers A + B)
- [ ] Internal Circuit extraction complete (Workers C + D, blind to prior-art docs)
- [ ] Prior-art audit of 4 in-repo docs (`bootstrap/prior-art-audit.md`)
- [ ] Synthesized `specs/evidence.md`
- [ ] Draft `specs/domain.md` (ubiquitous language, minimal)
- [ ] Draft 3-6 module contracts under `specs/contracts/`
- [ ] Type skeleton under `src/types/` (tsc passes)
- [ ] Zod schemas under `src/schemas/` matching types
- [ ] One contract test demonstrating schema + type parity
- [ ] Adversarial review pass on the type skeleton
- [ ] git init + initial commit
- [ ] continuity saved for next session

## Deferred to Tier 1+

- Container isolation; distinct-UID sandbox fallback
- `tests/properties/hidden/` pool; opaque rotation
- Mutation testing gate
- Anti-Goodhart ratchet machinery (quarantine, versioned floors, fingerprinting, meta-ratchets)
- Solo-approval protocol for ratchet weakening
- Registry-lookup install wrapper
- Plugin manifest under `.claude-plugin/` (empty now; Phase 1+)
- Any actual workflow implementation

## How to pick this up tomorrow

1. Read this file top to bottom.
2. Read `specs/evidence.md` — the synthesized Phase 0 output. This is what
   the rewrite is grounded in.
3. Read the type skeleton under `src/types/` and schemas under `src/schemas/`.
   Verify `npm run check` passes.
4. Read the adversarial review output (path noted at the bottom of
   `specs/evidence.md` when it lands).
5. Decide: enter Phase 1 (contract authorship for the first module), or
   iterate on the type skeleton, or rerun the adversarial pass with a new
   angle.

Useful first action tomorrow:

```bash
cd ~/Code/circuit-next
cat PROJECT_STATE.md
npm install
npm run verify
```

If `npm run verify` fails, that is a signal the architecture is not
structurally sound yet — something to address before Phase 1.

## Run state pointers

- External-evidence Explore run (Worker A + B): `.circuit/circuit-runs/external-prior-art-evidence-pass-survey-academic-f/`
- Phase 0 internal-evidence Explore run (Worker C + D): TBD — bootstrap path will be written here when launched
- Tournament methodology artifacts (source of truth): `.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/`

## Invocation id

This overnight run chains to invocation id `inv_ec9c950f-6044-4799-a293-e514fcb95656` from the user's 2026-04-17 late-night `/circuit:run` directive.
