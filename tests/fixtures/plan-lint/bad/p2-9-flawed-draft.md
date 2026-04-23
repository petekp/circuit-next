---
plan: p2-9-second-workflow
status: draft
opened_at: 2026-04-23
opened_in_session: post-slice-56-arc-open
target: review
trigger: |
  Slice 56 (P2.11 plugin-CLI wiring) closed the single-workflow-phase capability
  gap: `/circuit:explore` reaches the explore pipeline and `/circuit:run` routes
  as a pass-through during the single-registered-workflow phase. The plan
  authoritative at `specs/plans/phase-2-implementation.md §P2.9` schedules a
  second workflow next ("likely `review` ... unless Phase 2 evidence points
  elsewhere. Target reselection occurs at P2.9 framing time"). Operator pick
  at arc open 2026-04-23: second workflow over router (Option A over Option B)
  on the reasoning that a router with one registered workflow is shadow work;
  a second workflow tests whether the contract/adapter/fixture/protocol
  pattern landed at `explore` actually generalizes. Target selection confirmed
  `review` at framing time — smallest remaining surface, closest structural
  twin to `explore` (both investigation-shaped), and reference Circuit has a
  real `review` skill at `~/Code/circuit/skills/review/SKILL.md` whose
  characterization unblocks ADR-0003 contract authorship.
authority:
  - specs/plans/phase-2-implementation.md §P2.9 (forward slice; this plan
    occupies that slot)
  - specs/plans/phase-2-implementation.md §P2-CLOSE-CRITERIA table CC#P2-1
    (one-workflow parity — this arc's generalization proof tests whether
    the explore-established pattern composes to a second workflow without
    re-authoring the adapter/fixture/protocol shape)
  - specs/adrs/ADR-0003-authority-graph-gate.md §Decision (successor-to-live
    surfaces require classification + characterization before contract
    authorship; `review` is successor-to-live because reference Circuit's
    `review` skill exists at `~/Code/circuit/skills/review/`)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-1
    (one-workflow parity — generalization proof binds here)
  - specs/contracts/explore.md (template + workflow-kind-seam pattern this
    arc extends; EXPLORE-I1 + property_ids shape informs REVIEW-I1)
  - specs/artifacts.md §How-to-add-a-new-artifact + §Required-metadata-columns
    (authority-graph authoring conventions)
  - ~/Code/circuit/skills/review/SKILL.md (reference-surface characterization
    source — read-only per CLAUDE.md §Reference implementation rule)
  - CLAUDE.md §Cross-slice composition review cadence (arc spans 5 execution
    slices > 3; arc-close composition review required before next privileged
    runtime slice opens)
  - CLAUDE.md §Hard invariants #6 (Codex challenger required per
    ratchet-advancing slice)
  - User memory `feedback_plans_must_be_persisted.md` (plan persisted before
    execution; this file is the persistence)
---

# P2.9 — Second Workflow (`review`) — multi-slice arc

Land a second registered workflow in circuit-next whose contract + fixture +
runtime-dispatch path exercises the same pattern `explore` proves, with one
deliberate variation: a **4-phase canonical spine** (not 5) so the arc answers
whether the explore-shaped discipline actually generalizes beyond one workflow
kind, rather than cloning the explore shape under a new name.

## Why this plan exists

Phase 2's close criterion CC#P2-1 names "one-workflow parity" as the
target-bound close signal. `explore` reached that at Slice 43c. One workflow
proves the end-to-end protocol **once**. It does not prove the protocol
**generalizes** — a critical distinction. If the second workflow requires
re-authoring the adapter registry, the dispatch transcript shape, the
run-artifact naming rule, the fixture spine discipline, or the audit-check
kind map, the pattern hasn't actually landed as reusable plumbing. It's
landed as single-instance scaffolding dressed in reusable-sounding names.

This plan lands the second workflow (`review`) and tests generalization
empirically. Where generalization fails, the failure becomes visible at slice
landing — not at CC#P2-8 close-review time when finding the gap is expensive.

This plan also satisfies the ADR-0003 authority-graph gate: `review`-workflow
artifacts (`review.scope`, `review.report`, `review.verification`,
`review.result`) are classified as `successor-to-live` against the reference
Circuit `review` skill **before** the contract is drafted. Characterization
evidence lands at `specs/reference/legacy-circuit/review-characterization.md`.

## The generalization seam — what this arc is really testing

Five places where the explore-pattern could fail to generalize, surfaced
with fix hints in each slice:

