# Morning report — 2026-04-24

Written for you while you slept. Short, direct, no jargon soup.

**Start commit:** 6384460 (slice-57i). **Audit entering:** 32 green / 2 yellow / 0 red.

---

## TL;DR

I continued the Planning Readiness meta-arc autonomously. Plan at
`specs/plans/planning-readiness-meta-arc.md`. Slices 58–62 were on
deck. This report grows as each slice lands.

## What I'm doing

Landing a "plan-lint" tool + audit check + discipline paperwork so
future plans get checked before you sign off, instead of after.

## Each slice — three lines

For every slice I'll write exactly three lines:
- **Done:** what landed
- **Issues:** anything I amended or had to fix, plus root cause
- **Next:** what's next

---

## Slice 58 — plan-lint baseline + Check 36 + fixtures

**Done:** 18 per-rule bad fixtures + 1 legacy "backdating doesn't
work" fixture. New audit Check 36 runs plan-lint on every
committed plan AND verifies operator-signoff commits point back
to a real challenger-cleared predecessor. Test file went from 18
to 42 tests.

**Issues I amended:**

1. Commit body was missing the exact isolation-posture phrase the
   auditor looks for. Amended the commit once (one SHA, no chain
   of amends). Root cause: the exact phrase "Isolation: policy-
   compliant (no implementer separation required)" is only
   documented inside scripts/audit.mjs; a slice author reading
   plan headers wouldn't know that. Noted for a later discipline
   pass — the phrase should live somewhere more findable.

2. Codex challenger pass returned 1 critical + 1 high + 2 medium
   + 1 low findings (REJECT-PENDING-FOLD-INS). I folded them in a
   follow-up slice-58a commit — details below. Root cause of the
   critical was that my first pass at Check 36 only verified the
   predecessor SHA existed; it didn't verify the SHA was actually
   an ancestor of the transition commit or that the predecessor
   plan was at challenger-cleared status. A bad commit pointing
   at any-extant-SHA would have passed. Fixed.

**Slice 58a fold-ins (same session):**
- Check 36 now requires predecessor to be ancestor + at status
  challenger-cleared (fixes the critical).
- Scope promoted honestly from "19 rules" to "22 rules" since
  the code was already running all 22 — added 3 missing fixtures
  for rules #7, #8, #22 (scope-creep fix; HIGH).
- Check 36 now applies the chain check to both operator-signoff
  AND closed plans, and uses `--follow` to handle renames (MED).
- Added a minimal regression test for Check 36 (MED).
- Switched test runner to execFileSync so weird paths don't
  shell-inject (LOW).

**Audit after Slice 58 + 58a:** 33 green / 2 yellow / 0 red. Two
yellows are the fingerprint drift carry-over from Slice 55 (not
touched this session).

**Next:** Slice 59 — adds the `blocked` enforcement-layer
vocabulary to `specs/invariants.json` and strengthens/adds tests
for rules #7, #8, #22.

---

## Slice 59 — invariant rules + blocked escrow

**Done:** Added the `blocked` enforcement-layer key to
`specs/invariants.json`. Codex then pushed back with a HIGH
finding — the slice claimed "JSON is authoritative" but
`scripts/plan-lint.mjs` still had a hardcoded `|| layer === 'blocked'`
escape plus a silent fallback to a 5-key set if the JSON was
missing. Folded in as slice-59a: removed the escape, made
`loadInvariantLayerVocab` fail closed, exported the helpers so
tests can call them directly, and added a regression test
proving that removing `blocked` from the vocab makes rule #7
reject `enforcement_layer: blocked`.

**Issues I fixed:**

1. Same `git add -A` mistake as before — accidentally staged
   `specs/plans/p2-9-second-workflow.md` (intentionally
   untracked per plan). Amended slice-59 commit to remove it.
   **Root cause:** using `git add -A` sweeps up all untracked
   files. Fix for morning-you to know: I'll switch to explicit
   path staging for the remaining slices.

2. When I exported helpers from plan-lint.mjs for the
   regression test, the `main()` call at the bottom of the
   module triggered on import (process.exit(2) because no
   args). **Root cause:** no entry-point guard on `main()`.
   Added `if (import.meta.url === ...)` guard matching the
   pattern in scripts/audit.mjs.

3. ADR-0010 still said the `blocked` extension was "pending
   Slice 59" in prose and frontmatter. Updated to "landed
   Slice 59" + recorded that the fallback cleanup is
   Slice-59a. This fixes Codex's MED-1 about stale authority
   prose.

**Audit after Slice 59 + 59a:** 33 green / 2 yellow / 0 red.
Two yellows still the fingerprint carry-over.

**Next:** Slice 60 — run plan-lint on the flawed P2.9 draft
and record the hit rate vs the 13-finding ledger that Codex
originally filed.

---

## Slice 60 — retroactive proof on the P2.9 flawed draft

*Pending.*

---

## Slice 61 — memory rule + CLAUDE.md discipline line

*Pending.*

---

## Slice 62 — arc-close composition review

*Pending.*

---

## Things you might want to revert

*Will list any amended commits, inferred decisions, or unusual calls.*
