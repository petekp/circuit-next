---
name: adr-0007-codex
description: Codex cross-model challenger pass on ADR-0007 (Phase 2 close criteria governance). Required per CLAUDE.md hard invariant #6 / decision.md challenger protocol (governance ratchet and gate re-deferral).
type: review
review_kind: challenger-objection-list
target_kind: adr
review_target: specs/adrs/ADR-0007-phase-2-close-criteria.md
target_version: "2026-04-21 (as-authored, pre-fold-in)"
review_date: 2026-04-21
reviewer_model: gpt-5-codex
reviewer_role: cross-model-challenger
mode: adversarial-llm-review
opening_verdict: REJECT PENDING FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 7
  MED: 5
  LOW: 1
  META: 1
verdict: REJECT PENDING FOLD-INS
authored_by: gpt-5-codex
fold_in_disposition: all HIGH + all MED + LOW + META incorporated into ADR-0007 via revision in same authoring session on 2026-04-21; see ADR-0007 §Appendix B internal-consistency reconciliation table for per-objection fold-in location.
---

# Codex challenger objection list — ADR-0007

## Opening verdict: REJECT PENDING FOLD-INS

## Objections

### 1. HIGH — ADR-0007 violates the ADR-0006 precedent firewall while claiming not to

ADR-0007 says it does not cite ADR-0006 as precedent, but the current text does exactly that in several permission-granting places. The frontmatter calls ADR-0006 a "CC#14 retarget precedent pattern," Context says ADR-0007 installs a firewall "analogous to ADR-0006 §5," and the CC#P2-7 rationale says "ADR-0006 precedent shows that re-deferral by ADR ... is a legitimate pattern." That last sentence is a direct clause-7 violation: it uses ADR-0006's existence and retarget pattern as permission for a similar move. Later disclaimers do not undo the earlier precedent claim.

**Remediation:** Remove all permission-granting ADR-0006 language. ADR-0007 may cite ADR-0006 only as historical context for Phase 1.5 authority or as a negative constraint: "ADR-0006 §5 forbids citing ADR-0006 as precedent; ADR-0007 therefore re-authenticates its own basis." Replace the CC#P2-7 rationale bullet with the independent basis itself, not with an analogy to ADR-0006.

### 2. HIGH — CC#P2-7 re-deferral hollows container isolation into policy-only theater

CLAUDE.md says Phase 2 implementers run in a container with distinct UID and protected mounts, while hard invariants #1-#4 remain non-negotiable except through methodology reopening. ADR-0007 says Phase 2 close does not require container isolation, no audit check enforces CC#P2-7, and the invariants remain "policy (not Phase-2-close-gating)." That is not a preserved invariant in practice; it is a standing permission to run all P2.1-P2.11 work unisolated unless a slice happens to self-identify as "claiming isolation." The Break-Glass sentence does not rescue this, because the ADR defines normal Phase 2 work as not violating the invariants.

**Remediation:** Carry weaker-evidence wording openly: "ADR-0007 weakens Phase 2 close by accepting unisolated implementer execution for Phase 2 close." Add an interim enforcement surface, such as a required per-slice isolation status line and an audit check rejecting any Phase 2 slice that both writes protected surfaces and omits either container evidence or an explicit CC#P2-7 re-deferral citation. If the intent is to amend CLAUDE.md's Phase 2 container sentence, say so and route it as a methodology amendment instead of burying it in a close-criteria ADR.

### 3. HIGH — The CC#P2-7 trigger list misses obvious isolation-adjacent Phase 2 scenarios

The five triggers do not cover all cases where isolation honesty becomes load-bearing. Missing triggers include: a non-dry-run agent adapter with filesystem or tool access executing against this repo; any generated workflow or plugin command that can write under `specs/`, `tests/`, `.github/`, or config; new visible property tests or behavioral specs whose read-only status matters; CI/proxy/hook config changes that should be read-only to implementers; and any reference-Circuit parity harness that mounts both source and target trees. Trigger 1 also excludes "Claude/Codex under operator direction," which is exactly the current implementer class most likely to mutate protected files.

**Remediation:** Add triggers for any agent/tool process with repo write capability, any protected-surface mutation by workflow execution, any new property/behavioral/mutation/CI enforcement surface, and any parity harness requiring source-of-truth separation. Remove the blanket exclusion for Claude/Codex under operator direction; instead distinguish "LLM drafting in the operator session" from "agent/tool process executing with filesystem authority."

### 4. HIGH — CC#P2-8 can pass by review-artifact presence without proving CC#P2-1 through CC#P2-7 are closed

