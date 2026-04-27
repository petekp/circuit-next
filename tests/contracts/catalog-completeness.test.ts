// Catalog completeness — structural invariants that bind the real
// `src/workflows/catalog.ts` to the on-disk package layout.
//
// Sister test to `engine-workflow-boundary.test.ts`. The boundary test
// enforces import direction (runtime → catalog only). This test
// enforces shape: every workflow on disk appears in the catalog,
// every catalog entry has the expected files, and every package
// declares its required state in a uniform way.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { workflowPackages } from '../../src/workflows/catalog.js';

const WORKFLOWS_ROOT = 'src/workflows';

// Files at the workflows root that are NOT workflow-package directories
// (catalog, types, shared schemas/types). Anything else under
// src/workflows/ that isn't in this list is expected to be a package.
const NON_PACKAGE_FILES = new Set(['catalog.ts', 'types.ts']);

function listPackageDirectories(): readonly string[] {
  const entries: string[] = [];
  for (const entry of readdirSync(WORKFLOWS_ROOT)) {
    const path = join(WORKFLOWS_ROOT, entry);
    if (statSync(path).isDirectory()) {
      entries.push(entry);
    }
  }
  return entries;
}

describe('workflow catalog completeness', () => {
  it('every src/workflows/<id>/ directory is registered in the catalog', () => {
    const onDisk = new Set(listPackageDirectories());
    const inCatalog = new Set(workflowPackages.map((pkg) => pkg.id));
    const missing = [...onDisk].filter((id) => !inCatalog.has(id));
    const extra = [...inCatalog].filter((id) => !onDisk.has(id));
    expect(
      { missing, extra },
      `catalog drift — missing means a package directory exists without a catalog entry; extra means catalog references a directory that does not exist`,
    ).toEqual({ missing: [], extra: [] });
  });

  it('every src/workflows/ entry that is not a known shared file is a package directory', () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(WORKFLOWS_ROOT)) {
      const path = join(WORKFLOWS_ROOT, entry);
      if (statSync(path).isDirectory()) continue;
      if (NON_PACKAGE_FILES.has(entry)) continue;
      offenders.push(entry);
    }
    expect(
      offenders,
      `unexpected file at the workflows root: only catalog.ts/types.ts plus package directories belong here`,
    ).toEqual([]);
  });

  it('every workflow package id is unique', () => {
    const seen = new Map<string, number>();
    for (const pkg of workflowPackages) {
      seen.set(pkg.id, (seen.get(pkg.id) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicates, `duplicate workflow package ids in catalog`).toEqual([]);
  });

  it('every workflow package has an index.ts at its directory root', () => {
    const offenders: string[] = [];
    for (const pkg of workflowPackages) {
      if (!existsSync(join(WORKFLOWS_ROOT, pkg.id, 'index.ts'))) {
        offenders.push(pkg.id);
      }
    }
    expect(offenders, `missing index.ts — workflow packages must export their package via index.ts`).toEqual([]);
  });

  it('every workflow package declares a recipe path that points to a real file', () => {
    const offenders: { readonly id: string; readonly recipe: string }[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.paths.recipe.length === 0) {
        offenders.push({ id: pkg.id, recipe: '<empty>' });
        continue;
      }
      if (!existsSync(pkg.paths.recipe)) {
        offenders.push({ id: pkg.id, recipe: pkg.paths.recipe });
      }
    }
    expect(
      offenders,
      `recipe path missing or absent on disk — every package's recipe must exist`,
    ).toEqual([]);
  });

  it('declared command and contract paths point to real files when present', () => {
    const offenders: { readonly id: string; readonly path: string; readonly kind: string }[] = [];
    for (const pkg of workflowPackages) {
      if (pkg.paths.command !== undefined && !existsSync(pkg.paths.command)) {
        offenders.push({ id: pkg.id, path: pkg.paths.command, kind: 'command' });
      }
      if (pkg.paths.contract !== undefined && !existsSync(pkg.paths.contract)) {
        offenders.push({ id: pkg.id, path: pkg.paths.contract, kind: 'contract' });
      }
    }
    expect(
      offenders,
      `optional path declared on package but file is missing on disk`,
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
      if (!existsSync(join(WORKFLOWS_ROOT, pkg.id, 'artifacts.ts'))) {
        offenders.push(pkg.id);
      }
    }
    expect(
      offenders,
      `package declares dispatchArtifacts but has no <id>/artifacts.ts — schemas must live in the package`,
    ).toEqual([]);
  });

  it('the catalog imports every package via its local index.js path', () => {
    // Catches the case where someone adds a package to the array
    // without the matching `import { ... } from './<id>/index.js'`
    // statement, or vice versa.
    const catalogText = readFileSync(join(WORKFLOWS_ROOT, 'catalog.ts'), 'utf8');
    const offenders: { readonly id: string; readonly missing: 'import' | 'array' }[] = [];
    for (const pkg of workflowPackages) {
      const expectedImport = `from './${pkg.id}/index.js'`;
      if (!catalogText.includes(expectedImport)) {
        offenders.push({ id: pkg.id, missing: 'import' });
      }
    }
    expect(
      offenders,
      `package present at runtime but not imported by the static catalog source — catalog.ts must mirror the workflowPackages array`,
    ).toEqual([]);
  });

  it('every dispatch artifact schemaName is unique across the catalog', () => {
    // Duplicate schema names would silently drop one of the entries
    // in the artifact-schema registry. The derivation throws on
    // duplicates already; this test fails earlier with a more
    // pointed message that names the colliding workflow ids.
    const seen = new Map<string, string[]>();
    for (const pkg of workflowPackages) {
      for (const artifact of pkg.dispatchArtifacts) {
        const owners = seen.get(artifact.schemaName) ?? [];
        owners.push(pkg.id);
        seen.set(artifact.schemaName, owners);
      }
    }
    const duplicates = [...seen.entries()].filter(([, owners]) => owners.length > 1);
    expect(duplicates, `duplicate dispatch artifact schemaName across packages`).toEqual([]);
  });
});
