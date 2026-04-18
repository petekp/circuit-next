# Prior-Art Audit — 4 In-Repo Circuit Docs vs Independent Evidence

**Audit scope.** The 4 prior-art docs at `~/Code/circuit/docs/`
(`circuit-schema-first-principles-architecture.md`,
`circuit-schema-adversarial-review.md`, `sweep-v3-work-policy-summary.md`,
`work-pattern-policy-compiler-proof-slice.md`) were written in normal
(non-tournament) mode and advocate for a specific architectural direction
(Work-Pattern Policy Compiler). Per the methodology, they must be audited
against **independent evidence** — external prior art (Workers A + B) and
blind internal Circuit extraction (Workers C + D) — before being treated as
contracts to build on.

This audit is deliberately written AFTER the external-evidence synthesis
(`artifacts/analysis.md`) and AFTER both internal-evidence drafts
(`evidence-draft-{claude,codex}.md`). Without that order, the audit would
anchor on the docs' own framing.

---

## The 4 Docs — Core Claims

### Doc 1: `first-principles-architecture.md` (1535 lines)

**Six proposed principles:**

1. A Circuit is more than a step graph (must also encode work patterns + mode policy).
2. Human and agent legibility need different views.
3. Work intent and profile floors should precede provider selection.
4. Static steps are not enough (dynamic child work / fanout is required).
5. Portable intent, local binding (logical profiles bound by local config).
6. Prose is valuable, but not as hidden policy.

**Three architectural options considered:**

- Option 1: Extend current manifest in place (status quo + dispatch policy).
- Option 2: Keep manifest small, add policy overlays.
- Option 3: Authoring definition compiles to runtime manifest (the eventual "work-pattern policy compiler").

### Doc 2: `adversarial-review.md` (743 lines)

**Executive verdict**: Option 3 over-models before proving the stable primitive. Proposes six alternatives (A-F), ultimately recommending **Option D: Work-Pattern Policy Compiler** as a focused slice of Option 3.

**Strongest objections (8):**
1. Proposal over-models before proving the stable primitive.
2. "Intent before compute" is under-specified as the policy root.
3. Mode behavior in schema conflicts with current runtime semantics.
4. The compiler can easily become a hidden runtime.
5. Proposal weakens custom-circuit authoring unless a strict minimal form is enforced.
6. SKILL prose is not just missing structure — it is carrying judgment.
7. Runtime event neutrality is easy to violate.
8. Checkpoint auto-resolution is not just schema.

### Doc 3: `sweep-v3-work-policy-summary.md` (99 lines)

A specific instantiation of the Work-Pattern direction for the Sweep workflow. Introduces:

- **Logical profile names**: `scan-fast`, `research-standard`, `research-high`, `code-fast`, `code-standard`, `code-high`, `review-high`, `review-critical`.
- **Machine-significant controls**: fanout shape, mutation policy, prompt/template intent, skill budget, logical compute floors, batch caps, receipt expectations.
- **Prose-owned judgment**: confidence/risk classification, PROVE item handling, blast-radius batching, injection interpretation.
- **Projection check**: v3 → v2 compiler projection is required so v3 changes produce no runtime-core change.

### Doc 4: `work-pattern-policy-compiler-proof-slice.md` (475 lines)

Sketch of the compiler output (`work-policy.index.json`) + IR (`WorkPatternIR`). A proof-slice scoped to Sweep. Success bar: does the compiled view make the Sweep workflow easier to review than the current `circuit.yaml` plus hidden `SKILL.md` policy?

---

## Audit — Claim by Claim

Format: `[survives]` = confirmed by independent evidence; `[challenged]` = contradicted or weakened by independent evidence; `[unsupported]` = no independent evidence either way; `[overfit]` = overfit to existing Circuit's organic shape, not a general principle.

### Principle 1 — A Circuit is more than a step graph

