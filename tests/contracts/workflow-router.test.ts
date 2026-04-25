import { describe, expect, it } from 'vitest';

import { ROUTABLE_WORKFLOWS, classifyWorkflowTask } from '../../src/runtime/router.js';

describe('P2.8 workflow router classifier', () => {
  it('declares the current routable workflow set explicitly', () => {
    expect(ROUTABLE_WORKFLOWS).toEqual(['explore', 'review', 'build']);
  });

  it('routes review/audit-style tasks to the review workflow', () => {
    const cases = [
      'review this patch for safety regressions',
      'please audit the command wiring',
      'critique this migration plan',
      'inspect this diff',
      'check this PR before merge',
      'look for bugs in the runner change',
      'find an issue in this codebase',
      'surface any issues or opportunities',
      'identify bugs in this repo',
      'look for regressions in the runner',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('review');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('routes build-like tasks to the build workflow', () => {
    const cases = [
      'develop: add a focused feature',
      'build a feature for the plugin command surface',
      'implement the command wiring',
      'create a new endpoint',
      'make the focused change',
      'please build a tool for plugin checks',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('build');
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
      'find options for a build workflow',
      'find issue #123 in the tracker',
      'investigate whether to create a new endpoint',
      'explore whether we should implement the command wiring',
      'map options before we add a new integration',
      'build a tool evaluation matrix for parser libraries',
      'create a new endpoint proposal for the auth API',
      'implement the command wiring design doc',
      'implement the command wiring specification',
      'create a new endpoint RFC',
      'build a tool selection memo',
      'develop: create a new endpoint RFC',
      'develop: build a tool selection memo',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('explore');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeUndefined();
    }
  });
});
