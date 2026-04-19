---
review: adr-0005-v2-plane-required
reviewer: codex (cross-model challenger)
date: 2026-04-19
opening_verdict: NEEDS ADJUSTMENT
closing_verdict: ACCEPT
status: closed
---

# ADR-0005 v2 — Codex adversarial review

## Context

Slice 13 (Ratchet-Advance lane) promoted `plane` to structurally
required at `specs/artifacts.json` v2 and classified the three
previously-deferred mixed-layer artifacts (`selection.override`,
`adapter.registry`, `adapter.reference`) as `data-plane` under the
worst-case-producer rule. Codex was dispatched via `/codex` per
CLAUDE.md pillar 4 (cross-model challenger on Ratchet-Advance slices
touching authority-graph dimensions).

At dispatch: `npm run verify` was green (395 tests), `npm run audit`
was 10 green / 0 yellow / 0 red, 13/13 plane-classified.

## Opening verdict — NEEDS ADJUSTMENT

Codex accepted the ratchet direction but rejected two claims as
overstated or factually wrong:

1. The ADR's rejection of the per-layer-split alternative was stronger
   than the evidence supported. `.strict()` parsing uniformity
   captures schema hardness but does not answer layer-specific
   authorization or provenance questions.
2. The `adapter.reference` row's writer/backing-path prose named
   surfaces that do not exist in the schemas (`step.adapter`,
   `CircuitOverride.adapter`). The artifact's real producers are
   `DispatchConfig.roles` and `DispatchConfig.circuits` entries.

## Objection list + fold-in outcomes

### HIGH

**HIGH #1 — Worst-case producer is a safe coarse classifier, not proof
per-layer ids are unnecessary.** Codex evidence: ADR-0005 §Decision
argued that `.strict()` uniformity across layers means per-layer split
is not required. That claim conflates schema hardness with per-layer
authorization/provenance.

**Fold-in:** Rewrote ADR-0005 §Scope of this decision — what
worst-case classification does and does not prove. Worst-case is now
explicitly named as a coarse conservative v2 classifier that does NOT
settle: (a) whether resolver rules should distinguish plugin-authored
defaults from operator-local overrides, (b) whether the authority
graph should carry a first-class per-layer provenance column or split
ids, (c) whether any audit/emit surface needs to report the exact
producing layer. The split-rejection is now local to this slice, not
forever. Incorporated within slice. Green.

**HIGH #2 — `adapter.reference` producer evidence names surfaces that
do not exist in the schemas.** Codex evidence: ADR-0005 §Classify and
`specs/artifacts.json:275` said writers were `plugin author
(step.adapter)` and `operator (CircuitOverride.adapter)`. But
`step.ts:60` has `role: DispatchRole` on DispatchStep (no `adapter`
field); `config.ts:108` has `CircuitOverride` with only `selection`
(no `adapter` field). The real producer surfaces are
`DispatchConfig.roles[role]` and `DispatchConfig.circuits[workflow_id]`
entries in `config.ts:34`.

**Fold-in:** Corrected `writers`, `backing_paths`, and `trust_boundary`
for `adapter.reference` in `specs/artifacts.json` to name the real
surfaces (`DispatchConfig.roles`, `DispatchConfig.circuits`).
ADR-0005 §Trust-boundary prose rewrite now includes a note pointing at
the factual error in the v1 prose and naming the correct producers.
Incorporated within slice. Green.

### MED

**MED #3 — Two trust_boundary strings blur origin with validation.**
Codex evidence: `selection.override` said `engine-computed during
composition`, and `adapter.registry` said `engine-computed closure`.
Composition produces `selection.resolution` (a separate artifact), and
closure/parity checks are resolver validations, not registry origins.

**Fold-in:** Rewrote all three v2 trust_boundary strings to separate
origin (who writes) from validation (what the engine enforces at
parse/resolve):

- `selection.override`: `... engine validates .strict() key closure
  and ghost-provenance rejection at parse time. Composition produces
  selection.resolution (separate artifact).`
- `adapter.registry`: `... engine validates reserved-name
  disjointness, own-property closure, and registry-key/descriptor-name
  parity at parse time.`
- `adapter.reference`: `... engine validates named-ref registry
  closure during resolution. MUST NOT appear in run.log ...`

Each still names `operator-local` unnegated, satisfying the Slice 12
rule. ADR-0005 §Trust-boundary prose rewrite updated to match; the
`engine-computed` origin-token is no longer claimed for these three.
Incorporated within slice. Green.

