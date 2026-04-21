---
name: adr-0006-codex
description: Codex cross-model challenger pass on ADR-0006 (CC#14 operator-governance alignment). Required per CLAUDE.md hard invariant #6 / decision.md challenger protocol (gate loosening).
type: review
review_kind: challenger-objection-list
target_kind: adr
review_target: specs/adrs/ADR-0006-cc14-operator-governance-alignment.md
target_version: 2026-04-20 (as-authored, pre-fold-in)
review_date: 2026-04-20
reviewer_model: gpt-5-codex
reviewer_role: cross-model-challenger
mode: adversarial-llm-review
opening_verdict: REJECT PENDING FOLD-INS
closing_verdict: REJECT PENDING FOLD-INS
severity_counts:
  HIGH: 5
  MED: 5
  LOW: 1
  META: 1
verdict: REJECT PENDING FOLD-INS
authored_by: gpt-5-codex
fold_in_disposition: all HIGH + all MED + LOW + META incorporated into ADR-0006 via §Fold-in amendments (2026-04-20, same authoring session)
---

# Codex challenger objection list — ADR-0006

## Opening verdict: REJECT PENDING FOLD-INS

## Objections

### 1. HIGH — ADR-0006 still dissolves the original CC#14 gate while describing the replacement as preservation

The original evidence mode was not "a comprehension check" in the abstract; it was specifically a non-LLM human cold-read meant to catch the failure mode where dense planning prose becomes legible only to the LLMs that produced it. ADR-0006 replaces that with LLM stand-ins plus a product-direction note. The F17 flag is honest, but a label is not compensating evidence. The language at `ADR-0006` lines 93-101 saying the forcing function is "preserved" is too strong and masks the structural loss.

**Remediation:** Reword this as an explicit one-time waiver/substitution: "the original non-LLM cold-read forcing function is not satisfied; Phase 1.5 accepts a weaker substitute because the canonical signal is unobtainable from this operator." Add a compensating guard that Phase 1.5 close must cite the separate non-LLM/mechanical evidence already available under CC#13, and must not characterize 14b as equivalent to human review.

### 2. HIGH — Reopen condition 5 is a poor plain-text fit

ADR-0001 condition 5 says "Operator role change (team or single-agent tool)" and the mirror text frames it as "solo operator + dual-agent surface" changing into a team or single-agent setup. ADR-0006 instead says this is a "role clarification, not a role change" while still claiming condition 5 as "closest-fit" at lines 153-162. That is exactly the kind of retrofit future amendments can abuse: any capability mismatch can be recast as a "clarification" and used to reopen a gate.

**Remediation:** Stop claiming condition 5 directly. Use a new explicit one-time exception basis, patterned after ADR-0001 Addendum B's guardrailed condition 7: named failure mode, D1 impact analysis, challenger pass, and written explanation why the existing criterion cannot be satisfied honestly. Alternatively amend ADR-0001 with a new guarded reopen condition for "operator role-boundary clarification," but do not smuggle it through condition 5.

### 3. HIGH — The saved-memory governance clarification is load-bearing but not durable or discoverable

ADR-0006 cites `project_circuit_next_governance.md` repeatedly as authority for the operator/LLM role boundary, including lines 50, 75, 127, 294-296, and 336-337. I could not find that file under `/Users/petepetrash/.codex/memories` or in the repo; the memory directory is empty. A future reader cannot verify the role clarification that justifies the gate change.

**Remediation:** Move the governance clarification into a durable repo artifact, e.g. `specs/governance/operator-role-2026-04-20.md` or an appendix inside ADR-0006, with the operator's exact signed note. Make ADR-0006 cite that repo path, not ephemeral memory.

### 4. HIGH — The new 14a product-direction check is not machine- or artifact-enforced

ADR-0006 allows the operator confirmation to live "on the ceremony commit or via a signed note" at lines 68-75, but no audit check currently enforces either. A commit-body-only requirement is also weak archival evidence because later readers and scripts cannot easily validate it against the phase-close surface.

**Remediation:** Require a durable signed note file, for example `specs/reviews/phase-1.5-operator-product-check.md`, with frontmatter fields for `operator`, `date`, `scope`, `confirmation`, and `not_claimed`. Add `scripts/audit.mjs` coverage or a contract test that verifies the note exists before Phase 2 is claimed.

### 5. HIGH — CC#15 is technically preserved but semantically weakened

ADR-0001 CC#15 says no Phase 1.5 close criterion depends solely on Claude + Codex agreement. ADR-0006 avoids the letter by adding 14a, but the technical comprehension part of CC#14 now depends entirely on Claude + Codex stand-ins. That may be acceptable as a disclosed waiver, but the ADR should not let future readers infer that the technical cold-read has non-LLM support.

**Remediation:** Add explicit text: "CC#14b technical-comprehension closure rests solely on LLM stand-in evidence; CC#15 remains satisfied only because CC#14 also requires operator 14a and because separate non-LLM/mechanical evidence exists under other close criteria."

### 6. MED — Knight-Leveson concurrence is still too load-bearing

The Provenance caveat at lines 317-321 is good, but earlier text still says Claude and Codex were "independently consulted" and "both concurred" at lines 36-38 and 305-307. Because this ADR replaces a human signal with LLM signal, the concurrence cannot be used as supporting weight for the substitution; it is only same-distribution process evidence.

**Remediation:** Remove "independently" where it implies epistemic independence. State: "Claude/Codex concurrence is recorded as same-distribution advisory context only; it is not a justification for the retarget."

### 7. MED — The review file's frontmatter and residual section now conflict with the appended acknowledgment

The frontmatter still says this is "NOT a replacement" and that the operator "may still add their own section on pickup" at lines 3 and 19. The residual section says the genuine operator cold-read is tracked until an ADR relaxes it at lines 546-551. Later, the operator section says it "will not be filled" and points to ADR-0006 at lines 564-574. A future reader skimming top-down sees contradictory status.

**Remediation:** Update the frontmatter and residual item to final disposition: "Original non-LLM cold-read was not completed; ADR-0006 accepts a weaker substitute; no operator cold-read section is expected for Phase 1.5 close."

### 8. MED — The D6 citation is wrong or premature

ADR-0006 references `specs/methodology/decision.md` §D6 at lines 331-332, and the review file says "D6 still stands" at lines 614-615. But `decision.md` says D6 waits until executable probes can run; the D6 body is in the plan, not installed as an authoritative `decision.md` section. The installed non-LLM discipline I found is D10's rigor-budget extension and ADR-0001 CC#13.

**Remediation:** Replace "decision.md §D6" with precise citations: `specs/plans/phase-1-close-revised.md` §D6 as scheduled/non-authoritative, `decision.md` §D10 extension for non-LLM mode before pass 3, and ADR-0001 CC#13 for the close criterion that already requires non-LLM evidence.

### 9. MED — The ceremony commit scope discipline needs forbidden wording, not just intent

The ADR rightly says the ceremony commit must not overclaim at lines 242-249, but this is underspecified. The dangerous failure mode is not only claiming "product broadly proven"; it is softer language that implies parity, real dispatch, or methodology validation.

**Remediation:** Add a concrete "commit body MUST NOT say" list: no "product proven," no "Circuit parity achieved," no "real agent dispatch works," no "workflow parity complete," no "methodology validated," no "non-LLM cold-read satisfied," and no "Phase 2 ready because governance is complete." Require the positive wording: "enough executable proof to start implementation; real dispatch, parity, hardening, container isolation, and hidden tests remain Phase 2+."

### 10. MED — "One-time, not precedent" is asserted but not defended

ADR-0006 lines 109-115 and 164-167 say this is not precedent, but future amendments can still cite it for waiving operator reviews, waiving non-LLM review, replacing human comprehension with LLM delegation, or treating "operator cannot absorb this" as sufficient reason to lower a gate.

**Remediation:** Add a precedent firewall: future retargets must identify the original evidence mode, prove it is unobtainable, name compensating evidence of a different structural type, carry weaker-evidence wording in every authority surface, add an expiry/reopen trigger, and get a challenger pass.

### 11. MED — "Claude and Codex own methodology execution" is too strong as governance language

Lines 44-50 and 142-149 imply the LLM pair owns methodology execution. That makes the LLMs both the owners of the rule system and the substitute reviewers for a weakened rule, which is self-dealing in governance terms. The operator may not be fluent enough to cold-read the whole methodology, but human authority over methodology changes should not disappear.

**Remediation:** Rephrase to: "Claude and Codex assist with methodology execution and draft/review methodology artifacts; the operator remains the authority for accepting methodology changes and product-direction tradeoffs."

### 12. LOW — The 14a product confirmation phrase risks overclaiming parity

The proposed operator statement says the project is "on course for a substantially simplified Circuit with full feature parity" at lines 68-72. That is product-directional, but in a ceremony commit it can read like evidence rather than aspiration, especially next to Phase 2 opening.

**Remediation:** Change it to: "The alpha proof is directionally compatible with the product goal of a substantially simplified Circuit that can pursue full feature parity." Add "this is not evidence that parity exists."

### 13. META — The ADR treats unreadable methodology prose as an operator-capacity issue, not also a methodology defect

The operator's inability to honestly cold-read the plan is not only a reason to waive CC#14; it is also evidence that the methodology has become too dense for its human governor. If that is not recorded as a follow-up, the system can keep producing artifacts only LLMs can operate.

**Remediation:** Add a Phase 2 follow-up: create an operator-readable close packet or "plain-language governance brief" for major methodology moves, with a size cap and explicit "what changed / what is not claimed / what the operator must decide" sections.

## Closing verdict: REJECT PENDING FOLD-INS

The amendment can probably become acceptable, but only if it stops calling the original gate "preserved," stops leaning on reopen condition 5 as written, makes the role clarification durable, and adds enforceable evidence for 14a plus clearer weaker-evidence wording everywhere a future reader will look.
