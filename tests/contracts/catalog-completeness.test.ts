// Catalog completeness — structural invariants that bind the real
// `src/workflows/catalog.ts` to the on-disk package layout.
//
// Sister test to `engine-workflow-boundary.test.ts`. The boundary test
// enforces import direction (runtime → catalog only). This test
// enforces shape: every workflow on disk appears in the catalog,
// every catalog entry has the expected files, and every package
// declares its required state in a uniform way.
//
// Where this test does NOT duplicate other coverage:
// - `tests/runner/catalog-derivations.test.ts` already exercises the
//   pure derivation helpers against synthetic packages (duplicate-id
//   throws, duplicate-schema throws, default-package selection). Those
//   throws fire at module load when the real `workflowPackages` is
//   imported, so the real-catalog assertions here would crash before
//   running. We rely on the derivation tests for the failure-case
//   coverage and use this file for the cross-cutting structural
//   invariants the derivation tests can't see (file layout, schema-
//   identity, cross-validator scope).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { workflowPackages } from '../../src/workflows/catalog.js';

const WORKFLOWS_ROOT = 'src/workflows';

// Files at the workflows root that are NOT workflow-package directories
// (catalog, types, shared schemas/types). Anything else under
// src/workflows/ that isn't in this list is expected to be a package.
const NON_PACKAGE_FILES = new Set(['catalog.ts', 'types.ts']);

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function listPackageDirectories(): readonly string[] {
  const entries: string[] = [];
  for (const entry of readdirSync(WORKFLOWS_ROOT)) {
    // Skip dot-prefixed entries (e.g. .DS_Store, .cache/) — they're
    // never workflow packages and must not flag as "missing from
    // catalog" if a tool drops one in.
    if (entry.startsWith('.')) continue;
    const path = join(WORKFLOWS_ROOT, entry);
    try {
      if (statSync(path).isDirectory()) {
        entries.push(entry);
      }
    } catch {
      // Skip entries that can't be stat'd (race / permission).
    }
  }
  return entries;
}

