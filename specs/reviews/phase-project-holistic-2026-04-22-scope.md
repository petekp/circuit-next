---
name: phase-project-holistic-2026-04-22-scope
description: Shared scoping charter for the two-prong project-holistic critical review commissioned at HEAD 52bba0a (main). Both the Claude fresh-read prong and the Codex cross-model challenger prong work from this charter. Filed under the phase-comprehensive-review filename slot so the review-records classifier in tests/contracts/cross-model-challenger.test.ts recognizes the prong files; see META fold-in on generalizing the review-kind taxonomy.
type: review-charter
charter_date: 2026-04-22
review_target: phase-project-holistic-2026-04-22
target_kind: phase
phase_target: project-holistic
phase_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main, 2026-04-22)"
target_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main)"
commissioning_session: post-slice-48-push
operator_authorization: "operator explicitly asked for the largest and most exhaustive examination before building further"
paired_prongs:
  - specs/reviews/phase-project-holistic-2026-04-22-claude.md
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md
verdict_vocabulary: [ACCEPT, ACCEPT-WITH-FOLD-INS, REJECT-PENDING-FOLD-INS]
severity_taxonomy: [HIGH, MED, LOW, META]
---

# Project-Holistic Critical Review — Scoping Charter

## Why this review, why now

Circuit-next just closed a large arc (Slice 47 series + Slice 48 — 87 commits
newly pushed to `origin/main`). Phase 2 Implementation is open but only
partway through; two runtime slices (per-step model-and-effort, router
classifier) are ready to open. The operator has commissioned a
project-scope version of the arc-close composition review protocol before
any further runtime work lands.

The per-slice challenger machinery we run today is locally honest but
composition-blind — the P2 foundation composition review (2026-04-21,
`specs/reviews/p2-foundation-composition-review.md`) found five HIGH
boundary-seam failures after every contributing slice passed its own
challenger pass. That empirical result is the precedent for widening the
cadence to project scope at arc-heavy inflection points.

## Target

Full repository tree at HEAD `52bba0a1980bf6bd581171c5f1e2168b4f9d1d65`
on `main`. Working tree is clean. Branch is synced to `origin/main`.

## Scope — included

- `CLAUDE.md` (methodology + lane discipline + composition-review cadence)
- `PROJECT_STATE.md` (authoritative live snapshot)
- `README.md`, `TIER.md` (surface docs + tier posture)
- `specs/methodology/` (authoritative methodology artifacts — Slice 7 amended)
- `specs/domain.md` (ubiquitous-language glossary)
- `specs/contracts/` (all module contracts)
- `specs/behavioral/` (cross-cutting behavioral concerns)
- `specs/adrs/` (ADR-0001 through ADR-0009)
- `specs/plans/` (phase plans + arc plans)
- `specs/risks.md` (risks ledger)
- `specs/artifacts.json`, `specs/artifacts.md` (authority graph)
- `specs/invariants.json`, `specs/ratchet-floor.json` (ratchet state)
- `specs/evidence.md` (Phase 0 close synthesis)
- `specs/reviews/` (review history — for calibration; prior reviews are
  reference, not re-opened)
- `scripts/audit.mjs`, `scripts/doctor.mjs`, `scripts/inventory.mjs`
  (audit + ratchet + discovery machinery)
- `scripts/policy/workflow-kind-policy.mjs` (dispatch policy helper)
- `src/cli/dogfood.ts` (CLI entrypoint)
- `src/runtime/**` (runtime — runner, adapters, reducer, writers)
- `src/schemas/**` (Zod schemas — the contract-runtime layer)
- `src/types/` (type skeleton)
- `tests/contracts/` (contract tests — ratchet-governed)
- `tests/runner/` (runner integration tests)
- `tests/unit/` (unit tests)
- `tests/fixtures/` (AGENT_SMOKE + CODEX_SMOKE fingerprints, golden files)
- `.claude-plugin/plugin.json` (plugin manifest surface)
- Recent 30-commit arc (`git log --oneline -30`) for trajectory evidence

## Scope — explicitly skipped

- `bootstrap/**` (Phase 0 evidence loop, frozen per ADR-0001)
- Prior-gen Circuit at `~/Code/circuit` (read-only reference per CLAUDE.md)
- Raw prior-review transcripts >200KB (e.g. `p2-foundation-composition-review-codex-transcript.md`)
- `.circuit/` runtime dashboard state (passive, not committed modulo this
  charter)
- `package-lock.json` (dependency resolution, not substantive content)

## The eight questions

Both prongs produce findings against all eight. Findings are tagged by
question and severity.

### Q1 — Is the methodology paying for itself?

Where is the discipline catching real failures, and where has ceremony
become the project? Specifically:

- Which gates / ratchets / ADRs have prevented a concrete failure you can
  point to? Which have only generated bureaucratic overhead?
- Is the adversarial-yield-ledger accumulating signal or just passes?
- Are challenger passes finding substance, or are they mechanical
  HIGH/MED/LOW bucket-fill exercises converging to REJECT-THEN-ACCEPT by
  ritual?
- Where is "write an ADR" being used as a substitute for deciding?

