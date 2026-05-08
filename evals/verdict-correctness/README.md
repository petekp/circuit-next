# Verdict-Correctness Eval

Internal eval (not for public marketing). Measures whether the explore-flow
review step (`reports/relay/review.request.json` → `reports/review-verdict.json`)
catches mechanically-planted defects in compose outputs.

## What it measures

For each historical explore run, we take its real `review.request.json`
prompt, mutate the compose JSON inside it to inject a known defect, send
the mutated prompt back through the codex connector, and check whether
the reviewer's verdict surfaced the planted defect in `objections` or
`missed_angles`.

Defect catch rate = caught / (caught + missed). Errors are excluded from
the denominator. Per-defect rates expose which failure modes the
reviewer is good at catching and which it lets through.

## Defect taxonomy

| ID | Property the reviewer should be guarding |
| --- | --- |
| `fabricated-evidence-ref` | Evidence groundedness — citations should resolve. |
| `stripped-success-condition-alignment` | Alignment justification, not a vacuous restatement. |
| `wrong-subject` | Subject fidelity — compose subject must match the brief. |
| `added-false-certainty` | Epistemic calibration — claims should not exceed the evidence (no overclaiming). |
| `internal-contradiction` | Internal consistency — the recommendation should not negate itself. |

See `defect-taxonomy.ts` for the planting functions and
`scorer.ts` for the per-defect catch heuristics.

## Running

Build first (the runner imports the codex connector from `dist/`):

```bash
npm run build
```

Then:

```bash
# Full run: every explore review request, every defect, plus controls.
node --experimental-strip-types evals/verdict-correctness/index.ts

# Smaller run for iteration:
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --defects fabricated-evidence-ref --no-control

# Dry run — show planned cases without invoking the LLM:
node --experimental-strip-types evals/verdict-correctness/index.ts \
  --max-composes 3 --dry-run
```

Outputs land in `evals/verdict-correctness/results/<timestamp>/`:

- `partial-results.json` — per-case results, written incrementally
- `results.json` — final per-case results
- `summary.json` — aggregated metrics
- `report.md` — human-readable report

## Cost and wallclock

Each case is one codex subprocess call. Empirically ~50s per case and
~30K input + ~500–1000 output tokens per call.

A full 48-case run is ~40 minutes wallclock and ~$1.50 at codex pricing.

Track cost+wallclock per run to avoid silent suite bloat. The Markdown
report includes both.

## Limitations

- **String-match scoring** is generous on purpose (false negatives are
  the failure mode we guard against), but it can miss reviewer language
  that uses unusual phrasing. Audit misses by hand.
- **Self-grading risk**: the reviewer being judged is the same model
  family that produces composes. A separate-model judge would be a
  fairer test but is out of scope for v0.
- **One-shot mutations**: each defect is planted in isolation. Real
  compose failures often combine multiple subtle issues at once.
- **Codex connector only**: the production explore review step also
  runs through the agent (Claude Code) connector. Add an agent-mode run
  to compare.
