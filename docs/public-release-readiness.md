# Circuit Public Release Readiness

Last updated: 2026-04-29

This document is the master backlog for preparing Circuit for a public release.
It is written for a coding agent that has no prior context from the release
readiness discussion.

Circuit is a local engine for structured developer work. Circuit-next is a
reimplementation of the original Circuit, with the same broad operator promise:
route a task into the right workflow, run it with the right rigor, checkpoint
when judgment is needed, preserve continuity, and leave a checked, reviewed,
readable summary of what happened.

The codebase is mostly good. The release risk is trust and comprehension:
users may see a lot of machinery before they see why Circuit is better than a
carefully written prompt.

## How To Use This Document

Before changing code, read `AGENTS.md` and the files named by the item you pick.
Preserve unrelated local changes.

Release truth surfaces:

- `docs/release/parity-matrix.generated.md` is the generated parity matrix.
- `docs/release/readiness-report.generated.md` is the generated current release
  report.
- `generated/release/current-capabilities.json` is the machine-readable current
  capability snapshot.

Release checks:

- `npm run check-release-infra` must pass during normal readiness work. It is
  allowed to pass with known release blockers only when those blockers are
  represented in the release ledgers.
- `npm run check-release-ready` is the strict public-release gate. It must fail
  until every blocker in the generated readiness report is implemented or
  approved as an intentional public exception.

If this document and a generated release truth surface disagree, treat the
generated surface as the current implementation truth and update this document
or the release ledgers in the same change.

When changing behavior, add or update tests first. When changing generated
commands or compiled flow outputs, run the generator and check drift. For
changes under `src/`, `tests/`, or `commands/`, run the canonical verification
loop before calling the work done:

```bash
npm run verify
```

For release-polish work that touches docs only, at least read back the changed
sections and run any focused checks that apply. When the work changes host
integration, also run:

```bash
node plugins/circuit/scripts/circuit-next.mjs doctor
```

## Release Thesis

The public release should restore the original Circuit promise without restoring
the exploratory noise that made the first implementation hard to reason about:

> Give Circuit a developer task. Circuit selects the right workflow and rigor,
> runs the structured handoff, checkpoints only when needed, verifies and reviews
> the result where the workflow requires it, and leaves a summary that tells the
> user what happened, what passed, what risk remains, and what to do next.

A planning run is not complete unless it starts the next work slice, asks for
the decision that blocks it, or leaves the operator with one obvious next
action.

Feature breadth is not the enemy. Unimplemented or unclear breadth is. Do not
hide original-Circuit capabilities from the release plan; implement them,
document them honestly, and prove them with examples or tests before making
them part of the public promise.

## Feature Parity Release Scope

Ship a parity-grade public release, not a narrow alpha.

Earlier review notes that assumed a Build-first or Build+Review alpha are
superseded by this scope decision. Do not hide Migrate, Sweep, Tournament,
Handoff, Create, custom connectors, or the bug-fix discipline from the original
system to make the release easier to explain. Implement the behavior, prove it,
or keep it as an explicit release blocker. The public command surface should
stay simple: Fix is the only bug-fixing flow.

Original-Circuit parity surface:

- Router: `/circuit:run <task>` classifies the task and picks workflow + rigor.
- Built-in workflows: Explore, Build, Fix, Migrate, and Sweep.
- Utilities: Review, Handoff/continuity, and custom workflow creation.
- Intent hints and natural-language cues: `fix:`, `develop:`, `decide:`,
  `migrate:`, `cleanup:`, `overnight:`, and equivalent user language should
  guide routing, rigor, and other parameters when the user has not provided them
  explicitly.
- Rigor profiles: Lite, Standard/default, Deep, Tournament, and Autonomous.
- Checkpoints, escalation, and continuity are first-class runtime behavior.
- Custom workflow/connectors are real supported capabilities once their
  contracts match runtime.
- Host surfaces are truthful: Claude Code, Codex, and generic shell should each
  have a clear current support path.
- Final summaries are human receipts, not runtime receipts.
- Plan-execution requests continue work: they start the right workflow, ask the
  blocking checkpoint, or give an exact next command.

Parity gaps must be explicit:

- If circuit-next lacks original behavior, track it as a release blocker or a
  named parity exception approved by the maintainer.
- Do not describe a missing behavior as current.
- Do not remove a capability from the release story merely because it is harder
  to explain; make it understandable.

Original-Circuit evidence anchors:

- `/Users/petepetrash/Code/circuit/README.md` lists Explore, Build, a legacy
  bug-fix flow, Migrate, and Sweep as included core workflows, with Create,
  Review, and Handoff as utilities.
- `/Users/petepetrash/Code/circuit/CIRCUITS.md` lists entry modes for Build,
  Explore, Migrate, the legacy bug-fix flow, Sweep, and Run, including
  Tournament and Autonomous where supported.
- `/Users/petepetrash/Code/circuit/commands/run.md` defines the intent prefixes
  used by the original router. The public circuit-next surface should keep the
  active vocabulary centered on Fix.
- `/Users/petepetrash/Code/circuit/CUSTOM-CIRCUITS.md` documents the
  create/publish path for user-global custom circuits.

## Priority Levels

- P0: Blocks a public parity release, or must become an explicit maintainer-
  approved parity exception.
- P1: Strongly improves trust, comprehension, and repeated use after parity
  blockers are addressed.
- P2: Later hardening after the parity promise is implemented, proven, and
  understandable.

## Quick Index

P0:

- REL-001: Align Custom Connector Docs And Runtime
- REL-002: Correct Connector Names, Auto Selection, And Codex Isolation Claims
- REL-003: Implement Rich Schematic Routes For Parity
- REL-004: Add A Truthful Flow, Mode, And Parity Matrix
- REL-005: Require Consent Or Redaction For Untracked Review Evidence
- REL-006: Do Not Call `accept-with-fixes` A Clean Complete
- REL-007: Disclose Write-Capable Worker Behavior On First Write-Capable Run
- REL-008: Rewrite Final Summaries As Human Receipts
- REL-009: Make Failure And Uncertainty Trust-Building
- REL-010: Rebuild README Around Structured Delegation And Parity
- REL-011: Add Golden Release Example Runs
- REL-012: Refresh Or Remove Stale Agent-Facing Docs
- REL-013: Implement Skill Injection And Create Parity
- REL-014: Add Known Limits And Support Matrix
- REL-015: Address Release Audit And Packaging Hygiene
- REL-016: Treat Plan-Execution Requests As Campaign Starts, Not Analysis
- REL-017: Make First Run Doctor-First
- REL-018: Retire Legacy Bug-Fix Naming In Favor Of Fix

P1:

