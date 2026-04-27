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

// Allow-list: match by suffix so engine files at any directory depth
// get the same exemption. The catalog and the shared types are the
// only legitimate workflow surfaces the engine consumes.
const ALLOWED_WORKFLOW_IMPORT_SUFFIXES = ['/workflows/catalog.js', '/workflows/types.js'];

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

// Patterns covering every form a workflow path can sneak in through:
//   - `import x from '...'` and `import type x from '...'`
//   - `import '...'` (side-effect)
//   - `export ... from '...'` (re-export)
//   - `await import('...')` (dynamic import)
// Each pattern uses a single capture group for the import path.
const STATIC_IMPORT_PATTERN = /\bimport\s+(?:type\s+)?(?:[^'"\n;]+\s+from\s+)?['"]([^'"\n]+)['"]/g;
const REEXPORT_PATTERN = /\bexport\s+(?:type\s+)?(?:\*\s+|\{[^}]*\}\s+)?from\s+['"]([^'"\n]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;

function importPathsFrom(file: string): readonly string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const pattern of [STATIC_IMPORT_PATTERN, REEXPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      const importPath = match[1];
      if (importPath !== undefined) out.push(importPath);
    }
  }
  return out;
}

function isWorkflowImport(importPath: string): boolean {
  // Match the literal '/workflows/' segment so paths that merely
  // contain the word 'workflows' as a substring (e.g. comments,
  // hypothetical 'foo-workflows-bar.ts') don't trigger.
  return /\/workflows\//.test(importPath) || importPath.endsWith('/workflows');
}

function isAllowedEngineImport(importPath: string): boolean {
  return ALLOWED_WORKFLOW_IMPORT_SUFFIXES.some((suffix) => importPath.endsWith(suffix));
}

describe('engine ↔ workflow boundary', () => {
  it('no file under src/runtime/ imports a workflow source other than the catalog or types', () => {
    const offenders: { readonly file: string; readonly importPath: string }[] = [];
    for (const file of walk(RUNTIME_ROOT)) {
      for (const importPath of importPathsFrom(file)) {
        if (!isWorkflowImport(importPath)) continue;
        if (isAllowedEngineImport(importPath)) continue;
        offenders.push({ file, importPath });
      }
    }
    expect(
      offenders,
      `engine files imported per-workflow modules outside the catalog allowlist:\n${offenders
        .map((o) => `  ${o.file} → ${o.importPath}`)
        .join(
          '\n',
        )}\nAllowed engine→workflow import suffixes: ${ALLOWED_WORKFLOW_IMPORT_SUFFIXES.join(', ')}`,
    ).toEqual([]);
  });

  it('no file under src/workflows/<id>/ imports another workflow', () => {
    const offenders: {
      readonly file: string;
      readonly fromWorkflow: string;
      readonly toWorkflow: string;
    }[] = [];
    for (const entry of readdirSync(WORKFLOWS_ROOT)) {
      const workflowDir = join(WORKFLOWS_ROOT, entry);
      if (!statSync(workflowDir).isDirectory()) continue;
      for (const file of walk(workflowDir)) {
        for (const importPath of importPathsFrom(file)) {
          if (!isWorkflowImport(importPath)) continue;
          // Allowed: same-workflow imports starting with ./
          if (importPath.startsWith('./')) continue;
          // Allowed: imports of catalog.js or types.js at workflows/ root
          if (
            importPath.endsWith('/workflows/types.js') ||
            importPath.endsWith('/workflows/catalog.js')
          ) {
            continue;
          }
          const otherWorkflowMatch = importPath.match(/\/workflows\/([^/]+)\//);
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
    // Tests are exempt because they may legitimately exercise a
    // single workflow in isolation.
    const offenders: { readonly file: string; readonly importPath: string }[] = [];
    for (const file of walk('src')) {
      if (file === join(WORKFLOWS_ROOT, 'catalog.ts')) continue;
      for (const importPath of importPathsFrom(file)) {
        if (!isWorkflowImport(importPath)) continue;
        const indexMatch = importPath.match(/\/workflows\/([^/]+)\/index\.js$/);
        if (indexMatch === null) continue;
        const importedWorkflow = indexMatch[1];
        if (importedWorkflow === undefined) continue;
        // A workflow's own folder may import its own index — leave alone.
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

  it('test files do not bypass the engine→workflow boundary via direct package imports', () => {
    // Tests CAN import a workflow package's index for unit-testing
    // the package in isolation. They MAY also import a package's
    // artifacts.ts module (the package's typed Zod schemas — public
    // surface, not internals). What they MUST NOT do is import a
    // workflow's writer / dispatch-hint internals — that would
    // entangle the test surface with the workflow's internal layout.
    const offenders: { readonly file: string; readonly importPath: string }[] = [];
    for (const file of walk('tests')) {
      for (const importPath of importPathsFrom(file)) {
        if (!isWorkflowImport(importPath)) continue;
        // index.js / catalog.js / types.js / artifacts.js are the
        // supported public surfaces.
        if (importPath.endsWith('/index.js')) continue;
        if (importPath.endsWith('/artifacts.js')) continue;
        if (importPath.endsWith('/workflows/catalog.js')) continue;
        if (importPath.endsWith('/workflows/types.js')) continue;
        offenders.push({ file, importPath });
      }
    }
    expect(
      offenders,
      `tests reached into workflow internals:\n${offenders
        .map((o) => `  ${o.file} → ${o.importPath}`)
        .join('\n')}\nImport the workflow's index.js or go through the catalog.`,
    ).toEqual([]);
  });
});
