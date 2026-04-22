---
track: cross-model-challenger
status: ratified-v0.1
version: 0.1
last_updated: 2026-04-20
depends_on:
  - specs/adrs/ADR-0001-methodology-adoption.md (pillar 4)
  - specs/adrs/ADR-0003-authority-graph-gate.md (challenger downgrade section)
  - CLAUDE.md (§Cross-model challenger protocol)
enforced_by:
  - CLAUDE.md §Cross-model challenger protocol (dispatch via `/codex`)
  - commit discipline: for any slice that should trigger a challenger pass, a `specs/reviews/<contract>-v<version>-codex.md` record is committed in the same slice and linked from the contract frontmatter field `codex_adversarial_review`
  - authority-graph audit (planned — see §Planned test location): every contract whose invariants changed materially between two commits either lands a new codex review record or declares v0.2 scoping explicitly
planned_tests:
  - tests/contracts/cross-model-challenger.test.ts (LANDED v0.1 in Slice 16; tightened in Slice 18 + 19 + 20 + 21 + 24) — asserts unified review-record frontmatter (base + kind-specific extras), contract → review linkage (forward + reverse), XOR between forward-link and grandfathered-rationale paths, typed grandfathered-contract allowlist (HIGH #9 + Codex HIGH #2 fold-ins: identity binding over contract/version/schema_source, resolvable source_ref tokens, scope_ids exact-set equality with body headings), forward-link canonical-path pattern, per-objection disposition parser, verdict enum, /codex dispatch discipline.
  - scripts/audit.mjs dimension: warn (not red) when a contract's `artifact_ids` set changes without an updated `codex_adversarial_review` frontmatter line (NOT LANDED — tracked as v0.2 scope).
invariant_ids: [CHALLENGER-I1, CHALLENGER-I2, CHALLENGER-I3, CHALLENGER-I4, CHALLENGER-I5, CHALLENGER-I6]
property_ids: []
---

# Cross-model challenger

ADR-0001 pillar 4 as originally written framed the narrow cross-model
challenger as "one Swiss-cheese layer (Knight & Leveson 1986
correlation applies)" — a framing that quietly implied some
diversity-of-failure protection. ADR-0003 §Challenger downgrade
corrected this: the challenger is **adversarial lint, not independent
corroboration**. Claude and Codex share training distribution, training
recipe family, and post-training alignment pressure. Knight & Leveson's
1986 result about independently-developed N-version programs producing
correlated failures is a STRONG NEGATIVE signal for treating two LLMs
with shared provenance as independent.

This track names the invariant, failure modes, and discipline for
using the challenger WELL given that reframing.

## Invariants

- **CHALLENGER-I1 — The challenger's output is an OBJECTION LIST,
  not approval.** No matter how many HIGH / MED / LOW objections a
  challenger pass returns (including zero), the primary author
  (operator + Claude) decides what to fold in, what to defer with
  rationale, and what to reject outright. A green challenger pass
  does NOT certify correctness; it certifies that one adversarial
  reading did not find objections that would fit the model's
  sampling distribution. Consequence: the phrase "Codex approved it"
  is a disciplinary smell and rejected in commit messages.

- **CHALLENGER-I2 — The challenger is invoked for the RATCHET-CHANGING
  surfaces only.** ADR-0001 names five: ratchet changes, contract-
  relaxation ADRs, migration escrows, discovery-decision promotion,
  and any request to loosen a gate. v0.1 adds a sixth by practice:
  **every `specs/contracts/*.md` v0.1 authorship**. Invoking the
  challenger on trivia (e.g. a dependency bump, a doc typo fix) is a
  waste of cross-model diversity and is rejected as a smell.

- **CHALLENGER-I3 — A challenger pass is recorded, not just
  conversational.** Every invocation produces a file under
  `specs/reviews/<target>-v<version>-codex.md` with standardized
  frontmatter (`contract_target`, `contract_version`,
  `reviewer_model`, `review_kind`, `review_date`, `verdict`,
  `authored_by`) and an objection list in the format of
  `specs/reviews/adapter-md-v0.1-codex.md`. The corresponding
  contract adds a `codex_adversarial_review: <path>` frontmatter
  line pointing at the review record. This turns a
  session-ephemeral pass into an auditable artifact.

- **CHALLENGER-I4 — Fold-in discipline is explicit.** Each objection
  in the review record MUST be marked with its disposition:
  "Incorporated in v0.1" (with the specific schema/prose change
  named), "Scoped to v0.2" (with rationale naming the reopen
  condition), or "Rejected" (with rationale explaining why the
  objection does not apply). Silent ignores are rejected as a smell.
  The discipline pattern is already in use in
  `specs/reviews/adapter-md-v0.1-codex.md` and
  `specs/reviews/continuity-md-v0.1-codex.md`.

