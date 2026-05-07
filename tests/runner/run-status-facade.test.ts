import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RunStatusFolderError,
  projectRunStatusFromRunFolder,
} from '../../src/run-status/project-run-folder.js';

describe('run-status public facade', () => {
  it('keeps CLI imports on the neutral status dispatcher after retiring the old wrapper', () => {
    const runsCli = readFileSync(resolve('src/cli/runs.ts'), 'utf8');
    expect(runsCli).toContain("'../run-status/project-run-folder.js'");
    expect(runsCli).not.toContain("'../runtime/run-status-projection.js'");
    expect(existsSync(resolve('src/runtime/run-status-projection.ts'))).toBe(false);
    expect(projectRunStatusFromRunFolder).toEqual(expect.any(Function));
    expect(RunStatusFolderError).toEqual(expect.any(Function));
  });

  it('keeps v2 projection and retired-folder policy outside the public facade', () => {
    const dispatcher = readFileSync(resolve('src/run-status/project-run-folder.ts'), 'utf8');
    expect(dispatcher).toContain("'./v2-run-folder.js'");
    expect(dispatcher).toContain('../shared/retired-runtime-policy.js');
    expect(dispatcher).not.toContain("'./v1-run-folder.js'");
    expect(dispatcher).not.toContain('../compat/retained-checkpoint-folders.js');
    expect(dispatcher).not.toContain('../compat/retained-runtime.js');
    expect(dispatcher).not.toContain('function projectV1RunStatusFromTrace');
    expect(dispatcher).not.toContain('function projectV2RunStatusFromRunFolder');
    expect(dispatcher).not.toContain('../runtime/trace-reader.js');

    const projectionCommon = readFileSync(resolve('src/run-status/projection-common.ts'), 'utf8');
    expect(projectionCommon).toContain('../shared/result-path.js');
    expect(projectionCommon).not.toContain('../runtime/result-writer.js');

    expect(existsSync(resolve('src/run-status/v1-run-folder.ts'))).toBe(false);

    const v2Projector = readFileSync(resolve('src/run-status/v2-run-folder.ts'), 'utf8');
    expect(v2Projector).not.toContain('../runtime/reducer.js');
    expect(v2Projector).not.toContain('../runtime/trace-reader.js');
    expect(v2Projector).not.toContain('../runtime/trace-writer.js');
  });
});
