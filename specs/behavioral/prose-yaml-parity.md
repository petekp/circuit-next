---
track: prose-yaml-parity
status: draft
version: 0.1
last_updated: 2026-04-19
depends_on:
  - specs/contracts/workflow.md
  - specs/contracts/skill.md
  - specs/contracts/phase.md
enforced_by:
  - structural (compilation): catalog compiler emits `SkillDescriptor` + `Workflow` from YAML source; prose body `SKILL.md` is a downstream read of the descriptor, not a parallel authority
  - audit (Circuit-as-justification smell): rejects commits that justify SKILL.md prose by citing `circuit.yaml` content that does not actually support the claim
planned_tests:
  - tests/contracts/prose-yaml-parity.test.ts (future, Phase 1 authorship) — round-trip test: regenerate prose regions from YAML source; assert no drift against committed files
  - named Phase 2 property: workflow.prop.prose_yaml_round_trip (see specs/contracts/workflow.md)
---

# Prose / YAML parity

Existing Circuit has a load-bearing drift between `SKILL.md` prose and
`circuit.yaml` structure: the prose describes how the skill behaves in
natural language, the YAML declares the actual workflow machine, and
the two are authored independently. Internal evidence
(`bootstrap/evidence-draft-codex.md`) documents at least one live case
where `SKILL.md` Build Lite prose disagreed with the YAML's step
wiring. The model-reader sees the prose and acts on it; the runtime
sees the YAML and executes something else. Users discover the gap when
"the docs say X, but the workflow did Y."

This track names the invariant, the failure modes, and the enforcement
strategy circuit-next adopts to keep prose and YAML in sync — in a
rewrite, we have the opportunity to make drift structurally
un-representable rather than retrofitting parity checks on top of two
hand-maintained files.

## Invariants

- **PROSE-YAML-I1 — YAML is the source of truth; prose is a
  projection.** For every artifact that exists in both prose and YAML
  form (most notably `SKILL.md` + `circuit.yaml` for workflow skills),
  the YAML is authoritative. The prose regions that describe
  YAML-encoded structure (step list, phase ordering, dispatch
  mapping) are REGENERATED from the YAML by the catalog compiler,
  not hand-edited. Operator edits happen in the YAML; the compiler
  updates the prose. Hand-editing a compiler-owned prose region is
  an anti-pattern and rejected at compiler build time. Maps directly
  to `specs/domain.md` anti-pattern **"Prose/YAML drift"**.

- **PROSE-YAML-I2 — Prose regions are delimited, typed, and
  addressable.** The catalog compiler cannot update arbitrary
  paragraphs; it needs stable region boundaries. Each projected
  region is wrapped in a marker pair (comment-style appropriate to
  the target file — markdown HTML comments for `.md`, YAML block
  scalars for embedded YAML). The compiler replaces the region's
  content between markers; the markers themselves are preserved.
  Operator prose OUTSIDE a region is never touched. A file with a
  compiler-owned region that has been hand-edited detects as a diff
  at build time and fails the build with a specific error naming the
  region and the file. Maps to `specs/contracts/workflow.md`
  §"Failure modes (carried from evidence)"
  `carry-forward:prose-yaml-drift`.

- **PROSE-YAML-I3 — The prose → YAML direction is hand-authored; the
  YAML → prose direction is compiler-owned.** A workflow author
  writes prose that explains WHY a workflow exists and HOW an
  operator should think about invoking it. The compiler emits prose
  describing WHAT the YAML declares (phase list, step names, gate
  shapes, dispatch roles). The two halves of the prose are
  distinguishable visually (via region markers) and structurally
  (different sections of the file). An author who wants to add
  operator-facing narrative edits the "why/how" half; an author who
  wants to change "what" edits the YAML and regenerates. Prevents
  the implicit-bidirectional failure mode where prose starts to
  drive structural decisions by accretion.

