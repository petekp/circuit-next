// Migrate workflow package.
//
// Routable via /circuit:run but has no slash command — operators reach
// it through intent classification, not /circuit:migrate.

import { MigrateReview } from './artifacts.js';
import type { WorkflowPackage, WorkflowSignal } from '../types.js';
import { migrateBriefSynthesisBuilder } from './writers/brief.js';
import { migrateCloseBuilder } from './writers/close.js';
import { migrateCoexistenceSynthesisBuilder } from './writers/coexistence.js';
import { migrateInventorySynthesisBuilder } from './writers/inventory.js';
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
    recipe: 'src/workflows/migrate/recipe.json',
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningArtifact: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate workflow`;
    },
  },
  // Migrate's dispatch step (review) currently uses the generic
  // shape instruction. Preserved here so refactoring is explicit.
  dispatchArtifacts: [{ schemaName: 'migrate.review@v1', schema: MigrateReview }],
  writers: {
    synthesis: [
      migrateBriefSynthesisBuilder,
      migrateInventorySynthesisBuilder,
      migrateCoexistenceSynthesisBuilder,
    ],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
    checkpoint: [],
  },
};