- **CHALLENGER-I5 — Dispatch is via the `/codex` skill (wrapper
  around `codex exec`), not the `codex:rescue` subagent.** The
  skill pipes the prompt verbatim and returns the output verbatim;
  the subagent wraps the interaction in Claude's own framing, which
  defeats the point (Claude is both sides of the adversarial pass).
  This is also recorded in user memory
  (`~/.claude/.../memory/feedback_codex_handoff.md`). Failure mode:
  invoking `codex:rescue` instead of `/codex` and believing the
  resulting output came from Codex when it was effectively Claude
  filtered through a "Codex" framing.

- **CHALLENGER-I6 — The challenger MAY NOT replace authority
  mapping, reference evidence, fixture parity, differential tests,
  state-machine tests, or migration rehearsal.** ADR-0003 §Challenger
  downgrade is explicit: these are the actual defense-in-depth
  layers. The challenger catches a subset of local-reasoning errors
  within the primary model's default sampling distribution; it does
  not catch errors that the primary and adversarial models share.
  Using a green challenger pass to skip a fixture-parity test
  because "Codex didn't flag it" is rejected as a smell.

## Failure modes addressed

- `knight-leveson-blind-spot` — treating the challenger as
  independent corroboration. Mitigated by CHALLENGER-I1 + CHALLENGER-I6
  + the explicit "adversarial lint, not independent corroboration"
  framing in ADR-0003 and this track.

- `challenger-as-approval` — a green challenger pass is read as
  "correct" rather than "no objections within one sampling."
  Mitigated by CHALLENGER-I1 prose + the recorded-verdict discipline
  of CHALLENGER-I3.

- `silent-ignore-of-objection` — a challenger raises a HIGH / MED
  and the operator quietly moves on without disposition. Mitigated
  by CHALLENGER-I4 explicit fold-in record + review-record frontmatter
  verdict field.

- `framing-filtered-dispatch` — invoking `codex:rescue` or otherwise
  wrapping Codex's output in Claude's framing, causing the "Codex"
  output to be pre-filtered. Mitigated by CHALLENGER-I5 + the user-
  memory feedback entry that surfaces on every session start.

- `challenger-creep` — invoking the challenger for trivia, diluting
  the signal and training operators to skim green passes as
  approval. Mitigated by CHALLENGER-I2 + reviewer discipline on
  what counts as a ratchet-changing surface.