- `[survives, partial]` External evidence confirms that pure state-machine + step-graph models (LangGraph basic) are often augmented with dynamic fanout, work-pattern templates, and mode-driven policy. Temporal's child-workflow pattern, LangGraph's subgraph pattern, and OpenAI Swarm's hand-off pattern all encode "more than a step graph."
- `[challenged]` External evidence also suggests **simpler is usually better** (Anthropic: "start with simple prompts… and add multi-step agentic systems only when simpler solutions fall short"). The claim's weakness is that "step graph + a few constraints" is often sufficient for single-developer LLM workflows; "work patterns" is a real concept but pulling it into the outer manifest may over-model.
- **Audit verdict**: The principle is real (fanout + mode policy are load-bearing for Sweep/Explore-tournament/Repair-deep) but the proposed remedy in Option 3 over-applies it. A lighter-touch mechanism (step-level `dispatch_strategy` + runtime-rendered receipts) may cover the real cases without a new IR.

### Principle 2 — Human/agent legibility need different views

- `[survives]` External evidence strongly supports this. Anthropic Agent Skills use 3-tier progressive disclosure (L1 frontmatter ≈80-100 tokens; L2 body <5k; L3 on-demand files). Codex AGENTS.md uses per-directory walk-down. Cursor rules separate global/project/persona/user.
- **Audit verdict**: Survives cleanly. circuit-next should produce or include one-line human-legible summaries of workflow intent distinct from the full manifest.

### Principle 3 — Work intent and profile floors precede provider selection

- `[survives]` Strongly supported. OpenAI reasoning-effort tiers, Morph's LLM router, Anthropic's model-card guidance, and Codex's `reasoning_effort` field all encode "logical intent first, then provider-specific configuration." OPA/Cedar separate policy decision from enforcement; model selection is isomorphic.
- `[overfit]` The specific slate of profile names (`scan-fast`, `code-standard`, etc.) is Circuit-specific naming. External evidence supports the **pattern** (logical tiers) but not the specific 8-name vocabulary.
- **Audit verdict**: Adopt the principle; defer the specific profile names to Phase 1 contract authorship based on circuit-next's actual workflow inventory.

### Principle 4 — Static steps are not enough (dynamic fanout is required)

- `[survives, partial]` Temporal and LangGraph both encode dynamic fanout as first-class. SWE-agent, Plandex, and OpenDevin all dispatch dynamic subtask workers.
- `[challenged]` The **Sweep v3 proof slice itself keeps the outer graph static** (`frame → survey → triage → execute → verify → deferred → close`) and keeps dynamic child work "receipt-visible first." This proves the principle is right AND that the remedy doesn't require a new IR — the existing manifest could carry `dispatch_strategy: fanout` at a step to get most of the value.
- **Audit verdict**: Real principle; the proposed compiler is heavier than needed for what the proof slice actually demonstrates.

### Principle 5 — Portable intent, local binding

