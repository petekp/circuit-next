---
original_artifact_path: /Users/petepetrash/Code/.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/decision.md
source_kind: circuit-run-artifact
provenance_note: Non-operative provenance. The run-root path is host-local and may not exist on a clone. This repository copy is authoritative. The key is intentionally named original_artifact_path, not source, to prevent future tooling from treating it as an operative input.
inlined_at: 2026-04-19
inlined_in_slice: 25a
inlined_via_adr: ADR-0001 portability addendum
---

# Decision: LLM-Assisted Project Development Methodology

## Options Considered

Four tournament stances were authored, red-teamed across models, revised, and stress-tested. Each represents an orthogonal claim about *where truth lives* in an LLM-assisted workflow.

| Stance | Core claim | Author | Reviewer | Stress verdict |
|---|---|---|---|---|
| **A — Contract-First** | Truth lives in executable specs + property-based tests, authored before implementation, in a path the agent cannot write to. | Claude | Codex | **BENDS** (7 BREAK) |
| **B — Architecture-First** | Truth lives in types, module boundaries, and enforced architecture constraints; compiler IS the test. | Codex | Claude | **BENDS** (6 BREAK) |
| **C — Plurality-of-Minds** | Truth lives in the intersection of independent models' converged judgments with adversarial review by default. | Claude | Codex | **BREAKS** (15 BREAK+FATAL) |
| **D — Tiny-Step-Ratcheting** | Truth lives in continuously-measured metrics; every slice must advance a ratchet and cannot regress any. | Codex | Claude | **BENDS** (5 BREAK) |

Stance C was eliminated at stress-test: Knight-Leveson correlation [fact; Knight & Leveson 1986] means cross-model review is not statistically independent, and the Berkeley multi-agent failure study [fact; *Why Do Multi-Agent LLM Systems Fail?*, 2025; 86.7% failure rate] confirms role-design is load-bearing — a claim C could not defend against 15 concrete attack scenarios. Stances A, B, and D all survived with bounded damage.

## Decision

**Adopt Contract-First as the methodological core, execute via Tiny-Step-Ratcheting lane discipline, and borrow Architecture-First's types-as-first-line-of-defense at module boundaries.**

Stated operationally:

1. **Phase 0 — Evidence Loop** (time-boxed, 1-5 days): prototype in `bootstrap/` under minimal constraints. Output: `specs/evidence.md`. Close with adversarial auditor review before contract authorship [revised-a.md §Phase 0].
2. **Phase 1 — Contract authorship**: operator + LLM draft `specs/domain.md`, `specs/contracts/<module>.md` (with YAML frontmatter enumerating invariants, pre/postconditions, property_ids), and `specs/behavioral/<concern>.md` for non-specifiable concerns. Adversarial property-auditor (different model) emits prose tautology attacks; operator encodes each as a new property.
3. **Phase 2 — Implementation via lane discipline**: every agent slice declares one of six lanes — Ratchet-Advance, Equivalence Refactor, Migration Escrow, Discovery, Disposable, Break-Glass — with lane-specific merge semantics [revised-d.md §Work Lanes]. Implementer runs in a container with distinct UID; `specs/`, `tests/properties/visible/`, `tests/mutation/`, `specs/behavioral/`, CI configuration mounted read-only; `tests/properties/hidden/` not mounted at all [fact; Jiang et al. *ImpossibleBench* 2025: hiding tests drops hack rate to ~0].

At module boundaries, prefer types over tests when types can express the invariant. A compiling program is a first-line-of-defense against local-coherence/global-incoherence [inference from analysis.md; Ousterhout; Parnas; Alexis King "Parse, Don't Validate"]. Tests defend what types cannot reach.

Cross-model adversarial review (the one surviving mechanism from C) is used narrowly: ratchet changes, contract-relaxation ADRs, migration escrows, discovery-decision promotion, and any request to loosen a gate. The challenger produces an objection list, not an approval [Anthropic *Harness Design* 2025; fact: self-evaluation reliably skews positive]. It is one Swiss-cheese layer [Reason 1997], explicitly not independent corroboration [Knight & Leveson 1986].

## Rationale

Four convergent reasons for this synthesis:

