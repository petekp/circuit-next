import { describe, expect, it } from 'vitest';

import { buildFanoutAggregateV2 } from '../../src/core-v2/fanout/aggregate-report.js';
import { buildAggregate as buildAggregateFromRuntimePath } from '../../src/runtime/step-handlers/fanout/aggregate.js';
import {
  type FanoutAggregateBody,
  buildFanoutAggregate,
} from '../../src/shared/fanout-aggregate-report.js';

describe('fanout aggregate report compatibility', () => {
  it('keeps the retained fanout aggregate wrapper pointed at the shared helper', () => {
    expect(buildAggregateFromRuntimePath).toBe(buildFanoutAggregate);
  });

  it('builds the durable aggregate report shape from branch outcomes', () => {
    const aggregate = buildFanoutAggregate(
      'pick-winner',
      [
        {
          branch_id: 'a',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          result_path: 'reports/branches/a/result.json',
          duration_ms: 12,
          result_body: { verdict: 'accept', summary: 'accepted' },
        },
        {
          branch_id: 'b',
          child_run_id: '22222222-2222-2222-2222-222222222222',
          child_outcome: 'aborted',
          verdict: '<no-verdict>',
          admitted: false,
          result_path: 'reports/branches/b/result.json',
          duration_ms: 30,
        },
      ],
      'a',
    );

    expect(aggregate).toEqual({
      schema_version: 1,
      join_policy: 'pick-winner',
      branch_count: 2,
      winner_branch_id: 'a',
      branches: [
        {
          branch_id: 'a',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          result_path: 'reports/branches/a/result.json',
          duration_ms: 12,
          result_body: { verdict: 'accept', summary: 'accepted' },
        },
        {
          branch_id: 'b',
          child_run_id: '22222222-2222-2222-2222-222222222222',
          child_outcome: 'aborted',
          verdict: '<no-verdict>',
          admitted: false,
          result_path: 'reports/branches/b/result.json',
          duration_ms: 30,
        },
      ],
    } satisfies FanoutAggregateBody<'pick-winner'>);
  });

  it('keeps core-v2 aggregate output identical to the shared helper', () => {
    const outcomes = [
      {
        branch_id: 'a',
        child_run_id: '11111111-1111-1111-1111-111111111111',
        worktree_path: '/tmp/worktree-a',
        child_outcome: 'complete' as const,
        verdict: 'accept',
        result_path: 'reports/branches/a/result.json',
        result_body: { verdict: 'accept' },
        duration_ms: 4,
        admitted: true,
      },
    ];

    expect(buildFanoutAggregateV2('aggregate-only', outcomes)).toEqual(
      buildFanoutAggregate('aggregate-only', outcomes, undefined),
    );
  });
});
