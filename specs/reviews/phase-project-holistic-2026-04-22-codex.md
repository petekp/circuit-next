---
name: phase-project-holistic-2026-04-22-codex
description: Codex cross-model challenger prong of the project-holistic critical review at HEAD 52bba0a. Paired with Claude fresh-read prong specs/reviews/phase-project-holistic-2026-04-22-claude.md. Bound to charter specs/reviews/phase-project-holistic-2026-04-22-scope.md. Filed under the phase-comprehensive-review schema slot (tests/contracts/cross-model-challenger.test.ts:163-186) because a project-holistic sweep is the "phase-to-date sweep at project scope" — broader than a contract or arc. Generalizing the review-kind taxonomy (e.g. allowing target_kind=project-holistic as its own slot) is captured as a META fold-in.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: phase-comprehensive-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5-codex
review_target: phase-project-holistic-2026-04-22
target_kind: phase
phase_target: project-holistic
phase_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main, 2026-04-22)"
target_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: pending-fold-in-absorption
charter: specs/reviews/phase-project-holistic-2026-04-22-scope.md
paired_prong: specs/reviews/phase-project-holistic-2026-04-22-claude.md
severity_counts:
  high: 7
  med: 14
  low: 1
  meta: 1
commands_run:
  - sed -n '1,260p' specs/reviews/phase-project-holistic-2026-04-22-scope.md
  - sed -n '261,520p' specs/reviews/phase-project-holistic-2026-04-22-scope.md
  - sed -n '176,260p' specs/reviews/phase-project-holistic-2026-04-22-scope.md
  - git status --short
  - git rev-parse HEAD
  - git log --oneline -30
  - find specs/adrs -maxdepth 1 -type f -name '*.md' | sort
  - wc -l CLAUDE.md PROJECT_STATE.md specs/methodology/decision.md specs/risks.md specs/artifacts.json specs/ratchet-floor.json specs/invariants.json scripts/audit.mjs scripts/doctor.mjs scripts/inventory.mjs scripts/policy/workflow-kind-policy.mjs src/runtime/runner.ts src/runtime/reducer.ts src/cli/dogfood.ts .claude-plugin/plugin.json
  - find specs/contracts specs/behavioral src/runtime/adapters src/schemas tests/contracts tests/runner specs/plans -maxdepth 1 -type f | sort
  - nl -ba CLAUDE.md
  - nl -ba specs/methodology/decision.md
  - nl -ba PROJECT_STATE.md | sed -n '1,220p'
  - nl -ba specs/reviews/adversarial-yield-ledger.md
  - nl -ba specs/adrs/ADR-0001-methodology-adoption.md
  - nl -ba specs/adrs/ADR-0002-bootstrap-discipline.md
  - nl -ba specs/adrs/ADR-0003-authority-graph-gate.md
  - nl -ba specs/adrs/ADR-0004-control-plane-data-plane-split.md
  - nl -ba specs/adrs/ADR-0005-v2-plane-required.md
  - nl -ba specs/adrs/ADR-0006-cc14-operator-governance-alignment.md
  - nl -ba specs/adrs/ADR-0007-phase-2-close-criteria.md
  - nl -ba specs/adrs/ADR-0008-dispatch-granularity-modeling.md
  - nl -ba specs/adrs/ADR-0009-adapter-invocation-pattern.md
  - nl -ba specs/plans/phase-2-implementation.md
  - nl -ba specs/plans/phase-2-foundation-foldins.md
  - nl -ba specs/plans/slice-47-hardening-foldins.md
  - nl -ba specs/contracts/*.md
  - nl -ba specs/behavioral/*.md
  - nl -ba specs/artifacts.json
  - nl -ba specs/invariants.json
  - nl -ba scripts/audit.mjs
  - nl -ba scripts/doctor.mjs
  - nl -ba scripts/inventory.mjs
  - nl -ba scripts/policy/workflow-kind-policy.mjs
  - nl -ba src/runtime/runner.ts
  - nl -ba src/runtime/reducer.ts
  - nl -ba src/runtime/event-writer.ts
  - nl -ba src/runtime/adapters/*.ts
  - nl -ba src/runtime/policy/workflow-kind-policy.ts
  - nl -ba src/cli/dogfood.ts
  - nl -ba src/schemas/event.ts
  - nl -ba src/schemas/adapter.ts
  - nl -ba src/schemas/workflow.ts
  - nl -ba src/schemas/step.ts
  - nl -ba .claude-plugin/plugin.json
  - nl -ba .claude-plugin/commands/circuit-run.md
  - nl -ba .claude-plugin/commands/circuit-explore.md
  - nl -ba .claude-plugin/skills/explore/circuit.json
  - nl -ba .claude-plugin/skills/dogfood-run-0/circuit.json
  - nl -ba tests/contracts/schema-parity.test.ts
  - nl -ba tests/contracts/plugin-surface.test.ts
  - nl -ba tests/contracts/workflow-kind-policy.test.ts
  - nl -ba tests/contracts/cross-model-challenger.test.ts
  - nl -ba tests/contracts/artifact-authority.test.ts
  - nl -ba tests/contracts/slice-47d-audit-extensions.test.ts
  - nl -ba tests/contracts/slice-47c-forbidden-progress-firewall.test.ts
  - nl -ba tests/runner/explore-e2e-parity.test.ts
  - nl -ba tests/runner/dogfood-smoke.test.ts
  - nl -ba tests/runner/agent-dispatch-roundtrip.test.ts
  - nl -ba tests/runner/codex-dispatch-roundtrip.test.ts
  - nl -ba .claude/hooks/SessionStart.sh
  - nl -ba .claude/hooks/SessionEnd.sh
  - npm run audit
  - npm run circuit:run -- --help
opened_scope:
  - specs/reviews/phase-project-holistic-2026-04-22-scope.md (full, anti-sycophancy section read twice)
  - CLAUDE.md (full)
  - PROJECT_STATE.md head plus sampled prior entries and claim verification
  - specs/methodology/decision.md (full)
  - specs/adrs/ADR-0001-methodology-adoption.md through ADR-0009-adapter-invocation-pattern.md
  - specs/contracts/*.md and specs/behavioral/*.md
  - specs/plans/phase-2-implementation.md, phase-2-foundation-foldins.md, slice-47-hardening-foldins.md
  - specs/risks.md, specs/artifacts.json, specs/ratchet-floor.json, specs/invariants.json
  - scripts/audit.mjs, scripts/doctor.mjs, scripts/inventory.mjs, scripts/policy/workflow-kind-policy.mjs
  - src/runtime/runner.ts, reducer.ts, event-writer.ts, runtime adapters, workflow policy helper
  - src/cli/dogfood.ts
  - src/schemas/event.ts, adapter.ts, workflow.ts, step.ts
  - .claude-plugin/plugin.json, command files, dogfood-run-0 and explore fixtures
  - tests/contracts spot-read: schema-parity, plugin-surface, workflow-kind-policy, cross-model-challenger, artifact-authority, slice-47d-audit-extensions, slice-47c-forbidden-progress-firewall
  - tests/runner spot-read: explore-e2e-parity, dogfood-smoke, agent-dispatch-roundtrip, codex-dispatch-roundtrip, hook-engine-contract
  - prior review calibration: adversarial-yield-ledger plus arc-slice-47 / arc-slices-41-to-43 references in PROJECT_STATE and review ledger
skipped_scope:
  - bootstrap/** per charter
  - prior-gen Circuit at ~/Code/circuit per charter
  - raw >200KB review transcripts per charter
  - .circuit/ runtime dashboard state per charter
  - package-lock.json per charter
  - live AGENT_SMOKE/CODEX_SMOKE/CLI_SMOKE/CIRCUIT_HOOK_ENGINE_LIVE runs; default verification intentionally skips these unless operator-local env vars are set
authority:
  - specs/reviews/phase-project-holistic-2026-04-22-scope.md §The eight questions, §Verdict vocabulary, §Anti-sycophancy framing, §Authority
  - CLAUDE.md §Core methodology, §Lane discipline, §Verification commands, §Cross-model challenger protocol, §Cross-slice composition review cadence, §Hard invariants
  - specs/methodology/decision.md §Decision, §D10 Extension, §Reopen Conditions
  - ADR-0001 Addendum B §Phase 2 entry criteria and §Phase 1.5 Close Criteria
fold_in_disposition: The next privileged runtime slice should not open until the HIGH items below are folded in or explicitly reclassified by the operator. The central fold-in is to separate "scaffold / placeholder / opt-in smoke" from "satisfied product criterion" in the authority surfaces, then harden the audit checks that currently depend on self-declaration or curated scan scope.
---

## Q1 — Methodology ROI

### [MED] 1. D10 says to tune after 10-20 reviewed artifacts; the ledger is already past that without a tuning pass
- **Evidence:** `specs/methodology/decision.md:247-248` says the D10 pass caps are "opinionated priors" to tune after "10-20 reviewed artifacts". `specs/reviews/adversarial-yield-ledger.md:39-64` records 23 rows by 2026-04-22, and `npm run audit` reports "23 yield-ledger row(s) present; caps + mode-cycle + rigor-binding clean".
- **Risk:** the ledger is accumulating rows and audit cleanliness, but the promised empirical feedback loop has not happened. The cap values may be turning into ceremony by age rather than calibrated governance.
- **Proposed disposition:** fold-in.

### [MED] 2. The methodology's "Product Reality Gate" is not preventing Phase 2 from treating placeholder product evidence as close evidence
- **Evidence:** D1 requires a product proof such as "a user-facing command" or "an end-to-end fixture" at `specs/methodology/decision.md:174-185`. Yet CC#P2-1 is recorded as satisfied in `PROJECT_STATE.md:21` while ADR-0007 says the current golden is "placeholder-parity" and "NOT" the reference-Circuit comparison at `specs/adrs/ADR-0007-phase-2-close-criteria.md:130-148`.
- **Risk:** D1 is paying for ceremony but not blocking the specific failure it named: closing governance surfaces on non-product proof. The next runtime slices can inherit a false sense of product baseline.
- **Proposed disposition:** fold-in.

## Q2 — Artifact-To-Code Drift

### [MED] 3. TIER claims stayed "planned" after the slices they name already landed
- **Evidence:** `TIER.md:28-32` still marks `runner_smoke`, `workflow_fixture_runs`, `event_log_round_trip`, `snapshot_derived_from_log`, and `manifest_snapshot_byte_match` as `planned` for slices `27d` / `27c`. Those slices are long past the current marker (`README.md:1`, `TIER.md:8`, `PROJECT_STATE.md:1` all say `current_slice: 48`), and the Phase 2 plan's mid-term section records later landed runtime work at `specs/plans/phase-2-implementation.md:714-781`.
- **Risk:** the claim matrix can pass audit because `planned_slice` is non-empty, even when the plan date is stale. This creates a false negative for the "claim currentness" surface.
- **Proposed disposition:** fold-in.

### [MED] 4. Completed plans still advertise active or in-progress status
- **Evidence:** `specs/plans/phase-2-foundation-foldins.md:13` says `status: active` even though its arc is closed by Check 26 in the current audit output. `specs/plans/slice-47-hardening-foldins.md:3` says `status: in-progress`, while `PROJECT_STATE.md:13-15` says no further cleanup is pending and next work is feature work.
- **Risk:** stale plan frontmatter becomes a landmine for fresh agents using plan status as routing authority.
- **Proposed disposition:** fold-in.

### [LOW] 5. The user-facing explore command still describes the pre-ADR-0009 adapter architecture
- **Evidence:** `.claude-plugin/commands/circuit-explore.md:23-25` says P2.4 is the real-agent adapter as "`agent` in-process Anthropic subagent". ADR-0009 instead chose subprocess-per-adapter at `specs/adrs/ADR-0009-adapter-invocation-pattern.md:136-145`, and the implementation uses `spawn('claude', ...)` at `src/runtime/adapters/agent.ts:114-141`.
- **Risk:** command docs are the first surface a plugin user sees; stale invocation architecture in that surface undermines trust in the scaffold.
- **Proposed disposition:** fold-in.

### [HIGH] 6. "One-workflow parity" is marked satisfied while the code and test explicitly prove placeholder self-consistency, not parity
- **Evidence:** `PROJECT_STATE.md:21` marks `CC#P2-1 active — satisfied`. ADR-0007 says the v0.3 satisfaction is "placeholder-parity" and the original reference-Circuit artifact comparison is "NOT" what the golden measures at `specs/adrs/ADR-0007-phase-2-close-criteria.md:130-148`. The runner writes deterministic placeholder JSON at `src/runtime/runner.ts:315-325`, and the test title says the golden is self-consistent with `writeSynthesisArtifact`'s placeholder derivation at `tests/runner/explore-e2e-parity.test.ts:228-239`.
- **Risk:** the most important Phase 2 close claim is semantically overnamed. Any later work that assumes workflow parity has been proven is building on a placeholder artifact.
- **Proposed disposition:** fold-in.

## Q3 — Ratchet Validity / Goodhart

### [HIGH] 7. Check 35 cannot enforce the literal Codex policy because it only checks commits that self-declare the requirement
- **Evidence:** CHALLENGER-I2 says any ratchet advance requires Codex literally at `specs/behavioral/cross-model-challenger.md:49-72`. Check 35 says it scans HEAD for exact `Codex challenger: REQUIRED` at `scripts/audit.mjs:3994-4009`; if the body does not declare it, the check returns green/not-applicable at `scripts/audit.mjs:4064-4070`. The current audit output uses that path: "HEAD commit body does not declare "Codex challenger: REQUIRED"; Check 35 not applicable".
- **Risk:** the failure mode shifted from "no Codex pass exists" to "the commit forgot or avoids the declaration". A ratchet-advancing commit can stay green by omission.
- **Proposed disposition:** fold-in.

### [MED] 8. The arc-subsumption escape hatches validate only path existence at the immediate check site
- **Evidence:** Check 2 exempts a slice-shaped commit from the framing triplet when `arc-subsumption: <path>` points to any existing file at `scripts/audit.mjs:4799-4804`. Check 35 similarly accepts an existing `arc-subsumption` path at `scripts/audit.mjs:4073-4082`. Neither site verifies the file is a review, has the matching arc scope, or carries an ACCEPT* closing verdict.
- **Risk:** the escape hatch can be satisfied by a weak or wrong file unless another check happens to cover the same arc. That is brittle delegation, not a local invariant.
- **Proposed disposition:** fold-in.

### [MED] 9. Check 34 measures conformance to a curated scan list, not absence of forbidden progress framing
- **Evidence:** the fixed scan files are listed at `scripts/audit.mjs:3864-3877`, the review glob only matches `arc-slice.*composition-review` at `scripts/audit.mjs:3879-3891`, and PROJECT_STATE is intentionally truncated before the first historical marker at `scripts/audit.mjs:3911-3916`. Untracked files are explicitly excluded at `scripts/audit.mjs:3923-3928`.
- **Risk:** the project can remain green while forbidden scalar-progress language reappears in per-slice reviews, non-matching review names, or historical-looking current context. The scan rewards moving wording out of scope.
- **Proposed disposition:** fold-in.

### [MED] 10. The test-count ratchet is a static regex count, so non-invariant tests advance the floor
- **Evidence:** `scripts/audit.mjs:419-430` defines the ratchet as lines matching `/^\s*(it|test)\(/`. `specs/ratchet-floor.json:4` pins only `contract_test_count: 1062`; the notes at `specs/ratchet-floor.json:8` repeat that this is a static declaration count. Example ratchet-eligible tests include `tests/runner/agent-dispatch-roundtrip.test.ts:58-72`, which only checks string constants match `/^dispatch\./`, not that the Event schema parses each variant.
- **Risk:** any-test-shaped-thing can preserve or advance the ratchet. The floor protects declaration volume more directly than invariant coverage.
- **Proposed disposition:** fold-in.

## Q4 — Trajectory Honesty

### [HIGH] 11. The documented npm entrypoint fails in this sandbox before it can print help
- **Evidence:** `package.json:20` binds `circuit:run` to `tsx src/cli/dogfood.ts`. Running `npm run circuit:run -- --help` failed with `Error: listen EPERM ... /T/tsx-501/...pipe`, the same tsx IPC class described in `tests/runner/dogfood-smoke.test.ts:254-268` as the reason tests moved to direct `main()` import. The actual package script still uses `tsx`.
- **Risk:** the smallest user-facing demo can fail before it reaches circuit-next code in constrained agent/sandbox environments. The test workaround did not fix the product entrypoint.
- **Proposed disposition:** fold-in.

### [MED] 12. The plugin manifest registers command anchors, but both commands are placeholder markdown
- **Evidence:** `.claude-plugin/plugin.json:6-16` registers `circuit:run` and `circuit:explore`. The command bodies say "Not implemented yet" at `.claude-plugin/commands/circuit-run.md:8-18` and `.claude-plugin/commands/circuit-explore.md:8-17`.
- **Risk:** `checkPluginCommandClosure` goes green on closure consistency, but a stranger invoking the plugin gets a not-implemented page. This is acceptable as scaffold only if not counted as command-surface completion.
- **Proposed disposition:** fold-in.

### [MED] 13. The recent commit trajectory is mostly hardening/governance, while the feature queue remains ahead
- **Evidence:** `git log --oneline -30` is dominated by slice-47 hardening, arc-close reviews, audit checks, and governance fold-ins (`52bba0a`, `01430f1`, `73c729c`, `1c4a5b1`, `19ea401`, `d1dd56e`, `7d485c9`, `db5253d`, `7a08938`). The still-unbuilt mid-term product slices are listed at `specs/plans/phase-2-implementation.md:782-799` (`P2.8` router, `P2-MODEL-EFFORT`, `P2.9` second workflow, `P2.10` artifact schemas, `P2.11` plugin wiring).
- **Risk:** the project may be on a good hardening arc, but not yet on a short path to a working plugin. "No further cleanup pending" should not be read as "product loop is close".
- **Proposed disposition:** accept-as-tradeoff with explicit trajectory summary.

## Q5 — Architectural Coupling / Seams

### [HIGH] 14. Dispatch gates pass by construction; adapter output does not decide the verdict
- **Evidence:** `dispatchVerdictForStep` returns the first allowed verdict from `step.gate.pass` at `src/runtime/runner.ts:146-157`. The dispatch branch passes that verdict into `materializeDispatch` and then emits `gate.evaluated` with `outcome: 'pass'` unconditionally at `src/runtime/runner.ts:451-500`. The dogfood stub can return `result_body: '{"verdict":"ok"}'` at `tests/runner/dogfood-smoke.test.ts:60-64`; the runner does not parse it before passing the gate.
- **Risk:** model output can be malformed, rejecting, or unrelated and the workflow still advances. This is a real behavior gap, not just missing schema polish.
- **Proposed disposition:** fold-in.

### [HIGH] 15. The materializer violates the contract-level schema-parse rule for dispatch artifacts
- **Evidence:** `specs/contracts/explore.md:551-558` says the runtime MUST write `writes.artifact.path` by schema-parsing the result payload against `writes.artifact.schema`. `src/runtime/adapters/dispatch-materializer.ts:94-102` admits v0 writes raw `result_body` bytes with "no schema parsing", and `src/runtime/adapters/dispatch-materializer.ts:139-145` writes the raw result to both transcript and artifact paths.
- **Risk:** downstream steps read "canonical" artifacts that have never been validated. The exact dispatch-result-to-artifact failure ADR-0008 named can still occur with malformed but accepted bytes.
- **Proposed disposition:** fold-in.

### [MED] 16. `runDogfood` advertises workflow-general machinery but only handles synthesis/dispatch and coerces non-complete terminals to complete
- **Evidence:** checkpoint steps throw as "not exercised" at `src/runtime/runner.ts:501-506`. Routes to `@stop`, `@escalate`, or `@handoff` set a reason but still end with `outcome = 'complete'` at `src/runtime/runner.ts:393` and `src/runtime/runner.ts:525-547`. The schema itself recognizes all terminal targets at `src/schemas/workflow.ts:9`.
- **Risk:** future workflow fixtures can be schema-valid and still run through a narrow executor that misrepresents terminal outcomes.
- **Proposed disposition:** fold-in before second workflow.

## Q6 — Blind Spots / Correlated Failures

### [MED] 17. The non-LLM human cold-read was waived because the operator could not absorb the methodology prose; the substitute is still LLM-heavy
- **Evidence:** ADR-0006 says the non-LLM cold-read was intended to catch dense prose legible only to LLMs at `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md:22-30`, then waives it as not satisfied at `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md:62-68`, and relies on delegated LLM stand-in technical comprehension at `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md:106-116`.
- **Risk:** a skeptical staff engineer would ask why methodology governance is allowed to exceed the human operator's review bandwidth. The project records the weakness honestly, but the correlated-failure surface remains.
- **Proposed disposition:** ADR or operator-level tradeoff decision.

### [META] 18. The project tracks "correlation risk" but does not compute the named signal
- **Evidence:** `specs/risks.md:12` names cross-model reviewer correlation and says to watch for Claude/Codex convergence rate >=95% over N>=20. `specs/methodology/decision.md:136` repeats that reopen condition. The yield ledger at `specs/reviews/adversarial-yield-ledger.md:39-64` records counts and modes but not convergence/difference metrics between paired prongs.
- **Risk:** correlation is used to justify ceremony, but the project has not instrumented whether the ceremony is actually reducing correlated misses.
- **Proposed disposition:** deferred-to-operator.

## Q7 — Test Validity

### [HIGH] 19. Default verification skips the live subprocess paths that support the adapter and CLI claims
- **Evidence:** `tests/runner/agent-dispatch-roundtrip.test.ts:46-51` gates the real `claude` subprocess behind `AGENT_SMOKE=1`. `tests/runner/codex-dispatch-roundtrip.test.ts:34-39` gates the real `codex` subprocess behind `CODEX_SMOKE=1`. `tests/runner/dogfood-smoke.test.ts:248-283` gates the CLI entrypoint behind `CLI_SMOKE=1`. The default `npm run audit` still reports verify green and smoke fingerprints green.
- **Risk:** default verify can pass while the live adapters or CLI entrypoint are broken in the current environment. The fingerprints are historical evidence, not current executable coverage.
- **Proposed disposition:** fold-in.

### [MED] 20. Several ratchet-counted tests assert naming or export facts rather than behavior
- **Evidence:** `tests/runner/agent-dispatch-roundtrip.test.ts:58-72` labels itself "Event schema discriminator covers all five dispatch transcript kinds" but only checks literal strings match `/^dispatch\./`. `tests/runner/codex-dispatch-roundtrip.test.ts:92-107` does the same. `tests/runner/agent-dispatch-roundtrip.test.ts:54-56` and `tests/runner/codex-dispatch-roundtrip.test.ts:88-90` count as tests while only asserting `typeof materializeDispatch === 'function'`.
- **Risk:** the ratchet floor can grow without increasing regression-catching power. These tests are not harmful, but they should not be mistaken for invariant coverage.
- **Proposed disposition:** fold-in to ratchet classification, not necessarily delete.

### [MED] 21. The four semantic explore properties remain deferred after the happy-path e2e landed
- **Evidence:** `specs/contracts/explore.md:439-477` says P2.5 landed without promoting `artifact_emission_ordered`, `review_after_synthesis`, `no_skip_to_close`, and `reachable_close_only_via_review`, then re-defers them to P2.5.1, "not yet scheduled". The ledger keeps them `phase2-property` at `specs/invariants.json:1290-1313`.
- **Risk:** current tests prove the authored happy path, not that invalid explore graphs are rejected. A route skipping review can still be a blind spot until P2.5.1.
- **Proposed disposition:** fold-in before router or second workflow.

## Q8 — Completion / Implementation Gaps

### [HIGH] 22. Session hooks are marked closed, but clean clones silently no-op without an untracked engine shim
- **Evidence:** `SessionStart.sh` exits silently if `.circuit/bin/circuit-engine` is absent at `.claude/hooks/SessionStart.sh:20-26` and `.claude/hooks/SessionStart.sh:41-44`; SessionEnd does the same at `.claude/hooks/SessionEnd.sh:24-31` and `.claude/hooks/SessionEnd.sh:46-49`. `git ls-files .circuit/bin/circuit-engine .claude/hooks/SessionStart.sh .claude/hooks/SessionEnd.sh` shows only the two hook scripts are tracked. ADR-0007's close-state ledger admits the distinction at `specs/adrs/ADR-0007-phase-2-close-criteria.md:359-365`.
- **Risk:** CC#P2-4 can be "active — satisfied" while a fresh clone has hook wiring but no live hook behavior. This is exactly the facade vs live execution gap Q8 asks for.
- **Proposed disposition:** fold-in.

### [MED] 23. The advertised workflow surface is much larger than the implemented runtime surface
- **Evidence:** README promises "Explore, Build, Repair, Migrate, Sweep" with per-step configurability at `README.md:28-31`. The plugin tree currently contains only `dogfood-run-0` and `explore` fixtures, as shown by `.claude-plugin/skills/dogfood-run-0/circuit.json:3` and `.claude-plugin/skills/explore/circuit.json:3`. The remaining workflow/router/artifact-schema work is still listed as mid-term at `specs/plans/phase-2-implementation.md:782-799`.
- **Risk:** the top-level product claim is directionally true but operationally premature. A stranger handed the plugin today can inspect scaffolds and run tests, not actually automate the advertised family.
- **Proposed disposition:** accept-as-tradeoff with sharper README/plugin wording.

## Consolidated Disposition

| Question | HIGH | MED | LOW | META | Disposition |
|---|---:|---:|---:|---:|---|
| Q1 | 0 | 2 | 0 | 0 | Fold in D10 tuning + product-proof semantics |
| Q2 | 1 | 2 | 1 | 0 | Correct stale authority surfaces and parity wording |
| Q3 | 1 | 3 | 0 | 0 | Harden self-declaration and scan-scope ratchets |
| Q4 | 1 | 2 | 0 | 0 | Re-ground demo path and trajectory summary |
| Q5 | 2 | 1 | 0 | 0 | Fix dispatch verdict/materialization semantics before more runtime slices |
| Q6 | 0 | 1 | 0 | 1 | Record the correlated-failure measurement gap |
| Q7 | 1 | 2 | 0 | 0 | Separate live smoke from default verify claims; classify weak tests honestly |
| Q8 | 1 | 1 | 0 | 0 | Close clean-clone hook gap and narrow advertised surface |
| **Total** | **7** | **14** | **1** | **1** | **REJECT-PENDING-FOLD-INS** |

Overall verdict: **REJECT-PENDING-FOLD-INS**. The blockers are not stylistic. They are places where green gates or satisfied criteria are currently backed by placeholder artifacts, opt-in live paths, self-declared compliance, or clean-clone no-ops. The project can continue after those are folded in or explicitly reclassified by the operator.
