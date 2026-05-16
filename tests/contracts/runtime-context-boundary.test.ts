import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('runtime context boundary', () => {
  it('does not thread compiledFlow through production run or resume context', () => {
    expect(source('src/runtime/run/run-context.ts')).not.toContain('compiledFlow');
    expect(source('src/runtime/run/graph-runner.ts')).not.toContain('compiledFlow');
    expect(source('src/runtime/run/compiled-flow-runner.ts')).not.toContain('compiledFlow:');
    expect(source('src/runtime/run/checkpoint-resume.ts')).not.toContain('compiledFlow:');
  });
});
