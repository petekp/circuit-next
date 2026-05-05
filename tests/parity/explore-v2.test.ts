import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RelayConnectorV2 } from '../../src/core-v2/executors/relay.js';
import {
  completedStepIds,
  createSimpleParityExecutors,
  expectCompleteTrace,
  expectedPassStepIds,
  loadCompiledFlowFixture,
  readTrace,
  runSimpleCompiledFlowV2,
  withTempRun,
} from './core-v2-parity-helpers.js';

async function loadTournamentFixture() {
  const bytes = await readFile(
    join(process.cwd(), 'generated', 'flows', 'explore', 'tournament.json'),
  );
  return bytes;
}

describe('explore core-v2 parity', () => {
  it('runs the generated explore default flow through the v2 pass route path', async () => {
    const fixture = await loadCompiledFlowFixture('explore');
    await withTempRun(async (runDir) => {
      const result = await runSimpleCompiledFlowV2({
        flowBytes: fixture.bytes,
        runDir,
        runId: '66666666-6666-4666-8666-666666666666',
        goal: 'Explore a decision with v2',
      });

      expect(result.outcome).toBe('complete');
      await expectCompleteTrace(runDir);
      expect(await completedStepIds(runDir)).toEqual(expectedPassStepIds(fixture.flow));
    });
  });

  it('runs the generated explore tournament fanout through v2 aggregate-only join', async () => {
    const bytes = await loadTournamentFixture();
    const relayConnector: RelayConnectorV2 = {
      async relay(request) {
        const optionId = request.stepId.endsWith('option-1')
          ? 'option-1'
          : request.stepId.endsWith('option-2')
            ? 'option-2'
            : 'option-3';
        return {
          verdict: 'accept',
          option_id: optionId,
          option_label: `Option ${optionId.at(-1)}`,
          case_summary: request.prompt,
          assumptions: [],
          evidence_refs: ['generated fixture'],
          risks: [],
          next_action: 'Continue the parity run.',
        };
      },
    };

    await withTempRun(async (runDir) => {
      const simple = createSimpleParityExecutors();
      const result = await runSimpleCompiledFlowV2({
        flowBytes: bytes,
        runDir,
        runId: '77777777-7777-4777-8777-777777777777',
        goal: 'Choose between options with v2',
        entryModeName: 'tournament',
        relayConnector,
        executors: {
          ...simple,
          compose: async (step, context) => {
            if (step.id === 'decision-options-step') {
              await context.files.writeJson('reports/decision-options.json', {
                decision_question: 'Which option should we choose?',
                options: [
                  { id: 'option-1', best_case_prompt: 'make the case for option 1' },
                  { id: 'option-2', best_case_prompt: 'make the case for option 2' },
                  { id: 'option-3', best_case_prompt: 'make the case for option 3' },
                ],
              });
              return { route: 'pass', details: { report: 'reports/decision-options.json' } };
            }
            const compose = simple.compose;
            if (compose === undefined) throw new Error('missing compose executor');
            return await compose(step, context);
          },
        },
      });

      expect(result.outcome).toBe('complete');
      const trace = await readTrace(runDir);
      expect(trace.find((entry) => entry.kind === 'fanout.joined')?.branches_completed).toBe(3);
      const aggregate = JSON.parse(
        await readFile(join(runDir, 'reports', 'tournament-aggregate.json'), 'utf8'),
      ) as { branch_count: number };
      expect(aggregate.branch_count).toBe(3);
    });
  });
});