1. **Canonical phase set is not universal.** `explore` uses {Frame, Analyze,
   Synthesize, Review, Close}. `review` uses {Intake, IndependentAudit,
   VerificationRerun, Verdict} per reference Circuit's shape. The current
   `checkSpineCoverage` audit check hardcodes a `{id → canonical set}` map
   (specs/contracts/explore.md §Workflow-kind seam, Codex MED 8 fold-in).
   Adding `review` forces that map to carry 2+ entries — testing whether the
   "temporary adapter" labeling is honest or whether a first-class
   `Workflow.kind` field is overdue.
2. **Invariant shape varies by workflow kind.** EXPLORE-I1 is
   workflow-kind-specific. REVIEW-I1 must be authored, not copied. If the
   invariant machinery only admits explore-shaped invariants, the base
   schema is under-expressive.
3. **Artifact count + trust-boundary profile differs.** `explore` emits 5
   artifacts; `review` emits 4. Three of `review`'s artifacts are
   model-authored via dispatch (`review.report`), engine-computed
   (`review.verification` via verification command execution), or
   operator-local intake data (`review.scope`). The explore pattern
   assumes a particular balance — testing review surfaces whether the
   `artifact_ids` binding rule admits a non-explore-shaped balance.
4. **Plugin command body shape must compose.** `/circuit:review` body must
   invoke the same CLI (`npm run circuit:run -- review --<args>`) without
   the CLI hard-coding `explore` as the only workflow kind it routes. If
   `src/cli/dogfood.ts` is explore-coupled, P2.9 exposes that coupling as
   a refactor requirement, not a downstream surprise.
5. **Audit-rule kind-independence.** Check 23 (plugin-command closure,
   landed Slice 56) currently asserts two command bodies reference the
   CLI. Extending to three (or N) commands should be a data-driven
   extension, not a new rule-per-command. If each workflow's command body
   requires its own audit rule, the audit plane has a kind-coupling bug.

Each slice below surfaces whether the generalization holds or whether the
underlying machinery needs widening. Widening decisions (if any) get their
own follow-up ADR; this plan does not pre-commit to them.

## Entry state — what landed before this arc

Base commit: `a4de1d57` (Slice 56 close).

Green audit: **32 green / 2 yellow / 0 red** (yellows carry over from Slice
55 — AGENT_SMOKE + CODEX_SMOKE fingerprint drift; this arc does NOT touch
adapter source files so no compounding).

Tests: **1143 passing / 19 skipped**.

Working tree: clean.

Artifacts in authority graph: **24** (explore's 5 ids landed; review's 4
ids will bring the total to 28 at Slice 57 close).

Plugin command registry: 2 live commands (`/circuit:explore`,
`/circuit:run`) both wired through to `src/cli/dogfood.ts` at CLI-surrogate
parity. A third command (`/circuit:review`) registers at Slice 61.

## The arc — 5 execution slices + 1 arc-close ceremony slice

Slices numbered in intended execution order. Each slice authors its own
framing triplet at landing per CLAUDE.md §Lane discipline; this plan locks
scope, authority, and acceptance evidence only. Re-ordering is permitted if
an earlier slice exposes surface that makes a later slice smaller,
obsolete, or mis-sequenced (per CLAUDE.md §trajectory check).

### Slice 57 — P2.9.a: Characterization + artifact classification (ADR-0003 gate pass)

**Lane:** Ratchet-Advance (authority-graph coverage advances — 24 → 28
artifacts; characterization-doc count advances; ADR-0003 successor-to-live
posture declared explicitly for review artifacts).

