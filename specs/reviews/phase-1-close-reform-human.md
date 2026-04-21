---
name: phase-1-close-reform-human
description: L3 cold-read record for the Phase 1 close reform plan, delegated to Claude + Codex as LLM stand-ins. Phase 1.5 Close Criterion #14 final disposition — the canonical non-LLM operator cold-read was not completed; ADR-0006 accepts a weaker substitute by one-time waiver. No operator cold-read section is expected. See §Delegation acknowledgment and ADR-0006 for full rationale.
type: review
review_kind: l3-cold-read
target_kind: plan
target: specs/plans/phase-1-close-revised.md
target_version: 2026-04-20
artifact_commit_base: 6d348cfb26b6aaa1352c85596eb4750ddaf52343
review_date: 2026-04-20
reviewers:
  - reviewer_id: claude-opus-4-7
    reviewer_role: LLM-standin-for-human-cold-read
    mode: cold-read-comprehension
  - reviewer_id: gpt-5-codex
    reviewer_role: LLM-standin-for-human-cold-read
    mode: cold-read-comprehension
    prior_mode_on_same_artifact: adversarial-llm-review (pass 1, 7H/5M/3L, ACCEPT-WITH-FOLD-INS)
operator_delegation_note: 2026-04-20 — Final disposition under ADR-0006 one-time waiver + retarget. Operator initially delegated the L3 non-LLM cold-read to Claude + Codex as LLM stand-ins ("have codex and yourself--your combined expertise-- stand in for me here and for any other non-LLM gates"). On pickup the operator self-assessed that a canonical non-LLM cold-read of this 638-line plan is unobtainable from the operator role without performative compliance. ADR-0006 records this as a one-time waiver and retargets Phase 1.5 Close Criterion #14 to (14a) a product-direction check + (14b) this review as delegated weaker substitute. The LLM stand-in evidence in this file is strictly weaker than a canonical non-LLM zero-context human drill; no authority surface may describe it as equivalent to human review. See §Delegation acknowledgment.
verdict_overall: ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7 + gpt-5-codex
---

# L3 Cold-Read of Phase 1 Close Reform

**Target artifact:** `specs/plans/phase-1-close-revised.md` (638 lines).

**Why this file exists:** the reform plan's own L3 fold-in required a non-LLM
human cold-read recorded here before Slice 25b could land. The operator
initially authorized two LLM stand-ins. On pickup the operator self-assessed
that a canonical non-LLM cold-read of this 638-line plan is unobtainable from
the operator role without performative compliance. **ADR-0006 (2026-04-20)
records this as a one-time waiver** and retargets Phase 1.5 Close Criterion
#14: (14a) a durable operator product-direction check at
`specs/reviews/phase-1.5-operator-product-check.md` + (14b) the two LLM
stand-in sections below as delegated weaker substitute, with the F17 weaker-
evidence flag carried openly in every authority surface. This file is
final-disposition under ADR-0006; no additional operator cold-read section is
expected.

---

## Reviewer 1 — Claude Opus 4.7

### opened_scope

I read `specs/plans/phase-1-close-revised.md` end-to-end once, then skimmed
`CLAUDE.md`, the yield ledger, `specs/methodology/decision.md` header, and
the first + next-slice rows of `PROJECT_STATE.md`. After one careful pass, my
synthesis is:

The reform does three distinct things in one artifact. First, it **schedules
ten methodology deltas** (D1–D10) against `specs/methodology/decision.md`,
rather than installing them all at once. Second, it **sequences eleven-plus
slices** to get from the current HEAD (`6d348cf`, scaffold-heavy, zero
end-to-end `circuit:run`) to `dogfood-run-0` running twice from a clean
checkout. Third, it **installs a discipline around adversarial review itself**
(D10) that caps pass counts (2/3/4 by artifact class), adds a compound
stopping criterion, requires mode-cycle between same-mode review passes, and
treats a pass-count >3 as a signal that the artifact is too large.

Slice 25b — the only slice authorized by this reform to land immediately —
installs exactly four methodology deltas (D1 Product Reality Gate, D4
Governance Authority Graph rule, D9 TIER.md claim matrix, D10 adversarial
review discipline), plus: yield ledger wiring, Product Gate exemption ledger
scaffolding, one combined `scripts/audit.mjs` check (Product Reality Gate
visibility + TIER orphan-claim rejection), a human-cold-read record
requirement (this file), and a self-recorded exemption ledger entry marking
25b itself as a **one-time operator waiver** — explicitly not as proof that
the Gate works. 25b does **not** install D2, D3, D5, D6, D7, or D8; each has
its own trigger-gated later slice (25c after first alpha runner; 25d/26.5 as
explicit ADR-0001 reopen; 25e after runtime-boundary probes; 25f after
dogfood; 25g at Phase 2 close).