CC#P2-8's enforcement is a set of files plus a Check-21-analog artifact-presence audit. It does not require the close review to enumerate CC#P2-1 through CC#P2-7, cite their exact evidence, mark each as satisfied/not satisfied, or fail closed if any criterion is red, re-deferred, waived, or satisfied by weaker evidence. Worse, it explicitly allows LLM stand-in sections until a genuine non-LLM signal is obtainable, which can recreate the ADR-0006 weaker-evidence pattern at Phase 2 close while still satisfying artifact presence.

**Remediation:** Define CC#P2-8 as the final blocking review over a close matrix: every CC#P2-N must have an evidence path, audit/test result, commit SHA, and status. The audit check should reject a Phase 2 close claim if any prior criterion is missing, red, re-deferred without an active ADR, or supported only by stand-in evidence where the criterion requires operator/non-LLM evidence. Artifact presence alone is not enough.

### 5. HIGH — Several enforcement bindings are circular or substitutable by weaker evidence

ADR-0007 repeatedly treats "landing of slice X" as enforcement. That is weaker than a testable binding. CC#P2-5 says the audit check will be "named explicitly in the slice commit body," but names no check. CC#P2-8 depends on P2-CLOSE-REVIEW, which is not yet in the plan. CC#P2-2 allows a real-agent smoke test to be skipped in CI without requiring a durable local transcript or receipt artifact. CC#P2-3 says P2.2 is partial and P2.11 is full, but the audit binding only checks manifest/markdown closure, not Claude Code invokability. These can all be satisfied by weaker evidence without tripping the firewall.

**Remediation:** Replace slice-name enforcement with concrete acceptance artifacts. For each CC#P2-N, name the required test file or audit function, the required fixture/golden path, the required frontmatter fields if a review artifact is involved, and the non-substitutable failure condition. Where the exact test name is not known yet, mark the criterion "not fully locked" or require the later slice to amend ADR-0007 before claiming closure.

### 6. HIGH — CC#P2-6 weakens the plan's `explore` spine and silently resolves Open Question #5

The plan's P2.3 deliverable says the `explore` fixture should have "full-spine phases — at minimum Frame → Analyze → Synthesize → Review → Close," while Open Question #5 asks whether `explore` starts full-spine or partial-spine. ADR-0007 instead defines `explore` canonical coverage as only {Frame, Analyze, Synthesize}. That makes the close criterion weaker than the plan slice it supposedly locks, and it resolves an open plan question without acknowledging the resolution or amending the plan section.

**Remediation:** Either set CC#P2-6's `explore` canonical phase set to Frame, Analyze, Synthesize, Review, Close, or explicitly amend Open Question #5 and P2.3 to say Phase 2 parity starts with the three-phase subset. If the latter is chosen, carry weaker-evidence wording because the ADR is lowering the plan's stated minimum.

### 7. HIGH — The "plan amended in place" story is actually pointer-by-another-name

ADR-0007 says the plan will be amended in place, but the proposed replacement text says the plan is only a "faithful mirror" and does not duplicate enforcement binding text. That leaves future slice authors reading a tactical plan whose close criteria are still terse summaries, while the actual bindings live elsewhere. This is the exact pointer-only failure ADR-0007 claims to avoid under D4 authority-graph discipline.

**Remediation:** Put the locked CC#P2-1 through CC#P2-8 identifiers, target workflow, re-deferral status, and short binding summary directly in `specs/plans/phase-2-implementation.md`. ADR-0007 can remain authoritative on conflicts, but the plan must carry enough in-place content that a slice author cannot miss the locked semantics.

### 8. MED — Retargeting from `explore` to `review` lacks a complete amendment payload

ADR-0007 says a retarget requires amending the ADR and clearing the firewall, but it does not say what has to change. A fallback to `review` affects CC#P2-1 goldens, CC#P2-6 canonical phase coverage, P2.3 contract authorship, P2.5 fixture paths, artifact-shape expectations, and possibly whether already-landed `explore` work remains a target, a discarded partial, or a second-workflow candidate. Without that payload, "amend the ADR" can degrade into a target-name swap.

**Remediation:** Add a retarget checklist: new target workflow, canonical phases, fixture path, golden path, artifact-shape contract, affected planned slices, disposition of any landed `explore` artifacts, and evidence that the retarget is structurally required rather than merely scope-reducing.

### 9. MED — Aggregate-scoring firewall leaves status-color loopholes and legitimizes "green-by-redeferral"

The no-aggregate rule is strong in intent, but the text still uses "partial-green," "takes it to green," "all eight close criteria green," and the especially dangerous "CC#P2-7 is trivially green-by-redeferral." A re-deferred criterion should not be green; it should be `re-deferred`, `not applicable to Phase 2 close`, or `active`. Treating it as green invites exactly the scalar dashboards the ADR is trying to ban.

