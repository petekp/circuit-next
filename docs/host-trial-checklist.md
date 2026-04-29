# Circuit Host Trial Checklist

Use this checklist before saying the Codex or Claude Code host experience is
ready for broader use.

## Setup

- Refresh generated host output.
- Refresh the installed Codex plugin cache.
- Run Codex doctor from a normal temp repo.
- Confirm `circuit-next` on PATH is the expected checkout.

## Codex Scenarios

- Routed Build: run `Circuit:run` with a plain implementation request and
  confirm the router selects Build.
- Explicit Build: run `Circuit:run build` for the same kind of change.
- Review: review a real uncommitted diff and confirm evidence warnings are
  visible when present.
- Explore: ask for an architectural recommendation and confirm the final summary
  is useful without opening raw reports.
- Checkpoint: exercise a checkpointing run and confirm the question/choice is
  understandable.
- Failure: force a verification failure and confirm the final summary explains
  what failed and where to look.

## Claude Code Scenarios

- Routed Build: invoke the generated command with a plain implementation request
  and confirm the router selects Build.
- Explicit Build: invoke the Build command directly.
- Review: review a real uncommitted diff and confirm evidence warnings are
  visible when present.
- Explore: ask for an architectural recommendation and confirm the final summary
  is useful without opening raw reports.
- Checkpoint: confirm AskUserQuestion or the closest native question tool is used
  when available.
- Failure: force a verification failure and confirm the final summary explains
  what failed and where to look.

## What To Grade

- Did Circuit take work off the operator's plate?
- Was the selected flow obvious?
- Were progress updates helpful without becoming noisy?
- Did the host distinguish itself from the worker connector?
- Did verification and review actually run?
- Could the operator understand the outcome from the final summary alone?
- Were deeper report paths available without dominating the thread?

