---
adr: 0014
title: Non-External Challenger Fallback
status: Accepted
date: 2026-04-25
author: Codex under operator direction
amends:
  - AGENTS.md §Core methodology
  - AGENTS.md §Cross-model challenger protocol
  - AGENTS.md §Hard invariants
  - AGENTS.md §Plan-authoring discipline
  - specs/methodology/decision.md §Methodology Amendments
related:
  - ADR-0009
  - ADR-0010
  - ADR-0012
---

# ADR-0014 - Non-External Challenger Fallback

## Context

The default challenger path uses the external Codex CLI. During the
two-mode methodology hardening plan, that path was blocked by the execution
environment's escalation reviewer even after the operator explicitly approved
the disclosure risk. The block was not a plan objection; it was an access and
policy boundary outside the repo.

Without a fallback, any plan or Heavy slice that needs challenger review can
become permanently stuck even when the operator wants to continue and the
repository can still record an honest adversarial review artifact.

## Decision

Keep the external Codex challenger as the default path.

Allow a **non-external challenger fallback** only when all of these are true:

1. The external challenger attempt was blocked, unavailable, or failed for an
   access/policy reason outside the plan or code under review.
2. The blocked attempt is recorded in the session or review artifact.
3. The operator explicitly authorizes continuing with the non-external path.
4. The review artifact declares:
   - `review_channel: non-external-fallback`
   - `external_attempt: blocked` or `external_attempt: unavailable`
   - `operator_fallback_authorization: <date or quoted instruction>`
   - a short limitations note saying the fallback is weaker than a true
     external cross-model pass.
5. The review still provides objections, severity, fold-ins, and an
   ACCEPT-class or REJECT-class verdict using the existing vocabulary.

For plan lifecycle, the fallback review uses the same plan binding fields as
the external review:

- `plan_slug`
- `plan_revision`
- `plan_base_commit`
- `plan_content_sha256`

For per-slice challenger evidence, the fallback keeps the existing review file
shape, such as `specs/reviews/arc-slice-<N>-codex.md`, but the frontmatter must
identify the non-external channel.

## Consequences

This is not independent corroboration. It is an explicit continuity fallback
when the preferred external path is unavailable.

The fallback must not be used as a convenience shortcut. If the external path
is available, use it. If a fallback review identifies a HIGH finding, fold it in
or stop, just as with an external review.

The ADR-0010 plan lifecycle remains unchanged: plans still move through
challenger-pending, challenger-cleared, operator-signoff, and closed. This ADR
only broadens what can count as the challenger artifact when the external path
is blocked.