The through-line I came away with: the plan is betting that the fastest path
to reducing methodology-runaway risk is to get a runnable product proof
(`dogfood-run-0`) in hand, then self-host methodology evolution on
circuit-next itself (D5 sunset). Along the way, 2026-05-04 is printed as a
forecast several times; the plan is emphatic that this is not acceptance
pressure, and there is a fastest-falsifier checkpoint after Slice 26a that
switches execution to a single Discovery slice if the existing schemas cannot
carry a thin vertical runner.

### skipped_scope

I skimmed rather than absorbed:

- The bullet-level interior of methodology deltas D2, D3, D5, D6, D7, D8 —
  they install in later slices, not 25b, and first-read absorption of all ten
  deltas was past my working-memory capacity. I read each well enough to
  recognize its trigger and target surface, not to reproduce its rules
  verbatim.
- The full Demoted / Deferred / Replaced table. I confirmed the shape and
  spot-checked 28a/28c/30 (the three with cross-references in the slice
  sequence I did read carefully) but did not interrogate every row.
- The individual product-ratchet names. I recognized they exist as a
  replacement for contract-test-count as headline audit signal, but I did not
  verify that every ratchet name has a named enforcement site in the slice
  sequence. My cold-read assumes this will be caught later.
- The dated-forecast rows for 2026-05-18 and 2026-06-01. I read them once,
  noted they are even further out, and did not attempt to audit them.

### "I could not understand X"

Honest first-read opacities, not rhetorical:

- **"one-time operator waiver" is named twice but never fully defined.** The
  plan says Slice 25b is "recorded as a consumed one-time operator waiver,
  not proof that the Gate works." The `product_gate_exemptions` ledger row
  shape is `{ phase_id, slice, reason, consumed: true }`. First-read: what
  does `phase_id` hold when the operator has not yet reopened ADR-0001
  (D3)? Is it `"phase-1"`, `"phase-1.5-alpha-proof"` (the planning
  nickname), or `"pre-phase-1.5"`? The plan does not answer. Executor of
  Slice 25b will have to pick.
- **D10 pass-count categories read as fuzzy on second look.** "Reversible
  work" gets 2 passes; "governance changes" get 3; "irreversible artifacts
  such as schema breaks for external consumers, production migrations, or
  published APIs" get 4. Governance changes are irreversible in the sense
  that methodology rules bind future work. The 3-vs-4 line is a judgment
  call, not a rule. First-read, I cannot classify a future contract-ADR
  with confidence.
- **"artifact types" in the fastest-falsifier tripwire.** "The runner needs
  more than two new artifact types" — does that mean two new rows in
  `specs/artifacts.json`, two new Zod schema files in `src/schemas/`, two
  new backing-path shapes, or something else? The phrase "artifact types"
  is ambiguous across those meanings.
- **The one audit check's shape.** "One `scripts/audit.mjs` check proving
  Product Reality Gate visibility and TIER orphan-claim rejection." On
  first read I could not tell whether this is one check (where both pass or
  both fail together) or one slice's-worth of check work that resolves to
  two named check functions. The distinction matters for D10
  (pass-count-as-artifact-size) because a single check bundling two
  concerns is a smaller cold-read surface but a larger defect surface.
- **Relationship between D10 mode-cycle and the current L3 stand-in.** D10
  says after K same-mode passes, the next defect-discovery effort must come
  from a structurally different mode. Pass 1 on this plan was adversarial
  LLM review. This file is a cold-read by two LLMs. Is cold-read
  comprehension a "structurally different mode" from adversarial LLM
  review? The named examples in D10 are "runtime, human, fuzzer, property
  test" — LLM cold-read is not on that list. First-read, I genuinely do
  not know whether this file satisfies the mode-cycle rule or waives it
  under the operator-delegation note.

### Comprehension objections

One-line bullets; each a first-read comprehension snag, not an adversarial
defect.

- `phase_id` field of the `product_gate_exemptions` ledger should be bound
  to the ADR-0001 phase taxonomy at authoring time; today the bound is
  implicit and the first executor has to invent one.
