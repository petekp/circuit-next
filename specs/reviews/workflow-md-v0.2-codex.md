---
contract_target: workflow
contract_version: 0.2
reviewer_model: gpt-5-codex via codex exec
reviewer_model_id: gpt-5-codex
review_kind: adversarial property-auditor
review_date: 2026-04-20
verdict: REJECT → incorporated → ACCEPT
authored_by: operator + claude-opus-4-7
authorship_role: operator+agent
---

# workflow.md v0.2 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/workflow.md` v0.2 (Slice 27, workflow.md grandfather exit).
The pass is **pass 1 on a newly promoted artifact** under D10 semantics —
the v0.1 skeleton carried a grandfathered rationale pointing at
`bootstrap/adversarial-review-codex.md`; the v0.2 bump exits the grandfather
and requires a proper review record here.

## Delta under review

- `version: 0.1` → `0.2`; grandfathering frontmatter block removed.
- `codex_adversarial_review: specs/reviews/workflow-md-v0.2-codex.md` added.
- Two new invariants initially drafted: **WF-I8 terminal reachability** and
  **WF-I9 no dead steps**, promoted from `workflow.prop.*` reserved
  properties into parse-time `Workflow.superRefine` enforcement via graph
  traversal in `src/schemas/workflow.ts`.
- WF-I1..I7 upgraded in `specs/invariants.json` from `static-anchor` (via
  scope_ids tokens in the grandfather allowlist in
  `tests/contracts/cross-model-challenger.test.ts`) to `test-enforced` via
  per-invariant titled negative tests in
  `tests/contracts/schema-parity.test.ts`.
- `tests/contracts/cross-model-challenger.test.ts` allowlist entry for
  `specs/contracts/workflow.md` removed per the grandfather exit protocol.

The pass target is the workflow-contract change set in the Slice 27 working
tree, not a committed SHA — the challenger was dispatched before commit so
fold-ins land in the same commit (same protocol as prior contract reviews).

## Opening verdict

**REJECT pending HIGH fold-ins.** 3 HIGH / 3 MED / 2 LOW returned by
`gpt-5-codex` via `codex exec`.

## Objection list (as returned by Codex)

### HIGH

**1. HIGH — WF-I8 proves target reachability, not executable route
reachability.** WF-I8 walks `Object.values(step.routes)` and accepts any
path to a terminal. But `GateEvaluatedEvent.outcome` in
`src/schemas/event.ts` is `z.enum(['pass', 'fail'])` uniformly across all
three gate kinds. A workflow with `routes: { success: '@complete' }`
satisfies WF-I8 but has no route for the actual `pass` gate outcome — the
run stalls at runtime. Proposed remediation: a narrow parse-time
invariant requiring every step's `routes` to contain a `pass` key (fail
deferred to v0.3). Fold-in disposition: **Incorporable in Slice 27**.

**2. HIGH — Grandfather exit points at a placeholder review record.**
`specs/contracts/workflow.md` links to `specs/reviews/workflow-md-v0.2-codex.md`;
the review frontmatter preclaims `verdict: REJECT → incorporated → ACCEPT`
but the body was a placeholder at draft time. Current tests only require
the linked file to exist and match `contract_target`. Proposed
remediation: populate the review record with the real objection list
and dispositions before commit; a future guard could reject non-ACCEPT
verdict chains paired with zero objection headings. Fold-in disposition:
**Incorporable in Slice 27** (populate body); the guard test is **scoped
to v0.3 / Phase 2**.

**3. HIGH — Claimed Phase 1 → Phase 1.5 transition absent from working
tree.** ADR-0001 Addendum B says Phase 1.5 opens on the Slice 27
commit, but README, PROJECT_STATE, and TIER all still say `current_slice:
25d` and Phase 1 closing. If the slice commits only the contract delta,
the authoritative status docs are stale at the exact transition point.
Proposed remediation: include the README / PROJECT_STATE / TIER
`current_slice` + phase-line updates in the same Slice 27 commit.
Fold-in disposition: **Incorporable in Slice 27**.

### MED

**4. MED — WF-I2's test is masked by WF-I9.** The WF-I2 fixture uses a
single unknown `entry_modes.start_at` and only asserts parse failure. But
WF-I9 seeds BFS from every `entry_mode.start_at`, including unknown
starts, and would also fail the fixture — so removing the explicit WF-I2
check in the schema would still fail the fixture for the wrong reason.
The ledger nevertheless claims WF-I2 is test-enforced. Proposed
remediation: make the WF-I2 fixture uniquely provable by including a
second, valid entry mode that covers all real steps, and assert the
issue path at `entry_modes[*].start_at`. Also consider skipping WF-I9
when entry starts are invalid, matching WF-I1/WF-I4 noise-suppression.
Fold-in disposition: **Incorporable in Slice 27**.

