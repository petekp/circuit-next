// Migrate workflow package.
//
// Routable via /circuit:run but has no slash command — operators reach
// it through intent classification, not /circuit:migrate.

import type { WorkflowPackage, WorkflowSignal } from '../types.js';
import { MigrateInventory, MigrateReview } from './artifacts.js';
import { migrateInventoryShapeHint } from './dispatch-hints.js';
import { migrateBriefSynthesisBuilder } from './writers/brief.js';
import { migrateCloseBuilder } from './writers/close.js';
import { migrateCoexistenceSynthesisBuilder } from './writers/coexistence.js';
import { migrateVerificationWriter } from './writers/verification.js';

const MIGRATE_SIGNALS: readonly WorkflowSignal[] = [
  { label: 'migrate prefix', pattern: /^\s*migrate\s*:/i },
  {
    label: 'migrate request',
    pattern:
      /^\s*(?:please\s+)?(?:migrate|port|swap|replace|rewrite|transition)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|all\s+|our\s+)?\S+/i,
  },
  {
    label: 'framework swap signal',
    pattern: /\b(?:framework|library|dependency|stack)\s+(?:swap|replacement|migration)\b/i,
  },
];

export const migrateWorkflowPackage: WorkflowPackage = {
  id: 'migrate',
  paths: {
    schematic: 'src/workflows/migrate/schematic.json',
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningArtifact: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate workflow`;
    },
  },
  dispatchArtifacts: [
    {
      schemaName: 'migrate.inventory@v1',
      schema: MigrateInventory,
      dispatchHint: migrateInventoryShapeHint.instruction,
    },
    { schemaName: 'migrate.review@v1', schema: MigrateReview },
  ],
  writers: {
    synthesis: [migrateBriefSynthesisBuilder, migrateCoexistenceSynthesisBuilder],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
    checkpoint: [],
  },
};
