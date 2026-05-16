import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flowPackages } from '../../src/flows/catalog.js';
import type { CompiledFlowProgressSurface } from '../../src/flows/types.js';
import type { TraceEntry } from '../../src/runtime/domain/trace.js';
import { fromCompiledFlow } from '../../src/runtime/manifest/from-compiled-flow.js';
import { createProgressProjector } from '../../src/runtime/projections/progress.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import type { ProgressEvent } from '../../src/schemas/progress-event.js';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RECORDED_AT = '2026-05-15T12:00:00.000Z';

function progressSurfaceFor(flowId: string): CompiledFlowProgressSurface {
  const surface = flowPackages.find((pkg) => pkg.id === flowId)?.runtimeSurface?.progress;
  if (surface === undefined) throw new Error(`missing ${flowId} progress surface`);
  return surface;
}

function trace(entry: Omit<TraceEntry, 'run_id' | 'recorded_at'>): TraceEntry {
  return {
    run_id: RUN_ID,
    recorded_at: RECORDED_AT,
    ...entry,
  };
}

describe('runtime progress projection', () => {
  it('keeps operator copy stable when schematic step titles change', () => {
    const body = JSON.parse(readFileSync(resolve('generated/flows/explore/circuit.json'), 'utf8'));
    for (const step of body.steps) {
      if (step.id === 'synthesize-step') {
        step.title = 'Compose — produce explore.compose (connector-bound relay)';
      }
    }

    const flow = fromCompiledFlow(CompiledFlow.parse(body));
    const progress: ProgressEvent[] = [];
    const projector = createProgressProjector({
      progress: (event) => progress.push(event),
      runDir: '/tmp/circuit-progress-test',
      runId: RUN_ID,
      flow,
      progressSurface: progressSurfaceFor('explore'),
    });

    projector(trace({ sequence: 0, kind: 'run.bootstrapped', flow_id: 'explore' }));
    projector(trace({ sequence: 1, kind: 'step.entered', step_id: 'synthesize-step', attempt: 1 }));
    projector(
      trace({
        sequence: 2,
        kind: 'step.completed',
        step_id: 'synthesize-step',
        attempt: 1,
        route_taken: 'pass',
      }),
    );

    const visibleText = progress.map((event) => event.display.text).join('\n');
    expect(visibleText).toContain('Circuit: Drafting the recommendation...');
    expect(visibleText).toContain('Finished drafting the recommendation.');
    expect(visibleText).not.toContain('explore.compose');
    expect(visibleText).not.toContain('connector-bound relay');

    const taskLists = progress.filter((event) => event.type === 'task_list.updated');
    const lastTaskList = taskLists.at(-1);
    expect(lastTaskList?.tasks.find((task) => task.id === 'synthesize-step')).toMatchObject({
      title: 'Draft the recommendation',
      status: 'completed',
    });
  });
});