- "One `scripts/audit.mjs` check proving Product Reality Gate visibility
  and TIER orphan-claim rejection" should say either "one combined check"
  or "two check functions" so the 25b author knows whether to write one
  exported function or two.
- The plan's Slice 25b deliverables list edits to `decision.md` for "D1,
  D4, and D10" but the section heading for D10 in the deltas is
  `D10. Adversarial Review Discipline`. Reader has to cross-check that the
  delta list and the install list both say D10. (They do.) Confusing only
  because D9 is also in 25b but named as a `TIER.md` edit, not a
  `decision.md` edit — a first read can fail to notice which deltas land
  in which file.
- "Spike mining is read-only" and produces "a short inventory of
  event/reducer/manifest lessons that can inform 27c" — the word "inform"
  is unconstrained. A cold reader cannot tell how the plan distinguishes
  "informed by" from "architecture adoption by inertia." 27a forbids code
  cherry-picks but not prose-level architectural echo.
- Slices 27c and 27d acceptance both reference a post-27b inventory diff,
  but the inventory tool (`scripts/inventory.mjs` and `npm run inventory`)
  is authored in 27b. The dependency is correct in the ordered sequence
  but the acceptance language does not say "requires 27b landed first."
- The dogfood-run-0 acceptance item "CLI verifiably loads
  `.claude-plugin/skills/dogfood-run-0/circuit.json`" refers to a file that
  does not exist today and is authored by Slice 27d itself. Unambiguous on
  second read, but first-read can parse as "the CLI must already load this
  file" rather than "27d creates this file + a test that loads it."
- Phase 1.5 Alpha Proof Close Criteria list uses "authoritatively installed"
  for D1/D4/D9/D10. First-read does not know if that means "amended into
  `specs/methodology/decision.md`" or "used as planning rule" or both.
- The `adversarial_yield_ledger_current` product ratchet has no named
  criterion for "current." A cold reader cannot audit it without an
  explicit rule (most-recent entry within N days? at least one entry
  per slice? at least one HIGH per 5 passes? etc.).

### Surprising-honesty objections

Places where the plan reads as politely unclear rather than wrong — a
first-time reader will silently assume the plan means X when it actually
means Y.

- **D1's design-only escape hatch has no maximum expiry.** "A design-only
  Product Reality Gate proof requires an ADR naming the next executable
  proof and an expiry date." A cold reader will silently assume tight
  expiries; the plan does not set a cap. Without a cap, this route can
  slide indefinitely.
- **The 2026-05-04 forecast is repeated four times.** Repetition itself is
  a tell: the plan is worried it will be read as a deadline. A cold reader
  may still treat it as one despite the disclaimers. The alternative —
  deleting the date entirely and replacing it with "est. N slices, gated
  on fastest-falsifier" — would be more honest but less motivating. The
  plan chose motivating.
- **The reform bundles ~15 distinct governance changes** (10 methodology
  deltas + ledger + exemption ledger + audit check + human-review
  requirement + Phase 1.5 nickname + 2026 forecast) but Slice 25b only
  installs 4 methodology deltas and 4 surrounding artifacts. First-read
  confuses "reading the reform" with "reading Slice 25b." The plan could
  be more explicit that the reform is a roadmap + one immediate slice, not
  one self-contained reform.
- **25b bundles four methodology amendments into one slice, the largest
  single-slice methodology change concentration in the project's history.**
  D7 cooling (3-slice gap between normal amendments) is not yet binding at
  25b, so the concentration is legal under current rules. But retroactively
  installing D7 later means future amendments get the cooling treatment
  and 25b is grandfathered. A first-read can miss that this is a deliberate
  "install fast now, cool later" sequencing choice.
- **The "Codex challenger: review the drafted 25b doc set"** step in the
  Slice 25b scope reads at first as a second adversarial pass on this
  plan. It is actually a different artifact (the 25b commit's changes to
  `decision.md`, `TIER.md`, the audit script, etc.). D10 pass count resets
  on the new artifact. The plan could say so explicitly.

### Verdict (Claude reviewer)

**ACCEPT-WITH-FOLD-INS.** No structural blocker. The comprehension
objections are real but small. The surprising-honesty objections point at
calibration choices the plan made, not at misstatements. Proposed fold-ins
for the next revision of the plan are in the combined section below.

---

## Reviewer 2 — GPT-5 Codex