**Why first.** ADR-0003 §Contract-First-is-conditional blocks
contract authorship for successor-to-live surfaces until
`specs/artifacts.json` classification lands AND `specs/reference/<source>/`
characterization is committed. `review` is successor-to-live (reference
Circuit's `review` skill exists). Drafting the contract before
classification inverts the ADR-0003 ordering and audit Check 1 (authority
graph) would fail red on any contract frontmatter binding to undeclared
ids.

**Deliverable:**
1. `specs/reference/legacy-circuit/review-characterization.md` — one-pass
   read of `~/Code/circuit/skills/review/SKILL.md` + `~/Code/circuit/
   commands/review.md`, recording: observed phase set (Intake /
   Independent Audit / Verification Rerun / Verdict), observed artifacts
   (`review.md` primary, `reports/review-report.md` intermediate,
   verification command outputs inline), observed dispatch shape
   (compose-prompt + dispatch helper with `--role reviewer --circuit
   review`), observed verdict vocabulary (CLEAN / ISSUES FOUND, plus
   Critical / High / Low finding tiers), observation date (2026-04-23),
   and the **explicit clean-break decision** (circuit-next's `review`
   workflow does NOT attempt runtime parse of reference Circuit's
   `review.md` output; reference shape is evidence, not an interop
   requirement).
2. `specs/artifacts.json` — 4 new artifact rows:
   - `review.scope` — data-plane, successor-to-live, clean-break.
     Operator-local intake artifact recording: diff target (explicit
     paths or commit range), verification commands (user-supplied OR
     repo-declared OR "none available"), brief.md/plan.md pointers if
     present. Writers: engine (intake-step). Readers: review's subsequent
     steps. Backing path: `<run-root>/artifacts/review-scope.json`.
   - `review.report` — data-plane, successor-to-live, clean-break.
     Model-authored (dispatch with `role=reviewer`) adversarial audit
     artifact. Writers: review independent-audit-step (worker-dispatch).
     Readers: review verification-step, review verdict-step. Backing
     path: `<run-root>/artifacts/review-report.md`. Schema: structured
     findings (Critical/High/Low) plus prose review text.
   - `review.verification` — data-plane, successor-to-live, clean-break.
     Engine-computed artifact recording verification-command-rerun
     outputs (stdout/stderr + exit codes). Writers: review
     verification-step (orchestrator-executed subprocess run, not
     model-authored). Readers: review verdict-step. Backing path:
     `<run-root>/artifacts/review-verification.json`.
   - `review.result` — data-plane, successor-to-live, clean-break.
     Close-phase aggregate artifact. Composes summary + verdict
     (CLEAN / ISSUES FOUND) + pointers to review.scope, review.report,
     review.verification. Writers: review verdict-step (orchestrator
     aggregation — NOT model-authored; verdict is algorithmic from
     report's finding counts per reference Circuit's verdict rules).
     Readers: run result consumer. Backing path: `<run-root>/artifacts/
     review-result.json` (sibling to explore-result.json per Slice 39
     HIGH 4 fold-in path-split pattern).
3. All 4 artifacts carry full `successor-to-live` frontmatter:
   `reference_surfaces: ["legacy-circuit.review.<artifact>"]`,
   `reference_evidence: ["specs/reference/legacy-circuit/review-
   characterization.md"]`, `migration_policy: "deferred; no transparent
   runtime parse of old Circuit review artifacts"`, `legacy_parse_policy:
   reject`, `dangling_reference_policy: n/a` (no outgoing cross-artifact
   references from review-family at v0).

**Failure mode addressed:** Before this slice, the authority graph has no
coverage for review-workflow artifacts; attempting to author
`specs/contracts/review.md` frontmatter with `artifact_ids: [review.*]`
fails `tests/contracts/artifact-authority.test.ts` (unknown id) and audit
Check 1 (contract citing missing id).

**Acceptance evidence:**
- `npm run audit` green with 4 new data-plane successor-to-live artifacts.
- `tests/contracts/artifact-authority.test.ts` passes (4 new ids present
  in graph with required successor-to-live fields).
- Characterization file commits with observation date + clean-break
  decision.

**Alternate framing:**
- *(a) Reuse `explore.review-verdict` for the review-workflow output.*
  Rejected — `explore.review-verdict` is a dispatch-step intra-explore
  artifact bound to `role=reviewer` within explore's Synthesize→Review
  boundary. Its trust-boundary prose cites explore's dispatch transcript.
  Review-workflow artifacts are a separate workflow kind; reusing the id
  would conflate cardinality-of-review-in-explore with
  review-as-a-standalone-workflow and break the artifact-id uniqueness
  rule.
- *(b) Classify review artifacts as greenfield since circuit-next
  rewrites everything.* Rejected per ADR-0003 §Clean-break-is-not-
  greenfield. The reference surface exists. Classifying greenfield to
  skip characterization is the failure mode ADR-0003 explicitly blocks.
- *(c) Land artifacts + characterization in the SAME slice that drafts
  the contract.* Rejected — separates concerns poorly. Slice ≤30min
  wall-clock budget is tight for authority-graph authoring AND contract
  authoring AND both reviews. Splitting keeps each slice's failure mode
  focused.

**Ratchet:** Authority-graph coverage (24 → 28 artifacts); characterization
doc count (N → N+1); ADR-0003 gate passes for review-workflow contract
authorship.

**Codex challenger:** REQUIRED (CLAUDE.md §Hard invariants #6 — authority-
graph changes are privileged classification work that ADR-0003 explicitly
names as ratchet-advancing). Filed at `specs/reviews/arc-slice-57-codex.md`.
Objection-list shape; Codex is not an approver. Commit body carries
`Codex challenger: REQUIRED` literal.

---

### Slice 58 — P2.9.b: `review` workflow contract + REVIEW-I1 invariant

**Lane:** Ratchet-Advance (contract count advances; new workflow-kind
canonical phase set; REVIEW-I1 added to invariant ledger).

**Why after Slice 57.** ADR-0003 gate requires successor-to-live artifacts
classified AND characterized before contract authorship. Slice 57 provides
both.

**Deliverable:**
1. `specs/contracts/review.md` with frontmatter:
   - `contract: review`, `status: draft`, `version: 0.1`
   - `artifact_ids: [review.scope, review.report, review.verification,
     review.result]` — all four bound.
   - `invariant_ids: [REVIEW-I1]`
   - `property_ids` — at least 3 deferred properties (shape mirrors
     explore's): `review.prop.canonical_phase_set_is_correct`,
     `review.prop.verdict_deterministic_from_finding_counts` (CLEAN only
     when Critical = 0 AND High = 0), `review.prop.report_precedes_
     verdict`.
2. **REVIEW-I1 definition:** "A review-workflow run's verdict step MUST
   consume a review.report artifact authored by a dispatch step whose
   `role=reviewer`; the verdict MUST NOT be authored by the same adapter
   instance that produced any review.report in the same run."  The
   two-clause form binds (a) dispatch-shape for the audit phase and (b) a
   dispatch-identity separation constraint that maps to
   `ResolvedAdapter` binding (per explore.md §adr_bindings
   ADR-0007 CC#P2-2 dispatch transcript).  Clause (b) is evidential at
   P2.9.c fixture + P2.9.d parity landing; at contract level it is
   normative prose backed by property `review.prop.verdict_role_
   separation` (deferred enforcement — property_id listed, test file
   exists as red-placeholder at Slice 58, flips green at Slice 60).
3. **Canonical phase set:** {Intake, IndependentAudit, VerificationRerun,
   Verdict} — 4 phases, not 5. Explicit rationale: review is itself an
   adversarial check; adding a Review-of-review phase is recursive and
   reference Circuit does not do it. Documenting the 4-phase choice in
   the contract's scope note makes the generalization deliberate, not
   accidental.
4. **Scope note** acknowledging that `review.md` is NOT a new domain
   contract (workflow-kind-specific, not workflow-general) and that
   EXPLORE-I1's "workflow-kind-seam" convention (specs/contracts/
   explore.md §Workflow-kind seam) applies: the `{id → canonical set}`
   map at `scripts/audit.mjs::WORKFLOW_KIND_CANONICAL_SETS` extends with
   `{ 'review' → {Intake, IndependentAudit, VerificationRerun, Verdict} }`
   at this slice. The map grows from 1 entry to 2; this is the first
   empirical pressure on the "temporary adapter" labeling. Contract
   explicitly notes whether the second entry confirms or refutes the
   temporary-adapter posture.
5. **audit.mjs update:** `WORKFLOW_KIND_CANONICAL_SETS` extension.
   Check 23 rule-set may gain a kind-independent version; the decision
   lands at Slice 61, NOT this slice (keeps slice scope surgical).
6. **`tests/contracts/review.md` NEW test file:** assertions mirror
   `tests/contracts/explore.md`'s shape — contract citation binding,
   artifact_id presence, invariant_id uniqueness, property_id deferred
   marker.

**Failure mode addressed:** Without the contract, Slice 59's fixture has
no normative source for phase naming, step-role binding, or artifact
emission ordering. The fixture would be invented-from-imagined-shape —
exactly the failure mode ADR-0003 was introduced to block.

**Acceptance evidence:**
- `npm run verify` + `npm run audit` green.
- `specs/contracts/review.md` drafted with all frontmatter fields.
- REVIEW-I1 recorded in a canonical invariant ledger (location: TBD —
  existing invariants live in contract frontmatter; if no aggregate
  ledger exists, REVIEW-I1 lives only in `specs/contracts/review.md`
  §invariant_ids).
- `tests/contracts/review.md` new file passes.
- `scripts/audit.mjs::WORKFLOW_KIND_CANONICAL_SETS` carries 2 entries.

**Alternate framing:**
- *(a) Mirror explore's 5-phase spine for parity.* Rejected — forcing a
  Review-of-review phase is recursive and reference Circuit doesn't do
  it. Generalization arc gains value by extending into a
  non-explore-shape.
- *(b) Defer REVIEW-I1 to a later slice, land phase set only.* Rejected
  — contracts without invariants invite downstream drift; the invariant
  is a structurally required frontmatter field in the explore pattern.
  Deferring normalizes "imagine-and-draft" which ADR-0003 blocks.

**Ratchet:** Contract count (10 → 11); invariant count (1 in
workflow-kind-specific invariants → 2); audit kind-map coverage (1 → 2
kinds).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-58-
codex.md`. Special attention to REVIEW-I1 clause (b) on dispatch-identity
separation — adversarial-reasoning test that the clause actually
constrains runtime behavior rather than being prose-only.

---

### Slice 59 — P2.9.c: `review` workflow fixture

**Lane:** Ratchet-Advance (fixture count advances; workflow_fixture_runs
ratchet maintained; new spine-policy entry lands).

**Why after Slice 58.** Fixture authors the concrete 4-step sequence
normative under `specs/contracts/review.md`; without the contract, the
fixture has no validation source.

**Deliverable:**
1. `.claude-plugin/skills/review/circuit.json` — workflow fixture:
   - Top-level `id: "review"` (workflow-kind selector per Workflow-kind
     seam in specs/contracts/explore.md).
   - 4-phase spine: Intake → IndependentAudit → VerificationRerun →
     Verdict.
   - Intake step: `executor: "orchestrator"`, `kind: "synthesis"` —
     gathers diff target + verification commands + prior-run pointers.
     Emits `review.scope`.
   - IndependentAudit step: `executor: "worker"`, `kind: "dispatch"`,
     role: `reviewer`. Fresh-context dispatch. Emits `review.report`.
   - VerificationRerun step: `executor: "orchestrator"`, `kind:
     "synthesis"` — subprocess execution of verification commands from
     review.scope. Emits `review.verification`.
   - Verdict step: `executor: "orchestrator"`, `kind: "close"` —
     aggregates review.report + review.verification into review.result.
     Verdict is algorithmic (CLEAN iff Critical=0 AND High=0) per REVIEW-I1.
2. `.claude-plugin/skills/review/SKILL.md` — plugin-authored skill
   metadata (name, description, trigger, role: utility).
3. `src/cli/dogfood.ts` — extend CLI `--workflow` selector (or whatever
   the current mechanism is — TBD at slice open; if the CLI is
   `explore`-only and carries no workflow selector, Slice 59 exposes
   that as a widening requirement addressed in the same slice or punted
   to P2.8 (router) depending on scope fit).
4. Fixture validated by base Workflow schema (`src/schemas/workflow.ts`);
   no workflow-kind-specific schema is authored at this slice.

**Failure mode addressed:** Without the fixture, runtime has nothing to
dispatch when `--workflow review` or `/circuit:review` invokes the
pipeline. CC#P2-1-equivalent parity at Slice 60 would have no fixture
to validate byte-shape against.

**Acceptance evidence:**
- Fixture validates against `src/schemas/workflow.ts`.
- `npm run verify` + `npm run audit` green including new spine-policy
  entry + kind-map entry.
- CLI selector (or confirmation that existing selector mechanism is
  kind-agnostic) landed.
- Runtime can load the review fixture without error (smoke test —
  `src/cli/dogfood.ts --workflow review --goal "test"` invocation in
  smoke mode).

**Alternate framing:**
- *(a) Co-author fixture + SKILL.md + circuit.json in the same slice as
  the contract.* Rejected — slice budget. The contract has its own
  adversarial-review load (Codex challenger on REVIEW-I1); bundling
  fixture work risks rushing either surface.
- *(b) Stub the IndependentAudit dispatch step as
  `executor: "orchestrator"` to defer adapter wiring.* Rejected — HIGH 1
  of the Phase 2 foundation composition review landed the lesson that
  orchestrator-only fixtures don't exercise runtime dispatch and the
  adapter would land correctly-tested and never invoked. `review`'s
  audit phase is a dispatch step from the start.

**Ratchet:** Fixture count (1 → 2 workflow fixtures under `.claude-plugin/
skills/<workflow>/`); workflow_fixture_runs product ratchet maintained
(both explore + review fixtures load without error).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-59-
codex.md`. Specific focus: whether CLI `--workflow` selector mechanism
is kind-agnostic or whether Slice 59 exposes a coupling that needs its
own ADR.

---

### Slice 60 — P2.9.d: E2E parity test + golden fixture

**Lane:** Ratchet-Advance (parity-test count advances; review-workflow
byte-shape golden lands; CC#P2-1-equivalent evidence established for
review kind).

**Why after Slice 59.** E2E parity test consumes the fixture + the
runtime dispatch path; both land at Slice 59.

**Deliverable:**
1. `tests/runner/review-e2e-parity.test.ts` — end-to-end parity harness
   mirroring `tests/runner/explore-e2e-parity.test.ts`:
   - Invokes `src/cli/dogfood.ts --workflow review --goal "<fixture
     input>"` against a known test scope (use a canned sub-directory +
     known-green verification commands).
   - Captures run artifacts.
   - Normalizes timestamps + per-run identifiers per existing golden
     normalization helper.
   - SHA256 fingerprint match against
     `tests/fixtures/golden/review/review-result.json.sha256` AND
     `tests/fixtures/golden/review/review-report.md.sha256`.
2. `tests/fixtures/golden/review/` directory with golden files:
   - `review-result.json` (normalized, post-dispatch).
   - `review-report.md` (normalized reviewer output — since this is
     adapter-authored, golden requires a fixed adapter in test mode or
     a canned stub response; reuse explore's stubbed-adapter pattern if
     it exists, or author a minimal stub at this slice if not).
   - `.sha256` files for each.
3. **Dispatch transcript validation** per ADR-0007 CC#P2-2: the
   IndependentAudit dispatch MUST produce a 5-event transcript
   (dispatch.request, dispatch.receipt, dispatch.result, plus the two
   bracketing events). Test asserts transcript shape.
4. **REVIEW-I1 property flips green:** `tests/properties/visible/
   review-prop-verdict-role-separation.test.ts` — assertion that the
   run's verdict-step adapter differs from its independent-audit-step
   adapter (deferred property from Slice 58 becomes enforcing).

**Failure mode addressed:** Without parity + golden, any subsequent
change to review's runtime path could silently break review's byte-shape
contract without a red audit signal. Parity is the protection.

**Acceptance evidence:**
- `npm run verify` + `npm run audit` green with new parity test.
- SHA256 fingerprints match on happy-path fixture invocation.
- Dispatch transcript validates structurally (5 events in correct
  order).
- REVIEW-I1 property flips from deferred (red placeholder) to green.
- Observed test count advances by at least 6 (parity + dispatch-
  transcript-shape + REVIEW-I1 property + any negative tests for
  finding-count-to-verdict determinism).

**Alternate framing:**
- *(a) Skip golden and rely on dispatch transcript only.* Rejected —
  explore's Slice 43c established byte-shape golden as the canonical
  parity mechanism; diverging for review weakens the pattern.
- *(b) Defer REVIEW-I1 property enforcement to a later slice.* Rejected
  — deferred properties listed in contract frontmatter need enforcing
  evidence before arc close, not unbounded deferral.

**Ratchet:** Parity-test count (1 → 2); golden-fixture directory count
(1 → 2); enforced-property count (N → N+1 for REVIEW-I1 green transition).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-60-
codex.md`. Focus: golden-determinism robustness (is the stubbed adapter
output reproducible? Are timestamps fully normalized?).

---

### Slice 61 — P2.9.e: Plugin command body + audit rule generalization

**Lane:** Ratchet-Advance (plugin surface count advances; audit rule
kind-independence advance — Check 23 rule-g generalizes from 2-command
hardcoding to N-command data-driven).

**Why last in execution arc.** Plugin command body invokes the CLI;
before Slice 59 the CLI has no `review` selector, and before Slice 60
the review pipeline has no byte-shape guarantee. Slice 61 delivers the
plugin-user-visible surface on top of the reliable runtime.

**Deliverable:**
1. `.claude-plugin/commands/circuit-review.md` — new command body
   following the `circuit-explore.md` template (safe-construction rule,
   worked examples, 4-field surfacing instructions):
   - Extract `$ARGUMENTS` as scope (defaults: uncommitted diff per
     reference Circuit's Fast Modes).
   - Invoke `npm run circuit:run -- review --scope
     '<safely-single-quoted-scope>'`.
   - Parse JSON output for `run_root` / `outcome` / `result_path` /
     `verdict` (CLEAN or ISSUES FOUND).
   - Surface verdict + finding counts + result file pointer to user.
2. `.claude-plugin/plugin.json` — version bump to 0.1.0-alpha.2 (minor-
   alpha per Slice 56 precedent); new per-command entry for
   `/circuit:review` with description leading with wired state (not
   placeholder language).
3. `.claude-plugin/commands/circuit-run.md` — body updated to route
   among registered workflows (`explore`, `review`) during the
   pre-classifier phase. Simple rule: if goal starts with a review verb
   ("review", "audit", "verdict") OR explicitly names scope (files,
   diff target), route to `/circuit:review`; otherwise route to
   `/circuit:explore`. Temporary heuristic — explicit note that P2.8
   router supersedes this routing at P2.8 landing.
4. **Audit rule generalization:** `scripts/audit.mjs` Check 23 rule-g
   rewritten to iterate over `.claude-plugin/commands/*.md` files (not
   hardcoded `circuit-explore.md` + `circuit-run.md`). Placeholder-
   substring rejection applies to every command body. This is the
   generalization item — the rule becomes N-command data-driven.
5. **Test updates:** `tests/runner/plugin-command-invocation.test.ts`
   extended with assertions for `/circuit:review` command body shape
   (fenced-bash invocation block present, single-quoted scope
   construction, P2.8-pointer or direct-route pattern in
   `/circuit:run`). Negative fixtures regenerated to cover three
   commands.
6. **Invoke-evidence file:** `specs/reviews/p2-9e-invoke-evidence.md`
   recording the live `/circuit:review` invocation per Slice 56's
   p2-11-invoke-evidence.md precedent (CLI-surrogate parity scope;
   explicit "Does NOT prove" section).

**Failure mode addressed:** Without this slice, a plugin user running
`/circuit:review` in Claude Code sees "unknown command" or (after
Slice 61) the routed target only. The plugin-advertised surface must
match the runtime reality per CC#P2-3 (plugin command registration)
generalized to N commands.

**Acceptance evidence:**
- `npm run verify` + `npm run audit` green.
- `/circuit:review` slash-command invocation in a Claude Code session
  produces a review run_root + review-result.json + verdict surfaced
  to operator (CLI-surrogate parity recorded in invoke-evidence file).
- Audit Check 23 rule-g now data-driven (N-command coverage, not
  2-command hardcoded).

**Alternate framing:**
- *(a) Add `/circuit:review` but leave Check 23 rule-g hardcoded to 2
  commands.* Rejected — this arc's generalization test fails if the
  audit plane stays hard-coded; a third command would require a third
  edit to the rule, which is the kind-coupling bug §generalization-seam
  #5 identifies.
- *(b) Land plugin command without updating `/circuit:run` routing.*
  Rejected — `/circuit:run` remains a pass-through to `/circuit:explore`
  post-Slice-56; introducing `/circuit:review` without routing creates
  a discoverability gap (operator types `/circuit:run "audit this"`
  and still gets explore).

**Ratchet:** Plugin command count (2 → 3); audit rule kind-independence
(Check 23 rule-g 2-command → N-command); test count (+N from expanded
plugin-command-invocation suite).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-61-
codex.md`. Focus: the `/circuit:run` temporary routing heuristic (verb
match) — is this a bug farm or acceptable pre-P2.8 scaffolding?

---

### Slice 62 — Arc-close composition review (ceremony slice)

**Lane:** Disposable (ceremony commit; no runtime surface, no ratchet
changes; arc-boundary discipline).

**Why required.** CLAUDE.md §Cross-slice composition review cadence:
"At the close of any arc spanning ≥ 3 slices, commission a composition
review before the next privileged runtime slice opens." This arc spans
5 execution slices (57 → 61). P2.8 router (next candidate arc) is a
privileged runtime slice (modifies dispatch boundary). Composition
review mandatory.

**Deliverable:**
1. `specs/reviews/arc-p2-9-second-workflow-composition-review-claude.md`
   — fresh-read Claude composition-adversary pass over the full arc
   (slices 57-61 as a unit). Verdict vocabulary per cadence rule:
   REJECT-PENDING-FOLD-INS / ACCEPT-WITH-FOLD-INS / ACCEPT.
2. `specs/reviews/arc-p2-9-second-workflow-composition-review-codex.md`
   — Codex cross-model challenger composition pass via `/codex` skill.
   Same verdict vocabulary.
3. If any HIGHs: fold in this same ceremony commit (Slice 56 precedent
   — all 7 findings folded in one commit, no defer-with-trigger items).
4. `PROJECT_STATE.md` `current_slice` marker advances from 61 → 62 in
   the SAME commit as the two prong review files (per Check 26
   same-commit staging discipline established at Slice 40).
5. Arc close: `specs/plans/p2-9-second-workflow.md` frontmatter updates
   to `status: closed`, `closed_at: <date>`, `closed_in_slice: 62`.

**Failure mode addressed:** Per-slice Codex challenger passes are
necessary but not sufficient for cross-slice drift. The Phase 2
foundation composition review (p2-foundation-composition-review.md)
empirical basis: 5 HIGH boundary-seam failures surfaced after every
slice passed its own challenger. Arc-close review is the discipline
mechanism.

**Acceptance evidence:**
- Both prong review files committed.
- Both prong closing verdicts at ACCEPT or ACCEPT-WITH-FOLD-INS.
- Any HIGH findings folded in this same commit.
- Check 26 (arc-close composition review presence) green.
- PROJECT_STATE + plan file frontmatter synchronized.

**No alternate framing** — ceremony slice, not an implementation choice.

**Ratchet:** Arc-close discipline record (N → N+1).

**Codex challenger:** REQUIRED as a review prong (not a challenger-of-
challenger). Filed at `specs/reviews/arc-p2-9-second-workflow-
composition-review-codex.md`.

---

## Dependency graph

```
Slice 57 (classification + characterization)
  └─ Slice 58 (contract)  [ADR-0003 gate unblocks at 57 close]
       └─ Slice 59 (fixture)  [contract is authoring source]
            └─ Slice 60 (parity + golden)  [fixture loads at 59]
                 └─ Slice 61 (plugin command + audit generalization)
                      └─ Slice 62 (arc-close composition review)
```

Linear dependency. No parallelism. Each slice is ≤30 min wall-clock; arc
total ~3 hrs wall-clock plus adversarial-review turnaround.

## Acceptance evidence for arc close

1. All 5 execution slices land with green `npm run verify` + `npm run
   audit`.
2. All 5 slices carry Codex challenger files at `specs/reviews/arc-
   slice-<n>-codex.md`.
3. Slice 62 composition review (both prongs) verdict: ACCEPT or
   ACCEPT-WITH-FOLD-INS.
4. Authority graph grows 24 → 28 artifacts.
5. Contract count grows by 1 (`specs/contracts/review.md`).
6. Workflow fixture count grows by 1 (`.claude-plugin/skills/review/`).
7. Plugin command count grows by 1 (`/circuit:review`).
8. Parity test count grows by 1 (`review-e2e-parity.test.ts`).
9. REVIEW-I1 invariant enforced (not just prose).
10. Audit Check 23 rule-g generalized from 2-command hardcoding to
    N-command data-driven.

## The generalization verdict

At arc close, the plan records one plain-English finding:

- **If every slice landed without requiring contract widening, schema
  refactoring, or audit-rule per-kind branching:** the explore-pattern
  generalizes cleanly. The "temporary adapter" labeling on
  `WORKFLOW_KIND_CANONICAL_SETS` (Codex MED 8 fold-in) is confirmed
  temporary — a Workflow.kind field is the natural next step but the
  current machinery stretches.
- **If any slice exposed a widening requirement:** the pattern does not
  generalize cleanly at the identified surface; the widening decision
  gets its own ADR before the next workflow lands (or before P2.8
  router composes the kinds).

Either outcome is a win for the arc. A silent-false-generalization would
be the failure mode; both explicit outcomes are progress.

## Open questions

1. **CLI `--workflow` selector mechanism.** Unknown until Slice 59
   opens whether `src/cli/dogfood.ts` carries a workflow selector or
   is `explore`-hardcoded. If hardcoded, slice scope grows; if already
   selector-based, slice scope stays surgical.
2. **Stubbed adapter for golden determinism.** Slice 60 depends on a
   deterministic adapter output for SHA256 fingerprint match. Explore's
   Slice 43c precedent should have established a pattern; verify at
   Slice 60 open.
3. **Routing heuristic in `/circuit:run`.** Slice 61's verb-match
   heuristic is a known temporary measure. Codex challenger at Slice 61
   may push back on this. Acceptable fallback: leave `/circuit:run` as
   pass-through to `/circuit:explore` and require plugin users to type
   `/circuit:review` directly until P2.8 lands a real classifier.

## Arc discipline

- Per-slice Codex challenger via `/codex` skill (CLAUDE.md §Cross-model
  challenger protocol).
- Arc-close composition review (two prongs: Claude + Codex) at Slice 62
  before any subsequent privileged runtime slice (e.g., P2.8 router)
  opens.
- Plan transitions to `status: closed` at Slice 62 commit.
- Any reopening requires a new ADR (pattern generalization failure
  discovered post-close → widening ADR authored before the next
  workflow lands).
