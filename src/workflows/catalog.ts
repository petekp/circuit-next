// Workflow catalog — single source of truth for the engine.
//
// The router, registries (synthesis, close, verification, checkpoint,
// artifact-schemas, shape-hints), and emit script all derive their
// state from `workflowPackages`. The engine never imports a workflow
// module directly. Adding a workflow means appending here.

import { buildWorkflowPackage } from './build/index.js';
import { exploreWorkflowPackage } from './explore/index.js';
import { fixWorkflowPackage } from './fix/index.js';
import { migrateWorkflowPackage } from './migrate/index.js';
import { reviewWorkflowPackage } from './review/index.js';
import { sweepWorkflowPackage } from './sweep/index.js';
import type { WorkflowPackage } from './types.js';

export const workflowPackages: readonly WorkflowPackage[] = [
  reviewWorkflowPackage,
  migrateWorkflowPackage,
  fixWorkflowPackage,
  buildWorkflowPackage,
  exploreWorkflowPackage,
  sweepWorkflowPackage,
];

const PACKAGES_BY_ID: ReadonlyMap<string, WorkflowPackage> = (() => {
  const map = new Map<string, WorkflowPackage>();
  for (const pkg of workflowPackages) {
    if (map.has(pkg.id)) {
      throw new Error(`duplicate workflow package id '${pkg.id}'`);
    }
    map.set(pkg.id, pkg);
  }
  return map;
})();

// Look up a workflow package by id. Used by engine layers that hold
// only a Workflow value and need package-level metadata (e.g. engine
// flags). Returns undefined when no package is registered for the id.
export function findWorkflowPackageById(id: string): WorkflowPackage | undefined {
  return PACKAGES_BY_ID.get(id);
}

export type { WorkflowPackage } from './types.js';