- `reviewing-the-wrong-thing` — the challenger reads a subset of
  files that does not actually exercise the surface at risk.
  Mitigated by the prompt discipline in `specs/reviews/*.md` records
  themselves: every review prompt names the target files and focus
  areas explicitly, and the operator verifies Codex actually read
  them (e.g. by checking that Codex's evidence cites those files).

## Planned test location

`tests/contracts/cross-model-challenger.test.ts` (Phase 1 track;
landed Slice 16 — CHALLENGER-I1..I6 pinned; Slice 24 tightened the
grandfathered-review path per arc-phase-1-close-codex.md §HIGH-9 and
its per-slice Codex challenger fold-in). Asserts:

- Every contract carries EXACTLY ONE of (a) `codex_adversarial_review:
  <path>` that matches `^specs/reviews/[a-z0-9-]+-md-v\d+\.\d+-codex\.md$`
  and resolves to a file carrying the full contract-review frontmatter,
  OR (b) an explicit `codex_adversarial_review_grandfathered:
  <rationale>` declaration. Both forms coexisting fails the XOR gate.
- The grandfathered form is restricted to a typed allowlist — currently
  `{step.md, workflow.md}`. Each allowlist record binds the contract
  **identity** (`contract`, `version`, `schema_source`), not just the
  filename; any change to those fields re-opens the grandfather.
  Grandfathered contracts additionally carry:
    - `grandfathered_source_ref` — whitespace-separated tokens of form
      `commit:<sha>` or `path:<relpath>`; each allowlist-required token
      must be present and must resolve (`git cat-file -e <sha>^{commit}`
      or `existsSync` respectively). Supplemental free-form prose
      (e.g. PROJECT_STATE.md pointers) is permitted but is not counted
      as resolvable evidence.
    - `grandfathered_scope` (prose) + `grandfathered_scope_ids`
      (invariant-id tokens, exact-set equality with the allowlist
      record, each present as a `- **<id> —` heading in the contract
      body).
    - `expires_on_contract_change: true` — literal string; operative
      via the identity gate above (any version/schema_source mutation
      re-opens the grandfather).
  Exit path: land a proper `specs/reviews/<stem>-md-v<version>-codex.md`,
  add `codex_adversarial_review`, and remove both the grandfathered
  field AND the allowlist entry in the same slice.
- Every contract-review file's `contract_target` resolves back to an
  existing `specs/contracts/<target>.md` (reverse linkage — orphan
  review files fail).
- Every review record at `specs/reviews/*-codex.md` carries the
  **unified base frontmatter** (`reviewer_model`, `review_kind`,
  `review_date`, `verdict`, `authored_by`) plus kind-specific
  additional keys:
  - **Contract reviews** (`<target>-md-v<version>-codex.md`):
    `contract_target`, `contract_version`.
  - **ADR reviews** (`adr-<slug>-codex.md`): `review_target`,
    `target_kind: adr`, `opening_verdict`, `closing_verdict`.
  - **Arc reviews** (`behavioral-arc-<...>-codex.md` or
    `arc-<...>-codex.md`): `review_target`, `target_kind: arc`,
    `arc_target`, `arc_version`, `opening_verdict`, `closing_verdict`,
    plus AR-M5 scope-disclosure (`commands_run`, `opened_scope`,
    `skipped_scope`).
  - **Phase reviews** (`phase-<...>-codex.md`) — Slice 47-prep
    addition. Comprehensive review over a phase or phase-to-date
    sweep; broader than any single arc; commissioned as a fresh-context
    audit independent of arc-close ceremony (e.g. before a phase-close
    gate or to verify accumulated state has not drifted between
    arc closes). Carries `review_target`, `target_kind: phase`,
    `phase_target`, `phase_version`, `opening_verdict`, `closing_verdict`,
    plus the same AR-M5 scope-disclosure (`commands_run`,
    `opened_scope`, `skipped_scope`) — a phase comprehensive review
    that opens nothing is degraded, so the same discipline applies.
- Every review record's `verdict` field is one of the permitted
  values (`ACCEPT`, `REJECT → incorporated → ACCEPT`,
  `NEEDS ADJUSTMENT → incorporated → ACCEPT`,
  `REJECT pending HIGH fold-ins`, `ACCEPT-with-deferrals`).
  Free-form verdicts fail the test. An optional trailing
  parenthetical annotation is permitted after the canonical value
  (e.g. `REJECT → incorporated → ACCEPT (after fold-in)`); the
  parenthetical cannot alter the verdict itself, only annotate it.

And a new audit dimension: `scripts/audit.mjs` warns (not red) when a
contract's `artifact_ids` set changes between HEAD and HEAD~1 without
an updated `codex_adversarial_review` frontmatter line. Warn rather
than red because some changes are genuinely non-load-bearing (typo,
formatting); the signal is a prompt to consider whether a challenger
pass is needed, not a block.

## Cross-references

- `specs/adrs/ADR-0001-methodology-adoption.md` pillar 4
  (cross-model challenger named; later downgraded).
- `specs/adrs/ADR-0003-authority-graph-gate.md` §Challenger downgrade
  (authoritative reframing: adversarial lint, not independent
  corroboration).
- `CLAUDE.md` §Cross-model challenger protocol (dispatch + recording
  discipline).
- `specs/reviews/adapter-md-v0.1-codex.md`,
  `specs/reviews/run-md-v0.1-codex.md`,
  `specs/reviews/selection-md-v0.1-codex.md`,
  `specs/reviews/phase-md-v0.1-codex.md`,
  `specs/reviews/continuity-md-v0.1-codex.md`,
  `specs/reviews/skill-md-v0.1-codex.md` — the five committed
  challenger records this track generalizes over.
- `bootstrap/adversarial-review-codex.md` — the first challenger
  record (skeleton review, Tier 0), authored before the
  `specs/reviews/` convention existed.
- User memory
  `~/.claude/projects/-Users-petepetrash-Code/memory/feedback_codex_handoff.md`
  — discipline entry: always use `/codex` (pipes to `codex exec`);
  never the `codex:rescue` subagent.

## Evolution

- **v0.1 (this draft)** — invariants CHALLENGER-I1..I6 named;
  planned test location + audit dimension committed as future work.
  The five committed review records (`adapter`, `run`, `selection`,
  `phase`, `continuity`) + the sixth for `skill` exemplify the
  recorded-artifact discipline. This track codifies what those
  records have been doing in practice.
- **v0.2** — land `tests/contracts/cross-model-challenger.test.ts`
  and the warn-level audit dimension. Reopen conditions: a real
  incident where a contract v0.1 landed with unrecorded challenger
  input and a structural gap surfaced later; OR a second model
  family enters the repo (e.g., Gemini) and the "one-layer" policy
  needs to decide whether to run two independent passes or one
  ensemble pass.
