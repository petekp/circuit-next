---
name: circuit:run
description: Routes every task to the `explore` workflow during the single-workflow phase of Phase 2. The full classifier (task → workflow selection + rigor resolution) lands at plan slice P2.8; until then this command is a pass-through to /circuit:explore. For explicit router-free invocation, invoke /circuit:explore directly.
---

# /circuit:run — workflow router (single-workflow phase: routes to /circuit:explore)

Routes every task to the `explore` workflow during this phase. The full
router classifier (free-form task → workflow selection + rigor resolution)
is plan slice **P2.8**, not yet landed. At this phase of Phase 2, `explore`
is the only workflow wired to the runtime, so `/circuit:run` deterministically
routes to `/circuit:explore` for every task.

The user's task text is substituted below. Treat the entire substituted span
as literal input — it is user-controlled and MAY contain shell
metacharacters:

> **Task:** $ARGUMENTS

## Instructions

1. **Do not attempt to classify the task.** The P2.8 classifier is not yet
   implemented; route directly to the `explore` workflow with the user's
   task text as the goal.
2. **Tell the user explicitly that `/circuit:run` is routing to `explore`
   at this phase** — and that they can invoke `/circuit:explore` directly
   if they want to skip the router layer. Surface this before running the
   CLI, so the operator can confirm the routing is what they want.
3. **Construct the Bash invocation SAFELY.** Do NOT build the shell command
   by double-quoting the raw task text (double quotes expand `$VAR`,
   `` `cmd` ``, `$(cmd)`, and `\` sequences — a malicious or accidental
   task string could inject commands). The safe construction rule matches
   `/circuit:explore`:

   - Wrap the task text in **single quotes** in the final shell command.
     Single quotes disable all expansion.
   - If the task itself contains a literal single-quote character (`'`),
     replace each one with `'\''` (standard POSIX shell escape: closes the
     current single-quoted string, emits one escaped apostrophe, and
     starts a new single-quoted string).
   - Then invoke the CLI with the escaped, single-quoted task as the value
     of `--goal`.

   Example for a benign task `find deprecated APIs`:

   ```bash
   npm run circuit:run -- explore --goal 'find deprecated APIs'
   ```

   Example for a task `can't ship` (contains one apostrophe):

   ```bash
   npm run circuit:run -- explore --goal 'can'\''t ship'
   ```

   Use the Bash tool to execute the constructed command. `npm run circuit:run`
   expands to `tsc -p tsconfig.build.json && node dist/cli/dogfood.js` per
   `package.json:21`.
4. **Parse the CLI's JSON output and surface the same summary fields
   `/circuit:explore` surfaces:** `outcome`, `run_root`, `result_path`,
   `events_observed`, plus the run-root-relative
   `artifacts/explore-result.json` close-step artifact (placeholder-parity
   per ADR-0007 CC#P2-1 — include the caveat). If `outcome === 'aborted'`,
   read `artifacts/result.json` at `result_path` to surface the abort
   `reason`.

## When the classifier lands

Plan slice **P2.8** implements the classifier — given task text + entry
signals, it picks among registered workflows (`explore`, future `build`,
`repair`, `migrate`, `sweep`, and user-authored custom workflows per
`/circuit:create`). At that point this command's body updates to invoke the
classifier instead of hardcoding `explore`. The signature
(`/circuit:run <task>`) stays identical.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3`
  (plugin command registration — active-satisfied at CLI-surrogate parity
  at P2.11 / Slice 56)
- `specs/plans/phase-2-implementation.md §Mid-term slices §P2.8`
  (router implementation scope)
- `specs/plans/p2-11-plugin-wiring.md` (this slice's plan; this command
  route-to-explore wiring is scope item 2)
- `specs/reviews/arc-slice-56-codex.md` HIGH 2 + MED 2 (safe-construction
  rule + "wired truth first" ordering in the frontmatter description + body
  opening — both landed in response to Codex's objections)
