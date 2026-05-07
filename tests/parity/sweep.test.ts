import { describe, expect, it } from 'vitest';
import {
  completedStepIds,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  runSimpleCompiledFlow,
  withTempRun,
} from './runtime-parity-helpers.js';

describe('sweep runtime parity', () => {
  it.each([
    { label: 'default', entryModeName: undefined },
    { label: 'lite', entryModeName: 'lite' },
    { label: 'autonomous', entryModeName: 'autonomous' },
  ])(
    'runs the generated sweep $label flow through the runtime pass route path',
    async ({ entryModeName }) => {
      const fixture = await loadCompiledFlowFixture('sweep');
      await withTempRun(async (runDir) => {
        const result = await runSimpleCompiledFlow({
          flowBytes: fixture.bytes,
          runDir,
          runId: '55555555-5555-4555-8555-555555555555',
          goal: 'Sweep cleanup candidates with runtime',
          ...(entryModeName === undefined ? {} : { entryModeName }),
        });

        expect(result.outcome).toBe('complete');
        await expectCompleteTrace(runDir);
        expect(await completedStepIds(runDir)).toEqual(
          expectedPassStepIds(fixture.flow, entryModeName),
        );
      });
    },
  );
});
