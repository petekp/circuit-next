import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { projectTraceEntryToProgress } from '../../../src/runtime/progress-projector.js';
import type { CompiledFlow } from '../../../src/schemas/compiled-flow.js';
import { RunId, StepId } from '../../../src/schemas/ids.js';
import { ProgressEvent } from '../../../src/schemas/progress-event.js';
import type { TraceEntry } from '../../../src/schemas/trace-entry.js';

const flow = {
  id: 'review',
  steps: [
    { id: 'frame', title: 'Frame' },
    { id: 'audit', title: 'Audit' },
  ],
} as unknown as CompiledFlow;
const RUN_ID = RunId.parse('84000000-0000-0000-0000-000000000001');
const AUDIT_STEP_ID = StepId.parse('audit');

function project(input: {
  readonly runFolder: string;
  readonly taskStatuses?: Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
  readonly traceEntry: TraceEntry;
}): Array<ProgressEvent> {
  const events: ProgressEvent[] = [];
  projectTraceEntryToProgress({
    progress: (event) => events.push(ProgressEvent.parse(event)),
    runFolder: input.runFolder,
    flow,
    runId: RUN_ID,
    taskStatuses:
      input.taskStatuses ??
      new Map([
        ['frame', 'pending'],
        ['audit', 'pending'],
      ]),
    traceEntry: input.traceEntry,
  });
  return events;
}

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'circuit-progress-projector-'));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('progress projector', () => {
  it('projects step lifecycle trace entries to progress and task updates', () => {
    const started = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 1,
        recorded_at: '2026-04-24T15:00:00.000Z',
        run_id: RUN_ID,
        kind: 'step.entered',
        step_id: AUDIT_STEP_ID,
        attempt: 1,
      },
    });
    expect(started.map((event) => event.type)).toEqual(['step.started', 'task_list.updated']);
    expect(started[0]).toMatchObject({ type: 'step.started', step_title: 'Audit', attempt: 1 });

    const completed = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 2,
        recorded_at: '2026-04-24T15:00:01.000Z',
        run_id: RUN_ID,
        kind: 'step.completed',
        step_id: AUDIT_STEP_ID,
        attempt: 1,
        route_taken: 'pass',
      },
    });
    expect(completed.map((event) => event.type)).toEqual(['step.completed', 'task_list.updated']);
    expect(completed[0]).toMatchObject({
      type: 'step.completed',
      step_title: 'Audit',
      route_taken: 'pass',
    });

    const aborted = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 3,
        recorded_at: '2026-04-24T15:00:02.000Z',
        run_id: RUN_ID,
        kind: 'step.aborted',
        step_id: AUDIT_STEP_ID,
        attempt: 2,
        reason: 'handler threw',
      },
    });
    expect(aborted.map((event) => event.type)).toEqual(['step.aborted', 'task_list.updated']);
    expect(aborted[0]).toMatchObject({ type: 'step.aborted', reason: 'handler threw' });
  });

  it('projects relay trace entries with connector payload fields', () => {
    const started = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 1,
        recorded_at: '2026-04-24T15:00:00.000Z',
        run_id: RUN_ID,
        kind: 'relay.started',
        step_id: AUDIT_STEP_ID,
        attempt: 1,
        role: 'reviewer',
        connector: { kind: 'builtin', name: 'claude-code' },
        resolved_from: { source: 'default' },
        resolved_selection: { skills: [], invocation_options: {} },
      },
    });
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      type: 'relay.started',
      connector_name: 'claude-code',
      connector_kind: 'builtin',
      filesystem_capability: 'trusted-write',
      role: 'reviewer',
    });

    const completed = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 2,
        recorded_at: '2026-04-24T15:00:01.000Z',
        run_id: RUN_ID,
        kind: 'relay.completed',
        step_id: AUDIT_STEP_ID,
        attempt: 1,
        verdict: 'NO_ISSUES_FOUND',
        duration_ms: 42,
        result_path: 'relay/result.json',
        receipt_path: 'relay/receipt.json',
      },
    });
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      type: 'relay.completed',
      verdict: 'NO_ISSUES_FOUND',
      duration_ms: 42,
    });
  });

  it('projects report-written evidence warnings from report bodies', () => {
    const reportPath = 'reports/review-result.json';
    mkdirSync(dirname(join(tempRoot, reportPath)), { recursive: true });
    writeFileSync(
      join(tempRoot, reportPath),
      JSON.stringify({
        evidence: [{ path: 'trace.jsonl' }],
        evidence_warnings: [{ kind: 'missing-file', message: 'proof not found' }],
      }),
    );

    const events = project({
      runFolder: tempRoot,
      traceEntry: {
        schema_version: 1,
        sequence: 1,
        recorded_at: '2026-04-24T15:00:00.000Z',
        run_id: RUN_ID,
        kind: 'step.report_written',
        step_id: AUDIT_STEP_ID,
        attempt: 1,
        report_path: reportPath,
        report_schema: 'review.result@v1',
      },
    });

    expect(events.map((event) => event.type)).toEqual(['evidence.collected', 'evidence.warning']);
    expect(events[0]).toMatchObject({ type: 'evidence.collected', warning_count: 1 });
    expect(events[1]).toMatchObject({
      type: 'evidence.warning',
      warning_kind: 'missing-file',
      message: 'proof not found',
    });
  });
});
