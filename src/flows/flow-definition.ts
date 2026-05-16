import type { z } from 'zod';

import {
  FlowSchematic,
  type FlowSchematic as FlowSchematicValue,
} from '../schemas/flow-schematic.js';
import {
  buildCheckpointRegistry,
  buildCloseRegistry,
  buildComposeRegistry,
  buildCrossReportValidatorRegistry,
  buildReportSchemaRegistry,
  buildRuntimeSurfaceRegistry,
  buildSchemaHintMap,
  buildStructuralHintList,
  buildVerificationRegistry,
} from './catalog-derivations.js';
import type {
  CompiledFlowPackage,
  CompiledFlowPaths,
  CompiledFlowRelayReport,
  CompiledFlowReportSchema,
  CompiledFlowRoutingMetadata,
  CompiledFlowRuntimeSurface,
  CompiledFlowVisibility,
} from './types.js';

type FlowDefinitionSchematicInput = z.input<typeof FlowSchematic>;

type FlowDefinitionPaths = Omit<CompiledFlowPaths, 'schematic'> & {
  readonly schematic?: string;
};

type FlowDefinitionWriters = Partial<CompiledFlowPackage['writers']>;

export interface FlowDefinitionRuntimeSurface {
  readonly supportedEntryModes?: CompiledFlowRuntimeSurface['supportedEntryModes'];
  readonly primaryResult?: CompiledFlowRuntimeSurface['primaryResult'];
  readonly progress?: CompiledFlowRuntimeSurface['progress'];
}

export interface FlowDefinitionInput {
  readonly id: string;
  readonly visibility: CompiledFlowVisibility;
  readonly schematic: FlowDefinitionSchematicInput;
  readonly paths?: FlowDefinitionPaths;
  readonly routing?: CompiledFlowRoutingMetadata;
  readonly relayReports?: readonly CompiledFlowRelayReport[];
  readonly reportSchemas?: readonly CompiledFlowReportSchema[];
  readonly writers?: FlowDefinitionWriters;
  readonly structuralHints?: CompiledFlowPackage['structuralHints'];
  readonly runtimeSurface?: FlowDefinitionRuntimeSurface;
  readonly engineFlags?: CompiledFlowPackage['engineFlags'];
}

export interface FlowDefinition
  extends Omit<FlowDefinitionInput, 'schematic' | 'paths' | 'runtimeSurface'> {
  readonly schematic: FlowSchematicValue;
  readonly paths: FlowDefinitionPaths;
  readonly runtimeSurface?: FlowDefinitionRuntimeSurface;
}

function defaultSchematicPath(flowId: string): string {
  return `src/flows/${flowId}/schematic.json`;
}

export function defineFlow(definition: FlowDefinitionInput): FlowDefinition {
  const schematic = FlowSchematic.parse(definition.schematic);
  if (definition.id !== schematic.id) {
    throw new Error(
      `flow definition id '${definition.id}' does not match schematic id '${schematic.id}'`,
    );
  }
  return {
    ...definition,
    paths: definition.paths ?? {},
    schematic,
  };
}

function compilePaths(definition: FlowDefinition): CompiledFlowPaths {
  const paths: CompiledFlowPaths = {
    schematic: definition.paths.schematic ?? defaultSchematicPath(definition.id),
  };
  if (definition.paths.command !== undefined) {
    return definition.paths.contract === undefined
      ? { ...paths, command: definition.paths.command }
      : { ...paths, command: definition.paths.command, contract: definition.paths.contract };
  }
  return definition.paths.contract === undefined
    ? paths
    : { ...paths, contract: definition.paths.contract };
}

function deriveSupportedEntryModes(
  definition: FlowDefinition,
): CompiledFlowRuntimeSurface['supportedEntryModes'] {
  const entryModes = definition.schematic.entry_modes;
  if (entryModes === undefined) {
    throw new Error(
      `flow definition '${definition.id}' cannot derive runtime support without schematic entry_modes`,
    );
  }
  return entryModes.map((mode) => ({ entryModeName: mode.name, depth: mode.depth }));
}

