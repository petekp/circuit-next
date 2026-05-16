import { FLOW_BLOCK_SCHEMATIC_POLICY } from './flow-block-definitions.js';
import type { FlowBlock as FlowBlockValue } from './flow-blocks.js';
import type { StepExecutionKind } from './flow-schematic.js';
import type { CanonicalStage as CanonicalStageValue } from './stage.js';

export function schematicExecutionKindsForBlock(
  block: FlowBlockValue,
): readonly StepExecutionKind[] {
  return FLOW_BLOCK_SCHEMATIC_POLICY[block.id].executionKinds;
}

export function schematicStagesForBlock(block: FlowBlockValue): readonly CanonicalStageValue[] {
  return FLOW_BLOCK_SCHEMATIC_POLICY[block.id].stages;
}
