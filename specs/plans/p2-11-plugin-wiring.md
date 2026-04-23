---
plan: p2-11-plugin-wiring
status: closed
opened_at: 2026-04-23
closed_at: 2026-04-23
closed_in_slice: 56
opened_in_session: post-slice-55-arc-open
trigger: |
  Clean-Clone Reality Tranche closed at Slice 55 with 32 green / 2 yellow / 0 red
  and the four-way capability arc choice presented to the operator (plugin wiring /
  P2.8 router / P2-MODEL-EFFORT / P2.9 second workflow). Operator picked plugin
  wiring at arc-open. This slice executes the plugin-CLI wiring scope originally
  authored at `specs/plans/project-holistic-foldins.md §Slice 52 — Plugin-CLI
  wiring (Claude Q5 HIGH 4 / Codex Q4 MED 12)` which was superseded by the
  Clean-Clone Reality Tranche but not executed; the scope is carried forward
  here with the stale slice-numbering corrected (executes as Slice 56, not 52)
  and the wiring path simplified to reflect the actual CLI invocation (the
  package.json `circuit:run` script builds TypeScript then runs
  `node dist/cli/dogfood.js`, so the Slice-55-proposed tsx-IPC-EPERM concern
  does not apply).
authority:
  - specs/plans/project-holistic-foldins.md §Slice 52 (superseded — scope body
    carried forward and revised here; numbering corrected 52 → 56, wiring path
    simplified to reflect the actual compiled-JS CLI invocation, and Codex
    challenger fold-ins — specs/reviews/arc-slice-56-codex.md HIGH 2 + MED 2
    — added)
  - specs/reviews/phase-project-holistic-2026-04-22-claude.md §HIGH 4
    (plugin-as-advertised not reached through production entrypoint)
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md §MED 12
    (plugin manifest registers command anchors but command bodies are "Not
    implemented yet")
  - specs/reviews/arc-clean-clone-reality-composition-review-claude.md
    (ledger entries [3] + [6] + [25] + [31] — defer-to-next-arc-opener triggered
    by this slice)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3
    (plugin command registration close criterion; currently active-red; moves
    to active-satisfied at this slice's close)
  - CLAUDE.md §Hard invariants #6 (Codex challenger required for ratchet change
    + privileged runtime — plugin command binding)
  - User memory `feedback_plans_must_be_persisted.md` (plans persisted before
    execution)
---

# P2.11 Plugin-CLI Wiring

Connect `/circuit:explore` through to the working CLI at `src/cli/dogfood.ts`
so that a plugin user invoking the slash command in Claude Code actually runs
the explore pipeline and sees canonical run artifacts, not placeholder text.

## Single-slice scope

This is a single-slice arc opener. Slice framing + scope follow.

### Slice 56 — Plugin-CLI wiring (P2.11; Claude H4 / Codex M12)

**Lane:** Ratchet-Advance (capability: plugin `/circuit:explore` reaches the
functional pipeline; closes the plugin-surface-vs-runtime seam and advances
CC#P2-3 from active-red to active-satisfied).

**Failure mode addressed:** `.claude-plugin/commands/circuit-run.md:8-18` and
`.claude-plugin/commands/circuit-explore.md:8-17` return "Not implemented yet."
A plugin user invoking `/circuit:explore` in Claude Code gets placeholder text.
The functional pipeline lives at `src/cli/dogfood.ts::main` and is reachable
only via `npm run circuit:run` — an npm-script invocation that requires cloning
the repo. The plugin-advertised surface (two slash commands) does not connect
to the runtime that actually works. CC#P2-3 (plugin command registration) is
"active — red" under honest accounting. Additionally, four project-holistic
ledger entries bundle to this slice: [3] (Claude HIGH 4 — plugin-as-advertised),
[6] (Claude MED 3 — manifest description divergence), [25] (Codex Q2-LOW 5 —
command body describes pre-ADR-0009 adapter architecture), [31] (Codex Q4-MED 12
— both command bodies are placeholder).

**Acceptance evidence:**
- `/circuit:explore <goal>` invoked in a Claude Code session routes through the
  explore pipeline and produces canonical run artifacts (`runs/<id>/events.jsonl`
  or `.circuit-next/runs/<id>/events.ndjson` per runner convention, plus
  `artifacts/explore-result.json`).
- `specs/reviews/p2-11-invoke-evidence.md` records the live invocation: exact
  command invoked, run_root produced, artifact fingerprints (sha256 of
  `artifacts/explore-result.json`), CC#P2-3 close-criterion state transition.
- `tests/runner/plugin-command-invocation.test.ts` asserts:
  (a) `circuit-explore.md` body references the CLI invocation (contains
  `npm run circuit:run` OR `node dist/cli/dogfood.js`);
  (b) `circuit-run.md` body either references `/circuit:explore` for routing
  OR carries the deliberate "P2.8" pointer with explore-command link;
  (c) neither file contains the placeholder string `"Not implemented yet"`.
- `scripts/audit.mjs` Check 23 (`checkPluginCommandClosure`) extended to reject
  the `"Not implemented yet"` placeholder substring in command bodies once
  CC#P2-3 is marked active-satisfied.
- `.claude-plugin/plugin.json` description + per-command descriptions rewritten
  to match the wired state (not "P2.2 scaffold").

**Alternate framing:**
- **(a) Author a Claude Code SKILL.md file under `.claude-plugin/skills/` +
  register it via plugin.json `skills` array.** Rejected — this repo uses
  `.claude-plugin/skills/` for circuit workflow fixtures (e.g.,
  `.claude-plugin/skills/explore/circuit.json`); adding a SKILL.md alongside
  would conflict semantically with the existing fixture-only convention.
  The slash-command body IS the Claude prompt at invocation time — putting
  the CLI invocation instruction directly in the command body is the simpler
  composition path.
- **(b) Wire via a hook that intercepts `/circuit:explore` and dispatches the
  CLI.** Rejected — hooks are for automated behaviors; slash commands should
  deliver their functionality directly.
- **(c) Rewrite `src/cli/dogfood.ts` as a TypeScript-compiled bin that the
  command file invokes.** Rejected because it is already compiled
  (`npm run build` produces `dist/cli/dogfood.js` which `npm run circuit:run`
  invokes directly) — no additional build infrastructure needed; the existing
  invocation path is portable.

**Trajectory check:**
- *Arc goal:* open capability arc by closing the single largest operator-visible
  gap — plugin advertises slash commands whose bodies say "Not implemented yet"
  while the real pipeline runs only via `npm run circuit:run`. A plugin user
  installing circuit-next today cannot invoke its advertised surface.
- *Phase goal:* CC#P2-3 moves from active-red to active-satisfied at the
  clean-clone-portable + honest-dispatch baseline that the Clean-Clone Reality
  Tranche produced. One of Phase 2's three remaining red close criteria
  resolves at this slice.
- *Prior-slice terrain:* Slice 42 landed real agent adapter; Slice 45 landed
  codex adapter; Slice 43c closed the explore-e2e fixture; Slice 52 made the
  CLI portable on clean clones (compiled-JS binding via `npm run build`);
  Slice 53 made dispatch verdicts honest; Slice 54 made artifact writes honest;
  Slice 55 closed the arc. No earlier slice has made this slice smaller or
  obsolete — the portable + honest baseline is precisely what makes plugin
  wiring load-bearing rather than papering over the reality gap.

**Scope:**
1. Rewrite `.claude-plugin/commands/circuit-explore.md` body: remove "Not
   implemented yet" placeholder; replace with instructions that tell Claude
   to (a) extract the goal from `$ARGUMENTS`, (b) invoke
   `npm run circuit:run -- explore --goal "<goal>"`, (c) parse the JSON output
   for `run_root` / `outcome` / `events_observed` / `result_path`, (d) surface
   the result summary to the user. Update any references to pre-ADR-0009
   adapter architecture (closes ledger entry [25]).
2. Rewrite `.claude-plugin/commands/circuit-run.md` body: remove "Not implemented
   yet" placeholder per option (a) of the plan — route to `/circuit:explore` for
   now (single-workflow phase) with a deliberate note that router classification
   lands at P2.8 (closes ledger entry [31]).
3. Amend `.claude-plugin/plugin.json`: top-level description updated to remove
   "Phase 2 scaffold" language; per-command descriptions updated to match the
   wired state (closes ledger entry [6]).
4. New test file `tests/runner/plugin-command-invocation.test.ts` per
   acceptance-evidence assertions above.
5. Extend `scripts/audit.mjs` Check 23 (`checkPluginCommandClosure`) to reject
   the `"Not implemented yet"` placeholder substring once the placeholder has
   been removed from the command bodies (the literal-substring check keeps the
   audit cheap; the intent is to prevent regression, not detect semantic
   drift).
6. Author `specs/reviews/p2-11-invoke-evidence.md` with the live invocation
   transcript — exact command invoked, run_root, artifact sha256, CC#P2-3
   state transition.

**Ratchet:** Contract-test count advances (+N from new tests in scope item 4).
Audit-coverage advances (Check 23 tightening — scope item 5). CC#P2-3 moves
from active-red to active-satisfied.

**Codex challenger:** REQUIRED (CLAUDE.md §Hard invariants #6 — plugin command
binding is a privileged runtime surface change + this is a ratchet-advancing
slice). Dispatched via `/codex` skill with the staged diff pre-commit. Objection
list filed at `specs/reviews/arc-slice-56-codex.md` (or equivalent Codex
challenger filename per existing convention). Commit body carries the literal
"Codex challenger: REQUIRED" per audit Check 35.

## Arc-close discipline

This is a single-slice arc. No arc-close composition review is required per
CLAUDE.md §Cross-slice composition review cadence ("arc spanning ≥ 3 slices").
The per-slice Codex challenger pass IS the review for this capability.

## Close criterion

Plan transitions to `status: closed + closed_at: <date> + closed_in_slice: 56`
at the slice commit.