**Remediation:** Reserve green/red status for active criteria with executable evidence. Use `re-deferred` for CC#P2-7 and ban "green-by-redeferral," "all but," "mostly done," "only N remaining," "complete except," and "near close" alongside the existing forbidden wording. Make the close condition "all active close criteria satisfied and all re-deferred criteria have valid ADR trigger coverage," not "all eight green."

### 10. MED — Audit-check numbering is already stale

ADR-0007 repeatedly refers to P2.2's future plugin check as "planned Check 22 after the Slice 31a Check 21 numbering." In `scripts/audit.mjs`, Check 22 is already the verify gate after Slice 31a inserted Check 21. The next new audit check is not Check 22 unless the audit report is renumbered again. This is a small citation error with large drift potential because future commit bodies and tests may bind to the wrong check number.

**Remediation:** Avoid fixed future check numbers or state "next available audit check number, currently after the verify gate." If a number is kept, update it to the actual next slot and require the implementing slice to preserve monotonic printed check order.

### 11. MED — Phase 2 close omits gates for mid-term surfaces the plan treats as important

The plan names P2.8 router/classifier, P2.10 artifact schema set, status/tier freshness ratchets, golden hashing, and continuity lifecycle as Phase 2 work, but ADR-0007 does not make them close gates or explicitly demote them from close. CC#P2-1 can pass by byte-shape golden without artifact schemas. CC#P2-4 can pass by hook presence plus seeded resume without proving the continuity-record lifecycle. Product ratchets like `status_docs_current` and `tier_claims_current` "continue" but are not required at close.

**Remediation:** Add close criteria or explicit non-gating dispositions for router/classifier, artifact schemas, golden hashing, continuity lifecycle, and inherited product ratchets. At minimum, require all inherited product ratchets named in the plan to be green at Phase 2 close unless a separate ADR re-defers them.

### 12. MED — Real-agent dispatch proof can be faked without violating the stated rule

CC#P2-2 excludes a mock adapter, but "externally-produced artifact byte-shape" is not enough to prove a genuine request/receipt/result round-trip. A checked-in artifact, manually produced output, or deterministic script could satisfy byte-shape unless the event log records adapter provenance and the test asserts it. The CI skip also creates a path where the only always-on ratchet is contract shape, not real dispatch.

**Remediation:** Require a durable dispatch transcript or event-log proof: adapter id, non-dry-run flag, request payload hash, receipt id, result artifact hash, and a test asserting the reducer/result-writer consumed that sequence. If CI skips live invocation, require a local smoke artifact path and audit-visible timestamp/commit reference before CC#P2-2 can close.

### 13. LOW — Knight-Leveson caveat is good, but "independent lines" wording is avoidable drift

The ADR correctly states Claude/Codex concurrence is not independence. Still, the Rationale opens with "Three independent lines of reasoning," and the plan provenance says the operator adopted "Codex challenger recommendation" over Claude's. Those are not fatal, but this repo is explicitly sensitive to Knight-Leveson language. The word "independent" is cheap to avoid unless it means structurally independent evidence.

**Remediation:** Replace "Three independent lines of reasoning" with "Three separate lines of reasoning." When mentioning Codex's `explore` recommendation, keep the emphasis on operator product-direction authority, not on Codex as an independent validator.

### 14. META — ADR-0007 is carrying too many governance moves in one artifact

This ADR locks eight criteria, re-defers a hard-invariant-adjacent gate, defines future retarget rules, designs Phase 2 close review, amends the plan, sets ceremony wording, and declares no new audit check. The breadth is why contradictions slipped in: "verbatim" criteria are not actually verbatim after binding changes, "in-place" amendment becomes a pointer, and "not ADR-0006 precedent" coexists with an ADR-0006 precedent sentence. D10 treats repeated review churn as an artifact-size signal; this ADR is already showing that signal before fold-in.

**Remediation:** Either split the isolation re-deferral into a narrow ADR-0007a and keep ADR-0007 to close-criteria locking, or add an explicit internal consistency table that reconciles each source-plan statement, ADR lock, plan amendment, audit binding, and reopen condition. Do not land the current all-in-one version without folding the contradictions above.

## Closing verdict: REJECT PENDING FOLD-INS

ADR-0007 is directionally useful, but it cannot land as-is. The minimum acceptable fold-in is: remove ADR-0006 precedent leakage, make CC#P2-7's weakening honest and trigger-complete, turn slice-name bindings into concrete evidence bindings, close the CC#P2-8 circularity, fix the `explore` spine mismatch, and make the plan amendment genuinely in-place.
