import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resultPath } from '../../src/runtime/result-writer.js';
import { RUN_RESULT_RELATIVE_PATH, runResultPath } from '../../src/shared/result-path.js';

describe('run result path compatibility', () => {
  it('keeps the shared path helper equivalent to the retained runtime helper', () => {
    const runFolder = join('/tmp', 'circuit-run-result-path-test');

    expect(RUN_RESULT_RELATIVE_PATH).toBe('reports/result.json');
    expect(runResultPath(runFolder)).toBe(join(runFolder, 'reports', 'result.json'));
    expect(resultPath(runFolder)).toBe(runResultPath(runFolder));
  });
});