- `[survives]` npm/cargo/pyproject/bun + VS Code settings + Codex AGENTS.md all instantiate this pattern. The config-precedence prior art is field-standard.
- **Audit verdict**: Survives. circuit-next should make "why this value" auditable (the external evidence's `ResolvedSelection` concept).

### Principle 6 — Prose as non-hidden policy

- `[survives, with challenge]` External evidence confirms that prose-carrying-policy is a known anti-pattern. Internal evidence (Worker C + D) identifies this in existing Circuit directly: ~400-500 line `SKILL.md` files with embedded bash heredocs, no structural cross-check between prose and `circuit.yaml`. The **adversarial-review doc's objection #6** is correct: "SKILL prose is not just missing structure; it is carrying judgment."
- **Audit verdict**: Survives. But the fix is not necessarily a full compiler — it could be (a) a stricter schema that forbids prose-encoded policy at key decision points, plus (b) a contract test that enforces prose/YAML parity.

### Option 3 / Doc 4 — Work-Pattern Policy Compiler

- `[challenged]` Adversarial review objection #1 is the strongest attack: "over-models before proving the stable primitive." External evidence supports the critique — DSPy, GEPA, and dspy Signatures work precisely because they are minimal + proven before expanding. A new IR + compiler adds cognitive surface area without a measured delta over a tightened manifest + receipt model.
- `[overfit]` The proof slice targets *Sweep*, which has the most dynamic-fanout shape of any Circuit workflow. Generalizing from Sweep to all workflows may over-fit to Sweep's specific pattern.
- `[unsupported]` The **success bar** — "the compiled view is easier to review than `circuit.yaml` + hidden `SKILL.md`" — is meaningful but has not been measured. No A/B test exists.
- **Audit verdict**: The proposal is not wrong, but the evidence does not support making it the foundation of the rewrite. **Take the principles, defer the IR + compiler** until after Phase 1 contract authorship exposes the actual boundary shape.

### Adversarial-review objection #2 — "Intent before compute" under-specified

- `[survives]` This objection is correct. The first-principles doc does not specify:
  - Who authors intent? (Operator? Workflow author? Template?)
  - How is intent resolved against user/project config?
  - Is intent versioned?
- External evidence has a clear answer from Codex AGENTS.md + npm: **precedence is a first-class concern**. circuit-next's `SelectionResolution` + `SELECTION_PRECEDENCE` (see `src/schemas/selection-policy.ts`) is the minimum contract that resolves this objection.

### Adversarial-review objection #4 — "Compiler can become a hidden runtime"

- `[survives]` This objection is correct and important. External evidence from BAML, DSPy, GEPA warns about this: once a compiler is introduced, debugging requires understanding *both* the source language AND the compiled output. **Knight & Leveson 1986** on N-version programming applies: correlated errors between authoring and compilation can go undetected.
- **Audit verdict**: If a compiler is eventually adopted, it must be structurally prevented from carrying runtime policy (e.g., compiled manifest must be deterministic from IR + no hidden injection).

---

## Summary of Audit Verdicts

### Claims that survive

- Human/agent legibility need different views.
- Work intent and profile floors precede provider selection.
- Portable intent, local binding (config precedence as first-class concern).
- Prose-as-policy is an anti-pattern (supported by internal evidence + external evidence).
- Adversarial-review objections #2 ("intent before compute under-specified"), #4 ("compiler can become hidden runtime"), #6 ("SKILL prose is carrying judgment") are all correct and should shape circuit-next.

### Claims that are challenged

- "Static steps are not enough" — real but the proof slice shows the fix is lighter than a new IR.
- "Circuit is more than a step graph" — real but over-applied in Option 3.
- The specific `scan-fast`/`code-standard`/etc. profile vocabulary is Circuit-specific, not externally grounded.

### Claims that are overfit or unsupported

- Option 3 (Authoring definition compiles to runtime manifest) — unsupported by independent evidence; the proof slice's success bar ("easier to review") has not been measured.
- Doc 4's IR + Sweep-specific compiler is overfit to Sweep's dynamic-fanout pattern.
- The introduction of `WorkPatternIR` as a cross-workflow abstraction — unsupported; no workflow besides Sweep has been shown to benefit.

### Hard lessons for circuit-next

1. **Adopt the principles, defer the IR + compiler.** circuit-next's Phase 1 contract authorship should encode:
   - Logical profile names (not hard-coded provider models) — from Principle 3.
   - Explicit selection precedence (SELECTION_PRECEDENCE already in the skeleton) — from Principle 5.
   - Separation of machine-significant controls from prose-owned judgment — from Principle 6.
   - Optional step-level `dispatch_strategy: fanout` for dynamic child work — from Principle 4.
2. **Do NOT introduce `WorkPatternIR` in Tier 0 or Tier 1.** Wait until Phase 1 contracts expose whether the current discriminated-union Step + event log is insufficient.
3. **Enforce prose/YAML parity structurally** — contract test that every `SKILL.md` matches its `circuit.yaml` (adversarial-review #6 + internal evidence from Worker D).
4. **Treat the 4 prior-art docs as historical artifacts**, not active contracts. They record valuable thinking but were written before the methodology tournament and before cross-model auditing. The tournament decision (now at `specs/methodology/decision.md`) is authoritative.

---

## What this audit does NOT do

- Does not replicate the 4 docs' reasoning. Readers should open the docs themselves if they want the full argument.
- Does not rank the 8 objections in adversarial-review.md against each other; only #2, #4, #6 are called out because they're corroborated by external + internal evidence.
- Does not propose a circuit-next architecture. That's Phase 1's job, grounded in `specs/evidence.md` (which combines external + internal + this audit).
