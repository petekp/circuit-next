# Morning Report — Exception Template

<!--
Use this template when there is something the operator needs to know
before signing off on the overnight autonomy window. If the four
sections below are all genuinely empty, use the "Ratified — nothing
to report" line and nothing else.

Hard rules:
- This template is capped at 60 lines total including headers, blank
  lines, and this comment block. Exceeding the cap is a review-level
  red flag: either too much happened autonomously (operator needs
  wider review, not a longer report) or prose is padded (cut it).
- Enforcement is review, not audit. The 60-line cap is the signal to
  stop writing and escalate instead of absorb into the report.
- Copy the file to `specs/session-notes/morning-report-<YYYY-MM-DD>.md`
  and fill only the sections that have content; delete the rest.
- Sections are intentionally terse. Link out for detail.
-->

## Amends

<!--
List every commit amended during the window and why. Amending is
pre-authorized for same-slice authoring-window fixes; still surface
it so the operator sees what moved in ratified history.
Format per line: `<short-sha> — <amend reason>`.
-->

- _(none)_

## Inferred operator decisions

<!--
List decisions taken autonomously that an operator would normally
make. For each: what was decided, the directive basis (operator
quote or prior memory), and how it is reversible.
Format per entry: 3 short sentences max.
-->

- _(none)_

## Revert candidates

<!--
List commits the operator should consider reverting. For each:
short-sha, subject, one-sentence reason. Surface; do not revert.
-->

- _(none)_

## Ratified — nothing to report

<!-- Use only when Amends + Inferred decisions + Revert candidates
are all genuinely empty. One line: "No exceptions. <N> slices landed
under ordinary discipline." -->
