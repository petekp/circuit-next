import { describe, expect, it } from 'vitest';

import { ROUTABLE_WORKFLOWS, classifyWorkflowTask } from '../../src/runtime/router.js';

describe('P2.8 workflow router classifier', () => {
  it('declares the current routable workflow set explicitly', () => {
    expect(ROUTABLE_WORKFLOWS).toEqual(['explore', 'review']);
  });

  it('routes review/audit-style tasks to the review workflow', () => {
    const cases = [
      'review this patch for safety regressions',
      'please audit the command wiring',
      'critique this migration plan',
      'inspect this diff',
      'check this PR before merge',
      'look for bugs in the runner change',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('review');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('falls back to explore when no review/audit signal is present', () => {
    const cases = [
      'figure out how the adapter pipeline fits together',
      'investigate options for a build workflow',
      'map the current project state',
      'review possible approaches for the next workflow',
      'inspect the project structure',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('explore');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeUndefined();
    }
  });
});
