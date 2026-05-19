---
name: cloudflare-glasswing-decision-memo
description: Decision memo ranking Cloudflare Project Glasswing concepts by Circuit operator value.
type: product-architecture
date: 2026-05-19
status: reviewed
---

# Cloudflare Glasswing Decision Memo

## Decision

Borrow Cloudflare's **Validate** stage as a Circuit **Claim Validation** block
candidate.

The first useful shape is not "more agents" or a default vulnerability-scanner
flow. It is a narrow disproof block that takes one claim, its evidence packet,
the scope being asserted, and the proof target. It returns `upheld`,
`disproved`, or `inconclusive`, with tool-backed reasons where possible. It must
not emit unrelated new findings in the primary result.

This most improves Circuit's core value prop because it turns the operator's
hardest question from "do I trust this answer?" into "has this specific claim
survived a focused challenge?" That directly supports false-done reduction,
reduced babysitting, and proof-carrying closeout.

Prototype it first as a report schema and optional Review/Pursue sub-step. Do
not change runtime behavior until the contract and eval are reviewed.

## Source Boundary

This memo uses:

- Cloudflare's "Project Glasswing: what Mythos showed us" post, published
  2026-05-18: <https://blog.cloudflare.com/cyber-frontier-models/>.
- The local Glasswing block review and learning note
  (`docs/flows/cloudflare-glasswing-block-review.md:34-59`,
  `docs/learnings/cloudflare-glasswing-harness-confirmation.md:19-34`).
- Current Circuit flow docs and flow source
  (`docs/flows/blocks.md:68-88`, `docs/flows/authoring-model.md:62-78`,
  `docs/flows/pursue.md:22-27`, `src/flows/catalog.ts:18-27`).
- Eval notes under `evals/`.
- Local repo search over `docs/flows/*`, `src/flows/*`, `docs/ideas/*`, and
  eval evidence.

Claim labels:

- **Confirmed** means directly stated by Cloudflare or current repo docs/code.
- **Supported** means backed by repo evidence plus an explicit inference.
- **Uncertain** means plausible but not yet implemented or measured in Circuit.

## Confirmed Facts

- **Confirmed:** Cloudflare says a generic coding agent can produce findings but
  does not produce useful coverage on real codebases; the bottlenecks are context
  and throughput. Its four harness lessons are narrow scope, adversarial review,
  splitting different questions across agents, and parallel narrow tasks followed
  by dedupe (`docs/flows/cloudflare-glasswing-block-review.md:36-51`; Cloudflare
  post).
- **Confirmed:** Cloudflare's Validate stage is constrained. An independent
  agent tries to disprove the finding, uses a different prompt, and cannot emit
  new findings (`docs/flows/cloudflare-glasswing-block-review.md:206-224`;
  Cloudflare post).
- **Confirmed:** Circuit already has reusable blocks for Frame, Gather Context,
  Diagnose, Plan, Act, Run Verification, Review, Pursue, Coordinate Pursuits,
  Queue, Batch, Risk/Rollback Check, Close With Evidence, and Handoff
  (`docs/flows/blocks.md:68-88`).
- **Confirmed:** Circuit's authoring model says blocks have stable identity,
  input contracts, one output contract, allowed routes, and expected evidence;
  new flows should compose built-in blocks first
  (`docs/flows/authoring-model.md:62-78`).
- **Confirmed:** Pursue V1 coordinates broad work but deliberately serializes
  code-changing work. It may mark read-only discovery as parallel-safe, but it
  does not yet run a separate discovery fanout (`docs/flows/pursue.md:22-27`,
  `docs/flows/pursue.md:43-67`).
- **Confirmed:** Current flow packages are Review, Fix, Pursue, Runtime Proof,
  Build, and Explore; Runtime Proof is internal while the others are product
  flows. All derive through the catalog
  (`src/flows/catalog.ts:18-27`).
- **Confirmed:** Circuit Review is audit-only and deliberately omits plan, act,
  verify, and nested review (`src/flows/review/data.ts:53-100`,
  `src/flows/review/contract.md:18-31`).