**1. First-principles fit to the dominant failure class.** The analysis identifies "faulty external grounding" (hallucinated APIs, fabricated imports, wrong version assumptions, phantom helpers) as the dominant class of coding-agent errors [inference from analysis.md; supported by CodeHalu 2025 (all 17 models exhibit all 4 hallucination classes); Spracklen et al. USENIX 2025 (19.7% of generated code references non-existent packages); Codex introspection]. Contract-First addresses this most directly: contracts ARE the external grounding the agent writes against. Ratchets (D) measure compounding error in long horizons but do not constrain what the agent writes. Types (B) reach part of the problem but miss domain-level invariants.

**2. Strongest LLM-specific empirical backing among surviving stances.** Contract-First's component interventions have direct measured effect:
   - Tests-in-prompt: +12.78% MBPP, +9.15% HumanEval [fact; Mathews & Nagappan ASE 2024]
   - Property-Generated Solver: +9.2% pass@1 absolute [fact; PGS 2025]
   - Hidden tests: drops reward-hack rate to ~0 on LiveCodeBench [fact; Jiang et al. 2025]
   - Generator/evaluator split across models beats self-critique [fact; Anthropic *Harness Design* 2025]
   - Mutation testing correlates with real-fault detection [fact; IEEE TSE 2012-2018]

Architecture-First (B) has classical-CS backing (Parnas, Ousterhout, TLA+ at AWS [fact; Newcombe et al. CACM 2014]) but weaker LLM-specific RCT evidence. Tiny-Step-Ratcheting (D) has evidence for components (METR time horizons [fact; 2025]; LORE 120-step collapse [fact]) but not for monotonic-advancement-as-policy.

**3. Survivability via D's lane discipline.** D had the fewest stress BREAKs (5) because lane semantics honestly cover the diversity of real work — equivalence refactors, migration debt, research spikes, throwaway scripts, emergency hotfixes. A pure Contract-First stance stress-tested with 7 BREAKs because it treated `bootstrap/` as a loophole [revised-a.md acknowledged review finding]. Composing A + D's lane system closes that exploit path: Phase 0 becomes Discovery Lane; emergency fixes become Break-Glass; pure refactors become Equivalence Refactor. The lane declaration IS the slice framing gate [revised-d.md §Framing Gate].

**4. Anti-Goodhart controls from D strengthen A's weakest point.** Contract-First's review correctly attacked mutation-score theater as gameable by operator-implementer collusion [review-a finding, preserved in revised-a.md §Residual Risks]. D's quarantine protocol, versioned ratchet floors, fingerprinted commands/configs/datasets, overlap windows on metric replacement, and meta-ratchets (flake rate, gate runtime, override count, skipped-audit age) give Contract-First's mutation gate concrete governance [revised-d.md §Anti-Goodhart Controls].