Dispatched via `scripts/run-codex.sh` on 2026-04-20 with a brief explicitly
cold-read-comprehension (not defect-hunting), and explicitly acknowledging
that per D10 mode-cycle rule a second adversarial-defect pass on the same
artifact is not authorized under this dispatch.

### opened_scope (Codex)

Codex read the revised Phase 1 close plan as a reset of the remaining close
arc around one concrete claim: circuit-next should stop earning confidence
only by improving its governance artifacts and must produce an executable
alpha proof before Phase 1 can honestly close. The plan is not trying to
complete all methodology reform up front. It is trying to install enough
governance to prevent the next executor from mistaking better process for
working software, then move through the minimum runner path: config
strictness, snapshot shape split, status/ratchet freshness, ADR-0001
phase-semantics reopen, narrowed workflow contract, read-only spike mining,
inventory baseline, runtime-boundary safety, and finally `dogfood-run-0`.

The next executor is being asked to land Slice 25b, not to implement the
runner yet. Slice 25b is a Ratchet-Advance governance slice with a
deliberately narrow install set: D1, D4, D9, D10, adversarial-yield-ledger
wiring, a Product Gate exemption ledger, the human-cold-read record
requirement, and one audit check. It explicitly must not install D2, D3,
D5, D6, D7, or D8, and it must not touch ADR-0001, ADR-0006, contracts, or
the deferred methodology surfaces.

The first landed slice succeeds when `decision.md` has only D1/D4/D10,
`TIER.md` exists with every claim classified as enforced/planned/not
claimed, the adversarial-yield ledger is hooked up as the D10 evidence
source, Slice 25b is recorded as a consumed one-time Product Gate waiver,
the human cold-read record shape is required, and `scripts/audit.mjs` can
prove at least Product Reality Gate visibility plus TIER orphan-claim
rejection. The success condition is not "the Product Gate works" and not
"Phase 1.5 is authoritative"; 25b is explicitly a bootstrap waiver that
changes future acceptance terms.

Codex also noted that `PROJECT_STATE.md` row 6 still reads
`Phase: 0.5 — Slice 8 Continuity Contract closed...`, which it treated as
an important status-currentness signal rather than background history — a
finding Claude's cold-read missed.

### skipped_scope (Codex)

Codex skimmed D2, D5, D6, D7, and D8 after understanding their trigger
positions because they are not 25b-scoped and install later. It did not
re-open the superseded `arc-remediation-plan-codex.md`, inspect the
implementation files, or verify the existing audit script; this was a
cold-read comprehension pass on the reform plan, not a defect audit.
Codex did not absorb the full `PROJECT_STATE.md`, reading only the
requested next-slice and phase lines. Codex read only enough of
`specs/artifacts.md` to understand the authority-graph context
`artifacts.json` is authoritative, plans are not durable authority, and
audit-backed classification is the existing pattern the new governance
rule is borrowing.

### "I could not understand X" (Codex)

- **Slice naming `25d / 26.5`.** Codex could not understand the slice
  identity at the heading `### Slice 25d / 26.5 — D3 ADR-0001 Reopen` on
  first read. A cold executor needs one canonical slice name for branch
  names, commit bodies, audit/status updates, and cross-references. (Claude
  missed this entirely.)
- **Phase 1.5 Alpha Proof heading promotion.** The plan says to call the
  concept "Phase 1.5 Alpha Proof" in planning prose, then uses
  "Phase 1.5 Alpha Proof Close Criteria" as a major heading. Codex
  parsed that as acceptable because the document is itself planning
  prose, but a first-time reader could wonder whether the heading is
  already asserting phase semantics that D3 says cannot be authoritative
  yet.
- **Exemption ledger file path.** The sentence
  `Product Gate exemption ledger created and populated for Slice 25b with
  { phase_id, slice, reason, consumed: true }` was clear in shape but
  opaque in placement. Codex could not tell where the ledger is supposed
  to live without inferring a path or expecting the 25b executor to
  invent one. (Claude flagged the same via `phase_id` ambiguity.)

### Comprehension objections (Codex)

- The plan asks for a `product_gate_exemptions` ledger but does not name
  a file path, owner file, or expected serialization format.
- Slice `25d / 26.5` has two names, which adds friction exactly where
  the plan is trying to reduce cold-operator load.
- The distinction between "this planning pass schedules methodology
  work" and "Slice 25b installs D1/D4/D9/D10" is easy to lose because
  both are discussed in the same artifact.
- `Phase 1.5 Alpha Proof` is framed as non-authoritative planning prose,
  then used as the close-criteria label; probably fine, but takes a
  second read.
