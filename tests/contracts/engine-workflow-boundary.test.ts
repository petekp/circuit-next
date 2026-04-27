// Architecture boundary: src/runtime/ may not import from any
// per-workflow source. The catalog (src/workflows/catalog.js) and the
// shared types module (src/workflows/types.js) are the only allowed
// import surfaces — everything per-workflow flows through those.
//
// If this test fails, the catalog refactor is being undone: the
// engine has grown a workflow-specific import. Move the imported
// state into the WorkflowPackage shape and re-derive instead.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RUNTIME_ROOT = 'src/runtime';
const WORKFLOWS_ROOT = 'src/workflows';

// Allow-list: imports the engine IS permitted to take from
// src/workflows/. If any other path appears, the test fails.
const ALLOWED_WORKFLOW_IMPORTS = [
  '../workflows/catalog.js',
  '../../workflows/catalog.js',
  '../workflows/types.js',
  '../../workflows/types.js',
];

function walk(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (extname(path) === '.ts') {
      out.push(path);
    }
  }
  return out;
}

// Match `from '...workflows/...'` — both single and double quotes,
// covers any depth of relative import. Excludes paths that contain
// 'test' or end in '.test.ts' since the runtime tree shouldn't have
// those, but we also exclude tests/ and dist/ from the walk anyway.
const WORKFLOW_IMPORT_PATTERN = /from\s+['"]([^'"\n]*workflows\/[^'"\n]+)['"]/g;

function workflowImports(file: string): readonly string[] {
  const text = readFileSync(file, 'utf8');
  const matches: string[] = [];
  for (const match of text.matchAll(WORKFLOW_IMPORT_PATTERN)) {
    const importPath = match[1];
    if (importPath !== undefined) matches.push(importPath);
  }
  return matches;
}

describe('engine ↔ workflow boundary', () => {
  it('no file under src/runtime/ imports a workflow source other than the catalog or types', () => {
    const offenders: { readonly file: string; readonly importPath: string }[] = [];
    for (const file of walk(RUNTIME_ROOT)) {
      for (const importPath of workflowImports(file)) {
        if (ALLOWED_WORKFLOW_IMPORTS.includes(importPath)) continue;
        offenders.push({ file, importPath });
      }
    }
    expect(
      offenders,
      `engine files imported per-workflow modules outside the catalog allowlist:\n${offenders
        .map((o) => `  ${o.file} → ${o.importPath}`)
        .join('\n')}\nAllowed engine→workflow imports: ${ALLOWED_WORKFLOW_IMPORTS.join(', ')}`,
    ).toEqual([]);
  });

  it('no file under src/workflows/<id>/ imports another workflow', () => {
    // Workflow packages are independent: build/index.ts must not
    // import explore/. Cross-workflow coupling defeats the vertical
    // shape — surface it as a contract violation.
    const offenders: {
      readonly file: string;
      readonly fromWorkflow: string;
      readonly toWorkflow: string;
    }[] = [];
    for (const entry of readdirSync(WORKFLOWS_ROOT)) {
      const workflowDir = join(WORKFLOWS_ROOT, entry);
      if (!statSync(workflowDir).isDirectory()) continue;
      for (const file of walk(workflowDir)) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(WORKFLOW_IMPORT_PATTERN)) {
          const importPath = match[1];
          if (importPath === undefined) continue;
          // Allowed: same-workflow imports (./ or ../same-id/) and
          // imports of types.js / catalog.js at the workflows/ root.
          if (importPath.startsWith('./')) continue;
          if (importPath.endsWith('/types.js') && /workflows\/types\.js$/.test(importPath))
            continue;
          if (importPath.endsWith('/catalog.js') && /workflows\/catalog\.js$/.test(importPath))
            continue;
          // Detect cross-workflow imports like '../explore/...' from
          // inside src/workflows/build/.
          const otherWorkflowMatch = importPath.match(/workflows\/([^/]+)\//);
          if (otherWorkflowMatch === null) continue;
          const importedWorkflow = otherWorkflowMatch[1];
          if (importedWorkflow !== undefined && importedWorkflow !== entry) {
            offenders.push({ file, fromWorkflow: entry, toWorkflow: importedWorkflow });
          }
        }
      }
    }
    expect(
      offenders,
      `cross-workflow imports detected:\n${offenders
        .map((o) => `  ${o.file} (workflow: ${o.fromWorkflow}) → ${o.toWorkflow}`)
        .join(
          '\n',
        )}\nWorkflow packages must be independent — share through the engine, not directly.`,
    ).toEqual([]);
  });

  it('catalog.ts is the only file that imports each workflow package index', () => {
    // Anyone who needs workflow data should go through the catalog
    // rather than reach into a specific workflow package directly.
    // Allowed importers: src/workflows/catalog.ts itself, and tests.
    const offenders: { readonly file: string; readonly importPath: string }[] = [];
    for (const file of walk('src')) {
      if (file === join(WORKFLOWS_ROOT, 'catalog.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(WORKFLOW_IMPORT_PATTERN)) {
        const importPath = match[1];
        if (importPath === undefined) continue;
        // Match imports of an explicit per-workflow index.js — the
        // surface a workflow package exposes externally.
        const indexMatch = importPath.match(/workflows\/([^/]+)\/index\.js$/);
        if (indexMatch === null) continue;
        const importedWorkflow = indexMatch[1];
        // A workflow's own folder may import its own index? Should not
        // need to — but if it does, leave it alone. Just look for
        // imports from outside the workflow's directory.
        if (file.includes(`/workflows/${importedWorkflow}/`)) continue;
        offenders.push({ file, importPath });
      }
    }
    expect(
      offenders,
      `non-catalog files imported a workflow package directly:\n${offenders
        .map((o) => `  ${o.file} → ${o.importPath}`)
        .join('\n')}\nUse src/workflows/catalog.ts → workflowPackages instead.`,
    ).toEqual([]);
  });
});
