// Migrate coexistence-plan synthesis writer.
//
// Reads migrate.brief@v1 and migrate.inventory@v1 and emits a
// MigrateCoexistence with the brief's rollback_plan and a default
// switchover/health story. A real run would author this through an
// operator decision; the inline-synthesis fallback keeps the recipe
// executable in autonomous mode.

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/synthesis-writers/types.js';
import {
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
} from '../../../schemas/artifacts/migrate.js';

export const migrateCoexistenceSynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'migrate.coexistence@v1',
  reads: [
    { name: 'brief', schema: 'migrate.brief@v1', required: true },
    { name: 'inventory', schema: 'migrate.inventory@v1', required: true },
  ],
  build(context: SynthesisBuildContext): unknown {
    const brief = MigrateBrief.parse(context.inputs.brief);
    const inventory = MigrateInventory.parse(context.inputs.inventory);
    return MigrateCoexistence.parse({
      strategy: `${brief.coexistence_appetite} window: keep ${brief.source} in place while ${brief.target} is rolled out batch by batch (${inventory.batches.length} batch(es) planned).`,
      switchover_criteria: [
        'All declared inventory items have been touched and verification passes.',
        'Cutover review verdict is cutover-approved or cutover-with-followups.',
      ],
      health_signals: [
        `Verification command suite (${brief.verification_command_candidates.map((c) => c.id).join(', ')}) reports passed.`,
        'No regressions reported by the cutover review.',
      ],
      rollback_path: brief.rollback_plan,
      risks: [
        'Single-batch v0 has no per-batch isolation — a partial failure rolls back the entire run.',
      ],
    });
  },
};
