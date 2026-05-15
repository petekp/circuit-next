import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  RunStatusFolderError,
  projectRunStatusFromRunFolder,
} from '../../src/run-status/project-run-folder.js';

function importsFrom(path: string): string[] {
  const source = readFileSync(resolve(path), 'utf8');
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = [];
  file.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  });
  return imports;
}

describe('run-status public facade', () => {
  it('keeps CLI imports on the neutral status dispatcher', () => {
    const runsCliImports = importsFrom('src/cli/runs.ts');
    expect(runsCliImports).toContain('../run-status/project-run-folder.js');
    expect(runsCliImports.some((specifier) => specifier.startsWith('../runtime/'))).toBe(false);
    expect(existsSync(resolve('src/runtime/run-status-projection.ts'))).toBe(false);
    expect(projectRunStatusFromRunFolder).toEqual(expect.any(Function));
    expect(RunStatusFolderError).toEqual(expect.any(Function));
  });

  it('keeps runtime projection and folder policy outside the public facade', () => {
    const dispatcherImports = importsFrom('src/run-status/project-run-folder.ts');
    expect(dispatcherImports).toContain('./runtime-run-folder.js');
    expect(dispatcherImports).not.toContain('./v1-run-folder.js');
    expect(dispatcherImports.some((specifier) => specifier.startsWith('../compat/'))).toBe(false);
    expect(dispatcherImports).not.toContain('../runtime/trace-reader.js');

    const projectionCommonImports = importsFrom('src/run-status/projection-common.ts');
    expect(projectionCommonImports).toContain('../shared/result-path.js');
    expect(projectionCommonImports).not.toContain('../runtime/result-writer.js');

    expect(existsSync(resolve('src/run-status/v1-run-folder.ts'))).toBe(false);

    const runtimeProjectorImports = importsFrom('src/run-status/runtime-run-folder.ts');
    expect(runtimeProjectorImports).not.toContain('../runtime/reducer.js');
    expect(runtimeProjectorImports).not.toContain('../runtime/trace-reader.js');
    expect(runtimeProjectorImports).not.toContain('../runtime/trace-writer.js');
  });
});
