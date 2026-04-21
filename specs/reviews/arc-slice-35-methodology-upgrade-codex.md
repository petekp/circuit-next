---
name: arc-slice-35-methodology-upgrade-codex
description: Codex challenger objections on Slice 35 — methodology upgrade opener of the pre-P2.4 foundation fold-in arc (Check 25 artifact backing-path integrity + Check 26 arc-close composition-review presence gate + CLAUDE.md cadence rule + tracked review opener merged in from originally-planned Slice 36). Adversarial lint per CLAUDE.md §Cross-model challenger protocol.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-21
verdict: REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 (objections) + claude-opus-4-7 (fold-in synthesis + closing annotations)
target_kind: arc
target: slice-35-methodology-upgrade
target_version: "2026-04-21 as-staged pre-ceremony at HEAD=e62a5c5 (plan commit)"
review_target: arc-slice-35-methodology-upgrade
arc_target: slice-35
arc_version: e62a5c5..HEAD (Slice 35 working tree, pre-commit)
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 5
  MED: 3
  LOW: 2
  META: 1
commands_run:
  - read specs/plans/phase-2-foundation-foldins.md (the arc plan committed at e62a5c5)
  - read specs/reviews/p2-foundation-composition-review.md (the triggering review; untracked at dispatch time, committed in this slice)
  - read scripts/audit.mjs (Check 25 + Check 26 pre-fold-in state)
  - read scripts/audit.d.mts (type declarations)
  - read tests/contracts/artifact-backing-path-integrity.test.ts (19-test suite pre-fold-in)
  - read CLAUDE.md (cadence rule pre-fold-in)
  - git ls-files specs/reviews/p2-foundation-composition-review.md (verified untracked — seed for HIGH 5)
  - codex exec (Slice 35 challenger prompt; session 019db0c5-b423-7182-9963-24cee01b3c41)
opened_scope:
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/artifact-backing-path-integrity.test.ts
  - CLAUDE.md
  - specs/reviews/p2-foundation-composition-review.md (ceremony commit as part of Slice 35 per HIGH 5 fold-in)
  - specs/reviews/p2-foundation-composition-review-codex-transcript.md (archive transcript as part of Slice 35 per HIGH 5 fold-in)
  - specs/plans/phase-2-foundation-foldins.md (plan amendment: merge Slice 35+36 acceptance text)
