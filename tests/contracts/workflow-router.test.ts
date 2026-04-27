import { describe, expect, it } from 'vitest';

import { ROUTABLE_WORKFLOWS, classifyWorkflowTask } from '../../src/runtime/router.js';

describe('P2.8 workflow router classifier', () => {
  it('declares the current routable workflow set explicitly', () => {
    expect(ROUTABLE_WORKFLOWS).toEqual(['explore', 'review', 'fix', 'build']);
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

  it('routes fix-like tasks to the fix workflow', () => {
    const cases = [
      'fix the foo bug',
      'fix: handle the missing token edge case',
      'please fix the auth regression',
      'patch the leaking handler',
      'debug the flaky integration test',
      'diagnose the failing build',
      'reproduce the missing-token crash',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('fix');
      expect(decision.source).toBe('classifier');
      expect(decision.matched_signal).toBeDefined();
    }
  });

  it('keeps review-style fix-mention goals on review, not fix', () => {
    const cases = [
      'audit this bug fix before merge',
      'find any regressions in the patch',
      'critique the regression repro plan',
    ];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('review');
    }
  });

  it('keeps build-style fix-mention goals on build, not fix', () => {
    const cases = ['build a fix for the auth bug', 'implement the fix for the regression'];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('build');
    }
  });

  it('keeps fix-prefixed planning goals on explore via planning-artifact suppression', () => {
    const cases = ['fix: write a postmortem report', 'diagnose the outage and produce an analysis'];

    for (const task of cases) {
      const decision = classifyWorkflowTask(task);
      expect(decision.workflowName, task).toBe('explore');
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
