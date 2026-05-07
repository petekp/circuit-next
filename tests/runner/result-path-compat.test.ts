import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resultPath, writeResult } from '../../src/runtime/result-writer.js';
import { RUN_RESULT_RELATIVE_PATH, runResultPath } from '../../src/shared/result-path.js';
import { RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE } from '../../src/shared/retired-runtime-policy.js';

describe('run result path compatibility', () => {
  it('keeps the shared path helper equivalent to the retained runtime helper', () => {
    const runFolder = join('/tmp', 'circuit-run-result-path-test');

    expect(RUN_RESULT_RELATIVE_PATH).toBe('reports/result.json');
    expect(runResultPath(runFolder)).toBe(join(runFolder, 'reports', 'result.json'));
    expect(resultPath(runFolder)).toBe(runResultPath(runFolder));
  });

  it('fails closed for old result writer calls', () => {
    expect(() => writeResult()).toThrow(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
  });
});