- `PROJECT_STATE.md` row 6 still reads like an old phase state, while
  row 4 points to the revised 25b arc; a cold reader has to decide
  whether that mismatch is known evidence for 26b or an immediate
  status problem.
- D10's compound stopping criterion is conceptually dense: "stop when
  all are true" includes availability of a cheaper structurally
  different mode, which reads strangely if such a mode is not
  available.
- The 25b audit deliverable says "one audit check" but actually covers
  two ideas: Product Gate visibility and TIER orphan-claim rejection.
  (Matches Claude finding.)
- The plan says the human cold-read record is required, but this exact
  review is an LLM stand-in by delegation; a future reader needs a
  bright label that this is not ordinary non-LLM evidence.
- "No edits to ADR-0001, ADR-0006, contracts, or
  D2/D3/D5/D6/D7/D8 surfaces" — "surfaces" is broader than "files"
  and may make an executor hesitate over nearby docs that mention
  those deltas.
- The fastest-falsifier checkpoint is understandable once read with the
  Highest-Risk Assumption section, but it appears before the detailed
  runtime sections, so the first pass has to hold a forward reference
  in memory.

### Surprising-honesty objections (Codex)

- The plan is honest that 25b is a waiver, not proof, but it could still
  let a hurried executor act as if recording the waiver satisfies the
  Product Reality Gate. The wording should keep saying "bootstrap
  exception" everywhere this ledger is touched.
- The plan says non-LLM human review must be recorded, but the current
  requested review is explicitly an LLM stand-in for a sleeping
  operator. That delegation should be recorded as delegation, not
  silently counted as the non-LLM human review the plan describes.
- `PROJECT_STATE.md` is treated as authoritative by `CLAUDE.md`, yet
  the phase line I read appears stale or at least not aligned with the
  revised plan. Not a new adversarial defect; as a cold-read issue it
  makes the first executor wonder which status artifact to believe
  before 26b lands.
- The plan says forecasts are not acceptance pressure, but the May 4
  forecast is prominent and detailed. A tired executor may still
  experience it as schedule pressure unless slice acceptance language
  keeps repeating that schema redesign beats thinning evidence.
- The plan says D3 must not silently mutate ADR-0001, but the document
  necessarily rehearses the new phase concept in enough detail that it
  almost feels real already. The "planning nickname only" caveat is
  doing important work and should stay close to every
  authoritative-looking Phase 1.5 mention.
- The runtime-boundary split is explained well, but the plan politely
  avoids saying that dogfood before 27c would be unsafe evidence. It
  implies that strongly; saying it plainly helps a cold reader
  understand why 27c is not optional ceremony.
- The TIER matrix sounds like it prevents honesty theater, but the
  reader has to trust that "not claimed" will be culturally
  acceptable. 25b should make examples of valid `not claimed` rows so
  the matrix does not become pressure to overclaim.

### Verdict (Codex reviewer)

**ACCEPT-WITH-FOLD-INS.**

---

## Combined fold-ins (applied in this planning pass)

Each fold-in below traces to at least one reviewer's objection and is
applied as a targeted edit to `specs/plans/phase-1-close-revised.md` (or,
where noted, to `PROJECT_STATE.md` — the stale-row finding is not a plan
edit). Authored by Claude as orchestrator; edits delegated to Codex per
operator directive ("utilize Codex for all coding").

**F1. Exemption ledger file path + shape.**
Plan must name the exact path and format. Resolution: path is
`specs/methodology/product-gate-exemptions.md` (under
`specs/methodology/` per D4 authority-graph rule — this is authoritative
methodology content, not a plan). Shape: YAML frontmatter identifying the
ledger + markdown table with columns `phase_id | slice | reason |
consumed`. For the Slice 25b seed row, `phase_id = "phase-1-pre-1.5-reopen"`
(pre-D3-reopen planning nickname; will be rewritten to
`"phase-1.5-alpha-proof"` after 25d lands). Closes Claude's
"one-time operator waiver" ambiguity and Codex's "opaque in placement."

**F2. Canonical slice name.**
Replace `Slice 25d / 26.5` with `Slice 25d` everywhere. Rationale: 25d
sits in the governance-series (D-deltas, letter suffixes on 25); 26.5 was
a position-in-sequence hint, not a name. Cold executors get one name for
branch/commit/audit/cross-ref use. Closes Codex objection.

