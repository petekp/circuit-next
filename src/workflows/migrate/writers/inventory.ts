// Migrate inventory synthesis writer.
//
// Reads migrate.brief@v1 and emits a placeholder inventory naming the
// brief's stated scope as a single coalesced item, grouped into a
// single batch that the downstream sub-run will hand to a Build child.
// A future slice will replace this with a dispatched worker that scans
// the project for actual migration targets — the v0 stub keeps
// end-to-end execution honest while leaving the DAG shape stable for
// when the real surveyor lands.

import type {
  SynthesisBuildContext,
  SynthesisBuilder,
} from '../../../runtime/registries/synthesis-writers/types.js';
import { MigrateBrief, MigrateInventory } from '../artifacts.js';

export const migrateInventorySynthesisBuilder: SynthesisBuilder = {
  resultSchemaName: 'migrate.inventory@v1',
  reads: [{ name: 'brief', schema: 'migrate.brief@v1', required: true }],
  build(context: SynthesisBuildContext): unknown {
    const brief = MigrateBrief.parse(context.inputs.brief);
    const inventoryItem = {
      id: 'item-1',
      path: brief.scope,
      category: 'migration-target',
      description: `Default-stub item representing the brief scope: ${brief.scope}`,
    };
    return MigrateInventory.parse({
      summary: `Single-batch placeholder inventory for ${brief.objective}`,
      items: [inventoryItem],
      batches: [
        {
          id: 'batch-1',
          title: 'All migration targets in one batch',
          item_ids: [inventoryItem.id],
          rationale:
            'v0 default executor is sub-run sequential — single batch covers the whole inventory until fanout-over-batches lands.',
        },
      ],
    });
  },
};