- REL-019: Add Human Text Progress For Shell Users
- REL-020: Rewrite Major Progress Copy Around Delegation
- REL-021: Improve Build Plan Quality
- REL-022: Clarify Verification Scope And Environment
- REL-023: Add "Why Not Just Prompt?" Proof
- REL-024: Clean Public Naming Without Renaming Internals Yet
- REL-025: Reorganize Docs Around User Journey

P2:

- REL-026: Native Host Adapters
- REL-027: Route Policy Hardening Beyond Parity
- REL-028: Published Package Or Installer
- REL-029: Report Viewer Or TUI
- REL-030: Flow Quality Benchmarks

## P0 Items

### REL-001: Align Custom Connector Docs And Runtime

Problem:
Resolved in the current implementation slice: README, the connector contract,
schemas, and runtime now agree on one file-based custom connector protocol.
Circuit appends `PROMPT_FILE OUTPUT_FILE` to the configured command. The wrapper
reads the prompt file and writes a JSON response object to the output file.

Evidence:

- `README.md` says custom connectors receive `PROMPT_FILE OUTPUT_FILE`.
- `docs/contracts/connector.md` says the relayer appends two positional
  arguments, `PROMPT_FILE` and `OUTPUT_FILE`.
- `src/schemas/connector.ts` declares `PromptTransport = 'prompt-file'` and
  `output.kind = 'output-file'`.
- `src/runtime/connectors/custom.ts` writes the prompt to a temporary prompt
  file, appends prompt/output file paths to the wrapper argv, and reads the
  result from the output file.
- `tests/runner/runner-relay-provenance.test.ts` proves a custom reviewer
  connector receives file paths, not the raw prompt argv, and returns the JSON
  result through the output file.

Why users care:
A user following the docs will build an incompatible connector. This is a fast
trust failure because connector behavior is correctness- and security-sensitive.

Decision:
Use the documented file protocol for public release.

Options:

| Option | Tradeoff |
|---|---|
| Implement the documented file protocol | Chosen. Safer for long prompts and wrapper authors; requires runtime, schema, tests, and docs changes. |
| Update docs to the current append-argv/stdout JSON protocol | Fastest; keeps an awkward protocol and can hit argv-size limits. |
| Defer custom connectors with an approved parity exception | Smallest implementation; not the preferred parity path. |

Recommendation:
Keep custom connectors as a real release capability. Maintain the release
claim ledger entry `CLAIM-CUSTOM-CONNECTOR-PROTOCOL` as `verified_current` and
keep the runtime test as the proof that docs and behavior agree.

Acceptance checks:

- [x] README, connector contract, schemas, and runtime describe the same
  protocol.
- [x] At least one test proves a documented custom connector works end to end.
- [ ] Advanced docs include a copy-pasteable custom connector example.

Primary files:

- `README.md`
- `docs/contracts/connector.md`
- `src/schemas/connector.ts`
- `src/runtime/connectors/custom.ts`
- `tests/`

### REL-002: Correct Connector Names, Auto Selection, And Codex Isolation Claims

Problem:
Current public docs make connector claims that do not match runtime behavior.

Evidence:

- `README.md` refers to an `agent` connector, but built-ins are
  `claude-code`, `codex`, and `codex-isolated`.
- `src/runtime/relay-selection.ts` auto-resolves to `claude-code`, not "Codex
  if installed, else agent".
- `README.md` says Codex runs inside isolated `CODEX_HOME` and `TMPDIR`.
- `src/runtime/connectors/codex.ts` spawns with `env: process.env` and comments
  that the subprocess inherits the parent cwd by design.
- `docs/contracts/connector.md` and `src/schemas/connector.ts` mention
  `codex-isolated`, while `src/runtime/relay-selection.ts` throws when it is
  selected.

Why users care:
Containment and connector behavior are trust surfaces. A precise-sounding but
partly false isolation claim is worse than a clearly stated limitation.

Decision needed:
Decide whether `codex-isolated` is part of the public host/worker promise. If it
is, implement and test the stronger containment. If it is not, remove it from
the public promise and record it as a post-parity extension.

Recommendation:
For the public parity release, document and implement a coherent connector set:

- `claude-code`: trusted write-capable worker.
- `codex`: read-only Codex CLI worker using Codex read-only sandbox flags and
  the current process environment.
- `codex-isolated`: either implemented with isolated `CODEX_HOME`/`TMPDIR` and
  tests, or removed from public config/docs with an approved exception.
- Auto-selection defaults to `claude-code` unless config says otherwise.

Acceptance checks:

- README and connector docs use `claude-code`, not `agent`.
- `codex-isolated` either works as documented or is absent from public config
  examples and docs with a named parity exception.
- No public doc claims isolated `CODEX_HOME` or `TMPDIR` unless implemented and
  tested.
- A support matrix states current host and worker status in plain language.

Primary files:

- `README.md`
- `docs/contracts/connector.md`
- `docs/contracts/host-capabilities.md`
- `src/runtime/relay-selection.ts`
- `src/runtime/connectors/codex.ts`
- `src/schemas/connector.ts`

### REL-003: Implement Rich Schematic Routes For Parity

Problem:
Schematics can declare outcomes such as `retry`, `revise`, `stop`, `ask`,
`handoff`, and `escalate`. The compiler currently drops those routes. Real
failures abort instead of retrying, asking, or revising.

Evidence:

- `src/runtime/compile-schematic-to-flow.ts` has
  `SCHEMATIC_ROUTES_DROPPED_AT_COMPILE`.
- Build and Fix schematics declare richer route outcomes.
- Generated compiled flows keep only executable `pass` routes for many checks.
- The runner advances through compiled pass routes or aborts on failure.

Why users care:
Circuit's promise is structured delegation. If docs or flow schematics imply
recovery behavior that does not execute, a failure feels like the product broke
its contract.

Decision needed:
Define the route semantics circuit-next must support for parity with original
Circuit's checkpoints, circuit breakers, handoff/continuity, and bounded retry
loops.

Options:

| Option | Tradeoff |
|---|---|
| Implement every route outcome used by shipped workflows | Correct parity target; requires compiler, runner, schema, summary, and tests. |
| Implement stop/ask/handoff/escalate first, then retry/revise loops | Lower-risk sequence; still must not silently drop retry/revise declarations. |
| Keep route declarations but fail compilation when runtime lacks support | Prevents false behavior; blocks release until parity gaps are resolved. |

Recommendation:
For the parity release, the compiler must not silently drop declared routes.
Implement executable route semantics for shipped workflows, or make compilation
fail until the workflow declaration and runtime behavior agree. Do not paper over
missing route behavior with docs. REL-027 is only for hardening route policy
after parity; it must not be used to defer route outcomes declared by shipped
workflows.

Acceptance checks:

- The compiler no longer silently drops declared shipped-workflow routes.
- Every shipped flow has a route-outcome inventory covering Build, Explore,
  Fix, Migrate, Sweep, Review, Handoff, and Create where applicable.
- Every declared shipped-workflow route either executes or fails generation with
  a clear parity error.
- Tests cover at least one `ask`, `stop`, `handoff`, `escalate`, `retry`, and
  `revise` path, or name an explicit maintainer-approved parity exception.
- Failure summaries explain which recovery route ran or why Circuit stopped.

Primary files:

- `src/runtime/compile-schematic-to-flow.ts`
- `src/flows/build/schematic.json`
- `src/flows/explore/schematic.json`
- `src/flows/fix/schematic.json`
- `src/flows/migrate/schematic.json`
- `src/flows/sweep/schematic.json`
- `src/flows/review/schematic.json`
- `generated/flows/build/circuit.json`
- `generated/flows/fix/circuit.json`
- `docs/flows/`

### REL-004: Add A Truthful Flow, Mode, And Parity Matrix

Problem:
The README describes modes more broadly than compiled flows support, and the
release plan needs a clear map from original Circuit capabilities to
circuit-next implementation status.

Evidence:

- `README.md` says Tournament is available on Explore and Review.
- `generated/flows/explore/tournament.json` now exposes an Explore tournament
  entry mode.
- `generated/flows/review/circuit.json` exposes only `default`.
- `docs/release/parity-matrix.generated.md` is now the current source for
  supported router intent modes.
- `develop:`, `decide:`, `migrate:`, `cleanup:`, and `overnight:` now route to
  the expected workflow and mode.
- `docs/flows/explore-tournament.md` pins the intended Explore Tournament
  behavior, graph, reports, checkpoint, fanout shape, tests, and remaining
  golden proof work.
- Original Circuit exposed Explore, Build, a bug-fix flow, Migrate, Sweep,
  Review, Handoff, Create, intent prefixes, and five rigor profiles.

Why users care:
Trying an advertised mode and getting rejected makes the product feel unfinished
even when the engine behaves correctly.

Recommendation:
Keep the generated circuit-next flow/mode matrix as the release truth surface.
It derives current support from `generated/flows/**/circuit.json` and router
classification, then compares it with the original-Circuit parity fixture.
Unsupported examples become release blockers unless explicitly approved as
parity exceptions.

Minimum parity matrix axes:

- Public command or invocation shape.
- Router signal or intent hint.
- Entry modes / rigor profiles.
- Phase path for each mode.
- Required artifacts and report schemas.
- Checkpoint policy and safe defaults.
- Review behavior.
- Verification behavior.
- Worker dispatch / handoff behavior.
- Continuity and resume behavior.
- Golden example or test proving the behavior.
- Status: implemented, failing test, missing, or approved exception.

Acceptance checks:

- README has a current matrix of supported flows, utilities, intent hints, and
  entry modes.
- Command docs do not include unsupported examples.
- A test or script fails when README mode claims drift from compiled flows.
- A parity matrix maps original Circuit workflows/utilities/modes across the
  axes above to circuit-next status: implemented, failing test, missing, or
  approved exception.
- `npm run check-release-infra` fails if a capability is marked implemented by
  name alone while any behavioral axis above is missing or different, unless a
  named release blocker or approved exception covers that exact capability.

Primary files:

- `README.md`
- `commands/run.md`
- `commands/build.md`
- `src/flows/*/schematic.json`
- `docs/flows/explore-tournament.md`
- `generated/flows/*/circuit.json`
- `scripts/emit-flows.mjs`
- original reference: `/Users/petepetrash/Code/circuit/README.md`
- original reference: `/Users/petepetrash/Code/circuit/CIRCUITS.md`
- original reference: `/Users/petepetrash/Code/circuit/commands/run.md`

### REL-005: Require Consent Or Redaction For Untracked Review Evidence

Problem:
Resolved. Review intake samples untracked paths and sizes by default, but does
not include untracked file contents unless the operator explicitly opts in.

Evidence:

- `src/flows/review/writers/intake.ts` runs `git ls-files --others
  --exclude-standard`.
- It samples up to `MAX_UNTRACKED_FILES` and records path/size metadata.
- It includes file contents only when `--include-untracked-content` or the
  matching runtime evidence policy is set.
- Content opt-in still skips binary, unreadable, symlink, non-regular, and
  oversized samples safely.

Why users care:
Untracked files often contain scratch notes, secrets, generated output, or
private context. Relaying their contents without a clear policy can feel like a
privacy violation.

Decision:
Default to paths and metadata only. Require explicit opt-in for untracked file
contents.

Options:

| Option | Tradeoff |
|---|---|
| Opt-in to untracked file contents | Safest and clearest; review may miss untracked changes by default. |
| Include paths only by default, contents with flag/config | Good balance; avoids silent leakage. |
| Keep current behavior and document it | Least work; risky for trust. |

Current implementation:
`./bin/circuit-next run review --goal '<scope>'` sends untracked paths and
sizes only. Add `--include-untracked-content` only when those files are safe to
relay to the configured worker.

Acceptance checks:

- [x] Review default does not relay untracked file contents.
- [x] A flag can enable content sampling when desired.
- [x] Operator summary includes evidence warnings when untracked content is
      omitted by policy.
- [x] Tests cover untracked paths, content opt-in, binary files, unreadable
      files, and truncation.

Primary files:

- `src/flows/review/writers/intake.ts`
- `src/flows/review/reports.ts`
- `tests/runner/` or `tests/contracts/`
- `README.md`
- `docs/known-limits.md` if added

### REL-006: Do Not Call `accept-with-fixes` A Clean Complete

Problem:
Resolved in the current implementation slice: Build no longer reports a clean
flow-level `complete` when the independent reviewer returns `accept-with-fixes`.
The universal run can still close successfully because the engine finished, but
the Build flow report and operator summary now tell the user that follow-up
fixes need attention.

Evidence:

- `generated/flows/build/circuit.json` treats `accept` and
  `accept-with-fixes` as passing review outcomes so the review report can be
  materialized.
- `src/flows/build/writers/close.ts` maps `accept` to `complete`,
  `accept-with-fixes` to `needs_attention`, and failures/rejections to `failed`.
- `src/flows/fix/writers/close.ts` was audited and now maps
  `accept-with-fixes` to `partial` instead of `fixed`.
- `src/runtime/operator-summary-writer.ts` says when Build verification passed
  but review requested follow-up fixes.

Why users care:
"Accepted with fixes" means something still needs attention. A clean
"complete" can lead users to ship work the reviewer said still needed fixes.

Decision:
Use `needs_attention` for Build follow-up outcomes, and use Fix's existing
`partial` outcome when a bug fix still needs review-requested follow-ups.

Options:

| Option | Tradeoff |
|---|---|
| Add `needs_attention` or `complete_with_followups` | Chosen for Build as `needs_attention`; most accurate for machines and humans. |
| Keep `complete` but highlight follow-ups in summary | Smaller change; still ambiguous for machines. |
| Treat `accept-with-fixes` as failure | Safest; may be too strict for minor follow-ups. |

Recommendation:
Keep this distinction as a release safety invariant: clean completion requires
clean review acceptance when review is present. Follow-up acceptance is useful,
but it is not done.

Acceptance checks:

- [x] Build result distinguishes clean complete from follow-up complete.
- [x] Fix is audited for the same issue before schema changes are applied beyond
  Build.
- [x] Operator summary tells the user not to treat follow-ups as done.
- [x] Tests cover `accept`, `accept-with-fixes`, and `reject`.

Primary files:

- `src/flows/build/reports.ts`
- `src/flows/build/writers/close.ts`
- `src/flows/fix/reports.ts`
- `src/flows/fix/writers/close.ts`
- `src/runtime/operator-summary-writer.ts`
- `tests/runner/operator-summary-writer.test.ts`

### REL-007: Disclose Write-Capable Worker Behavior On First Write-Capable Run

Problem:
The Claude Code connector invokes a write-capable subprocess with
`bypassPermissions`. This may be correct for implementation, but the first-run
experience must not hide it.

Evidence:

- `src/runtime/connectors/claude-code.ts` says the subprocess receives tools
  like Read, Write, Edit, Bash, Glob, and Grep.
- It passes `--permission-mode bypassPermissions`.
- Codex worker relays are read-only and cannot run implementer roles.

Why users care:
Users need to know when Circuit can edit files. Honest disclosure increases
trust; surprise write access destroys it.

Decision needed:
Where should the disclosure appear?

Recommendation:
Show it in first-run docs and, for the first write-capable Build, Fix, Migrate,
or Sweep run, in progress or the initial summary:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

Acceptance checks:

- README and first-run guide disclose write-capable workflow behavior.
- Review is presented as the safer read-only first run when appropriate.
- Connector matrix clearly separates write-capable and read-only workers.

Primary files:

- `README.md`
- `docs/first-run.md` if added
- `docs/contracts/host-capabilities.md`
- `src/runtime/runner.ts`
- `src/runtime/connectors/claude-code.ts`

### REL-008: Rewrite Final Summaries As Human Receipts

Problem:
Current operator summaries expose internal metadata before user value.

Evidence:

- `src/runtime/operator-summary-writer.ts` emits "Selected flow", "Outcome",
  "Routed by", "Router reason", "Run folder", "Result path", report paths, and
  schema names.
- `docs/terminology.md` says product surfaces should avoid terms like
  `relay`, `evidence link`, `canonical trace`, `run folder`, and `depth`.

Why users care:
The final summary is the main trust surface. If it reads like debug output,
Circuit feels like machinery instead of delegation.

Target shape:

```markdown
## Result
Circuit completed the Build, but the review found follow-ups.

## What Changed
...

## What Passed
...

## Review
...

## Remaining Risk
...

## Next Step
<done | needs a decision | ready to start the next slice | blocked by a named issue | exact suggested next command>

## Inspection Details
...
```

Decision needed:
Should debug details always be included at the bottom, or only when requested?

Recommendation:
Always include a compact "Inspection Details" section at the bottom, but never
lead with paths, schema ids, trace counts, or router internals.

Acceptance checks:

- Completed, checkpoint, and aborted runs all have human-first summaries.
- Raw paths and schema ids move below user-facing result, proof, risk, and next
  action.
- Every summary includes one obvious next action unless the run is truly done.
- Existing host instructions still have machine-readable stdout JSON for tools.
- Snapshot/golden tests cover representative summaries.

Primary files:

- `src/runtime/operator-summary-writer.ts`
- `src/schemas/operator-summary.ts`
- `tests/runner/operator-summary-writer.test.ts`
- `commands/run.md`
- `plugins/circuit/skills/run/SKILL.md`

### REL-009: Make Failure And Uncertainty Trust-Building

Problem:
Abort output can surface raw validation/runtime detail as the primary user
message. That is technically honest but emotionally damaging.

Evidence:

- `commands/run.md` tells hosts to read `reports/result.json` and surface abort
  `reason`.
- Prior review reported representative abort runs with raw Zod-style error
  detail in progress and summaries; exact fixtures still need to be captured in
  the Evidence Appendix.

Why users care:
Users forgive clear limits. They do not forgive a tool that dumps internals and
leaves them to diagnose the next step.

Target shape:

```markdown
Circuit stopped before finishing.

What happened:
...

What I checked:
...

What is still unknown:
...

Suggested next step:
...

Debug detail:
...
```

Acceptance checks:

- Abort summaries start with a plain explanation and next step.
- Raw validation errors are still available for debugging.
- Progress events with `display.tone === "error"` are concise and non-JSON.
- Tests cover schema failure, connector failure, verification failure, and
  timeout.

Primary files:

- `src/runtime/runner.ts`
- `src/runtime/operator-summary-writer.ts`
- `commands/run.md`
- `commands/build.md`
- `plugins/circuit/skills/run/SKILL.md`
- `tests/runner/`

### REL-010: Rebuild README Around Structured Delegation And Parity

Problem:
The README opens with "Automate your Claude Code flows" and describes an
orchestration layer, modes, config, schematics, run folders, and connectors
before proving why Circuit is useful.

Evidence:

- README starts with `circuit-next`, not Circuit.
- It leads with Claude Code, orchestration, and configurability.
- It introduces config, skills, connector routing, modes, depth, and run folders
  early in the first-run path.

Why users care:
A skeptical developer should understand the value in 30 seconds. They should
not need to learn the control plane before seeing the payoff.

Recommended opening:

> Circuit helps you hand off a coding task and come back to a checked, reviewed
> summary of what happened.

Then show the router, the core workflow catalog, one Build command, and one
realistic result. Build can be the demo, but it must not imply the release is
Build-only.

Also show one plan-execution example. A request like "Execute this release
checklist" should become a first slice, checkpoint, or exact next command, not a
plain analysis summary.

Acceptance checks:

- README leads with structured delegation, the parity workflow catalog, and a
  concrete Build example.
- README clearly presents the parity flow set: Explore, Build, Fix, Migrate,
  Sweep, Review, Handoff, and custom flow creation.
- Advanced config appears after the first-run path.
- The README answers "why not just prompt?" with concrete proof.
- README shows how broad plan-execution requests turn into a concrete next work
  slice or checkpoint.
- It includes a current support matrix and known limits link.
- It does not use internal terms in the intro.

Primary files:

- `README.md`
- `docs/first-run.md` if added
- `docs/known-limits.md` if added
- `docs/public-release-readiness.md`