**5. MED — `disposable`-lane exception conflicts with unconditional
WF-I9.** The property text says no-dead-steps holds "modulo
`disposable`-lane workflows," but WF-I9 is unconditional in prose and
schema. Proposed remediation: remove the disposable-lane carveout in
v0.2, or explicitly defer/define the exception. Fold-in disposition:
**Incorporable in Slice 27** (prose removal).

**6. MED — Reachable-but-unphased steps remain a silent manifest hole.**
The original v0.1 bootstrap HIGH asked for "every step appears in
exactly one phase." Current workflow validation only checks that
phase-listed steps exist; it never checks that every `Workflow.steps[]`
id appears in a phase. Proposed remediation: add the exact-one-phase
check now if 27c manifest writing will consume `Phase.steps`, or add an
explicit deferred note. Fold-in disposition: **Scoped to v0.3 / Phase
2** — `specs/contracts/phase.md` §Evolution already defers this; v0.2
Evolution section names it as a deferred subfinding.

### LOW

**7. LOW — Workflow.md overstates that every invariant is enforced by
`superRefine`.** WF-I7 is enforced by the literal field on
`WorkflowBody`, before `superRefine`. Fold-in disposition:
**Incorporable in Slice 27** (prose fix).

**8. LOW — WF-I7 ledger rationale carries stray "surplus unknown
literals" wording.** The test rejects non-`'2'` `schema_version` values,
not surplus keys. Fold-in disposition: **Incorporable in Slice 27**
(ledger wording fix).

## Dispositions (as incorporated)

All 3 HIGH **folded in** this slice:

- **HIGH #1 — folded in** as the new invariant **WF-I10** (pass-route
  presence) in `specs/contracts/workflow.md`, enforced by
  `Workflow.superRefine` in `src/schemas/workflow.ts`, with two
  negative/positive tests in `tests/contracts/schema-parity.test.ts`
  and a ledger row in `specs/invariants.json`. The fail-route presence
  variant is explicitly deferred to v0.3 / Phase 2 and documented in
  the WF-I10 body + Evolution §Deferred list.
- **HIGH #2 — folded in** by populating this review record with the
  actual opening verdict, objection list, and dispositions before
  commit. The guard-test proposal (reject non-ACCEPT verdict chain +
  zero objection headings) is **scoped to v0.3 / Phase 2**.
- **HIGH #3 — folded in** by including README / PROJECT_STATE / TIER
  `current_slice` + phase-line updates in this slice's commit. At
  commit time `current_slice` flips to `27` and the phase line flips
  to `Phase 1.5 — Alpha Proof (open)`. Check 20 + Check 9 go green on
  the new state.

All 3 MED **folded in or scoped**:

- **MED #4 — folded in.** The WF-I2 test fixture now includes a second
  valid entry mode covering all real steps and asserts the issue path
  at `entry_modes[1].start_at`. The `Workflow.superRefine` reachability
  pass now gates on `allEntryStartsKnown` in addition to
  `noDuplicateIds` and `allRouteTargetsKnown`, so a WF-I2 violation
  does not cascade into WF-I9 noise.
- **MED #5 — folded in.** The "modulo `disposable`-lane workflows"
  carveout has been removed from `workflow.prop.no_dead_steps`; the
  property text now notes that WF-I9 is unconditional and that the
  v0.1 carveout was never reflected in the schema.
- **MED #6 — scoped to v0.3 / Phase 2.** The exact-one-phase step
  membership check remains deferred per `specs/contracts/phase.md`
  §Evolution. Added to workflow.md v0.2 Evolution §Deferred list so
  the subfinding is visible, not swallowed.

Both LOW **folded in**:

- **LOW #7 — folded in.** Contract prose now reads "enforced by the
  Workflow Zod schema — some as literal fields on `WorkflowBody`
  (e.g. WF-I7's `schema_version` literal), the remainder inside
  `Workflow.superRefine`."
- **LOW #8 — folded in.** WF-I7 ledger rationale rewritten to
  "non-'2' schema_version values" (removes the misleading "surplus
  unknown literals" conflation).

## Closing verdict

**ACCEPT.** All 3 HIGH folded in this slice; all 3 MED folded in or
explicitly scoped; both LOW folded in. Verdict chain:
`REJECT pending HIGH fold-ins → incorporated → ACCEPT`.
