# HANDOFF

Last updated: 2026-05-06. The retained-runtime compatibility posture is superseded. There are zero external users, so the v2 work should move toward final cutover instead of preparing more external review packets. Do not continue the Phase 5.60 review-packet path unless a genuinely new ambiguity appears. Group 2 makes retained and v1 run folders fail closed instead of adapting them, Group 3 removes the unused retained/v1 run-status projector, and Group 4 compresses the tracked numbered checkpoint notes into `docs/architecture/v2-checkpoint-history.md`.

Next group: runtime-removal inventory. Start by mapping retained fresh-run fallback, retained direct tests, and old runtime wrappers before deleting more code. Preserve unrelated dirty work in the repo.