skipped_scope:
  - src/schemas/* (Slice 35 ships no schema changes; event schema widening is Slice 37's scope per plan)
  - src/runtime/* (Slice 35 ships no runtime changes; runtime-boundary changes are Slices 38-40's scope)
  - specs/contracts/* (Slice 35 is a methodology-surface slice, not a contract authorship slice)
  - specs/artifacts.json (registry data unchanged; Slice 35 only adds integrity check over the current registry)
fold_in_disposition: all HIGH + MED + LOW folded into Slice 35 working tree via (a) `checkArtifactBackingPathIntegrity` normalization upgrade (path-segment canonicalization, trailing-parenthetical regex), (b) container-path allowlist shape upgrade (collision-class-specific `allowed_artifact_ids`), (c) stale-allowlist detection with strict-mode option, (d) fail-closed on malformed artifact rows, (e) Object.freeze on all three allowlist surfaces, (f) new Check 26 `checkArcCloseCompositionReviewPresence` audit binding for the cadence rule, (g) merge of originally-planned Slice 36 (tracked review opener + transcript archive) into Slice 35, (h) plan acceptance-criteria amendment reconciling yellow-OK semantics. META observations absorbed into the fold-in implementation. Closing verdict ACCEPT-WITH-FOLD-INS.
session_reference:
  - prompt: /tmp/codex-slice-35/prompt.txt (64 lines)
  - output: /tmp/codex-slice-35/output.jsonl (JSONL event stream) + /tmp/codex-slice-35/last.md (final assistant message, 8.1 KB)
  - codex session id: 019db0c5-b423-7182-9963-24cee01b3c41
---

# Slice 35 methodology upgrade — Codex challenger objections + fold-in record

## Scope

Slice 35 is the methodology-upgrade opener of the pre-P2.4 foundation
fold-in arc defined in `specs/plans/phase-2-foundation-foldins.md`
(plan commit `e62a5c5`). It ships:

1. New audit Check 25 — artifact registry backing-path integrity, the
   minimum-viable mechanism that would have caught HIGH 4 in the
   composition review at slice-34 authorship time.
2. New audit Check 26 — arc-close composition-review presence gate for
   this specific arc, binding the CLAUDE.md cadence rule to an
   auditable ratchet (added post-Codex HIGH 4 fold-in).
3. `CLAUDE.md §Cross-slice composition review cadence` new section
   formalizing the rule "at the close of any arc spanning ≥3 slices,
   commission a composition review before the next privileged runtime
   slice opens."
4. Tracked review opener — commits
   `specs/reviews/p2-foundation-composition-review.md` and archives
   the 14,895-line Codex composition-review transcript as a tracked
   sibling. Merged into Slice 35 post-Codex HIGH 5 fold-in.

## Opening verdict

**REJECT-PENDING-FOLD-INS.** Five HIGH, three MED, two LOW, one META.

## HIGH findings (verbatim Codex objections + Claude fold-in synthesis)

### HIGH 1 — Check 25 lands weaker than Slice 35's own acceptance bar

**Codex objection.** The plan requires "Check 25 green on live repo"
(plan §Slice 35 acceptance evidence) but the implemented live check
returns yellow for the tracked `{explore.result, run.result}`
collision. The live regression test only asserts "not red." This
converts a ratchet from "no duplicate backing paths" into "duplicates
allowed if yellow," exactly while advancing the test floor.

**Fold-in.** Plan text amended: Slice 35 acceptance may return yellow
on live repo for the pre-existing tracked HIGH 4 collision (closing
slice 39); acceptance bar is red-free, not green-only. Arc-close
acceptance explicitly requires green (no tracked collisions remaining)
— see §Acceptance evidence for arc close. Reconciles the implementation
posture with the plan's acceptance language without weakening the
arc-close gate.

### HIGH 2 — The tracked-collision allowlist has no invalidation mechanism

**Codex objection.** `ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS` entries
carry `closing_slice`, but nothing enforces that an entry is deleted
when the collision is resolved. Slice 39 could resolve the collision
and leave the allowlist entry behind; Check 25 would go green (no
active collision) while the stale entry silently re-yellows any future
exact reintroduction.

**Fold-in.** `checkArtifactBackingPathIntegrity` now walks
`ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS` after collision scan; any
entry without a matching live collision is flagged as stale and
returns red. Tests `returns red when a known-collision allowlist entry
has no matching live collision in strict mode` + `ARTIFACT_BACKING_
PATH_KNOWN_COLLISIONS is Object.frozen` encode this. Check runs in
strict mode against the live repo by default; test fixtures opt in
explicitly via `{ strictAllowlist: true }` to avoid spurious trips on
unrelated fixtures.

### HIGH 3 — Container-path allowlist is path-global, not collision-class-specific

**Codex objection.** Any collision at an allowlisted container path is
skipped solely by `ARTIFACT_BACKING_PATH_CONTAINER_PATHS.has(normalized)`.
The test even greenlights arbitrary `alpha.event`, `beta.event`,
`gamma.event` sharing `events.ndjson`. A future full-file writer
collision on `events.ndjson`, `circuit.yaml`, or config files can hide
behind "container" status without proving distinct JSON paths, event
families, or writer modes.

**Fold-in.** Container-path allowlist upgraded from `Map<path, string>`
to `Map<path, { rationale, allowed_artifact_ids: ReadonlySet<string> }>`.
Collisions on container paths must satisfy: every sharing artifact id
is in `allowed_artifact_ids`. Unauthorized sharers fire red. Test
`returns red when an unauthorized artifact id shares a container path`
encodes this. All four existing container entries updated with
enumerated allowed-id sets drawn from current `specs/artifacts.json`
reader/writer declarations.

### HIGH 4 — Cross-slice cadence rule is not a machine-checkable ratchet

**Codex objection.** The new rule and "privileged runtime slice"
definition live only in CLAUDE.md prose. No test or audit binding for
"composition review" or "privileged runtime." Future arcs can silently
skip arc-close review unless humans remember to classify the next
slice as privileged — exactly the methodology rot Slice 35 is supposed
to prevent.

**Fold-in.** New audit Check 26 (`checkArcCloseCompositionReviewPresence`)
added to `scripts/audit.mjs`. Narrow to the first instance: when
`PROJECT_STATE.md` `current_slice` advances to
`PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE` (40) or beyond, a file
under `specs/reviews/` matching the arc-close naming pattern must
exist with closing verdict `ACCEPT` or `ACCEPT-WITH-FOLD-INS`. Until
then, Check 26 is informational-green. CLAUDE.md §Cross-slice
composition review cadence updated to cite Check 26 as the binding.
Six negative/positive-path tests encode the gate
(`checkArcCloseCompositionReviewPresence > ...`). Subsequent arcs
either extend this check or land a generalized arc-ledger gate;
explicit TODO in the check docstring.

### HIGH 5 — Slice 35 cites an authority file that is not tracked in the slice

**Codex objection.** CLAUDE cites
`specs/reviews/p2-foundation-composition-review.md` as empirical basis
and the allowlist reason cites the same file.
`git ls-files specs/reviews/p2-foundation-composition-review.md`
returns nothing; the file is untracked. A ceremony commit at Slice 35
would contain dangling methodology authority.

**Fold-in.** Slice 36 (originally "tracked review opener") absorbed
into Slice 35. Slice 35 now commits:
- `specs/reviews/p2-foundation-composition-review.md` (the review
  itself, 221 lines)
- `specs/reviews/p2-foundation-composition-review-codex-transcript.md`
  (14,895-line Codex transcript archived from `/tmp/codex-composition-
  review/output.md` to survive reboot)
- Updated transcript citation in the main review file line 218 →
  in-repo archive location.
Plan amended to document the merge (dependency graph shows Slice 36 as
"reserved — absorbed into Slice 35"; acceptance text amended).

## MED findings (verbatim + fold-in synthesis)

### MED 1 — Normalization catches named prefix synonym, not real path equivalence

**Codex objection.** Normalization only trims, strips first `" ("`,
and replaces two prefixes. No closed token grammar or dot-segment
canonicalization. `<run-root>/artifacts/./result.json`, doubled
slashes, a new run-root synonym, or a bare relative `result.json` can
represent the same file while bypassing the collision detector.

**Fold-in (partial).** `normalizeArtifactBackingPath` upgraded:
- Trailing parenthetical regex (LOW 2 fold-in — see below) — correctly
  trailing-only, preserves inner parentheticals.
- After synonym substitution, path tail collapses consecutive slashes
  and `/./` segments iteratively. Trailing `/.` stripped.
- Tests `collapses /./ path segments`, `collapses consecutive slashes`,
  `treats the template-prefix synonym + /./ combination as fully
  equivalent` encode the new normalization.

**Deferred.** Closed token grammar (rejecting unknown `<*-root>`
tokens) is scope creep for Slice 35. Added as TODO in check docstring:
a future slice may add a registered-template-tokens allowlist and
flag unknown tokens as yellow. Documented explicitly as out-of-scope
for this slice.

### MED 2 — "Reintroduction" test is tight for a third id, but not for stale allowlist

**Codex objection.** The third-artifact test proves exact-set
mismatch goes red. It does not prove that a resolved collision forces
allowlist deletion.

**Fold-in.** Covered by HIGH 2 fold-in. New test `returns red when a
known-collision allowlist entry has no matching live collision in
strict mode` encodes the stale-allowlist lifecycle path directly.

### MED 3 — Check 25 silently ignores malformed artifact rows

**Codex objection.** Rows with non-string `id`, non-array
`backing_paths`, non-string path entries, or path-like strings without
`/` are skipped. The check's standalone contract says it walks
`specs/artifacts.json`, but invalid rows can disappear from its
evidence surface.

**Fold-in.** `checkArtifactBackingPathIntegrity` now collects
malformed rows into a `malformedRows` list. Any malformed row → red
with specific reason (`missing/invalid id string`, `missing
backing_paths`, `backing_paths must be an array`, `backing_paths[N]
must be a string`). Top-level `artifacts` field missing or non-array
also red. Tests `returns red on malformed artifact rows (fold-in
Codex MED 3)` and `returns red when top-level artifacts field is
missing or not an array` encode these paths.

## LOW findings (verbatim + fold-in synthesis)

### LOW 1 — The container and known-collision allowlists are mutable exports

**Codex objection.** Tests or future importers can mutate audit
policy in-process. Low practical risk, but bad shape for a ratchet
surface.

**Fold-in.** `Object.freeze` applied to
`ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS`,
`ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS` (array + each entry + each
entry's `artifact_ids` array), and every
`ARTIFACT_BACKING_PATH_CONTAINER_PATHS` entry object.
`allowed_artifact_ids` Sets also wrapped in `Object.freeze` (note: JS
engines do not honor freeze on Set.add, so runtime guarantee is at
entry-property level only; type-level `ReadonlySet` prevents normal
TS mutation — documented in the freeze test).

### LOW 2 — Parenthetical stripping is not actually trailing-only

**Codex objection.** `p.indexOf(' (')` strips from the first
occurrence. A path containing `" ("` inside a legitimate directory or
filename would normalize incorrectly.

**Fold-in.** Regex replaced: `p = p.replace(/\s*\([^)]*\)\s*$/, '')`.
Trailing-only; inner parentheticals preserved. Test `only strips
trailing parentheticals (preserves inner parentheticals)` encodes the
boundary.

## META observation (verbatim + synthesis)

> Check 25 is useful, but it is not "registry-transitive"; it is a
> normalized duplicate backing-path detector with exceptions.
>
> The strongest pre-commit fold-in is not more tests for the happy
> path; it is lifecycle enforcement for temporary exceptions.
>
> The Slice 35/Slice 36 ordering is the biggest governance smell:
> methodology should not cite an uncommitted review as load-bearing
> authority.

**Synthesis.** All three folded in: (a) Check 25 renamed from
"registry-transitive" to "backing-path integrity" in comments and
docstring (matches the check's actual title in the audit output;
prevents future reviewers from assuming broader coverage); (b)
lifecycle enforcement for temporary exceptions is the HIGH 2 fold-in;
(c) Slice 35/36 merge is the HIGH 5 fold-in. META landed as
implementation, not as standalone concession.

## Closing verdict

**ACCEPT-WITH-FOLD-INS.**

All five HIGH findings folded in as code or plan amendments. All three
MED findings folded in as code or documented-deferral (MED 1's closed
token grammar is explicit future work). Both LOW findings folded in
as code. META observation absorbed into the implementation.

Post-fold-in state:
- 39 contract tests pass in `tests/contracts/artifact-backing-path-
  integrity.test.ts` (up from 19 pre-fold-in); full suite 832 pass.
- Audit: 24 green / 2 yellow / 0 red (Check 26 added as green;
  Check 25 yellow for HIGH 4 tracked collision — red-free is the
  acceptance bar).
- `CLAUDE.md` 244 lines (≤300 hard invariant #10).
- Plan file `specs/plans/phase-2-foundation-foldins.md` amended in
  same working tree: Slice 35+36 merge documented, acceptance
  reconciled.

The methodology upgrade now binds the cadence rule to Check 26, forces
stale-allowlist deletion by closing slices, and rejects unauthorized
container sharers. The escape hatches Codex surfaced are closed.

## Authority

- `specs/plans/phase-2-foundation-foldins.md §Slice 35`
- `specs/reviews/p2-foundation-composition-review.md` (this slice
  tracks the review)
- `CLAUDE.md §Hard invariants #6` (challenger pass on ratchet change)
- `CLAUDE.md §Cross-slice composition review cadence` (new section
  this slice introduces)
