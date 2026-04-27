// Migrate workflow package.
//
// Routable via /circuit:run but has no slash command — operators reach
// it through intent classification, not /circuit:migrate.

import { migrateCloseBuilder } from '../../runtime/close-writers/migrate.js';
import { migrateBriefSynthesisBuilder } from '../../runtime/synthesis-writers/migrate-brief.js';
import { migrateCoexistenceSynthesisBuilder } from '../../runtime/synthesis-writers/migrate-coexistence.js';
import { migrateInventorySynthesisBuilder } from '../../runtime/synthesis-writers/migrate-inventory.js';
import { migrateVerificationWriter } from '../../runtime/verification-writers/migrate-verification.js';
import { MigrateReview } from '../../schemas/artifacts/migrate.js';
import type { WorkflowPackage, WorkflowSignal } from '../types.js';

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
    recipe: 'specs/workflow-recipes/migrate.recipe.json',
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
