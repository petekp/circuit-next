---
review_target: behavioral-track-tests
target_kind: arc
arc_target: behavioral-track-tests
arc_version: 0.1
slices_reviewed: slice-14 (a248cb6), slice-15 (69677ed), slice-15-fixup (bf93ef0), slice-16 (b08034a)
pre_arc_baseline: 6fe599a (slice-13, 399 tests, audit 10/0/0)
post_arc_state: b08034a (HEAD, 436 tests, audit 10/0/0)
reviewer_model: gpt-5-codex via codex exec
review_kind: methodology-adherence retrospective
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT (after fold-in across slices 17-21; MED #7 scoped to v0.2)
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT (after fold-in across slices 17-21; MED #7 scoped to v0.2)
authored_by: operator + claude-opus-4-7
commands_run:
  - git log --oneline 6fe599a..b08034a
  - npm run verify
  - npm run audit
  - codex exec (methodology-adherence retrospective)
opened_scope:
  - specs/behavioral/*.md (all three tracks)
  - tests/contracts/session-hygiene.test.ts
  - tests/contracts/prose-yaml-parity.test.ts
  - tests/contracts/cross-model-challenger.test.ts
  - scripts/audit.mjs (relevant checks)
  - Slice 14/15/15-fixup/16 commit bodies
  - CLAUDE.md (§Cross-model challenger protocol)
skipped_scope:
  - contract-surface schemas unrelated to the behavioral-track arc
  - .circuit/ runtime state
  - bootstrap/ evidence drafts
---

# Behavioral-track arc (slices 14-16) — Codex Methodology-Adherence Retrospective

This record captures an **arc-level** cross-model challenger pass over the
behavioral-track contract-test arc (Slices 14-16) rather than a single
contract. The three slices each landed Ratchet-Advance work but the
per-slice Codex challenger was NOT dispatched at commit time; the commit
prose cited CHALLENGER-I2 ("challenger for ratchet-changing surfaces
only") and argued behavioral-track slices were not contracts / authority-
graph dimensions. This retrospective audit tests that argument.

Reviewer's task was an **objection list**, not approval, per CHALLENGER-I1
/ ADR-0003 §Challenger downgrade (Knight-Leveson Swiss-cheese, not
independent corroboration). Dispositions recorded inline per CHALLENGER-I4.

## Objection list (as returned by Codex)

### HIGH

**1. Ratchet-Advance slices skipped same-slice challenger discipline.**
Affected: CHALLENGER-I2/I3; commits a248cb6, 69677ed, b08034a.
Evidence: [CLAUDE.md](/Users/petepetrash/Code/circuit-next/CLAUDE.md:138)
says challenger is required for any ratchet change and response is
documented in the originating commit/ADR, while
[PROJECT_STATE.md](/Users/petepetrash/Code/circuit-next/PROJECT_STATE.md:141)
and [PROJECT_STATE.md](/Users/petepetrash/Code/circuit-next/PROJECT_STATE.md:142)
explicitly say Slice 14/15 challenger was not dispatched.
Proposed remediation: record this review as retroactive, but also add an
explicit note that it missed same-slice gating; add an audit dimension for
Ratchet-Advance commits touching behavioral ratchets without a review
artifact or explicit exception.

**2. Contract-to-review linkage is opt-in, so missing challenger records pass.**
Affected: CHALLENGER-I2/I3. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:213)
skips any contract without `codex_adversarial_review`;
[phase.md](/Users/petepetrash/Code/circuit-next/specs/contracts/phase.md:1),
[step.md](/Users/petepetrash/Code/circuit-next/specs/contracts/step.md:1), and
[workflow.md](/Users/petepetrash/Code/circuit-next/specs/contracts/workflow.md:1)
lack that field. `phase-md-v0.1-codex.md` exists but is not linked back from
`phase.md`. Minimal forbidden example: delete `codex_adversarial_review`
from `skill.md`; tests still pass except the review file remains orphaned.
Proposed remediation: require every `specs/contracts/*.md` v0.1 to either
link a review or declare an explicit grandfathered exception with
rationale; add reverse linkage from every contract-review file to an
existing contract.

**3. Verdict enum check is not actually an enum.**
Affected: CHALLENGER-I1/I3. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:180)
uses `startsWith`; `verdict: ACCEPTED_BY_CODEX` and
`verdict: ACCEPTANCE CERTIFIED` pass because `ACCEPT` is a prefix. Also
[cross-model-challenger.md](/Users/petepetrash/Code/circuit-next/specs/behavioral/cross-model-challenger.md:142)
omits `NEEDS ADJUSTMENT → incorporated → ACCEPT`, while the test permits
it.
Proposed remediation: replace prefix matching with an anchored regex
allowing only exact canonical values plus optional parenthetical suffix;
update the spec enum or normalize existing review verdicts.

**4. CHALLENGER-I4 spot-check allows silent ignores.**
Affected: CHALLENGER-I4. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:253)
only requires one disposition token anywhere in the body, while
[cross-model-challenger.md](/Users/petepetrash/Code/circuit-next/specs/behavioral/cross-model-challenger.md:66)
requires each objection to have a disposition. A review with five HIGH
objections and one unrelated sentence saying "incorporated lessons"
passes.
Proposed remediation: parse objection headings and require a disposition
block before the next objection heading. Current review corpus is regular
enough for a pragmatic parser now; a stricter grammar can wait for v0.2.

### MED

**5. Slice 15 acceptance evidence was false for the committed tree.**
Affected: commit 69677ed. Evidence: `git show 69677ed:PROJECT_STATE.md`
contains the banned marker literal on line 140;
`git show 69677ed:tests/contracts/prose-yaml-parity.test.ts` bans that
literal in `MARKER_PATTERNS`. The fixup commit confirms the sentinel
failed immediately after commit.
Proposed remediation: record that Slice 15's green evidence was
pre-final-PROJECT_STATE, not final tree; future acceptance evidence must
be after all snapshot/doc edits.

**6. PROSE-YAML-I1..I4 are reserved, not pinned.**
Affected: PROSE-YAML-I1..I4. Evidence:
[prose-yaml-parity.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/prose-yaml-parity.test.ts:77)
checks frontmatter and cross-reference landing points, but it does not
even assert the four invariant IDs remain in
[prose-yaml-parity.md](/Users/petepetrash/Code/circuit-next/specs/behavioral/prose-yaml-parity.md:38).
Deleting the invariant prose while leaving the cross-reference strings
would pass.
Proposed remediation: add invariant-ID presence checks and reword
commit/project prose from "pinned" to "v0.1 reserved/static
cross-reference guard."

**7. Sentinel marker choice is both too narrow and too design-prescriptive.**
Affected: PROSE-YAML-I2 sentinel. Evidence:
[prose-yaml-parity.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/prose-yaml-parity.test.ts:160)
only catches `CIRCUIT:BEGIN|END` and `SKILL:BEGIN|END` HTML comments. It
misses plausible and already-evidenced alternatives such as
`<!-- BEGIN CIRCUIT:... -->`, `<!-- BEGIN ... -->`, MDX comments, and
YAML-region markers, despite
[prose-yaml-parity.md](/Users/petepetrash/Code/circuit-next/specs/behavioral/prose-yaml-parity.md:52)
allowing target-file-appropriate marker styles.
Proposed remediation: either ratify the exact marker grammar now, or
weaken the sentinel claim to "canary for one reserved marker family" and
add v0.2 marker-registry coverage when the compiler lands.

**8. ADR-review accommodation contradicts the stated review-record standard.**
Affected: CHALLENGER-I3. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:29)
blesses a looser ADR shape, but
[cross-model-challenger.md](/Users/petepetrash/Code/circuit-next/specs/behavioral/cross-model-challenger.md:138)
says every review record carries standardized frontmatter. ADRs are
challenger-triggering surfaces under
[CLAUDE.md](/Users/petepetrash/Code/circuit-next/CLAUDE.md:138).
Proposed remediation: normalize ADR reviews to a common shape:
`review_target`, `target_kind`, `reviewer_model`, `review_kind`,
`review_date`, `opening_verdict`, `closing_verdict`, `authored_by`.

**9. SESSION-I2/I5 are described as behavioral coverage but only static proxies are tested.**
Affected: SESSION-I2/I5. Evidence:
[session-hygiene.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/session-hygiene.test.ts:95)
checks phase agreement, not same-commit PROJECT_STATE freshness;
[session-hygiene.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/session-hygiene.test.ts:139)
checks that the citation rule is documented, not that commits cite. Audit
covers these, but the contract test title overstates.
Proposed remediation: either call/export audit checks, or rename these
tests as static documentation anchors and keep runtime enforcement
explicitly in audit.

**10. CHALLENGER-I5 regex is fragile to equivalent negation phrasing.**
Affected: CHALLENGER-I5. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:124)
matches only `never use ... codex:rescue`. "Do not use codex:rescue,"
"codex:rescue is banned," or "avoid codex:rescue" would miss.
Proposed remediation: either assert within the protocol paragraph that
`codex:rescue` appears with a nearby negation token, or broaden to
`never use|do not use|must not use|avoid|banned|forbidden|not allowed`.

### LOW

**11. Frontmatter key presence does not enforce meaningful values.**
Affected: CHALLENGER-I3 and behavioral frontmatter. Evidence:
[cross-model-challenger.test.ts](/Users/petepetrash/Code/circuit-next/tests/contracts/cross-model-challenger.test.ts:151)
checks `fm.has(key)`; empty `authored_by:` or malformed `review_date:`
passes.
Proposed remediation: require non-empty values, ISO dates, and known
`review_kind`/`authored_by` values.

**12. Fixup acceptance evidence uses prediction as evidence.**
Affected: commit bf93ef0. Evidence: commit body says `npm run audit`
10/0/0 "expected on next run," not actually observed. It did become true
later, but the framing-triplet standard says acceptance evidence should
be what proved the slice worked.
Proposed remediation: avoid "expected" in acceptance evidence; either run
the gate or list it as a follow-up expectation.

**Verdict: REJECT pending HIGH fold-ins.**

## Operator response (incorporated / scoped / rejected)

Dispositions follow CHALLENGER-I4; every objection carries a label and a
slice pointer. Fold-ins land across Slices 17-22; the closing_verdict
updates when the last in-slice fold-in commits.

### Incorporable within this slice (the review record itself; Slice 17)

- **HIGH #1** — **Incorporated as record + future-procedure note.** This
  file is the retroactive review. Supplementary effect: no same-slice
  review ever existed for the three behavioral slices; this retrospective
  substitutes. Going-forward rule added inline below in §Going-forward
  rule. No new audit dimension is added in this slice (scope creep into
  `scripts/audit.mjs`); the follow-up audit-dimension remediation is
  recorded in §Follow-ups as a separate scheduled slice.
- **MED #5** — **Incorporated as record.** The bf93ef0 fixup commit
  already captured the lesson; this record now captures it at the arc
  level: future acceptance evidence must be observed on the final
  committed tree, including post-doc-edit snapshots. Going-forward rule
  added below.
- **LOW #12** — **Incorporated as record.** Going-forward rule added
  below: "expected on next run" is a follow-up expectation, not
  acceptance evidence. Use either "observed on final tree" or mark the
  claim as deferred follow-up.

### Incorporable cross-slice (Slice 18 — test tightening)

- **HIGH #3** — **Scheduled for Slice 18.** Replace verdict `startsWith`
  with anchored regex allowing only exact canonical values plus optional
  parenthetical suffix. Also reconcile track spec §142 enum with observed
  verdicts (add `NEEDS ADJUSTMENT → incorporated → ACCEPT` to the track).
- **MED #6** — **Scheduled for Slice 18.** Add explicit PROSE-YAML-I1..I4
  ID-presence assertions in `tests/contracts/prose-yaml-parity.test.ts`.
  Reword PROJECT_STATE's "pinned" characterization to "v0.1 reserved /
  static cross-reference guard" for honesty.
- **MED #9** — **Scheduled for Slice 18.** Rename SESSION-I2 / SESSION-I5
  `describe` blocks to name them static-documentation anchors; add inline
  comment pointing at `scripts/audit.mjs` as the runtime enforcement
  surface.
- **MED #10** — **Scheduled for Slice 18.** Broaden the CHALLENGER-I5
  regex to accept equivalent negation phrasings (`never use`, `do not
  use`, `must not use`, `avoid`, `banned`, `forbidden`, `not allowed`).
- **LOW #11** — **Scheduled for Slice 18.** Require non-empty values on
  every review frontmatter key; enforce ISO date shape on `review_date`.

### Incorporable cross-slice (Slice 19 — HIGH #4 per-objection parser)

- **HIGH #4** — **Scheduled for Slice 19.** Pragmatic per-objection
  disposition parser. Parse objection headings matching
  `/^\*\*\d+\.\s+(HIGH|MED|LOW)\b/m` (or track-style `**HIGH** / **MED** /
  **LOW**` headers) and require a disposition token (Incorporated /
  Scoped to v0.2 / Rejected / folded in / deferred) within the objection
  body before the next objection heading. Review corpus is regular enough
  to make this tractable today. Full grammar remains v0.2.

### Incorporable cross-slice (Slice 20 — ADR review normalization)

- **MED #8** — **Scheduled for Slice 20.** Normalize the two existing
  ADR review records (`adr-0004-plane-split-codex.md`,
  `adr-0005-v2-plane-required-codex.md`) to a unified shape: `review_target`,
  `target_kind`, `reviewer_model`, `review_kind`, `review_date`,
  `opening_verdict`, `closing_verdict`, `authored_by`. Update
  `tests/contracts/cross-model-challenger.test.ts` to require the
  normalized shape on all review records (ADR + contract share a common
  base; contract reviews add `contract_target`/`contract_version`). Update
  the track §138 spec to document the unified shape.

### Incorporable cross-slice (Slice 21 — contract → review linkage)

- **HIGH #2** — **Scheduled for Slice 21.** Three contracts lack
  `codex_adversarial_review` frontmatter:
  `specs/contracts/phase.md` (review exists at
  `specs/reviews/phase-md-v0.1-codex.md` — add the link),
  `specs/contracts/step.md` (no standalone review file; step.md slice was
  authored before the `specs/reviews/` convention existed — add a
  grandfathered declaration with pointer to the inline review body in
  PROJECT_STATE.md), and `specs/contracts/workflow.md` (skeleton, never
  adversarially reviewed — add grandfathered declaration). Also tighten
  the test to require every contract either link a review or carry an
  explicit `codex_adversarial_review_grandfathered: <rationale>` field.
  Add reverse-linkage check: every review file's `contract_target` must
  point at an existing contract.

### Scoped to v0.2

- **MED #7** — **Scoped to v0.2 (reopen: catalog compiler lands).** The
  existing sentinel `CIRCUIT:BEGIN|END` / `SKILL:BEGIN|END` is narrow by
  design — widening it to include `<!-- BEGIN CIRCUIT:... -->`, MDX, and
  YAML markers commits to a marker grammar the catalog compiler has not
  yet chosen. The track's §Evolution explicitly places marker-grammar
  ratification in v0.2 (alongside the upstream SKILL.md mapping
  contract). The right move is to keep the sentinel narrow and document
  the deferral honestly. Slice 22 (sentinel-marker decision) is retired
  into the v0.2 scope rather than being landed as a widened-but-still-
  incomplete sentinel.

### Rejected (none)

All twelve objections are either incorporable or scoped to v0.2 with
reopen conditions. No objection is rejected as non-applicable.

## Going-forward rule (HIGH #1 + MED #5 + LOW #12)

1. **Per-slice challenger discipline (CHALLENGER-I2 clarification).** For
   any Ratchet-Advance slice that pins new machine-checked invariants —
   including behavioral-track test files that codify previously-
   unenforced discipline — dispatch a same-slice Codex challenger pass
   unless the operator explicitly waives it in the slice frame with a
   named reason. Behavioral-track tests are NOT trivia (CHALLENGER-I2's
   "no challenger on dependency bumps"); they pin the discipline the
   audit depends on.
2. **Acceptance evidence is post-commit-tree, not pre-snapshot.** When a
   slice edits PROJECT_STATE.md / CLAUDE.md / README.md as part of the
   slice, re-run `npm run verify` + `npm run audit` AFTER the
   documentation edit but BEFORE the commit, so the claimed evidence
   reflects the committed tree state. If a self-trip like Slice 15 is
   caught post-commit, record it explicitly in the fixup commit rather
   than retroactively updating the original claim.
3. **Prediction is not evidence.** "Expected on next run" is a
   follow-up expectation. Use either "observed on final tree" phrasing
   or mark the claim as deferred.

## Follow-ups

- **Scheduled — Slice 17 (this record + classifier extension).** Author
  this review record; extend
  `tests/contracts/cross-model-challenger.test.ts::classifyReview` to
  recognize `behavioral-arc-*` prefix as a third category with its own
  minimal shape check.
- **Scheduled — Slice 18.** HIGH #3, MED #6, MED #9, MED #10, LOW #11
  fold-ins (test tightening).
- **Scheduled — Slice 19.** HIGH #4 per-objection disposition parser.
- **Scheduled — Slice 20.** MED #8 ADR review frontmatter normalization.
- **Scheduled — Slice 21.** HIGH #2 contract → review linkage.
- **Scheduled future (not in this arc) — audit dimension for
  Ratchet-Advance-without-review.** A new `scripts/audit.mjs` dimension
  that warns (not red) when a Ratchet-Advance commit pins new machine-
  checked invariants without a same-slice review artifact or a named
  waiver. Surface in the monthly methodology review.

## Review-about-the-review meta-notes

- This review is itself a CHALLENGER-I1 artifact: the closing_verdict
  updates from "pending fold-ins across slices 17-22" to a canonical
  verdict once fold-ins land.
- Per the track §Evolution v0.2, the warn-level audit dimension
  "contract's `artifact_ids` set changes without updated
  `codex_adversarial_review` frontmatter" is adjacent to HIGH #2 and HIGH
  #1 remediations; it stays in v0.2 per the track's own scoping rather
  than being pulled forward into this arc.
- Knight-Leveson Swiss-cheese reminder: Codex and Claude share training
  distribution. This objection list is adversarial lint, not independent
  corroboration. Objections that both models would have missed by shared
  bias remain invisible to this process.