**Why not the inverse (D-core with A-layer)?** Ratchet-first creates the Goodhart-on-gaps failure (the stress test's top-ranked BREAK): the agent optimizes exactly to measured metrics and lets unmeasured risks grow. Contract-first makes the invariants the primary artifact, which forces unmeasured failure modes to be named before they can be optimized around. Ratchets are the enforcement mechanism; contracts are what is enforced.

**Why not pure D?** D alone leaves the operator authoring ratchets reactively — you discover a failure mode, then add a metric. Contract-First is proactive: the contract names the failure mode before implementation, and the property witnesses it [revised-a.md §Rationale; analysis.md invariant 10].

**Why not pure A?** A alone does not govern slice-level merge semantics well — the original proposal's weakness that the stress test surfaced. D's lane system is the missing execution discipline.

## Accepted Risks

Risks deliberately accepted as the cost of this methodology:

1. **Calendar-time tax of 15-25% steady-state; 3-5 days front-loaded Phase 0+1** [revised-a.md §Tradeoffs — honest arithmetic]. Breaches the brief's 25% ergonomic target for projects under ~6 weeks. [assumption; calibrated from TDD industrial studies (+16% time, Nagappan 15-35% cost) scaled to solo operator with agent drafting; no direct citation at solo-operator scale — labelled inference].

2. **Cognitive load of property authorship** above example-based testing [inference from Codex introspection on test-smell patterns; reduced but not eliminated by LLM-draft-then-auditor-attack workflow].

3. **Cross-model reviewer correlation** [fact; Knight & Leveson 1986]. Claude↔Codex share substantial training-data overlap; correlated errors expected. Accepted as inherent; treated as one Swiss-cheese layer, not independent corroboration.

4. **Container-tooling prerequisite**. Operators without Docker/Podman/Firecracker fall back to the distinct-Unix-account degraded mode, strictly weaker than container isolation. Flagged as compliance gap, not parity [revised-a.md §Sandbox].

5. **Contract-gap domains** — genuinely novel research, unspecifiable taste judgments, pure UI-polish work — are carved out as Discovery/Disposable lanes rather than forced into contracts [revised-a.md §Failure Modes NOT Defended]. For such projects, the methodology is over-engineered; the carve-out is honest scope, not evasion.

6. **Metric laundering by determined repo-admin collusion** is structurally undefeatable by the methodology alone [revised-d.md §Failure Modes Not Fully Defended]. Mitigation is git-visibility + periodic out-of-band audit, not prevention.

7. **Cross-contract emergent bugs** the contract graph did not anticipate [revised-a.md §Failure Modes NOT Defended]. Complementary mechanism (TLA+/model-checking) is available but not baseline.

8. **Slow-tier check latency** means some bad merges can land before expensive checks complete [revised-d.md §Residual Risks]. Mitigated by affected-scope blocking + bisection, not eliminated.

## Mitigations

Baked into the methodology:

1. **Hard Invariants 1-10** [from analysis.md] honored in the revised Contract-First compliance table; all at Pass or documented Partial [revised-a.md §Invariant Compliance].

2. **Hidden property pools with opaque rotation** [fact; instantiates Jiang et al. 2025]: implementer never sees `tests/properties/hidden/`; CI runs both visible and hidden; rotation schedule governed by CI, not operator.

3. **Container isolation with read-only mounts** of `specs/`, `tests/properties/visible/`, `tests/mutation/`, `specs/behavioral/`, CI configuration. `tests/properties/hidden/` not mounted into implementer container at all.

4. **Registry-lookup wrapper** as sole install path; raw network to PyPI/npm/crates firewalled from container. Addresses package hallucination [fact; Spracklen et al. 2025].

5. **API-grounding gate**: every new identifier from an external package is cross-checked against installed type stubs/docstrings/d.ts files or (dynamic languages) witnessed by an end-to-end call test. Addresses phantom helpers [fact; CodeHalu 2025].

6. **Lane discipline** [revised-d.md §Work Lanes]: slice framing gate declares lane + failure mode + acceptance evidence + alternate framing before implementation. Alternate-framing is mandatory to defend against anchoring [fact; Nguyen 2024].

7. **Anti-Goodhart controls** on ratchets: no aggregate scoring; eligibility-gated advancement credit; protected verification configs (lint configs, type configs, coverage configs, test selectors, ignore lists); versioned floors with overlap on replacement; fingerprinted commands/configs/datasets; meta-ratchets (flake rate, gate runtime, override count, quarantined-metric age, skipped-audit age).

8. **Solo-operator self-approval protocol** [revised-d.md]: for weakening a ratchet, lowering a floor, retiring a metric, extending an escrow, or promoting a discovery decision — non-implementing model writes an objection list; implementing agent writes the cheapest alternative; human records rejection rationale; approval occurs in a separate commit from product diff; non-emergency weakening has cooling-off until next working session.

9. **Behavioral Contract track** [revised-a.md]: `specs/behavioral/<concern>.md` for performance, accessibility, UX, security with first-class merge-blocking authority. UX/aesthetic gates use operator-authored checklists with closure-audit validation.

10. **Session hygiene**: `CLAUDE.md` <300 lines [fact; Anthropic docs]; prompt caching on stable prefix [fact; 85% latency / 90% cost reduction, Anthropic 2024]; `SESSION.md` auto-generated from git log + operator-appended open confusions; compaction disabled; session reset with persistent artifact re-initialization [fact; Anthropic *Effective Harnesses* 2025].

11. **Prompt-injection defense**: typed `RetrievedContent` wrapper; side-effectful tool calls with retrieved-content arguments go through confirmation seam at tool-definition layer. Addresses [fact; OWASP LLM01:2025; HouYi; ToolHijacker].

12. **Slice bound ≤ 30 min wall-clock** [fact; METR 2025; LORE 2025 super-linear collapse past ~120 steps]. Coordinated-edit slices compose under a single contract-change ADR.

## Open Risks

Risks present but not fully mitigated; carried into operations:

1. **Operator burnout on Phase 1 authorship** during first feature. No amortization claim made [review finding; revised-a.md removed the "by Nth project overhead drops" line]. Watch for retrospective feedback at end of first feature.

2. **Hidden-pool enumeration over time** if rotation schedule is predictable or pool is small. Mitigation (pool substantially larger than visible; opaque rotation) reduces but does not eliminate.

3. **ADR-channel reward hack**: implementer constructs a diff that makes a property look like a contract problem rather than a bug. Mitigation (auditor's "who silently breaks?" question on relaxation ADRs) forces the attack into a human-visible review path, not a structural block.

4. **Methodology applied to projects it is wrong for**. Tier 0-3 staged adoption [revised-d.md] gives lighter footprint for early/sketch work, but operator discretion could still apply heavy methodology to a 2-week hackathon. Open risk at the governance level.

5. **Behavioral gate subjectivity** on UX/aesthetic concerns. Checkbox discipline forces the judgment to be made but cannot make it correct. Accepted as irreducible for non-specifiable domains.

6. **Meta-process drift**: closure audits become rubber-stamps; lane declarations become boilerplate; auditor objection lists get skimmed. Mitigation (periodic Goodhart audit on meta-process; skipped-audit age as a meta-ratchet) is preventive, not curative.

## Reopen Conditions

Conditions under which this decision should be re-examined:

1. **Empirical reproduction fails**: if the first pilot project exceeds 40% calendar-time overhead (vs. the expected 15-25% + front-load), the 25% ergonomic bound is structurally breached and the methodology does not fit.

2. **Hidden-pool attack demonstrated**: if an implementer (human-operated or agent-demonstrated) reproducibly enumerates hidden properties through filesystem, timing, or rotation analysis, the ImpossibleBench intervention is not holding and the core reward-hack defense must be re-designed.

3. **Cross-model reviewer correlation ≥95%** on production tasks: if objection lists from Claude and Codex on the same ratchet/contract converge beyond 95% over N≥20 samples, the dual-model layer is not adding Swiss-cheese value and the review protocol should be replaced with structural checks.

4. **Frontier model behavioral shift**: major Claude or Codex release that changes the empirical base — e.g., reward-hacking rates drop an order of magnitude, self-correction without external feedback becomes reliable, or hallucination rates shift — invalidates the analysis's load-bearing citations and reopens the decision.

5. **Operator-role change**: methodology assumes solo operator + dual-agent surface. If team grows past one human or switches to a single-agent tool, the multi-model adversarial review loses its structural basis.

6. **Tooling unavailability**: if container isolation becomes unavailable (corporate policy, OS change, CI provider drop) and cannot be replaced, the degraded Unix-account mode is the only option and Hard Invariant 1 drops from Pass to Partial — reopen to reconsider.

## Pre-mortem

*Six months from now, imagine the methodology has failed. Why?*

**P1 — Phase 1 bureaucracy crushed velocity.** The contract-authorship phase became the bottleneck; the operator started skipping it for "small" features; Phase 0 got elided; the methodology eroded into ad-hoc agent work with better naming. → *Mitigation present*: Tier 0-3 staged adoption [revised-d.md] and the Disposable/Discovery lanes allow lighter-touch application for small or ambiguous work; the solo-approval protocol forces a cooling-off before lane boundaries are redrawn. *Residual*: enforcement depends on operator discipline; no structural block on lane drift. *Signal to watch*: ratio of Ratchet-Advance lanes to Disposable/Equivalence lanes trending upward over months.

**P2 — Property tests became tautological despite the auditor.** Auditor's tautology-attack was formulaic; same objections recycled; operator encoded minimum counterexamples; mutation score stayed green but the suite tested the wrong things. → *Mitigation present*: mutation gate with frozen operator list; carve-out lists reviewed at closure audit; full-suite weekly mutation; property-auditor rotates between Claude and Codex. *Residual*: tautology is a property of the space of plausibly-wrong implementations the auditor imagines — a blind spot stays blind. *Signal*: failures surfacing only at integration, not at property-level, over multiple features.

**P3 — Ratchet laundering through quarantine.** Metrics that started catching real bugs got flagged noisy, quarantined "temporarily," and never restored. Quarantine-age meta-ratchet was itself quarantined. → *Mitigation present*: quarantined-metric age is a meta-ratchet with hard consequences; replacement plan required; cooling-off on renewal. *Residual*: a determined operator can always extend. *Signal*: count of quarantined metrics growing faster than restored ones over 3 months.

**P4 — Container isolation abandoned.** Docker/Podman unavailable on operator's machine; fell back to Unix-account mode; then (after a year) to same-user mode "for expediency"; reward-hack defenses now conventional, not structural. → *Mitigation present*: degraded modes are flagged compliance gaps; CI-side duplication catches `--no-verify` bypass even in degraded mode. *Residual*: if CI is also on the operator's machine, the whole defense collapses. *Signal*: first time a test file appears in a non-verification-lane diff.

**P5 — Cross-model challenger produced correlated objections.** Claude and Codex agreed 98% of the time; disagreement surfaced nothing the operator hadn't already seen; the dual-model layer became ceremony. → *Mitigation present*: Swiss-cheese framing explicit — cross-model is one layer; primary defense is executable evidence. *Residual*: the value-add of dual-model was always bounded. *Signal*: Claude/Codex convergence rate on contract-relaxation ADRs over N≥20 samples; reopen condition #3 triggers.

**P6 — Goodhart-on-gaps realized.** Measured metrics stayed green; un-measured risks (UX regressions, data-quality drift, third-party API drift, security posture) grew silently. The methodology optimized exactly to its instruments [stress-d finding 5.1]. → *Mitigation present*: Behavioral Contract track extends coverage to UX/perf/a11y/security; discovery lane surfaces new risks into new ratchets; `specs/risks.md` ledger captures accepted risks. *Residual*: Goodhart is structural to any metric-governed system; the methodology can make it visible, not impossible. *Signal*: a field incident in a dimension that had no ratchet.

**P7 — Methodology applied to a project it was wrong for.** Operator treated a 2-week MVP like a high-durability system; front-load crushed the schedule; methodology was abandoned mid-project. → *Mitigation present*: explicit scope statement — governance option, not universal mandate; Tier 0 exists for light application. *Residual*: judgment call. *Signal*: project abandonment of methodology within first feature.

**P8 — The first-time operator gave up.** Phase 1 felt impossibly heavy; auditor attacks felt like hazing; operator reverted to bare Claude Code use. → *Mitigation present*: LLM drafts contracts/properties; operator reviews and iterates; worked-example templates in the adoption pilot [see plan.md]. *Residual*: learning curve is real. *Signal*: session logs showing contract/property authoring time exceeding 2× expected for first 3 features.

**P9 — Migration escrow became the permanent state.** Every feature slipped into "just one more escrow window"; ratchets were structurally weak for months; project shipped with accepted debt nobody tracked. → *Mitigation present*: escrow expiry is hard; renewal requires solo-approval protocol with cooling-off; escrow count is a meta-ratchet. *Residual*: operator can extend. *Signal*: average escrow duration trending upward.

**P10 — A critical published study invalidated a load-bearing citation.** New frontier model makes hidden tests trivially discoverable; or reward-hacking drops an order of magnitude under new training; or N-version errors turn out to be more correlated than Knight-Leveson suggests. → *Mitigation present*: reopen condition #4 triggers explicit re-examination. *Residual*: inherent — any evidence-grounded methodology is vulnerable to evidence revision.

Each pre-mortem failure is mapped to a mitigation already in the methodology or accepted as a known risk. None require methodology change; all require ongoing vigilance. The signal-to-watch column operationalizes the vigilance as observable metrics rather than hopes.

## Methodology Amendments (2026-04-20, Slice 25b)

Slice 25b installs only the minimum governance needed before product work resumes: D1, D4, and D10 in this decision record. D9 installs through repo-root `TIER.md`, not through `decision.md`. D2 waits until the first alpha runner exists; D3 requires an explicit ADR-0001 reopen; D5 waits until after `dogfood-run-0`; D6 waits until executable probes can run; D7 waits for runtime probes plus cooling/emergency-correction discipline; D8 is a Phase 2 close rollback review. Installing those rules before their triggers would be methodology work replacing executable product proof, which D1 is meant to prevent.

### D1. Product Reality Gate

No methodology phase may close solely on authored governance artifacts
(contracts, ADRs, reviews, ledgers, audit rules, or tests). Each phase must
produce or preserve one executable product proof.

A product proof is one of:

- a user-facing command that runs against a non-methodology workflow;
- an end-to-end fixture that creates a run log and derives a snapshot;
- a design-only claim recorded by ADR, with named next executable proof and
  expiry date.

A design-only Product Reality Gate proof expires after 2 slices or 14 calendar
days from the recording ADR, whichever is sooner. Renewal requires a second ADR
naming a specific hardening event that justifies the extension.

`product_gate_exemptions` is a machine-readable ledger at
`specs/methodology/product-gate-exemptions.md` with YAML frontmatter (name,
description, type=ledger) + a markdown table (columns: `phase_id | slice |
reason | consumed | authorization_record`). Audit enforces three integrity
rules: every row must name a non-empty `authorization_record` that exists on
disk; no row's `reason` may match `amend(s|ing) D1` or `amend(s|ing) D3`
(D1 is meta-rule, D3 is graph root — neither is waivable); and the ledger
must contain the Slice 25b bootstrap-exception seed row. Slice 25b consumes
a one-time operator waiver (bootstrap exception) because it changes future
acceptance terms; it is not evidence that the Gate works.

### D4. Governance Authority Graph Rule

Standing methodology rules (hard caps, cadences, close criteria, convergence
criteria) may not live only in `specs/plans/`. They must be mirrored or hosted
in `specs/methodology/decision.md` or an ADR. Plans may operationalize or
schedule; they may not author durable standing rules by themselves.

### D10. Adversarial Review Discipline

Target: `specs/methodology/decision.md`, with
`specs/reviews/adversarial-yield-ledger.md` as immediate data source. The
ledger is a markdown table with columns: `pass_date | artifact_path |
artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count
| MED_count | LOW_count | verdict | operator_justification_if_past_cap`.
`artifact_class` is one of `reversible`, `governance`, `irreversible`.

1. **Pass-count cap.** Adversarial review on a single artifact is capped at 2
   passes for reversible work, 3 for governance changes, and 4 for
   irreversible artifacts such as schema breaks for external consumers,
   production migrations, or published APIs. Beyond the cap requires operator
   written justification naming the specific failure class being hunted.
   Audit enforces the cap: when `pass_number_for_artifact` exceeds the class
   cap, `operator_justification_if_past_cap` must be substantive — at least
   30 characters and not a placeholder (`n/a`, `none`, `see body`, `tbd`,
   `.`, `justified`, `-`). Placeholder text is red.
2. **Compound stopping criterion.** Stop when all are true:
   - yield halved versus prior pass;
   - no HIGH severity appeared in the last pass;
   - the reviewer can name the specific defect class the next pass would hunt
     that the last pass missed;
   - a structurally different mode (runtime, human, fuzzer, property test) is
     available and cheaper than another review pass.

If no structurally different cheaper mode is available at the time of the
decision, the fourth clause is waived; the artifact must record the waiver
explicitly in the yield-ledger row for that pass.

3. **Mode-cycle rule.** After K review passes on an artifact, the next
   defect-discovery effort must come from a structurally different mode before
   another same-mode review is valid. K = 2. Audit rejects any artifact whose
   yield-ledger rows show three consecutive same-mode passes (by
   `pass_number_for_artifact` order) without an intervening different mode.
4. **Artifact-size signal.** If an artifact needs more than 3 adversarial
   passes to converge, treat that as evidence it is too large and decompose it.

The pass-cap values 2/3/4 are opinionated priors, not empirically tuned. Tune
them after 10-20 reviewed artifacts using the yield ledger.

### D10 Extension — Rigor-Profile Budget Binding (2026-04-20, Slice 28 / plan §Slice DOG+1)

Installed by Slice 28 (plan §Slice DOG+1) per
`specs/plans/phase-1-close-revised.md` §Slice DOG+1 and ADR-0001 Addendum B
§Phase 1.5 Close Criteria #10 and §D10 Adversarial Review Discipline. The
plan names the slice "DOG+1"; the canonical numeric slice-id marker at
the status-epoch layer is `28` (SLICE_ID_PATTERN constrained to
`^[0-9]+[a-z]?$`). This extension operationalizes D10 by binding the
adversarial-pass budget to a slice's declared rigor profile and adds a
"Why continue?" checkpoint between passes.

**Rigor → adversarial-pass budget (hard cap).** Each adversarial pass recorded
in `specs/reviews/adversarial-yield-ledger.md` carries a `rigor_profile`
column drawn from the circuit-next rigor set. Budget is the maximum
`pass_number_for_artifact` allowed under that rigor:

| Rigor profile | Adversarial budget | Notes |
|---|---:|---|
| `lite` | 0 | No adversarial pass. A lite slice that logs a pass is red by audit. |
| `standard` | 1 | One LLM-review pass max. |
| `deep` | 2 | Up to two passes. Pass 2 requires execution between passes (below). |
| `tournament` | 3 | Up to three passes. Pass 3 requires a non-LLM mode in a prior row on the same artifact (below). |
| `autonomous` | inherits | Budget equals the parent workflow's rigor budget. Rows carry the parent's resolved profile, not literal `autonomous`, when evaluated by audit. |

The rigor-profile budget and the artifact-class cap (2/3/4) from §D10 clause 1
are **both** enforced; the effective cap is the minimum of the two. Exceeding
either requires the same operator-justification form as §D10 clause 1.

**Non-LLM mode required before pass 3 (Tournament).** A pass with
`rigor_profile: tournament` and `pass_number_for_artifact: 3` is rejected
unless at least one prior row for the same `artifact_path` has a `mode` that
does not begin with `llm-`. This prevents a Tournament slice from running
three consecutive LLM passes and calling that coverage. The non-LLM mode
values are the same structurally-different modes named in §D10 clause 2:
`runtime`, `human`, `fuzzer`, `property-test`, `non-llm-review`, or any
other mode whose value does not begin with `llm-`.

**Review-execution alternation (Deep and Tournament).** For passes with
`rigor_profile` in `{deep, tournament}` and `pass_number_for_artifact >= 2`,
the row must populate `prior_execution_commit_sha` with a git SHA that
resolves to a commit landing between the prior pass and this one that
touches at least one path outside `specs/reviews/` (i.e., real execution,
not more review-authorship). Audit verifies the SHA resolves, the commit is
an ancestor of the current HEAD, and at least one file in its diff is
outside `specs/reviews/`. Standard and Lite rigor pass 1 use `n/a`.

**"Why continue?" checkpoint.** For any pass with
`pass_number_for_artifact >= 2`, the row must populate
`why_continue_failure_class` with a substantive specific-failure-class
string — ≥ 30 characters, not a placeholder (`tbd`, `more review`, `n/a`,
`see body`, `various`, `general`). Vague text is red by audit. The intent
is the plan's "next-pass hunter names the specific failure class" rule; if
the operator cannot name it, the correct move is to transition to execution
mode, not to schedule another pass.

**Autonomous inheritance.** An autonomous slice's rigor is resolved at
dispatch time to its parent workflow's rigor. Ledger rows written by an
autonomous adversarial pass carry the resolved value (`standard`, `deep`,
or `tournament`), not the literal `autonomous`, so audit evaluates a
concrete budget. A row literally carrying `autonomous` is treated by audit
as unbound (budget-skipped, but artifact-class cap still applies) and
flagged yellow — the operator is asked to write the resolved profile for
future-readability.

**Ledger schema (operationalized).** The three columns added by this
extension are `rigor_profile`, `why_continue_failure_class`, and
`prior_execution_commit_sha`. Their audit semantics are above. Pre-DOG+1
ledger rows are retroactively annotated to the closest-matching rigor
profile for their originating slice; a `migrated` value is not used —
rows carry real profile values so the audit exercises the same code path.

**Pre-DOG+1 grandfather value.** Ledger rows landed before DOG+1 was
installed are annotated with `rigor_profile: pre-dog-1-grandfather`.
`why_continue_failure_class` and `prior_execution_commit_sha` are set to
`n/a` for these rows. Audit skips the four extension rules for
grandfather rows but continues to enforce the §D10 clause-1 artifact-class
cap (2/3/4), clause-3 mode-cycle (K=2), and clause-1 placeholder-reject on
`operator_justification_if_past_cap`. The grandfather value is a
Migration-Escrow marker — its hard expiry is Phase 2 close. New rows
written after DOG+1 lands must use one of the five concrete rigor values;
audit rejects any new row whose `pass_date` is later than the DOG+1
install commit date and whose `rigor_profile` is `pre-dog-1-grandfather`.

**Machine enforcement.** `scripts/audit.mjs` Check 14
(`checkAdversarialYieldLedger`) extends to parse the three new columns and
enforce the four rules above (plus the grandfather expiry). A breaking
change to the ledger schema requires the same coordinated update — ADR +
audit check + contract test — as any other ratchet floor change.

## Methodology Amendments (2026-04-20, Slice 25d)

This section **mirrors** `specs/adrs/ADR-0001-methodology-adoption.md`
Addendum B for operator navigation and planning-prose continuity. Authority
for phase-graph semantics lives in ADR-0001 Addendum B; this mirror is not
the authority. If this section and ADR-0001 Addendum B disagree, the ADR
wins and this section must be corrected. Machine-enforced by
`scripts/audit.mjs` Check 20 (`checkPhaseAuthoritySemantics`).

### D3. Phase 1.5 Alpha Proof

Slice 25d installs D3 through an explicit ADR-0001 reopen
(Addendum B). The authored phase graph becomes
**Phase 0 → Phase 1 → Phase 1.5 → Phase 2**:

- **Phase 0 — Evidence Loop.** Unchanged; operational definition preserved
  from the original Decision section above.
- **Phase 1 — Contract authorship.** Unchanged; operational definition
  preserved. Close inventory is now precise: Phase 1 closes when
  (a) D1/D3/D4/D9/D10 governance is authoritatively installed AND (b) the
  remaining Phase 1 contracts are authored, which at HEAD 24b85d2 means
  the narrowed Slice 27 workflow contract. See ADR-0001 Addendum B §Phase
  1 Close Inventory for the authoritative list.
- **Phase 1.5 — Alpha Proof (NEW).** Purpose: prove the runner works
  end-to-end on a non-methodology workflow before Phase 2 expands
  implementation. `dogfood-run-0` succeeds here. Opens when Phase 1 close
  criteria are satisfied (the commit that lands the last Phase 1
  deliverable — at HEAD 24b85d2, Slice 27). Runs under the same lane
  discipline and current-tier gates as Phase 2; container isolation
  remains Tier 2+ deferred. D1 applies at Phase 1.5 close — the phase
  cannot close on authored governance alone. Closes when all 16 criteria
  at ADR-0001 Addendum B §Phase 1.5 Close Criteria are satisfied.
  **CC#14 amendment (ADR-0006, Slice 31a, 2026-04-21).** Close
  Criterion #14 was amended by ADR-0006 as a one-time waiver + retarget:
  the canonical non-LLM human cold-read is not satisfied; a product-
  direction operator check at `specs/reviews/phase-1.5-operator-product-check.md`
  (14a) plus the existing Claude + Codex LLM stand-in sections in
  `specs/reviews/phase-1-close-reform-human.md` carrying the F17
  weaker-evidence flag (14b) substitute weaker evidence of different
  shape. ADR-0006 §Precedent firewall governs future retargets; ADR-0006
  may not be cited as precedent. Authority: ADR-0001 Addendum B as
  amended by ADR-0006.
- **Phase 2 — Implementation.** Unchanged; operational definition
  preserved. Phase 2 entry is gated by Phase 1.5 close instead of Phase 1
  close. Runtime-substrate work (append-only writer, reducer snapshot,
  manifest byte-match) that precedes `dogfood-run-0` lands in Phase 1.5,
  not Phase 2.

**Authority clause (phase-graph semantics only).** Phase 1, Phase 1.5, and
Phase 2 semantics are authored in ADR-0001 Addendum B. `decision.md` may
mirror them; it cannot amend them alone. Other standing methodology rules
(D1–D10 themselves, lane definitions, ratchet rules, audit-gate semantics)
may still be authored here in `decision.md` per D4.

**Reopen basis — one-time for Slice 25d.** The reopen basis that
authorized Addendum B is scoped to Slice 25d only. A generic "phase-graph
amendment by operator directive" standing reopen condition was
**rejected** during Codex challenger fold-in; the guardrailed condition 7
in ADR-0001 Addendum B §Reopen basis is the authoritative form. Future
phase-graph amendments must satisfy all four guardrails there.

### Backwards-compatibility note

Pre-25d references in this file and elsewhere to "Phase 1 close" now
resolve to "Phase 1 contract-authorship close." Pre-25d references to
"Phase 2 entry" now resolve to "Phase 2 entry, which requires Phase 1.5
close." The original Decision section above is preserved verbatim; these
rewording rules apply at read-time, not by retroactive edit.
