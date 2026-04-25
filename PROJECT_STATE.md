<!-- current_slice: 143 -->

# PROJECT_STATE — circuit-next

**Phase:** 2 — Implementation (closed for the first working workflow;
broader parity expansion planning next). See
[PROJECT_STATE-chronicle.md](PROJECT_STATE-chronicle.md) for the
relocated narrative log + the full phase block with CC#14 retarget
context and phase-open provenance.

## §0 Live state

- **current_slice:** 143
- **current_arc:** Build workflow parity is now closed. The implementation has the policy
  shape, typed Build artifact contracts/schemas, registered runtime synthesis
  writers for `build.plan@v1` and `build.result@v1`, and a focused
  verification command execution substrate. The runner can also execute a
  focused checkpoint step: standard/lite can continue through the declared safe
  default choice, deep/tournament can pause open without writing a closed-run
  result, autonomous can continue only through a declared safe autonomous
  choice, and a paused checkpoint can now resume from the saved run manifest
  through an explicit operator choice. The real Build workflow fixture is now
  registered with Frame, Plan, Act, Verify, Review, and Close, including worker
  dispatch for implementation and review. The runtime and product CLI can now
  select named Build entry modes with `--entry-mode`; the selected mode supplies
  the default execution rigor, while explicit `--rigor` wins and drives
  bootstrap, Build dispatch selection, and checkpoint policy together. Public
  Build slash-command wiring has landed: `/circuit:build` is registered, and
  `/circuit:run` can route clear implementation prompts to Build while keeping
  planning/document prompts on Explore. A live Build proof through
  `./bin/circuit-next build` now completes, writes all six Build artifacts, and
  records schema-valid `artifacts/build-result.json`; the proof also folded
  Claude Code 2.1.119's passive `PushNotification` init-tool drift without
  admitting repo-write tools. Slice 126 closed the signed Build plan with a
  two-prong composition review, narrowed the live Frame checkpoint to the only
  choice the current runner can honor, aligned public command wording with the
  actual Build result shape, and bound the Build close into the arc-close audit
  gate. P2-1 uses structured JSON as the accepted successor artifact shape; it
  does not claim old Markdown byte-for-byte compatibility. P2-3 live command proof is included through a live Claude
  Code invocation of the inline `circuit` plugin. The Phase 2 close claim
  remains narrow: first working workflow product spine closed, not full
  first-generation Circuit parity. Slice 127 refreshed the parity map after
  Build close and added a read-only characterization of the old Repair workflow.
  Slices 128 through 131 drafted, cleared, signed off, and briefly opened a
  Repair path, but that path is now historical: ADR-0013 closes the old Repair
  plan by supersession and makes Fix over reusable primitives the only current
  bug-fix direction. Slice 132 adds the ADR-0012 two-mode methodology overlay:
  Light work is now available for low-risk preparatory slices, while Heavy work
  keeps external challenger review.
  Slice 133 adds a first-principles workflow primitives inventory so future
  workflow work can compose shared moves instead of cloning old shapes.
  Slice 134 adds a research intake packet so the deep prior-art findings can be
  turned into concrete workflow-design choices instead of a loose source list.
  Slice 135 adds a typed primitive catalog and a recipe-composition note so the
  next design turn has a tested structure to revise.
  Slice 136 adds a design-only Repair recipe fixture and recipe schema so
  primitive compositions can be tested before behavior is added.
  Slice 137 cleans up agent-legibility surfaces: `AGENTS.md` is the active
  guide, `CLAUDE.md` is a compatibility pointer, active audit/test references
  now point at the active guide, unused `tsx` package metadata and redundant
  `.gitkeep` placeholders are removed, and the product-surface inventory is
  refreshed with a current-checkout note. Slice 138 makes the product-direction
  pivot explicit: old Repair remains reference evidence, but the next proving
  recipe is Fix over reusable workflow moves. The design-only Repair recipe
  fixture is replaced by `specs/workflow-recipes/fix-candidate.recipe.json`,
  `specs/workflow-direction.md` records the v1 boundaries, and next work should
  strengthen the Fix artifact contracts or build Fix behavior without creating
  one-off Repair code. Slice 139 adds typed Fix artifact schemas, a Fix
  artifact contract, authority rows, and contract tests so future Fix behavior
  has stable evidence targets before any executable behavior is wired.
  Slice 140 makes recipe compatibility checks route-aware: a recipe item now
  needs its inputs on every path that can reach it, and unreachable recipe
  items are reported instead of being accepted by file order.
  Slice 141 canonicalizes the workflow-architecture pivot in ADR-0013:
  workflows are primitive-backed recipes, old Circuit remains reference
  evidence, Fix is the first proving recipe, and the old Repair plan is closed
  by supersession rather than left available for one-off implementation. Next
  work should continue strengthening Fix contracts or build Fix behavior through
  reusable moves. Slice 142 adds a narrow non-external challenger fallback for
  the case where the default external Codex CLI review path is blocked or
  unavailable after a recorded attempt and explicit operator authorization.
  The fallback keeps the same objection-list and review-artifact discipline,
  but records that it is weaker than a true external pass. Slice 143 closes
  the two-mode methodology hardening plan: routine Light work now uses a small
  task packet plus failure-mode and acceptance-evidence framing, while Heavy
  work and unclear Light work still carry the extra why-this-path framing and
  challenger review discipline.