### REL-011: Add Golden Release Example Runs

Problem:
Circuit needs visible proof that it did more than wrap a prompt. Local manual
runs are not enough for a public release.

Needed examples:

- Routed Build
- Explicit Build
- Explore Deep
- Explore Tournament / `decide:`
- Fix
- Migrate
- Sweep
- Handoff/continuity resume
- Custom workflow creation
- Custom connector or a documented parity exception
- Review
- Checkpoint waiting
- Abort/failure
- Plan execution / campaign start

Each example should include:

- Progress output
- Final stdout JSON
- `operator-summary.md`
- Key reports used by the summary
- Short README text explaining what this run proves

Why users care:
Examples make the trust promise inspectable. They also become regression
fixtures for output quality.

Decision needed:
Where should examples live?

Recommendation:
Add `examples/runs/<scenario>/` for checked-in fixtures, plus a script to
regenerate them with deterministic stub relayers where possible.

Acceptance checks:

- Examples are checked into the repo or generated by a documented command.
- They do not include machine-specific absolute paths unless deliberately
  scrubbed.
- A test or script checks that examples stay structurally valid.
- README links to at least one compact example.
- At least one golden run proves a broad plan request ends with a first slice,
  checkpoint, or exact suggested next command.
- Missing or planned examples are tracked as release blockers, not implied as
  current and not allowed through `npm run check-release-ready`.

Primary files:

- `examples/runs/` if added
- `scripts/`
- `tests/fixtures/`
- `README.md`
- `docs/host-trial-checklist.md`

### REL-012: Refresh Or Remove Stale Agent-Facing Docs

Problem:
`HANDOFF.md` contains stale architecture language and paths.

Evidence:

- `HANDOFF.md` says flows live under `src/workflows/<id>/`.
- The active repo uses `src/flows/<id>/`.
- Some historical notes reference old test files and old terminology.

Why users care:
Agent-facing stale docs create bad future edits. A coding agent may follow the
old architecture and make changes in the wrong place.

Decision needed:
Is `HANDOFF.md` a live handoff, an archive, or not part of release?

Recommendation:
Refresh it to two short current paragraphs per `AGENTS.md`, or remove it from
release archives if no longer active. Add a stale-doc check for active docs.

Acceptance checks:

- No active doc points to `src/workflows/` as the current flow location.
- No active release doc describes old workflow terminology as current.
- If `HANDOFF.md` remains, it is short, current, and plain English.

Primary files:

- `HANDOFF.md`
- `AGENTS.md`
- `docs/`
- `tests/` or audit scripts if stale-doc checks exist

### REL-013: Implement Skill Injection And Create Parity

Problem:
Original Circuit promised both reusable custom workflow creation and
phase/step-level skill orchestration. Circuit-next schemas and selection
resolver model skill selection, but the connector/runtime activation path must
prove that selected skills actually reach workers. The current command surface
also does not yet prove `/circuit:create` parity.

Evidence:

- Original Circuit `README.md` says users can pre-configure skills at the phase
  or step level.
- Original Circuit `README.md` and `CUSTOM-CIRCUITS.md` describe
  `/circuit:create` and custom circuit publication.
- Circuit-next `README.md` says users can pick skills for each step and Circuit
  will inject them.
- `docs/contracts/config.md` notes config does not inject plugin defaults
  directly until later product wiring lands.
- `src/runtime/connectors/claude-code.ts` disables slash commands and uses empty
  settings, which may prevent host skill activation.
- The generated release parity matrix currently tracks `utility:create` as
  missing.
- Before implementing, verify the boundary between "selection is modeled" and
  "skills are actually activated" by inspecting the selection resolver, prompt
  composition, and connector invocation path.

Why users care:
If users configure skills and the worker does not actually use them, Circuit
looks like it accepted configuration that had no effect.

Decision needed:
Define the supported activation path for each worker connector and host. Also
decide whether `/circuit:create` is restored as a public command for parity or
recorded as an explicit maintainer-approved public exception. It must not slip
through optional wording.

Recommendation:
Implement and test the first parity path for skill activation, and restore
`/circuit:create` as a real custom workflow creation path unless the maintainer
approves a named exception. If a host or connector cannot activate skills yet,
the support matrix must mark that exact host/connector gap as not release-ready
rather than downgrading the overall capability to marketing copy.

Acceptance checks:

- `/circuit:create` is implemented and documented, or `utility:create` remains a
  named release blocker with public wording that says custom workflow creation
  is not current.
- A golden customization proof covers `/circuit:create`, custom connector
  setup, or the approved exception that replaces them.
- A test proves a configured skill reaches the worker prompt/runtime for at
  least one supported worker path.
- The support matrix states which hosts/connectors support skill activation.
- Config docs distinguish selection modeling from worker activation.
- README claims only the activation paths that are proven.

Primary files:

- `README.md`
- `commands/create.md` if added
- `docs/release/parity/original-circuit.yaml`
- `docs/release/proofs/index.yaml`
- `docs/contracts/config.md`
- `docs/contracts/selection.md`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `tests/`

### REL-014: Add Known Limits And Support Matrix

Problem:
Implemented, model-mediated, and planned behavior are too close together in the
docs.

Evidence:

- `docs/contracts/host-capabilities.md` marks Codex plugin and Claude Code
  command support as model-mediated.
- It marks Codex App Server and Claude Agent SDK support as planned native.
- `docs/contracts/native-host-adapters.md` says native bridges are not
  implemented by the current slice.

Why users care:
Users trust honest limits. They lose trust when planned behavior is described
near current behavior without a clear status boundary.

Recommended matrix:

| Surface | Parity/release expectation |
|---|---|
| CLI / generic shell | Supported with human and JSONL progress |
| Claude Code command/plugin | Supported; original Circuit's primary host path |
| Codex plugin host | Supported when doctor passes; model-mediated until native path lands |
| Codex worker connector | Supported with clear read-only/write limits |
| Claude Code worker connector | Supported as trusted write-capable worker |
| Custom connectors | Supported after the contract/runtime mismatch is fixed |
| Custom workflow creation | Supported; implement `/circuit:create` parity or record an approved exception |
| Native Codex App Server | Implement if promised as a first-class host; otherwise list as post-parity extension |
| Claude Agent SDK | Implement if promised as a first-class host; otherwise list as post-parity extension |

Acceptance checks:

- README has a compact support matrix.
- Detailed matrix lives in docs.
- Planned items are labeled planned, not implied current.
- Known limits page covers write-capable workers, read-only Codex workers,
  restricted verification env, mode support, custom connector status, and
  native adapter status.
- Original-Circuit parity gaps are labeled as blockers or named parity
  exceptions, not hidden as advanced features.

Primary files:

