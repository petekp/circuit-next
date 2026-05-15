import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Circuit launcher contract', () => {
  it("package.json's circuit:run script and bin entry use the direct launcher", () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      bin?: Record<string, string>;
    };

    expect(pkg.scripts?.['circuit:run']).toBe('./bin/circuit-next');
    expect(pkg.bin?.['circuit-next']).toBe('./bin/circuit-next');
  });
});