- **current_phase:** Phase 2 — Implementation (closed for the first working workflow; broader parity expansion planning next)

Chronicle (relocated narrative history — non-authoritative; see
disclaimer at file top) at
[PROJECT_STATE-chronicle.md](PROJECT_STATE-chronicle.md).

*This file carries only live state. Per-slice narrative — historical
reference, with authoritative ceremony evidence in the commit bodies
themselves — is relocated to the chronicle and appended by each slice
ceremony. Live state at `## §0` above is the machine-readable surface
for new consumers (`readLiveStateSection` helper in `scripts/audit.mjs`);
the `<!-- current_slice: N -->` HTML-comment marker at file top is
preserved unchanged for existing consumers (doctor.mjs, inventory.mjs,
audit.mjs status-epoch + freshness + arc-close gate + contract tests) per
ADR-0010 compat-shim discipline. Slice 68 ARC-CLOSE fold-in (Codex MED-2):
authority wording reconciled with chronicle's own "non-authoritative
history" disclaimer — commits are authoritative, chronicle is narrative
companion. Runtime Safety Floor plan revision 03 reached challenger-cleared
on 2026-04-24 via `specs/reviews/runtime-safety-floor-codex-challenger-03.md`
and received operator signoff on 2026-04-24. Slice 69 landed the
run-relative path primitive and runtime containment checks. Slice 70
landed the fresh run-root guard so a reused root is rejected before
bootstrap writes can mutate prior run evidence. Slice 71 landed durable
adapter invocation failure closure: thrown dispatchers now emit
`dispatch.failed`, close the run as aborted, and write aborted
`result.json` / `state.json` surfaces.*
Slice 72 added WF-I11 pass-route terminal reachability and a runtime
schema-bypass cycle guard: pass-only self-cycles and multi-step cycles now
fail workflow parsing, and any already-parsed workflow object that revisits
a step closes the run as aborted with `step.aborted`, aborted state, and
aborted result instead of hanging or falsely marking the step complete.*
Slice 73 maps terminal route labels to honest run outcomes: `@complete`
closes complete, `@stop` closes stopped, `@escalate` closes escalated,
and `@handoff` closes handoff, with `run.closed`, `state.json`,
`RunProjection`, and `artifacts/result.json` agreeing for each route.*
Slice 74 records the regression proof for the five original runtime-safety
findings and declares the challenger-cleared P2.9 second-workflow plan
fresh against the new path, run-root, dispatch-failure, pass-route,
terminal-outcome, and synthesis-boundary semantics. No P2.9 implementation
started in this slice.*
Slice 75 closed the runtime-safety-floor arc with two composition-review
prong files, folded the Codex MED by binding the arc into
`ARC_CLOSE_GATES`, advanced the plan to `closed`, and left P2.9 untouched
pending its separate operator signoff.*
P2.9 received explicit operator signoff on 2026-04-24 after the safety
cleanup closed; implementation may now open from
`specs/plans/p2-9-second-workflow.md` starting with the policy-table seam.*
Slice 76 opened P2.9 by registering the audit-only `review` workflow's
canonical phase set in the shared workflow-kind policy table and adding
policy-only tests. The real review fixture, artifact schema, and runtime
wiring have not landed yet.*
Slice 77 added the structured `review.result` schema, registered the
artifact row against the signed P2.9 plan pending the real review contract,
added REVIEW-I1 / REVIEW-I2 invariant bindings, and pinned the review
analyze dispatch shape. The real review fixture and runtime wiring have
not landed yet.*
Slice 78 landed the real review workflow contract and the three-phase
fixture, rehomed the `review.result` authority row to that contract, and
anchored REVIEW-I1 / REVIEW-I2 on the contract itself. The fixture now
proves the review shape and reviewer dispatch boundary; runtime wiring for
schema-valid close synthesis remains the next P2.9 slice.*
Slice 79 wired the live review fixture through the runtime with a stubbed
reviewer dispatch and an injected synthesis writer. The test proves both
accepted review dispatch verdicts can pass the gate and that the final
`review.result` artifact parses with REVIEW-I2's deterministic verdict
rule. A companion regression proves the default synthesis writer still
emits placeholder-only `review.result` bytes; command wiring has not
landed yet.*
Slice 80 added the explicit `/circuit:review` command, registered it in
the plugin manifest, and updated `/circuit:run` wording so it remains the
default route to explore while review is available as a direct workflow
command. The review command surfaces the current synthesis-writer caveat
instead of claiming the default CLI path produces typed review verdicts.*
Slice 81 recorded the P2.9 generalization proof. Three risk points are
classified clean, the review-specific audit policy branch is validated by
an already-landed targeted widening, and artifact-count balance is
validated with the named follow-on for per-workflow synthesis-writer
registration; no risk point is not-yet-validated.*
Slice 82 closed P2.9 with two composition-review prong files, bound the
arc into `ARC_CLOSE_GATES`, closed the plan, and marked the parent P2.9
slot with the validated-with-declared-follow-on outcome. The only named
future follow-on from this arc is per-workflow synthesis-writer
registration.*
Slice 83 closed that follow-on for the audit-only review path. The
default runtime synthesis writer now has a narrow review registration:
it writes `review.intake@v1` from the user scope and `review.result@v1`
from the analyze-phase reviewer output, so `/circuit:review` can point at
a typed review verdict artifact without the old caveat.*
Slice 84 landed the first `/circuit:run` classifier. Free-form tasks now
route through the CLI router instead of the slash-command body hardcoding
`explore`: review/audit-style language selects the audit-only `review`
workflow, and other tasks keep the conservative `explore` default.*
Slice 85 landed the model/effort selection resolver seam. Dispatch events
now record model, effort, skills, rigor, and invocation options after the
runtime composes any supplied default, user-global, project, workflow,
phase, step, and invocation layers; CLI config discovery and built-in
adapter model/effort honoring remain follow-on work. The tests pin the
provider enum while keeping model ids open-ended for adapter-owned
handling.*
Slice 86 landed product-path config discovery for the selection resolver.
The CLI now loads `~/.config/circuit-next/config.yaml` and
`./.circuit/config.yaml` from the current working directory when present,
validates them through the existing config schemas, and supplies them to
dispatch selection resolution. Missing config files are skipped; malformed
or schema-invalid ones fail loudly. Adapter honoring remained for the
next slice.*
Slice 87 landed built-in adapter model/effort argument binding. The
Claude adapter now passes compatible Anthropic model ids through
`--model` and supported effort tiers through `--effort`; the Codex
adapter passes compatible OpenAI model ids through `-m` and effort
through the allowlisted `model_reasoning_effort` config key with a final
spawn-argv boundary check. Provider mismatches and unsupported built-in
effort tiers fail before subprocess spawn. The remaining next step is an
arc-close composition review before opening another privileged runtime
slice.*
Slice 88 closed the P2-MODEL-EFFORT arc with two composition-review
prong files. The ceremony fixed one real resolver bug: defaults and
per-workflow skill operations inside the same config file now compose
instead of dropping the default contribution. It also narrowed the docs
and artifact metadata so they say the current CLI discovers user-global
and project config files; plugin defaults and per-command invocation
selection remain future product wiring.*
Slice 89 started P2.10 artifact schemas with the two deterministic
orchestrator-produced explore artifacts. `explore.brief@v1` and
`explore.analysis@v1` now have strict Zod schemas and the default runtime
writer emits those shapes on the normal explore path. The dispatch-produced
`explore.synthesis` / `explore.review-verdict` artifacts and the close-phase
`explore.result` aggregate remain follow-on work.*
Slice 90 continued P2.10 by making the dispatch-produced
`explore.synthesis@v1` artifact strict. The synthesize adapter prompt now
asks for the full synthesis JSON shape, and runtime materialization rejects
incomplete synthesis payloads before `artifacts/synthesis.json` is written.
`explore.review-verdict` and `explore.result` remain the P2.10 follow-ons.*
Slice 91 continued P2.10 by making the dispatch-produced
`explore.review-verdict@v1` artifact strict. The review adapter prompt now
asks for the full verdict JSON shape, and runtime materialization rejects
incomplete review verdict payloads before `artifacts/review-verdict.json`
is written. `explore.result` remains the last P2.10 artifact schema; the
three-slice P2.10 arc now needs composition review before the next
privileged runtime slice opens.*
Slice 92 closed the first P2.10 artifact-schema tranche with two
composition-review prongs. The fold-ins narrowed `explore.result` metadata
to the honest placeholder-parity state and added a seam-level test tying the
landed fixture schema names, artifact rows, schema exports, and runtime
validation together. `explore.result` remains the next privileged runtime
slice.*
Slice 93 closed the remaining P2.10 artifact schema by adding the strict
`explore.result@v1` aggregate, wiring the close-step writer to read
`synthesis.json` and `review-verdict.json`, and updating the explore golden
to the deterministic close-result output. The five explore artifacts now all
have explicit schemas and runtime writers or dispatch materializers.*
Slice 94 refreshed the CODEX_SMOKE fingerprint after the Slice 93 runtime
surface changed and pinned the smoke harness to a known-accessible Codex
model so the evidence path does not inherit an unavailable personal default.
The AGENT_SMOKE promotion was not run because it would send repository-derived
runtime context to an external Claude service; it remains pending fresh
explicit operator approval for that disclosure.*
Slice 95 bound the inherited product-ratchet rows in `TIER.md` to referenced
audit/test evidence surfaces, and added an audit guard so those rows cannot
drift back to stale planned-slice placeholders or duplicate claim rows. This
is Phase 2 close-evidence cleanup; it does not run AGENT_SMOKE or change
product runtime behavior.*
Slice 96 refreshed the Claude live-smoke fingerprint after explicit operator
approval for external Claude disclosure and the CLI smoke check. The real
explore workflow ran through the Claude adapter and updated
`tests/fixtures/agent-smoke/last-run.json`. This did not change product
runtime behavior.*
Slice 97 drafted the Phase 2 close matrix and added an audit validator for
that matrix. The validator checks the per-criterion evidence rows and product
ratchet rows, and it will reject a future Phase 2 close claim unless the
required Codex phase-close review and operator product check exist. This is
not a Phase 2 close claim.*
