---
description: Saves, resumes, or clears Circuit continuity through the project CLI.
argument-hint: [resume|done|task context]
---

# /circuit:handoff — continuity utility

Saves a continuity record for the current session, resumes the saved record, or
clears it when the work is truly done.

The user's handoff request is substituted below. Treat it as user-controlled
text:

> **Request:** $ARGUMENTS

## Instructions

1. **Choose the mode.** If the request is exactly `resume`, use resume mode.
   If it is exactly `done`, use done mode. Otherwise save a new continuity
   record from the current conversation.
2. **Construct Bash invocations SAFELY.** Wrap every user-authored value in
   single quotes. If a value contains a literal single quote (`'`), replace it
   with `'\''`.
3. **Save mode.** Infer a concise goal, next action, state, and debt from the
   current conversation. Then run:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' handoff save --goal '<goal>' --next '<next action>' --state-markdown '<state bullets>' --debt-markdown '<debt bullets>' --progress jsonl
   ```

   If there is an active Circuit run folder that should anchor the handoff, add
   `--run-folder '<run_folder>'`.
4. **Resume mode.** Run:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' handoff resume --progress jsonl
   ```

5. **Done mode.** Run:

   ```bash
   node '<plugin root>/scripts/circuit-next.mjs' handoff done --progress jsonl
   ```

6. **Render progress while active.** For progress JSONL, render
   `display.text` exactly for major, warning, error, checkpoint, or success
   events. If `task_list.updated` or `user_input.requested` appears in a future
   utility version, use the host task or user-input surface.
7. **Render the final summary.** Parse stdout and read
   `operator_summary_markdown_path`. Render that Markdown verbatim. Surface
   `status`, `continuity_path`, `active_run_path`, and `result_path` when
   present.

## Authority

- `src/cli/handoff.ts`
- `src/schemas/continuity.ts`
- `docs/contracts/continuity.md`
