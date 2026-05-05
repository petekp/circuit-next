import { describe, expect, it } from 'vitest';
import {
  completedStepIds,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  runSimpleCompiledFlowV2,
  withTempRun,
} from './core-v2-parity-helpers.js';

describe('sweep core-v2 parity', () => {
  it('runs the generated sweep flow through the v2 pass route path', async () => {
    const fixture = await loadCompiledFlowFixture('sweep');
    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlowV2({
        flowBytes: fixture.bytes,
        runDir,
        runId: '55555555-5555-4555-8555-555555555555',
        goal: 'Sweep cleanup candidates with v2',
      });

      expect(result.outcome).toBe('complete');
      await expectCompleteTrace(runDir);
      expect(await completedStepIds(runDir)).toEqual(expectedPassStepIds(fixture.flow));
    });
  });
});