**MED #4 — Audit error message gives no escalation path for a
genuinely hard case.** Codex evidence: `scripts/audit.mjs:398` said
only "classify as control-plane or data-plane", giving a future
contributor encountering a hard case no hint at the correct response.

**Fold-in:** Extended the audit red detail to: `"classify as
control-plane or data-plane. If neither is defensible, write a
superseding ADR to split the artifact into per-layer ids or widen the
plane set (see ADR-0005 §Reopen conditions)"`. Incorporated within
slice. Green.

**MED #5 — Deferral-regression test is too narrow.** Codex evidence:
`tests/contracts/artifact-authority.test.ts` only banned the field name
`plane_deferred`. A future escape hatch named `plane_pending`,
`plane_status`, `plane_rationale`, or a reintroduced script-level
allowlist would pass.

**Fold-in:** Extended the test block with a `DEFERRAL_ALIAS_FIELDS`
list (`plane_deferred`, `plane_pending`, `plane_status`,
`plane_rationale`, `plane_exception`, `plane_exempt`) and a
regex-based field-name scan (`/plane.*(?:defer|exempt|pending)/i`)
that runs on every artifact row. Incorporated within slice. Green.

**MED #6 — Reopen conditions are too reactive.** Codex evidence:
ADR-0005 §Reopen conditions named only "after a security gap is
exposed" — a damage-signal trigger, not a design-pressure trigger.

**Fold-in:** Restructured §Reopen conditions into three groups —
damage-signal, design-pressure, and plane-set-expansion. Design-
pressure triggers now enumerate: new mixed-layer artifact proposals,
field-level or layer-level authorization rules in contracts/resolvers,
resolvers or audits needing exact producing layer, and writer/schema-
surface mismatches. A future contributor encountering any of these
should treat the ADR as reopened. Incorporated within slice. Green.

### LOW

**LOW #7 — Stale comments still referenced PLANE_DEFERRED_IDS.** Codex
evidence: `scripts/audit.mjs:80` and
`tests/contracts/artifact-authority.test.ts:399` comments said the
allowlist exists.

**Fold-in:** Rewrote both comments to reflect v2 (ADR-0005): the
audit.mjs header now says mixed-trust artifacts are classified as
data-plane under the worst-case-producer rule; the test file comment
now says ADR-0005 v2 classifies them rather than referencing the
removed allowlist. Incorporated within slice. Green.

**LOW #8 — PROJECT_STATE.md contradicted the slice.** Codex evidence:
ADR-0005 claimed PROJECT_STATE notes the v2 bump, but the file still
said `10 of 13` classified and `v2 schema evolution owes` the
promotion.

**Fold-in:** Updated the top-of-file summary to name Slice 13 + v2 +
13/13 coverage, and added a dedicated Slice 13 entry to the "Closed
this session" section describing the v2 scope, the classification
rationale, the Codex fold-in counts, and the reopen conditions. The
original Slice 12 entry remains for historical accuracy. Incorporated
within slice. Green.

**LOW #9 — Token rule is only a lint gate; no test pins the exact v2
trust_boundary strings.** Codex evidence: the three new prose strings
pass the token rule, but a silent prose edit that drops an origin or
reintroduces "mixed;" would still match the rule if an operator-local
token survived elsewhere.

**Fold-in:** Added a pinned-string test block
(`describe('specs/artifacts.json — v2 trust_boundary prose pinned ...')`)
asserting each of the three trust_boundary strings is exactly equal to
the ADR-0005-committed text. A silent prose edit now fails a named
test. Incorporated within slice. Green.

## Closing verdict — ACCEPT

All 2 HIGH + 4 MED + 3 LOW objections were incorporated within this
slice. Verify: 399 tests passing (395 pre-fold-in + 4 new pinned/guard
assertions). Audit: 10 green / 0 yellow / 0 red; authority graph
`13 artifacts, all surface_class-classified; 13/13 plane-classified;
8 contracts bound`.

No objections were deferred to a follow-up slice. The ratchet advances
from v1 (10/13 + 3 deferred) to v2 (13/13 + 0 deferred) cleanly.

## Methodology notes

- Dispatch via `/codex` skill per memory:feedback_codex_handoff and
  CLAUDE.md pillar 4.
- Review followed the same HIGH/MED/LOW verdict structure as prior
  reviews under `specs/reviews/`. Format parity was a stated ask in
  the challenger prompt.
- Fold-in discipline: each objection labeled incorporable vs deferred
  in the response. Codex labeled all nine as incorporable; the slice
  honored that by folding all nine before commit. No new
  Phase 2 property ids were introduced (this slice is graph-metadata
  only, not schema-behavior).