- `README.md`
- `docs/known-limits.md` if added
- `docs/contracts/host-capabilities.md`
- `docs/contracts/native-host-adapters.md`

### REL-015: Address Release Audit And Packaging Hygiene

Problem:
Current release packaging is not yet public-release grade, and dependency audit
has production moderate issues through the designer workspace.

Evidence:

- `package.json` has `"private": true`.
- `package.json` has workspace `apps/*`, which brings designer dependencies
  into the root install.
- `apps/designer/package.json` depends on Vite.
- `npm audit --omit=dev --json` on 2026-04-29 reported two moderate
  production vulnerabilities through `vite` and `esbuild`; the available fix is
  a semver-major Vite upgrade.
- README license is still `TBD`.

Why users care:
Install friction and obvious release metadata gaps reduce confidence before the
user ever sees the workflow quality.

Decision needed:
Is the public parity release installed from checkout, npm package, plugin
bundle, marketplace plugin, or another distribution artifact?

Recommendation:
Choose one release path and make it boring. Separate CLI/plugin install from
designer dependencies if possible. Resolve or document audit status before
public announcement.

Acceptance checks:

- Install docs match the chosen distribution model.
- License field and README license are not `TBD`.
- Audit status is either clean or documented with rationale and scope.
- Designer dependencies do not burden CLI users unless intentionally accepted.

Primary files:

- `package.json`
- `package-lock.json`
- `apps/designer/package.json`
- `README.md`
- `LICENSE` if added

### REL-016: Treat Plan-Execution Requests As Campaign Starts, Not Analysis

Problem:
When the user says "execute this plan," Circuit can route to Explore, summarize
the plan, and stop. That is safe, but it leaves the operator with the same
burden they started with: deciding what to do next.

Evidence:

- A dogfood run against `docs/public-release-readiness.md` completed Explore and
  produced a structural read of the release backlog.
- The run correctly warned not to bundle independent P0 decisions, but it did
  not start a slice, ask a scope checkpoint, or give a single next invocation.
- Original Circuit had a useful product instinct here: Explore plans could
  transfer into Build when `plan.md` existed with slices, but that behavior was
  encoded in SKILL prose rather than enforceable runtime state.

Why users care:
The operator does not want a better description of a campaign when they asked
Circuit to begin it. Circuit should reduce "what do I do next?" moments, not
preserve them.

Desired behavior:
If a request references a plan, backlog, checklist, or doc and uses execution
language, Circuit must do one of three things:

1. Start the first executable workflow slice.
2. Ask a checkpoint question, such as "This is a multi-item campaign. Start
   with REL-001?"
3. Produce an execution campaign with an explicit next command, not a completed
   Explore with no handoff.

Decision needed:
Should the first release implement plan execution as router behavior, Explore
close behavior, or an explicit checkpoint/handoff outcome?

Options:

| Option | Tradeoff |
|---|---|
| Router starts the appropriate workflow for the first slice | Feels decisive; requires plan-content routing good enough to distinguish Build, Fix, Migrate, Sweep, and Explore decisions. |
| Explore closes with a typed `ready_for_workflow` handoff | Preserves analysis first; requires a real handoff surface so users are not stranded. |
| Checkpoint before starting campaign execution | Safest and clearest for broad plans; adds one interaction before work begins. |

Recommendation:
Treat this as a parity operator behavior, not optional polish. If Explore
produces an executable plan, Circuit should either hand off to the appropriate
workflow, start the first safe slice, or ask the checkpoint that blocks starting.
The operator should never receive a completed analysis-only run after asking
Circuit to execute a plan.

Acceptance checks:

- `/circuit:run Execute this plan: <doc>` cannot finish as plain Explore unless
  the user explicitly asked for analysis only.
- If the plan has ordered items, Circuit identifies the first executable slice.
- If the first slice requires a decision, Circuit asks one checkpoint question.
- If Circuit does not start work, it provides the exact suggested next
  invocation.
- Golden plan-execution fixtures cover at least Build, Fix, Migrate, Sweep, and
  Explore decision plans, including `docs/public-release-readiness.md` or a
  scrubbed fixture derived from it.

Primary files:

- `src/runtime/router.ts`
- `src/flows/explore/`
- `src/flows/build/`
- `src/flows/fix/`
- `src/flows/migrate/`
- `src/flows/sweep/`
- `commands/run.md`
- `plugins/circuit/skills/run/SKILL.md`
- `src/runtime/operator-summary-writer.ts`
- `docs/public-release-readiness.md`

### REL-017: Make First Run Doctor-First

Problem:
The Codex plugin wrapper has a useful `doctor`, but onboarding does not lead
with it.

Why users care:
First-run confidence starts with "is this installed correctly?" A failed first
Build because the environment is wrong is a bad introduction.

Recommendation:
Expose a human-readable doctor command in README before the first run. Keep JSON
output available for tools.

Acceptance checks:

- README says to run doctor before the first flow.
- Doctor output is readable by a human by default, or docs clearly explain JSON.
- Doctor validates the public release path, not only Codex plugin internals.

Primary files:

- `README.md`
- `plugins/circuit/scripts/circuit-next.mjs`
- `src/cli/circuit.ts`
- `docs/first-run.md` if added

### REL-018: Retire Legacy Bug-Fix Naming In Favor Of Fix

Problem:
The original implementation used a second name for bug-fixing work. Circuit-next
has an active Fix flow, and the product direction is now clear: Fix should own
bugs, regressions, flaky behavior, and incident-style code fixes.

Evidence:

- Original Circuit `CIRCUITS.md` listed a separate bug-fix flow.
- Original Circuit `commands/run.md` routed quick bug-fix and broader
  investigation language into that flow.
- Circuit-next `docs/flows/direction.md` says the clearer v1 product shape is
  Fix and that a second bug-fix flow name is out of scope.
- Circuit-next `docs/flows/flow-schematics.md` repeats that older bug-fix
  evidence should inform Fix, not force separate runtime code.

Why users care:
Bug-fixing is one of the clearest reasons to use Circuit. If the public command,
router prefix, flow name, and docs disagree, users will not know what to invoke.

Decision:
Keep the public command surface simple. Do not add a second bug-fix command and
do not restore a second bug-fix runtime. Publicly, Circuit has one bug-fixing
flow: Fix. The old name is retired terminology and should not appear in active
public docs, command docs, generated support matrices, or proof scenario names.

Options:

| Option | Tradeoff |
|---|---|
| Keep Fix as the only public bug-fixing flow | Smallest, clearest surface; requires strong Fix routing/depth inference. |
| Keep both names | More literal original compatibility; overloads the surface with two names for one kind of work. |
| Rename Fix back to the legacy name | Strong historical continuity; loses the clearer product language current docs prefer. |