describe('workflow catalog completeness', () => {
  // Anti-vacuity floor — guards every "every package has X" assertion
  // below from passing vacuously if `workflowPackages` is silently
  // empty (e.g. a refactor that broke catalog imports). Six packages
  // live today: build, explore, fix, migrate, review, sweep.
  it('catalog has the expected non-zero workflow package count', () => {
    expect(
      workflowPackages.length,
      'workflowPackages is unexpectedly small — catalog discovery is likely broken',
    ).toBeGreaterThanOrEqual(6);
  });

  it('every src/workflows/<id>/ directory is registered in the catalog', () => {
    const onDisk = new Set(listPackageDirectories());
    const inCatalog = new Set(workflowPackages.map((pkg) => pkg.id));
    const missing = [...onDisk].filter((id) => !inCatalog.has(id));
    const extra = [...inCatalog].filter((id) => !onDisk.has(id));
    expect(
      { missing, extra },
      'catalog drift — missing means a package directory exists without a catalog entry; extra means catalog references a directory that does not exist',
    ).toEqual({ missing: [], extra: [] });
  });

  it('every src/workflows/ entry that is not a known shared file is a package directory', () => {
    const entries = readdirSync(WORKFLOWS_ROOT).filter((e) => !e.startsWith('.'));
    expect(
      entries.length,
      'src/workflows/ has unexpectedly few entries — discovery loop is likely broken',
    ).toBeGreaterThanOrEqual(6);
    const offenders: string[] = [];
    for (const entry of entries) {
      const path = join(WORKFLOWS_ROOT, entry);
      if (statSync(path).isDirectory()) continue;
      if (NON_PACKAGE_FILES.has(entry)) continue;
      offenders.push(entry);
    }
    expect(
      offenders,
      'unexpected file at the workflows root: only catalog.ts/types.ts plus package directories belong here',
    ).toEqual([]);
  });

  it('every workflow package has an index.ts file at its directory root', () => {
    const offenders: string[] = [];
    for (const pkg of workflowPackages) {
      if (!isFile(join(WORKFLOWS_ROOT, pkg.id, 'index.ts'))) {
        offenders.push(pkg.id);
      }
    }
    expect(
      offenders,
      'missing or non-file index.ts — workflow packages must export their package via index.ts',
    ).toEqual([]);
  });

  it('every workflow package declares a recipe path that points to a real file', () => {
    const offenders: { readonly id: string; readonly recipe: string }[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.paths.recipe.length === 0) {
        offenders.push({ id: pkg.id, recipe: '<empty>' });
        continue;
      }
      if (!isFile(pkg.paths.recipe)) {
        offenders.push({ id: pkg.id, recipe: pkg.paths.recipe });
      }
    }
    expect(
      offenders,
      `recipe path missing or not a regular file — every package's recipe must exist as a file`,
    ).toEqual([]);
  });

  it('declared command and contract paths point to real files when present', () => {
    const offenders: { readonly id: string; readonly path: string; readonly kind: string }[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.paths.command !== undefined && !isFile(pkg.paths.command)) {
        offenders.push({ id: pkg.id, path: pkg.paths.command, kind: 'command' });
      }
      if (pkg.paths.contract !== undefined && !isFile(pkg.paths.contract)) {
        offenders.push({ id: pkg.id, path: pkg.paths.contract, kind: 'contract' });
      }
    }
    expect(
      offenders,
      'optional path declared on package but file is missing or not a regular file on disk',
    ).toEqual([]);
  });

  it('every package that declares dispatchArtifacts ships an artifacts.ts module', () => {
    // A package that registers a dispatch artifact must own the
    // schema. The artifact-schema registry derives from
    // dispatchArtifacts, so an empty / missing artifacts.ts here
    // would mean the schemas live somewhere else (a regression to
    // the pre-2026-04-27 layout).
    const offenders: string[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.dispatchArtifacts.length === 0) continue;
      if (!isFile(join(WORKFLOWS_ROOT, pkg.id, 'artifacts.ts'))) {
        offenders.push(pkg.id);
      }
    }
    expect(
      offenders,
      'package declares dispatchArtifacts but has no <id>/artifacts.ts — schemas must live in the package',
    ).toEqual([]);
  });

  it('every dispatchArtifact schema is referentially identical to an export from the package artifacts.ts', async () => {
    // Catches the regression where a package re-exports schemas from
    // a sibling workflow's artifacts.ts (e.g. `export { BuildBrief }
    // from '../build/artifacts.js'`). The dispatchArtifacts entry's
    // `schema` field would still parse and the file would still
    // exist, but the schema would be owned by a different workflow —
    // exactly the cross-workflow coupling the schema relocation
    // refactor was meant to eliminate.
    const offenders: {
      readonly id: string;
      readonly schemaName: string;
      readonly reason: string;
    }[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.dispatchArtifacts.length === 0) continue;
      const moduleUrl = new URL(`../../src/workflows/${pkg.id}/artifacts.js`, import.meta.url);
      const module: Record<string, unknown> = await import(moduleUrl.href);
      const moduleExports = new Set(Object.values(module));
      for (const artifact of pkg.dispatchArtifacts) {
        if (!moduleExports.has(artifact.schema as unknown as object)) {
          offenders.push({
            id: pkg.id,
            schemaName: artifact.schemaName,
            reason: `dispatchArtifacts.schema is not a reference equal to any export from src/workflows/${pkg.id}/artifacts.ts`,
          });
        }
      }
    }
    expect(
      offenders,
      'dispatch artifact schema came from outside the package — the package must own its dispatch schemas',
    ).toEqual([]);
  });

  it('the catalog imports every package via its local index.js path', () => {
    // Catches the case where someone adds a package to the array
    // without the matching `import { ... } from './<id>/index.js'`
    // statement, or vice versa. We require an actual import line —
    // not a substring match — so a string literal or a comment
    // mentioning the path can't satisfy the assertion.
    const catalogText = readFileSync(join(WORKFLOWS_ROOT, 'catalog.ts'), 'utf8');
    const offenders: { readonly id: string; readonly missing: 'import' }[] = [];
    for (const pkg of workflowPackages) {
      const importPattern = new RegExp(
        `^\\s*import\\s+.*from\\s+['"]\\./${pkg.id}/index\\.js['"]\\s*;?`,
        'm',
      );
      if (!importPattern.test(catalogText)) {
        offenders.push({ id: pkg.id, missing: 'import' });
      }
    }
    expect(
      offenders,
      'package present at runtime but not imported by the static catalog source — catalog.ts must mirror the workflowPackages array via a real import statement',
    ).toEqual([]);
  });

  it('every dispatch artifact schemaName is unique across the catalog', () => {
    // Duplicate schema names would silently drop one of the entries
    // in the artifact-schema registry. The derivation also throws on
    // duplicates (catalog-derivations.test.ts covers it against
    // synthetic packages); this test names the colliding workflow ids
    // for the production catalog so a regression report points at
    // the right file.
    const seen = new Map<string, string[]>();
    for (const pkg of workflowPackages) {
      for (const artifact of pkg.dispatchArtifacts) {
        const owners = seen.get(artifact.schemaName) ?? [];
        owners.push(pkg.id);
        seen.set(artifact.schemaName, owners);
      }
    }
    const duplicates = [...seen.entries()].filter(([, owners]) => owners.length > 1);
    expect(duplicates, 'duplicate dispatch artifact schemaName across packages').toEqual([]);
  });

  // The previous "validator schemaName matches a dispatchArtifact"
  // test became structurally vestigial after co-locating
  // `crossArtifactValidate` on `WorkflowDispatchArtifact` itself —
  // the schemaName is now read off the artifact that owns the
  // validator, so the cross-reference cannot drift. Runtime regressions
  // (validator stops firing for sweep.batch@v1) are caught by
  // `tests/runner/cross-artifact-validators.test.ts` via the registry's
  // lookup-keyed-by-schemaName behavior.

  it('writer resultSchemaName values are unique across all packages and writer slots', () => {
    // Each writer is registered into a per-slot map keyed by
    // resultSchemaName. The catalog-derivation throws on intra-slot
    // collisions (catalog-derivations.test.ts). This test additionally
    // surfaces cross-slot collisions for the same schema (e.g. a
    // synthesis builder and a close builder both claiming to produce
    // 'build.plan@v1') — the runtime would dispatch to whichever was
    // registered first, silently picking a winner.
    const seen = new Map<string, { pkg: string; slot: string }[]>();
    for (const pkg of workflowPackages) {
      for (const slot of ['synthesis', 'close', 'verification', 'checkpoint'] as const) {
        for (const builder of pkg.writers[slot]) {
          const owners = seen.get(builder.resultSchemaName) ?? [];
          owners.push({ pkg: pkg.id, slot });
          seen.set(builder.resultSchemaName, owners);
        }
      }
    }
    const collisions = [...seen.entries()].filter(([, owners]) => owners.length > 1);
    expect(
      collisions,
      'writer resultSchemaName collides across packages or slots — registry order silently picks the winner',
    ).toEqual([]);
  });
});
