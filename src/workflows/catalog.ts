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

export type { WorkflowPackage } from './types.js';