**F3. Audit check shape — two checks, not one.**
Change "One `scripts/audit.mjs` check proving Product Reality Gate
visibility and TIER orphan-claim rejection" to **"Two `scripts/audit.mjs`
checks: one for Product Reality Gate visibility, one for TIER
orphan-claim rejection."** Closes shared Claude/Codex objection.

**F4. PROJECT_STATE stale Phase line — NOT a plan edit.**
PROJECT_STATE row 6 currently says `Phase: 0.5 — Slice 8 Continuity
Contract closed...`, which is stale. Update to reflect Phase 1 contract
authorship (pre-Phase-1.5-reopen). This is a PROJECT_STATE.md edit in
the same docs commit as the plan fold-ins. Closes Codex's
surprising-honesty objection about status-artifact misalignment. Also
loads the evidence 26b will use: "both README and PROJECT_STATE being
stale on the same phase is never green."

**F5. D10 compound stopping criterion — mode-availability clause.**
Append to the compound stopping criterion: "If no structurally different
cheaper mode is available at the time of the decision, that clause is
waived; the artifact must record the waiver explicitly in the yield
ledger row for that pass." Closes Codex objection about strange reading
when no alternate mode exists.

**F6. "surfaces" → explicit file paths.**
Change "No edits to ADR-0001, ADR-0006, contracts, or D2/D3/D5/D6/D7/D8
surfaces in this slice" to **"No edits in this slice to
`specs/adrs/ADR-0001-methodology-adoption.md`,
`specs/adrs/ADR-0006-*.md`, any file under `specs/contracts/`, or the
`decision.md` sections that will host D2/D3/D5/D6/D7/D8 when their
respective triggers fire."** Closes Codex objection.

**F7. Fastest-falsifier "artifact types" → enumerated.**
Change the tripwire to **"the runner needs more than two new rows in
`specs/artifacts.json`, or more than two new `src/schemas/*.ts` files,
or simultaneous structural changes to `RunLog`, `Snapshot`, `Workflow`,
and `Step` just to close a dry-run."** Closes Claude objection.

**F8. D1 design-only expiry cap.**
Add to D1: **"A design-only Product Reality Gate proof expires after 2
slices or 14 calendar days from the recording ADR, whichever is sooner.
Renewal requires a second ADR naming a specific hardening event that
justifies the extension."** Closes Claude surprising-honesty objection
about unbounded expiry.

**F9. "Bootstrap exception" wording everywhere the waiver is referenced.**
Replace "one-time operator waiver" with **"one-time operator waiver
(bootstrap exception)"** at every occurrence, and add an explicit line
in the exemption ledger row: `reason: bootstrap exception — the slice
that changes future acceptance terms cannot itself be proof those terms
work.` Closes Codex surprising-honesty objection.

**F10. Phase 1.5 non-authoritative caveat reinforced at the close-criteria
heading.**
Add a caveat line directly under the heading
"Phase 1.5 Alpha Proof Close Criteria":
**"This heading is planning-prose only. Phase 1.5 is not authoritative
phase semantics until Slice 25d explicitly reopens ADR-0001."** Closes
Codex surprising-honesty objection.

**F11. "Dogfood before 27c is unsafe evidence" — plainly stated.**
Insert an explicit line in Slice 27c scope: **"Running `dogfood-run-0`
before Slice 27c lands is unsafe evidence — the first product proof
would write `events.ndjson`, `state.json`, and `manifest.snapshot.json`
through the very gap 27c is supposed to close. This sequencing is
structural, not ceremonial."** Closes Codex surprising-honesty
objection.

**F12. Codex challenger pass on drafted 25b — different artifact.**
Append to the "Codex challenger" line in Slice 25b: **"(This is a pass
on the drafted 25b doc set — `decision.md` amendments, `TIER.md`, audit
script changes, ledger scaffolds — which is a distinct artifact from
this plan. D10 pass counts start at 0 for that artifact.)"** Closes
Claude surprising-honesty objection.

**F13. `adversarial_yield_ledger_current` ratchet criterion.**
Change the ratchet definition to **"at least one ledger row exists for
every adversarial review pass recorded in the last 3 slices, and no row
has `verdict: PENDING`."** Closes Claude comprehension objection.

**F14. 27c / 27d acceptance: 27b dependency stated.**
Append to both 27c and 27d acceptance lists: **"Acceptance requires
Slice 27b landed first; the post-27b inventory diff is the delta signal,
not a placeholder checklist."** Closes Claude comprehension objection.

