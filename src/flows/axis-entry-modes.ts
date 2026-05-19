import type { FlowAxes } from '../schemas/axes.js';
import type { FlowEntryMode } from '../schemas/flow-schematic.js';

export function entryModesForAxes(flowId: string, axes: FlowAxes): readonly FlowEntryMode[] {
  const modes: FlowEntryMode[] = [
    {
      name: 'default',
      depth: axes.default.rigor,
      description: `Default ${flowId} axis tuple.`,
    },
  ];

  for (const rigor of axes.allowed_rigors) {
    if (rigor === axes.default.rigor) continue;
    modes.push({
      name: rigor,
      depth: rigor,
      description: `${rigor} ${flowId} axis tuple.`,
    });
  }

  if (axes.supports_tournament) {
    modes.push({
      name: 'tournament',
      depth: 'tournament',
      description: `Tournament ${flowId} axis tuple.`,
    });
  }

  if (axes.supports_autonomous) {
    modes.push({
      name: 'autonomous',
      depth: 'autonomous',
      description: `Autonomous ${flowId} axis tuple.`,
    });
  }

  return modes;
}
