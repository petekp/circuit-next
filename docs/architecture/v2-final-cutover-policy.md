# Core-v2 Final Cutover Policy

Date: 2026-05-06

## Decision

The retained-runtime compatibility posture is superseded. There are zero
external users, so the product should move to a final cutover instead of
preserving old runtime compatibility for outside callers.

Do not prepare more external review packets by default. The Phase 5.60 review
packet path stops here unless a genuinely new ambiguity appears.

## Numbered Groups

1. Policy reset only. Done.
2. Code cutover. Done: retained and v1 run folders fail closed with exactly:

   ```text
   This run folder was created by the retired runtime. Start a fresh run.
   ```

3. Dead adapter cleanup. Done: the unused retained/v1 run-status projector is
   deleted. Retained fresh-run internals stay in place until a separate runtime
   removal batch.
4. Doc compression. Done: the tracked numbered checkpoint notes are compressed
   into `docs/architecture/v2-checkpoint-history.md`.

## Guardrails

- Do not add an adapter for v1 run folders.
- Do not delete the 100+ checkpoint docs during the policy reset or code
  cutover groups.
- Batch work by numbered group, not tiny migration slices.
- Use local adversarial self-review before each numbered group.
- Preserve unrelated dirty work while cutting over.

## Immediate Next Step

Choose the next runtime-removal batch. The likely next move is to inventory the
retained fresh-run fallback, retained direct tests, and old runtime wrappers now
that old run folders fail closed.