**F15. `circuit.json` dogfood file — authored by the slice itself.**
Add note to 27d scope: **"The file
`.claude-plugin/skills/dogfood-run-0/circuit.json` is authored by this
slice. Acceptance verifies the CLI loads a file this slice creates, not
that the file existed before."** Closes Claude comprehension objection.

**F16. TIER "not claimed" example row.**
Add to the D9 delta body: **"Example valid `not claimed` row:
`container_isolation: status=not claimed, rationale=Tier 2+ deferral per
ADR-0001`. `not claimed` is culturally permitted and does not count as
orphan."** Closes Codex surprising-honesty objection.

**F17. L3 operator-delegation clause.**
Add to L3 fold-in section in the plan: **"If the operator cannot perform
the non-LLM cold-read (asleep/unavailable/explicit delegation), Claude +
Codex may stand in as LLM cold-readers, recorded at
`reviewer_role: LLM-standin-for-human-cold-read`. Operator retains right
to add a section on pickup, which takes precedence. This delegation is
strictly weaker than a zero-context human drill and is recorded as such
in the yield ledger for that pass."** Closes Codex surprising-honesty
objection.

---

## D10 self-application decision

The handoff posed the question: does the 638-line plan itself violate
D10's pass-count-as-artifact-size signal (rule 4: artifacts needing >3
passes to converge are too large)?

**Decision:** **NO, the plan does not violate D10 rule 4 at this time.**

- **Letter:** The plan has 1 adversarial pass (gpt-5-codex, 7H/5M/3L,
  ACCEPT-WITH-FOLD-INS) plus this pass 2 (LLM-stand-in cold-read). Two
  passes. The cap for governance changes is 3. Under cap.
- **Structural argument:** The plan is a multi-slice roadmap + immediate
  executable slice (25b) + methodology delta schedule. That shape
  naturally has more surface area than a single slice spec. The
  appropriate size for "roadmap that sequences ~11 slices + schedules
  10 methodology deltas" is larger than a typical slice plan. 638 lines
  is not unreasonable for the shape.
- **Cold-read load argument:** The immediate executor of Slice 25b needs
  to read ~150 lines of the plan (Slice 25b section + D1/D4/D9/D10 delta
  sections + exemption ledger paragraphs). The rest is roadmap. Pre-read
  load for 25b is small; full-plan load is what this cold-read measured,
  and both reviewers landed ACCEPT-WITH-FOLD-INS without a REJECT-AS-
  INCOMPREHENSIBLE.
- **Decomposition cost argument:** Splitting the roadmap out would
  require a new file + new cross-references + dual maintenance on
  pointer updates. Churn without clear signal benefit.

Recorded in the adversarial yield ledger as pass 2. If pass 3 surfaces a
HIGH that pass 2 missed, or the compound stopping criterion requires a
structurally different mode, D10 may fire at that point and the plan is
split.

---

## Residual items (NOT folded in this pass; recorded for later)

- **Operator delivers a genuine non-LLM L3 cold-read.** **RESOLVED BY
  WAIVER under ADR-0006 (2026-04-20).** The canonical non-LLM cold-read
  was determined unobtainable from this operator's role without
  performative compliance; ADR-0006 records a one-time waiver and
  retargets Phase 1.5 Close Criterion #14 to operator product-direction
  check (14a) + delegated LLM stand-in technical comprehension (14b).
  This is strictly weaker evidence than a canonical non-LLM zero-context
  human drill. No follow-up pending on this item. See ADR-0006 §Precedent
  firewall for why this resolution cannot be cited as precedent for
  future gate retargets.
- **Full enumeration of D2..D8 "surfaces"** (not just files) — held
  until each delta's install slice lands. At that point the list of
  touched surfaces becomes concrete and can replace F6's placeholder.
- **`current_slice` / `status_epoch` structured field shape.** The plan
  names these for 26b but does not define the schema. Held to 26b for
  resolution — the shape is determined by the audit check that consumes
  it.
- **Pinned ratchet floor value.** Named for 26b; the specific pinned
  floor is determined when 26b authors it. No fold-in needed now.

---

## Operator cold-read section (intentionally empty — see §Delegation acknowledgment)

_This section was reserved for an operator-authored non-LLM cold-read on
morning pickup. It will not be filled. See §Delegation acknowledgment
below and `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md`
for the governance-aligned retarget. In short: on 2026-04-20 the
operator self-assessed that a canonical cold-read of this plan is
unattainable without performative compliance; Phase 1.5 Close Criterion
#14 was retargeted (14a operator product-direction check + 14b LLM
stand-in technical cold-read with F17 flag carried openly) rather than
left blocking or faked._