- **Confirmed:** Fix already has proof machinery: baseline regression
  proof, focused action, verification, change-set validation, regression rerun,
  optional review, and close evidence (`src/flows/fix/data.ts:306-541`,
  `src/flows/fix/reports.ts:363-419`, `src/flows/fix/reports.ts:487-607`,
  `src/flows/fix/reports.ts:609-694`, `src/flows/fix/reports.ts:794-944`).

## Supported Reading Of The Evidence

- **Supported:** Circuit's strongest current product evidence is false-done
  reduction on focused Fix work. The held-out Fix pilot reports zero false-fixed
  outcomes for Circuit across five held-out tasks, while the strong vanilla
  prompt false-fixed one task (`evals/fix-vs-vanilla/RESULTS.md:8-22`,
  `evals/fix-vs-vanilla/RESULTS.md:40-55`).
- **Supported:** Review's current structured prompting is not enough to carry
  the value prop by itself. One adversarial review task showed a small haiku-low
  lift, then no lift at sonnet-medium, and Circuit affirmatively cleared a real
  subtle defect in its Verified list
  (`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:53-68`,
  `evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:109-139`).
- **Supported:** The durable product bet is proof-carrying claims, not prompt
  ceremony. The future-proofing note argues that as models improve, plausible
  outputs become harder to spot-check and proof-carrying claims become more
  valuable (`docs/ideas/future-proofing-circuit.md:23-41`).
- **Supported:** Claim Validation best matches the "judge" frame already present
  in repo strategy notes: Circuit should absorb evaluation work by judging
  claims with proof, not merely run a longer prescribed flow
  (`docs/ideas/future-proofing-circuit.md:68-137`).

## Candidate Ranking

Scores are 1-5, higher is better. `Risk` is inverted: `5` means low adoption
risk. The `Core score` weights operator value, false-done reduction, and
babysitting reduction twice because those are the product outcomes this decision
is meant to improve.

| Rank | Borrowed concept | Circuit shape | Operator value | False-done reduction | Babysitting reduction | Implementation leverage | Evalability | Risk | Fit | Core score | Decision |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Validate | Claim Validation | 5 | 5 | 5 | 4 | 5 | 3 | 5 | 47 | Borrow first. |
| 2 | Recon | Coverage Map | 4 | 3 | 5 | 5 | 4 | 4 | 5 | 42 | Add as report shape after contract review. |
| 3 | Gapfill | Gap Queue | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 39 | Extend Queue/Batch after Coverage Map. |
| 4 | Trace | Reachability Check | 5 | 4 | 4 | 2 | 4 | 2 | 3 | 37 | Defer until claims are validated. |
| 5 | Feedback | Typed recovery routes | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 34 | Treat as route policy, not a block. |
| 6 | Report | Stronger structured reports | 3 | 2 | 2 | 5 | 3 | 4 | 5 | 31 | Strengthen as new reports exist. |
| 7 | Hunt | Scoped probe queue items | 3 | 2 | 3 | 4 | 3 | 3 | 4 | 30 | Adapt later; do not import the name. |
| 8 | Dedupe | Finding Cluster | 3 | 2 | 4 | 3 | 3 | 2 | 3 | 29 | Defer until fleet findings exist. |

## Iteration Notes

### Iteration 1: Validate -> Claim Validation

Cloudflare's Validate is the clearest transferable concept because it is not
generic review. It is one-claim disproof with role separation and a ban on new
findings (`docs/flows/cloudflare-glasswing-block-review.md:210-238`).

That maps directly to Circuit's current gap. Review already has reviewer
identity separation, but it remains audit-only and can emit findings
(`src/flows/review/contract.md:70-89`, `src/flows/review/data.ts:142-179`).
The adversarial Review eval shows the failure mode clearly: a structured Review
surface can still make a confident false clearance
(`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:109-139`).

Claim Validation therefore starts ranked first. It is the most direct attack on
false-done outcomes outside Fix's deterministic proof loop.

### Iteration 2: Recon -> Coverage Map

Coverage Map is the best broad-work support concept. It answers "what did this
actually inspect?" and gives Queue a principled source for follow-up work. The
Glasswing review already recommends starting as `coverage-map@v1`, with covered,
partial, unknown, gap reasons, and next queue candidates
(`docs/flows/cloudflare-glasswing-block-review.md:150-176`).