- **PROSE-YAML-I4 — Every `SkillDescriptor` field that has a
  human-readable projection names the compiler-owned region.** E.g.
  `SkillDescriptor.title` projects into the H1 of the skill's
  `SKILL.md`; `description` projects into the first-paragraph region;
  `trigger` projects into a "When to use" region. The binding is
  named in the v0.2 scope of
  `specs/contracts/skill.md` (upstream SKILL.md mapping contract)
  and the catalog compiler contract when it lands. v0.1 of this
  track RESERVES the invariant; actual field-by-field mapping is
  Phase 1 work done alongside the catalog compiler.

## Failure modes addressed

- `prose-yaml-drift:build-lite-skill-md-contradicts-yaml` — the
  motivating incident in `bootstrap/evidence-draft-codex.md`.
  Mitigated by PROSE-YAML-I1 + PROSE-YAML-I2.

- `prose-as-hidden-policy` — judgment rules live in prose rather than
  in typed contracts; a resolver branches on prose tokens. Maps to
  `specs/domain.md` anti-pattern. Mitigated by constraining prose to
  operator-facing narrative (PROSE-YAML-I3) and reserving deterministic
  behavior to typed fields enforced by schema. The `skill.md` v0.1
  `trigger` scope caveat (SKILL-I2) is the first concrete application.

- `bidirectional-drift` — authors edit prose expecting the YAML will
  follow, and other authors edit YAML expecting prose will follow;
  result is neither is authoritative and both disagree. Mitigated by
  PROSE-YAML-I3 (one direction is compiler-owned, one is
  hand-authored, each has a distinct surface).

- `hand-edit-compiler-region` — an operator overrides a compiler-owned
  region in a markdown file, and the next build silently reverts the
  edit. Mitigated by PROSE-YAML-I2 build-time diff detection: the
  compiler fails the build with a named region and file rather than
  silently regenerating.

## Planned test location

`tests/contracts/prose-yaml-parity.test.ts` (Phase 1, authored
alongside the catalog compiler). Will assert:

- For every committed `SKILL.md` with compiler-owned regions: the
  regenerated content equals the committed content (modulo explicit
  marker-guarded formatting). Drift fails the test with the file and
  region name.
- For every compiler-owned region marker pair: the pair is
  well-formed (open/close present, no orphan markers).
- For every `circuit.yaml` → `SKILL.md` binding documented in the
  upstream SKILL.md mapping contract: the field mapping is
  surjective (every compiler-owned region corresponds to a YAML
  field) and not over-constrained (no region claims to project a
  field that does not exist).

Also: the Phase 2 property `workflow.prop.prose_yaml_round_trip`
(reserved in `specs/contracts/workflow.md`) will property-test the
round-trip on generated YAML fixtures.

## Cross-references

- `specs/domain.md` §Anti-patterns — **Prose/YAML drift** (named
  anti-pattern), **Prose-as-hidden-policy** (related anti-pattern).
- `specs/contracts/workflow.md` §"Failure modes (carried from
  evidence)" `carry-forward:prose-yaml-drift`.
- `specs/contracts/skill.md` SKILL-I2 `trigger` scope caveat.
- `bootstrap/evidence-draft-codex.md` — Build Lite incident evidence.
- `specs/evidence.md` §Contract targets — lists this track as the
  structural-enforcement counterpart to the anti-pattern.

## Evolution

- **v0.1 (this draft)** — invariants PROSE-YAML-I1..I4 named;
  planned test location committed. No YAML / prose parity check
  ships in v0.1 because the catalog compiler has not yet been
  authored. The Phase 1 catalog compiler will land the first real
  enforcement.
- **v0.2** — introduce the upstream SKILL.md mapping contract
  (`skill.frontmatter` artifact, external-protocol) named in
  `specs/contracts/skill.md` v0.1 v0.2 scope. That contract will bind
  compiler-owned regions to specific `SkillDescriptor` fields and
  ratify PROSE-YAML-I4. Reopen condition: catalog compiler lands OR
  a second incident of drift surfaces in development.