function validateProgressSurface(
  definition: FlowDefinition,
  progress: CompiledFlowRuntimeSurface['progress'],
): void {
  if (progress === undefined) return;
  const itemIds = new Set(definition.schematic.items.map((item) => item.id as unknown as string));
  const seen = new Set<string>();
  for (const [index, step] of progress.steps.entries()) {
    if (seen.has(step.stepId)) {
      throw new Error(
        `flow definition '${definition.id}' declares duplicate progress step '${step.stepId}'`,
      );
    }
    seen.add(step.stepId);
    if (!itemIds.has(step.stepId)) {
      throw new Error(
        `flow definition '${definition.id}' progress step '${step.stepId}' is not a schematic item`,
      );
    }
    if (step.taskTitle.length === 0 || step.activeText.length === 0) {
      throw new Error(
        `flow definition '${definition.id}' progress step ${index} must declare operator text`,
      );
    }
  }
}

function compileRuntimeSurface(definition: FlowDefinition): CompiledFlowRuntimeSurface | undefined {
  const runtimeSurface = definition.runtimeSurface;
  if (runtimeSurface === undefined) return undefined;
  validateProgressSurface(definition, runtimeSurface.progress);
  const out: CompiledFlowRuntimeSurface = {
    supportedEntryModes:
      runtimeSurface.supportedEntryModes ?? deriveSupportedEntryModes(definition),
  };
  return {
    ...out,
    ...(runtimeSurface.primaryResult === undefined
      ? {}
      : { primaryResult: runtimeSurface.primaryResult }),
    ...(runtimeSurface.progress === undefined ? {} : { progress: runtimeSurface.progress }),
  };
}

export function compileFlowDefinition(definition: FlowDefinition): CompiledFlowPackage {
  const runtimeSurface = compileRuntimeSurface(definition);
  return {
    id: definition.id,
    visibility: definition.visibility,
    paths: compilePaths(definition),
    ...(definition.routing === undefined ? {} : { routing: definition.routing }),
    relayReports: definition.relayReports ?? [],
    ...(definition.reportSchemas === undefined ? {} : { reportSchemas: definition.reportSchemas }),
    writers: {
      compose: definition.writers?.compose ?? [],
      close: definition.writers?.close ?? [],
      verification: definition.writers?.verification ?? [],
      checkpoint: definition.writers?.checkpoint ?? [],
    },
    ...(definition.structuralHints === undefined
      ? {}
      : { structuralHints: definition.structuralHints }),
    ...(runtimeSurface === undefined ? {} : { runtimeSurface }),
    ...(definition.engineFlags === undefined ? {} : { engineFlags: definition.engineFlags }),
  };
}

function validatePackageSet(packages: readonly CompiledFlowPackage[]): void {
  const ids = new Set<string>();
  const reportNames = new Map<string, string>();
  const writerNames = new Map<string, string>();
  for (const pkg of packages) {
    if (ids.has(pkg.id)) {
      throw new Error(`duplicate flow definition id '${pkg.id}'`);
    }
    ids.add(pkg.id);
    for (const report of [...pkg.relayReports, ...(pkg.reportSchemas ?? [])]) {
      const owner = reportNames.get(report.schemaName);
      if (owner !== undefined) {
        throw new Error(
          `duplicate report schema '${report.schemaName}' registered by '${owner}' and '${pkg.id}'`,
        );
      }
      reportNames.set(report.schemaName, pkg.id);
    }
    for (const [slot, builders] of Object.entries(pkg.writers)) {
      for (const builder of builders) {
        const owner = writerNames.get(builder.resultSchemaName);
        if (owner !== undefined) {
          throw new Error(
            `duplicate writer result schema '${builder.resultSchemaName}' registered by ${owner} and ${pkg.id}.${slot}`,
          );
        }
        writerNames.set(builder.resultSchemaName, `${pkg.id}.${slot}`);
      }
    }
  }
}

export function compileFlowDefinitions(
  definitions: readonly FlowDefinition[],
): readonly CompiledFlowPackage[] {
  const packages = definitions.map(compileFlowDefinition);
  validatePackageSet(packages);
  buildComposeRegistry(packages);
  buildCloseRegistry(packages);
  buildVerificationRegistry(packages);
  buildCheckpointRegistry(packages);
  buildReportSchemaRegistry(packages);
  buildSchemaHintMap(packages);
  buildStructuralHintList(packages);
  buildCrossReportValidatorRegistry(packages);
  buildRuntimeSurfaceRegistry(packages);
  return packages;
}

export function schematicForFlowDefinition(definition: FlowDefinition): FlowSchematicValue {
  return definition.schematic;
}