---

## Delegation acknowledgment

**Added 2026-04-20 per ADR-0006** (`specs/adrs/ADR-0006-cc14-operator-governance-alignment.md`).

**The original canonical non-LLM cold-read that Phase 1.5 Close Criterion
#14 was designed to require is not satisfied by this file.** ADR-0006
records this as a one-time waiver and accepts the two LLM stand-in
sections above (Reviewer 1 — Claude Opus 4.7; Reviewer 2 — GPT-5 Codex)
as a **weaker substitute** closing CC#14's part (b) — the delegated
technical-comprehension component. This substitute is **strictly weaker
evidence** than a canonical non-LLM zero-context human drill. The
weaker-evidence flag (F17 in this file's combined fold-ins) is carried
explicitly here so any downstream reader auditing Phase 1.5 close sees
the reduced signal weight in-line, without having to reconstruct it
from frontmatter.

**No authority surface may describe this file as equivalent to human
review.** The word "equivalent" is forbidden; the word "substitute"
with "weaker" attached is the only permitted framing.

Why the waiver + substitute stands as closure of CC#14's 14b component:

- The operator self-assessed on 2026-04-20 that a canonical cold-read
  of `specs/plans/phase-1-close-revised.md` (638 lines, dense
  methodology-delta schedule) is unobtainable from this operator's role
  without performative compliance. Operator role, product-direction vs.
  methodology-execution boundary: see ADR-0006 §Appendix A (durable
  record; the earlier auto-memory file is a convenience cache only,
  not load-bearing).
- A faked cold-read section would silently advertise false
  comprehension — worse evidence than honestly recording the gap.
- The two LLM stand-in passes produced 17 concrete fold-ins (F1–F17
  above) — real defects the plan author could act on. Evidence weight
  is lower than a canonical human drill but not zero.
- Phase 1.5 Close Criterion #14 has been amended by ADR-0006 to
  explicitly split the check: (14a) durable operator product-direction
  confirmation at `specs/reviews/phase-1.5-operator-product-check.md`
  + (14b) this review as delegated weaker substitute. The waiver plus
  substitution is the close path; it does not preserve the original
  forcing function.
- CC#15 preservation (no close criterion depends solely on Claude +
  Codex agreement) rests on two separable facts: (i) CC#14 also
  requires 14a (a non-LLM operator signal of different shape); and
  (ii) CC#13 is closed at Phase 1.5 by a separate, genuinely non-LLM
  mechanical probe (the property fuzzer landed at Slice 29 under
  `tests/properties/visible/`). Neither (i) nor (ii) is an LLM
  stand-in signal; together they keep CC#15 intact under this
  retarget. See ADR-0006 §3.

**What this waiver is not:**

- **Not a dissolution of non-LLM review discipline in general.**
  `decision.md` §D10 (adversarial review discipline, including the
  non-LLM-mode requirement for pass 3 on tournament-class artifacts)
  stands. ADR-0001 Addendum B CC#13 (non-LLM evidence artifact)
  stands — and is closed at Phase 1.5 by the Slice 29 property
  fuzzer, not by this delegation.
- **Not a precedent for future operator-cold-read waivers on other
  plans or ADRs.** ADR-0006 §5 (Precedent firewall) requires any
  future retarget to identify the original evidence mode, prove it
  is unobtainable, name compensating evidence of a different
  structural type (not LLM-on-LLM), carry weaker-evidence wording
  openly, add expiry or reopen triggers, and get a fresh challenger
  pass. Citing ADR-0006 as precedent is invalid on its face.
- **Not a claim that Claude + Codex concurrence substitutes for
  independent human verification.** Claude and Codex share training
  distribution (Knight & Leveson 1986); concurrence between them is
  same-distribution advisory context only, not epistemic
  independence. ADR-0006's justification rests on its §4 Reopen
  basis (a)–(d) and on the Codex adversarial challenger pass with
  fold-ins, not on advisory concurrence.
- **Not a standing retreat of operator-in-the-loop signals.** The
  14a product-direction check is the concrete preserved operator
  signal at Phase 1.5 close under this retarget. Future close
  criteria that produce obtainable operator signals (product
  direction, simplification judgment, rigor calibration, priority
  setting) remain in force.
