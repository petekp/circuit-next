// Migrate flow package.
//
// Routable via /circuit:run and also exposed through a root-authored
// direct command surface. It has no flow-owned command source because
// commands/migrate.md is maintained at the root.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { migrateInventoryShapeHint } from './relay-hints.js';
import { MigrateInventory, MigrateReview } from './reports.js';
import { migrateBriefComposeBuilder } from './writers/brief.js';
import { migrateCloseBuilder } from './writers/close.js';
import { migrateCoexistenceComposeBuilder } from './writers/coexistence.js';
import { migrateVerificationWriter } from './writers/verification.js';

const MIGRATE_SIGNALS: readonly CompiledFlowSignal[] = [
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

export const migrateCompiledFlowPackage: CompiledFlowPackage = {
  id: 'migrate',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/migrate/schematic.json',
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'migrate.inventory@v1',
      schema: MigrateInventory,
      relayHint: migrateInventoryShapeHint.instruction,
    },
    { schemaName: 'migrate.review@v1', schema: MigrateReview },
  ],
  writers: {
    compose: [migrateBriefComposeBuilder, migrateCoexistenceComposeBuilder],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
    checkpoint: [],
  },
};