### Q2 — Artifact-to-code drift

Do specs, ADRs, and contracts describe what the code actually does?

- Pick three claims from `PROJECT_STATE.md` at random and check them
  against current code. Do they hold?
- Do `specs/contracts/<module>.md` contracts describe the behavior of
  the files under `src/runtime/`, or have they drifted?
- Do ADR "Consequences" sections describe observable consequences, or
  aspirational ones?
- Are `specs/plans/` plans current, or have multiple rewrites left
  stale claims as landmines?

### Q3 — Ratchet validity / Goodhart

What are the ratchets really measuring?

- Is the contract-test-count ratchet (`ratchet-floor.json`) measuring
  invariant coverage or line count?
- Which `scripts/audit.mjs` checks are performative — green because
  the pattern they scan for is avoided rather than because the risk they
  guard is mitigated?
- Where has the failure mode shifted out of the audit's scope such that
  green-on-audit no longer implies safe-on-reality?
- Is the framing-triplet audit measuring that slices are well-framed, or
  that slices carry the right literals to pass the regex?

### Q4 — Trajectory honesty

On track to a working plugin, or drifting into methodology-maintenance?

- What fraction of recent commits advanced user-facing capability vs.
  methodology machinery?
- Does `PROJECT_STATE.md` describe Phase 2 progress honestly, or optimize
  for narrative?
- If the operator handed the plugin to a stranger today, what could they
  actually do with it? What percent of the advertised surface is live?
- What's the shortest plausible path to a working dogfood loop?

### Q5 — Architectural coupling / seams

Do the module boundaries hold up?

- Seam between `runner.ts` and adapters (agent, codex): is the contract
  narrow, or is there leakage?
- Seam between event-writer and reducer: does the reducer own the full
  state transition, or is there hidden state elsewhere?
- Seam between plan files and runtime: are plans read-at-runtime data, or
  embedded conventions the code assumes?
- Seam between `scripts/audit.mjs` and `src/`: is audit observing code, or
  entangled with it in a way that makes the code hostage to audit shape?

### Q6 — Blind spots / correlated failures

Where does the Claude+Codex challenger protocol converge on a belief that
may be wrong because both models share training distribution?

- Name three claims this project treats as obvious that a skeptical
  outsider (unfamiliar with LLM-methodology discourse) might push back on.
- Where is the methodology protecting the project from a threat that
  probably isn't actually threatening, at a cost that is real?
- What methodology components would an experienced staff engineer from a
  non-LLM-centric org find bizarre or unnecessary?
- Where is "correlated failures between Claude and Codex" being used to
  justify ceremony that doesn't actually reduce correlation?

### Q7 — Test validity

Are tests asserting invariants, or exercising code to inflate ratchet
counts?

- Of the 53 test files, how many would catch a real regression in
  user-facing behavior? How many are meta-tests of the methodology itself?
- Which contract tests are tautologies (asserting that a schema parses
  the fixtures generated from that schema)?
- What invariants have NO test coverage today that would cause
  user-visible failure if violated?
- Is the current test count ratchet detecting addition of substance, or
  addition of any-test-shaped-thing?

### Q8 — Completion / implementation gaps

What's partially built? What's a facade?

- Which adapters are real (subprocess + live CLI roundtrip) vs. stubbed?
- Which workflows in `specs/contracts/` have runtime implementations vs.
  contract-only placeholders?
- Which features in `.claude-plugin/plugin.json` route to a live
  execution path?
- What's the smallest demo the plugin can actually do end-to-end from a
  clean install? Is it documented anywhere?

## Verdict vocabulary

Match the existing convention:

- **ACCEPT** — no fold-ins required; methodology + code + trajectory
  are honest and defensible.
- **ACCEPT-WITH-FOLD-INS** — substantive improvements recommended but
  no blockers to continuing Phase 2; fold-ins land across a subsequent
  arc or within the next privileged runtime slice's ceremony.
- **REJECT-PENDING-FOLD-INS** — HIGH findings must be incorporated
  before the next Phase 2 runtime slice opens.

Severity taxonomy:

- **HIGH** — blocks honest continuation; reality diverges from claim in
  a way that will compound.
- **MED** — substantive improvement; risk of compound cost if left.
- **LOW** — quality-of-life fix; operator discretion.
- **META** — observation about the review process or methodology itself
  that the operator should consider separately.

## Anti-sycophancy framing — read this before writing

This is **adversarial lint, not independent corroboration** (per
CLAUDE.md §Cross-model challenger protocol). Two rules:

1. **Convergence between prongs is a WEAK signal.** Claude and Codex
   share training distribution. If both prongs agree the methodology is
   sound, that's approximately what you would expect given the
   methodology was authored by the same distribution. The prongs agreeing
   on a finding is stronger signal than the prongs agreeing on an
   endorsement.

2. **Divergence between prongs deserves disproportionate weight.** When
   the Claude prong says X is fine and the Codex prong says X is broken,
   the operator should read that finding with extra attention — it
   survived one model's sycophantic baseline.

Additional anti-sycophancy instructions for the author of each prong:

