import { describe, expect, it } from 'vitest';

import {
  progressDisplay as progressDisplayFromRuntimePath,
  projectTraceEntryToProgress,
  reportProgress as reportProgressFromRuntimePath,
  reportTaskListProgress,
  taskStatusesFromTrace,
} from '../../../src/runtime/progress-projector.js';
import {
  progressDisplay as progressDisplayFromSharedPath,
  reportProgress as reportProgressFromSharedPath,
} from '../../../src/shared/progress-output.js';
import { RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE } from '../../../src/shared/retired-runtime-policy.js';

describe('retired progress projector path', () => {
  it('keeps shared progress helpers as compatibility re-exports', () => {
    expect(progressDisplayFromRuntimePath).toBe(progressDisplayFromSharedPath);
    expect(reportProgressFromRuntimePath).toBe(reportProgressFromSharedPath);
  });

  it('fails closed for old v1 trace projection helpers', () => {
    expect(() => taskStatusesFromTrace()).toThrow(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
    expect(() => reportTaskListProgress()).toThrow(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
    expect(() => projectTraceEntryToProgress()).toThrow(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
  });
});