It ranks second because it strongly reduces babysitting on broad work, but it
does not by itself decide whether a specific claim is true. Without Claim
Validation, a complete-looking map can still carry false confidence.

### Iteration 3: Gapfill and Feedback -> Gap Queue plus typed routes

Gap Queue is valuable because Pursue already records completed, skipped, blocked,
failed, actual touch set, and proof evidence, and its result cannot close as
complete when skipped, blocked, or failed work remains
(`src/flows/pursue/reports.ts:230-300`, `src/flows/pursue/reports.ts:390-445`).

The missing piece is semantic gap identity: what surface remains uncovered, why
it matters, and whether it deserves another bounded pass. That depends on a
Coverage Map, so Gap Queue ranks after Coverage Map. Feedback is best treated as
typed route policy from validated gaps into Queue; without validation and budgets
it can amplify noise (`docs/flows/cloudflare-glasswing-block-review.md:315-328`).

### Iteration 4: Trace -> Reachability Check

Reachability Check has high operator value because it turns "a flaw exists" into
"this flaw affects the operator's system." The local learning note treats
reachability as part of useful security triage, and the local review warns that
Circuit should not name a new block Trace because Trace already means the run record
(`docs/flows/cloudflare-glasswing-block-review.md:288-313`,
`docs/learnings/cloudflare-glasswing-harness-confirmation.md:19-34`,
`UBIQUITOUS_LANGUAGE.md:18-21`).

It ranks fourth, not first, because it depends on validated claims. Tracing an
unvalidated claim is expensive noise. It also has higher implementation risk
outside security tasks because modern app reachability can depend on generated
routes, config, feature flags, and runtime state.

### Iteration 5: Hunt -> Scoped Probe Items

Cloudflare's Hunt lesson is useful, but the product lesson is not "run many
agents." It is "make each queued question narrow enough to prove." Circuit
already has Queue and Batch, and Pursue already blocks parallel code writes until
safe apply exists (`docs/flows/blocks.md:84-85`, `docs/flows/pursue.md:43-67`,
`docs/ideas/sandboxed-parallel-pursuits.md:16-32`).

Scoped probes rank seventh because they are more useful after Circuit has claim
validation and coverage accounting. Otherwise they risk multiplying plausible
but unvalidated claims.

### Iteration 6: Dedupe and Report -> Finding Cluster plus stronger reports

Finding Cluster protects attention when many findings share a root cause, but it
is a high-risk summarizer. It should preserve each member finding and explain
what would disprove the cluster (`docs/flows/cloudflare-glasswing-block-review.md:265-286`).

Structured reports are already a Circuit strength. The useful borrowed lesson is
to add explicit fields for coverage, validation, gaps, reachability, and clusters
when those concepts exist, not to add more schema for its own sake
(`docs/flows/cloudflare-glasswing-block-review.md:330-346`,
`docs/flows/authoring-model.md:178-196`).

## Why Claim Validation Wins

Claim Validation is the smallest borrowed concept that changes the operator's
decision surface.

Without it, the operator still has to read a plausible report and decide whether
the claim is real. With it, Circuit can say:

- the claim was upheld by these source refs, commands, or repro attempts;
- the claim was disproved by this contradiction;
- the claim is still inconclusive, and here is the exact missing proof.

That is a better core value-prop move than Coverage Map alone, because false-done
is usually one bad claim at close time. It is also better than high-concurrency
Hunt, because Circuit's current evidence says proof gates matter more than raw
parallelism. The Fix eval supports the proof-first story; the Review eval shows
where generic structured review falls short
(`evals/fix-vs-vanilla/RESULTS.md:8-22`,
`evals/circuit-vs-vanilla/tasks/adversarial-review-planted-defects/RESULT-NOTES.md:128-145`).

## Proposed Contract Sketch

This is design-only. It is not a runtime change.

```ts
claim.validation@v1 = {
  claim_id: string,
  claim: string,
  scope: string,
  source_refs: string[],
  evidence_packet_refs: string[],
  validation_question: string,
  allowed_commands: VerificationCommand[],
  verdict: 'upheld' | 'disproved' | 'inconclusive',
  reasons: [
    {
      kind: 'source-ref' | 'command-output' | 'repro-attempt' | 'contradiction' | 'missing-proof',
      ref: string,
      summary: string
    }
  ],
  confidence: 'low' | 'medium' | 'high',
  follow_up_queue_candidates: [
    {
      question: string,
      scope_hint: string,
      reason: string
    }
  ]
}
```