Recommendation:
Implement the simple-surface contract. `/circuit:run fix: ...` and
natural-language bug/regression requests should select Fix, infer a reasonable
rigor level from the request, and respect explicit user-provided
flow/mode/depth parameters. Do not add a second bug-fix command unless this
decision is explicitly reopened.

Acceptance checks:

- The parity matrix treats Fix as the active bug-fixing flow.
- README, command docs, generated command surfaces, and support matrix agree.
- `fix:` and natural-language bug/regression requests select the Fix flow in
  tests.
- Routing/depth inference chooses a sensible rigor level when the user did not
  explicitly provide one, and explicit user-provided flow/mode/depth values win.
- Active public docs and command docs do not use the retired name.
- `docs/flows/direction.md` and `docs/flows/flow-schematics.md` are updated so
  future agents do not follow stale naming guidance.

Primary files:

- `README.md`
- `commands/run.md`
- `commands/fix.md`
- `src/runtime/router.ts`
- `src/flows/fix/`
- `docs/flows/direction.md`
- `docs/flows/flow-schematics.md`

## P1 Items

### REL-019: Add Human Text Progress For Shell Users

Problem:
JSONL progress is correct for hosts, but direct shell users need readable
progress without writing a parser.

Recommendation:
Add or document `--progress text` for direct humans and keep `--progress jsonl`
for hosts.

Acceptance checks:

- Shell first run shows concise text progress.
- JSONL format remains stable for hosts.
- Tests cover both modes.

Primary files:

- `src/cli/circuit.ts`
- `src/runtime/progress` related code if present
- `commands/run.md`
- `docs/contracts/host-rendering.md`

### REL-020: Rewrite Major Progress Copy Around Delegation

Problem:
Progress text can sound like runtime narration: relay names, connector names,
filesystem capabilities, and generic "Circuit started" lines.

Why users care:
Users want reassurance that work is moving and whether they need to intervene.

Preferred style:

- "I am treating this as Build."
- "I am treating this as a release campaign. I am finding the first safe slice."
- "I am making the change now."
- "Verification passed: `npm run check`."
- "Independent review found 2 follow-ups."
- "Still working. No decision needed from you yet."

Acceptance checks:

- Major progress messages are human and concise.
- Plan-execution runs say whether Circuit is choosing a first slice, asking a
  checkpoint question, or producing the exact next invocation.
- Detail/debug events can still include connector and trace internals.
- Host rendering docs continue to suppress detail by default.

Primary files:

- `src/runtime/runner.ts`
- `src/schemas/progress-event.ts`
- `docs/contracts/host-rendering.md`
- `tests/runner/cli-router.test.ts`

### REL-021: Improve Build Plan Quality

Problem:
Build planning can look mechanical. It should visibly reduce uncertainty before
implementation.

Recommended plan report content:

- Objective and success criteria.
- Likely files or areas.
- Verification rationale.
- Risks or assumptions.
- What Circuit is intentionally not changing.

Why users care:
If the plan feels boilerplate, the whole run feels like ceremony. The plan is a
chance to prove Circuit is structuring work, not just wrapping a prompt.

Primary files:

- `src/flows/build/writers/plan.ts`
- `src/flows/build/reports.ts`
- `tests/`

### REL-022: Clarify Verification Scope And Environment

Problem:
Verification is secure and deterministic, but real project checks may rely on
environment variables that Circuit does not pass through.

Evidence:

- Verification uses `spawnSync` with `shell: false`, timeout, max buffer, cwd
  checks, and a restricted environment allowlist.
- Build's default verification candidate may be narrow, such as `npm run check`.

Why users care:
A verification failure caused by restricted env can look like a project failure.
A verification pass from one narrow command can sound stronger than it is.

Recommendation:
Final summaries should say exactly which commands ran and in what environment
class. Docs should explain how to configure verification commands and env.

Acceptance checks:

- Summary names commands run and pass/fail status.
- Known limits explain restricted verification env.
- Config docs show explicit env allowlist/profile examples if supported.

Primary files:

- `src/runtime/step-handlers/verification.ts`
- `src/flows/build/writers/verification.ts`
- `README.md`
- `docs/contracts/config.md`

### REL-023: Add "Why Not Just Prompt?" Proof

Problem:
The product still risks sounding like a prompt wrapper.

Recommendation:
Add a README/docs section comparing ad-hoc prompting with Circuit across the
operator system, not only Build or Review.

Proof points:

- Fixed work shape.
- Explicit checks.
- Independent review.
- Checkpoints before risky decisions.
- Fewer "what do I do next?" moments because broad plans become a scoped next
  action.
- Saved evidence and summary.
- Resume after interruption.
- Customization through reusable workflows instead of repeated prompt
  copy-paste.

Acceptance checks:

- README answers the skepticism directly.
- The proof links to golden runs across these categories:
  - Doing work: Build or Fix.
  - Deciding: Explore Tournament or `decide:`.
  - Maintenance or migration: Sweep or Migrate.
  - Continuity: Handoff/resume.
  - Customization: `/circuit:create` or custom connector.
- The proof coverage checker treats planned proof as a release blocker until
  real artifacts exist.
- Claims in the proof are backed by implemented behavior, not planned behavior.

Primary files:

- `README.md`
- `docs/first-run.md` if added
- `examples/runs/` if added

### REL-024: Clean Public Naming Without Renaming Internals Yet

Problem:
Public surfaces still use terms that the terminology doc says to avoid.

Public language to prefer:

| Internal-ish | Public |
|---|---|
| relay | worker handoff, worker, or omit |
| trace | activity log or debug log |
| run folder | saved run, run record, or inspection details |
| operator summary | summary |
| connector | worker backend, advanced |
| depth | thoroughness |
| schematic | flow definition, advanced |
| selected_flow | selected work type |
| Legacy bug-fix name | Fix |

Acceptance checks:

- README intro avoids internal terms.
- Default final output avoids internal terms.
- Advanced docs can still use precise runtime terms.
- No runtime rename is required for release unless it reduces confusion.
- The Fix naming decision is explicit in README, command docs, and the parity
  matrix.

Primary files:

- `README.md`
- `commands/*.md`
- `plugins/circuit/skills/run/SKILL.md`
- `docs/terminology.md`
- `src/runtime/operator-summary-writer.ts`

### REL-025: Reorganize Docs Around User Journey

Problem:
Contributor and contract docs are strong, but new-user docs teach
implementation before value.

Recommended docs set:

- `README.md`: product promise, first run, support matrix, links.
- `docs/first-run.md`: one realistic Build run, expected output, failure cases.
- `docs/known-limits.md`: honest current limits.
- `docs/public-release-readiness.md`: this backlog.
- `docs/contracts/*`: maintainer contracts.
- `CONTRIBUTING.md`: one-page contributor map if needed.

