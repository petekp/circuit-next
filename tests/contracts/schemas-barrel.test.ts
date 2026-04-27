// Schemas barrel completeness — every `.ts` file in `src/schemas/`
// (except `index.ts` itself) must be re-exported by the barrel.
//
// The barrel is the public-schema entry point consumed by external
// callers (via `src/index.ts`) and by the cross-package contract
// tests. A new schema file that isn't re-exported is a silent gap:
// barrel consumers won't see the schema even though the deep import
// works. This test prevents that drift mechanically.
//
// Sister test to `catalog-completeness.test.ts`. Catalog-completeness
// enforces structural invariants for the workflow catalog; this one
// enforces the same class of invariant for the schemas package.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMAS_ROOT = 'src/schemas';
const BARREL_PATH = join(SCHEMAS_ROOT, 'index.ts');

function listSchemaModules(): readonly string[] {
  return readdirSync(SCHEMAS_ROOT)
    .filter((entry) => entry.endsWith('.ts') && entry !== 'index.ts')
    .map((entry) => entry.slice(0, -'.ts'.length))
    .sort();
}

describe('schemas barrel completeness', () => {
  it('every src/schemas/<name>.ts is re-exported by src/schemas/index.ts', () => {
    const barrelText = readFileSync(BARREL_PATH, 'utf8');
    const offenders: { readonly module: string; readonly missing: 'export' }[] = [];
    for (const module of listSchemaModules()) {
      // Require an actual `export * from './<name>.js';` line — not a
      // substring match — so a string literal or comment mentioning
      // the path can't satisfy the assertion. Same pattern as the
      // catalog-completeness import check.
      const exportPattern = new RegExp(
        `^\\s*export\\s+\\*\\s+from\\s+['"]\\./${module}\\.js['"]\\s*;?`,
        'm',
      );
      if (!exportPattern.test(barrelText)) {
        offenders.push({ module, missing: 'export' });
      }
    }
    expect(
      offenders,
      'src/schemas/<name>.ts present on disk but not re-exported by src/schemas/index.ts — barrel consumers will silently miss this module',
    ).toEqual([]);
  });
});