- Do NOT open the review by praising the project. If you find yourself
  writing "impressive", "thoughtful", "well-structured", stop and
  delete. Tone is neutral-surgical.
- Every finding must cite specific file + line OR specific claim text.
  "The methodology might be too heavy" is not a finding.
  "`CLAUDE.md:108` says audit is first-line-of-defense but
  `scripts/audit.mjs:3120` check X is unreachable because Y" is a finding.
- If you cannot find a specific file/line backing a finding, downgrade
  it to META or drop it.
- The operator is paying your time; a review that says "looks good" is
  a failure. A review that says "I tried to find N things and here are
  the M I found, here is why I expected more" is a success.
- Prose tautologies ("the methodology is methodology-heavy") should be
  suppressed. Name the concrete cost.

## Output file shape

Each prong writes its output to the path listed in frontmatter
`paired_prongs`, using the same frontmatter shape as prior arc-close
composition reviews (see `specs/reviews/arc-slice-47-composition-review-claude.md`
for an example):

- YAML frontmatter with `verdict`, `severity_counts`, `commands_run`,
  `opened_scope`, `skipped_scope`, `authority`, `fold_in_disposition`.
- Body organized by question (Q1 through Q8), findings under each.
- Each finding carries: severity, title, evidence (cited file/line or
  claim text), risk if left unaddressed, proposed fold-in disposition.
- Close with a consolidated disposition table: HIGH / MED / LOW counts
  per question + overall verdict.

## Workflow

1. Claude prong and Codex prong work independently — each does not see
   the other's output.
2. Operator + dispatcher-Claude synthesize after both land:
   - Mark convergent findings (both prongs raised the same concern).
   - Mark divergent findings (one prong raised, other did not).
   - Mark novel findings (prong-unique).
3. Both passes logged in `specs/reviews/adversarial-yield-ledger.md`.
4. Summary delivered to operator in plain English (three-beat format
   per CLAUDE.md §After-slice operator summary): what holds up, what's
   cracked, what to do next.

## Authority

- CLAUDE.md §Cross-slice composition review cadence (project scope is a
  valid aggregation scope — arc-heavy inflection point between arcs).
- CLAUDE.md §Hard invariants #6 (cross-model challenger required for any
  ratchet change; project-holistic review is the governance version).
- ADR-0001 Addendum B §Phase 2 entry criteria (Phase 2 runtime slices
  presume methodological integrity; this review tests that presumption
  before the next privileged runtime slice opens).
- Operator's explicit 2026-04-22 commission: "largest and most exhaustive
  critical examination before building further."

## Non-goals

- NOT a code-style review. Lint-equivalent findings are LOW at best.
- NOT a test-coverage audit in the line-coverage sense. What matters is
  whether tests assert invariants.
- NOT a security review. Security concerns are LOW unless they indicate
  a structural problem.
- NOT a performance review.
- NOT a documentation-completeness audit. Doc completeness matters only
  where it signals artifact-to-code drift.

## Post-review operational notes (2026-04-22, post-filing)

### Filename slot / classifier fit — META fold-in candidate

**Observation.** The review-records classifier in
`tests/contracts/cross-model-challenger.test.ts:349-361` recognizes four
review kinds by filename prefix: `adr-*`, `(behavioral-)arc-*`,
`*-v<N>.<M>-codex.md`, and `phase-*`. Everything else classifies as
`unknown` and the test at line 406-413 fails. A **project-holistic
critical review** — a sweep broader than a contract, arc, or phase — has
no native slot.

**Resolution chosen for this review (lowest-blast-radius path).** File
the three records under the `phase-` slot with
`target_kind: phase` and `phase_target: project-holistic`. The semantic
stretch: a project-holistic sweep is the "phase-to-date sweep at project
scope" case. The `phase-2-to-date-comprehensive-*` records already
establish the "phase-to-date sweep" pattern; this review generalizes it
one step further. This is a convention-documenting naming choice, not a
schema change — no governance amendment, no classifier change.

**META fold-in (for a future slice, not this one).** Generalize the
review-kind taxonomy so project-holistic reviews have a first-class slot.
Two shapes to consider:

1. **Rename `phase` → `comprehensive`** and make `target_kind` the
   discriminator, with allowed values `phase | project-holistic | arc-to-date`
   etc. Requires classifier update + frontmatter extension + migration of
   the two existing `phase-2-to-date-comprehensive-*` records.
2. **Introduce `project-holistic` as a fifth review kind** with its own
   filename prefix and frontmatter schema. Narrower change but adds
   schema surface.

This fold-in is Codex HIGH Q1 ("methodology-commit dominance") adjacent —
it's exactly the kind of methodology-tightening slice the operator should
weigh against opening a runtime capability slice. Recording it here so
the choice is explicit the next time someone commissions a sweep at this
scope or broader.

**Authority for the current filing choice.** Slice 47-prep phase-review
extras (see inline commentary at
`tests/contracts/cross-model-challenger.test.ts:163-186`) designed the
`phase-*` slot for "a phase or phase-to-date sweep (broader than a
contract or arc)". Project scope satisfies that definition as the
broadest "to-date" aggregation currently possible. No rule violated.
