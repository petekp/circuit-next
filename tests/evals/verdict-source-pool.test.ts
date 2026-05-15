import { describe, expect, it } from 'vitest';
import { DEFECT_IDS } from '../../evals/verdict-correctness/defect-taxonomy.ts';
import { renderMarkdownReport } from '../../evals/verdict-correctness/index.ts';
import { summarizeSourcePool } from '../../evals/verdict-correctness/reporting.ts';
import type { EvalCaseResult, EvalSummary } from '../../evals/verdict-correctness/types.ts';

describe('verdict-correctness source pool reporting', () => {
  it('renders source pool counts from old and new result records', () => {
    const results: EvalCaseResult[] = [
      {
        case: {
          source_run_id: 'run-a',
          source_request_path: '.circuit-next/runs/run-a/reports/relay/review.request.json',
          source_subject: 'Explore prompt tuning',
          defect_id: 'control',
          prompt: 'prompt',
          mutation_summary: 'control',
        },
        outcome: { kind: 'connector_error', message: 'not run' },
        score: { kind: 'skipped', reason: 'not run' },
      },
      {
        case: {
          source_run_id: 'run-b',
          source_request_path: '.circuit-next/runs/run-b/reports/relay/review.request.json',
          defect_id: 'control',
          prompt: 'prompt',
          mutation_summary: 'old result without source subject',
        },
        outcome: { kind: 'connector_error', message: 'not run' },
        score: { kind: 'skipped', reason: 'not run' },
      },
      {
        case: {
          source_run_id: 'run-b',
          source_request_path: '.circuit-next/runs/run-b/reports/relay/review.request.json',
          source_subject: ' Release proof review  ',
          defect_id: 'control',
          prompt: 'prompt',
          mutation_summary: 'new result with normalized subject',
        },
        outcome: { kind: 'connector_error', message: 'not run' },
        score: { kind: 'skipped', reason: 'not run' },
      },
    ];

    const sourcePool = summarizeSourcePool(results);
    const summary: EvalSummary = {
      started_at: '2026-05-01T00:00:00.000Z',
      finished_at: '2026-05-01T00:00:01.000Z',
      judge: 'codex',
      wallclock_ms: 1000,
      source_pool: sourcePool,
      per_defect: Object.fromEntries(
        DEFECT_IDS.map((id) => [id, { catches: 0, misses: 0, errors: 0, cases: 0 }]),
      ) as EvalSummary['per_defect'],
      controls: { passes: 0, fails: 0, errors: 0, cases: 0 },
      overall: {
        cases: results.length,
        successful_calls: 0,
        catches: 0,
        misses: 0,
        errors: results.length,
        catch_rate: 0,
        total_duration_ms: 0,
        median_duration_ms: 0,
      },
    };

    const markdown = renderMarkdownReport(results, summary);

    expect(markdown).toContain('Sources: 2');
    expect(markdown).toContain('Distinct subjects: 2');
    expect(markdown).toContain(
      '- Subjects: Explore prompt tuning; Release proof review',
    );
  });
});
