import { describe, expect, it } from 'vitest';

import { ProgressEvent } from '../../src/schemas/progress-event.js';

const BASE = {
  schema_version: 1,
  run_id: '86000000-0000-0000-0000-000000000001',
  flow_id: 'review',
  recorded_at: '2026-04-28T12:00:00.000Z',
  label: 'Progress label',
} as const;

describe('progress event schema', () => {
  it('accepts the host-facing progress event set', () => {
    const events = [
      { ...BASE, type: 'run.started', run_folder: '/tmp/run' },
      {
        ...BASE,
        type: 'route.selected',
        selected_flow: 'review',
        routed_by: 'classifier',
        router_reason: 'matched review',
        router_signal: 'change review request',
      },
      {
        ...BASE,
        type: 'step.started',
        step_id: 'intake-step',
        step_title: 'Intake',
        attempt: 1,
      },
      {
        ...BASE,
        type: 'step.completed',
        step_id: 'intake-step',
        step_title: 'Intake',
        attempt: 1,
        route_taken: 'pass',
      },
      {
        ...BASE,
        type: 'step.aborted',
        step_id: 'intake-step',
        step_title: 'Intake',
        attempt: 1,
        reason: 'failed',
      },
      {
        ...BASE,
        type: 'evidence.collected',
        step_id: 'intake-step',
        report_path: 'reports/review-intake.json',
        report_schema: 'review.intake@v1',
        warning_count: 1,
      },
      {
        ...BASE,
        type: 'evidence.warning',
        step_id: 'intake-step',
        report_path: 'reports/review-intake.json',
        warning_kind: 'diff_truncated',
        message: 'staged diff was truncated',
      },
      {
        ...BASE,
        type: 'relay.started',
        step_id: 'audit-step',
        step_title: 'Independent Audit',
        attempt: 1,
        role: 'reviewer',
        connector_name: 'claude-code',
        connector_kind: 'builtin',
        filesystem_capability: 'trusted-write',
      },
      {
        ...BASE,
        type: 'relay.completed',
        step_id: 'audit-step',
        step_title: 'Independent Audit',
        attempt: 1,
        verdict: 'NO_ISSUES_FOUND',
        duration_ms: 1,
      },
      {
        ...BASE,
        type: 'checkpoint.waiting',
        step_id: 'frame-step',
        request_path: 'reports/checkpoints/frame-step-request.json',
        allowed_choices: ['continue'],
      },
      { ...BASE, type: 'run.completed', outcome: 'complete', result_path: '/tmp/run/result.json' },
      {
        ...BASE,
        type: 'run.aborted',
        outcome: 'aborted',
        result_path: '/tmp/run/result.json',
        reason: 'failed',
      },
    ];

    for (const event of events) {
      expect(ProgressEvent.safeParse(event).success, event.type).toBe(true);
    }
  });
});