Guardrails:

- One primary claim per validation run.
- No unrelated findings in the primary result.
- Tool-backed evidence preferred.
- `inconclusive` must remain a healthy outcome.
- New issues can be emitted only as follow-up queue candidates.
- A downstream Close With Evidence step must display weak or inconclusive
  validation as weak or inconclusive, not as success.

## Eval Plan

The eval should measure the block, not the prose.

Suggested fixtures:

- One real bug claim with a reachable proof.
- One plausible but false bug claim.
- One claim where the right answer is inconclusive because a dependency, config,
  or runtime fact is missing.
- One D6-style review claim from the adversarial Review eval where a path guard
  looks sound but is defeated by a symlink.
- One Fix-style false-done claim where the agent says a regression is fixed but
  objective checks still fail.

Primary metrics:

- `false_upheld_rate`: false claims marked `upheld`.
- `false_disproved_rate`: real claims marked `disproved`.
- `inconclusive_calibration`: missing-proof cases marked `inconclusive`.
- `evidence_grounding_rate`: reasons cite existing source refs, command output,
  or repro attempts.
- `new_finding_leak_rate`: unrelated findings emitted in the primary result.

Success threshold for promotion:

- Claim Validation must reduce false-upheld outcomes versus current Review on
  the same seeded claims.
- It must not raise operator noise by leaking unrelated findings.
- It must produce a short receipt the operator can trust without reading a full
  transcript.

## Uncertain Claims

- **Uncertain:** Claim Validation will materially improve Review. The repo shows
  why Review needs sharper claim testing, but this block still needs an eval.
- **Uncertain:** Claim Validation should become a public block immediately. It
  may be better as an internal Review/Pursue sub-step until the report contract
  survives a few tasks.
- **Uncertain:** Reachability Check generalizes outside security without becoming
  brittle. It should wait for validated claims that actually need impact triage.
- **Uncertain:** Coverage Map reduces babysitting enough to justify becoming a
  block rather than staying a report. It needs a Pursue-scale measurement.

## Recommendation

Do this next:

1. Draft the `claim-validation` block candidate and `claim.validation@v1`
   report schema proposal.
2. Build a small eval over true, false, and inconclusive claims before runtime
   integration.
3. Trial it inside Review or Pursue as an optional validation sub-step.
4. Keep Coverage Map as the second-track design, but do not let it displace the
   Claim Validation eval as the next proof of value.

Do not do this next:

- Do not import Cloudflare's security-specific names as generic Circuit block
  names.
- Do not ship high-concurrency code-writing work as the lesson from Glasswing.
- Do not claim "multi-agent is better." The defensible claim is narrower:
  scoped blocks plus typed evidence can reduce false-done outcomes and
  babysitting when the task benefits from proof and independent challenge.

## Adversarial Review Log

### Pass 1

Findings:

- **Medium - One current-flow fact overcalled Runtime Proof as public.** The
  catalog includes Runtime Proof, but it is internal. Fixed by separating
  current flow packages from product flows.
- **Medium - Reachability wording overstated the Cloudflare source.** The draft
  said Cloudflare called Trace the most important security stage. The sources
  support reachability as part of useful triage, not that exact priority claim.
  Fixed by narrowing the sentence and citing the local learning note.
- **Medium - Block and report names were inconsistent.** The draft mixed
  `claim-validation@v1` and `claim.validation@v1`. Fixed by naming
  `claim-validation` as the block candidate and `claim.validation@v1` as the
  report schema.

Resolution: all medium findings from pass 1 are resolved. No high or critical
findings were found.

### Pass 2

Findings:

- No medium, high, or critical findings.

Residual low-risk notes:

- The memo is intentionally design-only. It does not prove implementation
  viability; it recommends the eval needed before runtime integration.

### Pass 3

Findings:

- No medium, high, or critical findings.

Residual low-risk notes:

- The scoring is a decision aid, not measured product truth. The memo keeps the
  implementation and operator-value claims uncertain until a Claim Validation
  eval exists.