Acceptance checks:

- A new user can run one useful thing without reading contracts.
- A contributor can find architecture/contracts without README bloat.
- README distinguishes "start here" from "advanced/maintainer".

Primary files:

- `README.md`
- `docs/`
- `AGENTS.md`

## P2 Items

### REL-026: Native Host Adapters

Problem:
Native host integrations are architecturally sound, but the parity release must
be precise about which host paths are truly first-class and which are
model-mediated.

Recommendation:
If native Codex App Server or Claude Agent SDK support is part of the public
host promise, implement it and prove progress/checkpoint/summary rendering
without relying on model obedience. If not, keep the model-mediated host paths
supported and label native adapters as post-parity host expansion.

Primary files:

- `docs/contracts/native-host-adapters.md`
- `docs/contracts/host-capabilities.md`

### REL-027: Route Policy Hardening Beyond Parity

Problem:
REL-003 covers the route semantics required for shipped parity workflows. Beyond
that, Circuit still needs a cleaner policy model for retry budgets, revision
loops, escalation language, and cross-flow handoff.

Recommendation:
After parity route outcomes execute, harden route policy as an explicit design
layer with tests and user-facing recovery summaries. Do not quietly add behavior
one flow at a time.

Primary files:

- `src/runtime/compile-schematic-to-flow.ts`
- `src/runtime/runner.ts`
- `src/schemas/compiled-flow.ts`
- `src/schemas/flow-schematic.ts`
- `tests/`

### REL-028: Published Package Or Installer

Problem:
Checkout install may be acceptable for internal testing, but public parity
adoption improves with a clean package or plugin installer.

Recommendation:
After first-run experience is stable, decide whether the public artifact is an
npm package, plugin bundle, CLI package, or host-specific installer.

Primary files:

- `package.json`
- `bin/circuit-next`
- `.claude-plugin/`
- `plugins/circuit/`

### REL-029: Report Viewer Or TUI

Problem:
Run records and reports are useful but can be hard to inspect from raw files.

Recommendation:
Later, build a small viewer after the summary format stabilizes. Do not build a
viewer to compensate for unclear summaries.

Primary files:

- `apps/designer/`
- `src/runtime/operator-summary-writer.ts`
- `examples/runs/`

### REL-030: Flow Quality Benchmarks

Problem:
Circuit needs proof that structured flows beat ad-hoc prompting.

Recommendation:
After golden examples, add benchmark tasks or eval fixtures that compare prompt
wrapper behavior with Circuit runs on skipped verification, missing review,
checkpoint decisions, and summary quality.

Primary files:

- `tests/fixtures/`
- `examples/runs/`
- `docs/`

## Right-Now Work Order

If one agent is polishing release readiness, use this order:

1. Capture the golden Explore Tournament proof for `proof:explore-decision`.
2. Implement or block generation for declared rich route outcomes.
3. Finish the custom connector guide with a copy-pasteable file-protocol
   example.
4. Make plan-execution requests continue work through a workflow, checkpoint, or
   exact next command.
5. Add write-capable worker disclosure and doctor-first onboarding.
6. Make final summaries and failure summaries human-first.
7. Add golden release examples across the parity surface.
8. Rewrite README around structured delegation, the parity workflow catalog, and
   proof examples after behavior and fixtures exist.
9. Re-run `npm run verify`, plugin doctor, and audit.

## Acceptance Bar For Public Release

Circuit is ready for a public release when:

- A new user can understand the value in 30 seconds.
- The first run path has one command, one doctor step, and one expected result.
- The README makes clear what works today and what is planned.
- No public docs contradict runtime behavior.
- `npm run check-release-infra` passes with no untracked gaps.
- `npm run check-release-ready` passes; planned proof and known blockers are not
  treated as release-ready.
- Original-Circuit parity is implemented or captured as explicit maintainer-
  approved exceptions.
- Explore, Build, Fix, Migrate, Sweep, Review, Handoff, custom flow creation,
  intent hints, and rigor profiles have current examples or tests.
- The parity matrix covers phase path, artifacts, checkpoint policy, review
  behavior, verification behavior, worker dispatch, continuity, and proof for
  each shipped workflow/mode.
- The Fix naming decision is implemented and reflected in active docs.
- Broad plan-execution requests do not end as analysis-only unless the user
  explicitly asked only for analysis.
- Every non-terminal result has one recommended next action.
- Every shipped workflow and standalone Review produce readable summaries that
  answer:
  - What did Circuit do?
  - What proof did it gather?
  - What risk remains?
  - What should I do next?
- Explore outputs that produce an executable plan either hand off to the
  appropriate workflow or explain the blocking decision.
- Review does not silently relay untracked file contents by default.
- `accept-with-fixes` cannot be mistaken for a clean complete.
- Write-capable worker behavior is disclosed before the first write-capable run.
- Representative runs prove doing work, deciding, maintenance/migration,
  continuity, and customization.
- `npm run verify` passes.
- Plugin doctor passes for the supported host path.
- Audit status is resolved or explicitly documented.

## Evidence Appendix

Use these anchors when validating the backlog. Do not rely on session memory
alone.

- Original Circuit README:
  `/Users/petepetrash/Code/circuit/README.md`
  - Core workflows: Explore, Build, a legacy bug-fix flow, Migrate, Sweep.
  - Utilities: Create, Review, Handoff.
  - Rigor profiles: Lite, Standard, Deep, Tournament, Autonomous.
- Original Circuit catalog:
  `/Users/petepetrash/Code/circuit/CIRCUITS.md`
  - Entry modes by workflow.
  - Workflow phase breakdowns and canonical artifacts.
- Original Circuit router command:
  `/Users/petepetrash/Code/circuit/commands/run.md`
  - Original router hints, with current public vocabulary centered on Fix.
  - Action-first bootstrap contract and continuity handling.
- Original custom circuit docs:
  `/Users/petepetrash/Code/circuit/CUSTOM-CIRCUITS.md`
  - End-user create/publish flow and maintainer hand-authoring path.
- Circuit-next dogfood run for plan execution:
  `/Users/petepetrash/Code/circuit-next/.circuit-next/runs/dfa3528f-2b56-4087-b96f-59ba06d9f830`
  - Completed Explore for "Execute this plan" and produced analysis instead of
    continuing into execution.
- Evidence still to capture:
  - Representative routed Build, explicit Build, Review, checkpoint, abort,
    Migrate, Sweep, Tournament, Handoff, Create, and custom connector runs.
  - Exact abort output that showed raw validation/runtime detail.
  - End-to-end proof that configured skills reach a worker prompt/runtime.

## One-Sentence Positioning

Circuit turns a coding request into a checked, reviewed handoff you can trust
without babysitting.
