import type { FlowFact } from './flow-definition.js';
import type { CompiledFlowEngineFlags, CompiledFlowPaths } from './types.js';

type Fact<K extends FlowFact['kind']> = Extract<FlowFact, { readonly kind: K }>;
type WithoutKindAndFlow<T> = T extends unknown ? Omit<T, 'kind' | 'flowId'> : never;

type FlowMetadata = Omit<Fact<'flow'>, 'kind' | 'flowId'>;
type PathMetadata = Omit<Fact<'path'>, 'kind' | 'flowId' | 'pathKind'>;
type EntryMetadata = WithoutKindAndFlow<Fact<'entry'>>;
type ModeMetadata = WithoutKindAndFlow<Fact<'mode'>>;
type StageMetadata = WithoutKindAndFlow<Fact<'stage'>>;
type StepMetadata = Omit<Fact<'step'>, 'kind' | 'flowId' | 'stepId'>;
type ProgressMetadata = Omit<Fact<'progress'>, 'kind' | 'flowId' | 'stepId'>;
type PrimaryResultMetadata = WithoutKindAndFlow<Fact<'primary-result'>>;
type StructuralHintMetadata = WithoutKindAndFlow<Fact<'structural-hint'>>;
type CanonicalStagePolicyMetadata = WithoutKindAndFlow<Fact<'canonical-stage-policy'>>;
type RouteMetadata = Fact<'route'>;
type WriterSlot = Fact<'writer-binding'>['slot'];
type ReportChannel = Fact<'registered-report'>['channel'];

type PathKind = keyof CompiledFlowPaths;
type EngineFlag = keyof NonNullable<CompiledFlowEngineFlags>;

export type DeclarativeRouteTarget =
  | string
  | {
      readonly to: string;
      readonly modeOverrides?: RouteMetadata['modeOverrides'];
    };

export interface DeclarativeFlowStep extends StepMetadata {
  readonly id: string;
  readonly input?: Readonly<Record<string, string>>;
  readonly routes?: Readonly<Record<string, DeclarativeRouteTarget>>;
  readonly progress?: ProgressMetadata;
}

export interface DeclarativeFlowReport {
  readonly schemaName: string;
  readonly channel: ReportChannel;
}

export interface DeclarativeFlowContractAlias {
  readonly generic: string;
  readonly actual: string;
}

export interface DeclarativeFlowFactsInput extends FlowMetadata {
  readonly id: string;
  readonly paths: Partial<Record<PathKind, PathMetadata['path']>>;
  readonly entry: EntryMetadata;
  readonly modes: readonly ModeMetadata[];
  readonly initialContracts?: readonly string[];
  readonly contractAliases?:
    | Readonly<Record<string, string>>
    | readonly DeclarativeFlowContractAlias[];
  readonly stages: readonly StageMetadata[];
  readonly steps: readonly DeclarativeFlowStep[];
  readonly reports?: readonly DeclarativeFlowReport[];
  readonly writerBindings?: Partial<Record<WriterSlot, readonly string[]>>;
  readonly structuralHints?: readonly StructuralHintMetadata[];
  readonly primaryResult?: PrimaryResultMetadata;
  readonly canonicalStagePolicy?: CanonicalStagePolicyMetadata;
  readonly engineFlags?: Partial<Record<EngineFlag, boolean>>;
}

function routeTarget(target: DeclarativeRouteTarget): {
  readonly to: string;
  readonly modeOverrides?: RouteMetadata['modeOverrides'];
} {
  return typeof target === 'string' ? { to: target } : target;
}

function contractAliasEntries(
  aliases: DeclarativeFlowFactsInput['contractAliases'],
): readonly DeclarativeFlowContractAlias[] {
  if (aliases === undefined) return [];
  if (Array.isArray(aliases)) return aliases;
  return Object.entries(aliases).map(([generic, actual]) => ({ generic, actual }));
}

export function defineDeclarativeFlowFacts(input: DeclarativeFlowFactsInput): readonly FlowFact[] {
  const flowId = input.id;
  const facts: FlowFact[] = [
    {
      kind: 'flow',
      flowId,
      title: input.title,
      purpose: input.purpose,
      status: input.status,
      version: input.version,
      visibility: input.visibility,
      startsAt: input.startsAt,
      stagePathPolicy: input.stagePathPolicy,
    },
  ];

  for (const [pathKind, path] of Object.entries(input.paths) as [PathKind, string][]) {
    facts.push({ kind: 'path', flowId, pathKind, path });
  }

  facts.push({ kind: 'entry', flowId, ...input.entry });

  for (const mode of input.modes) {
    facts.push({ kind: 'mode', flowId, ...mode });
  }

  for (const schemaName of input.initialContracts ?? []) {
    facts.push({ kind: 'initial-contract', flowId, schemaName });
  }

  for (const { generic, actual } of contractAliasEntries(input.contractAliases)) {
    facts.push({ kind: 'contract-alias', flowId, generic, actual });
  }

  for (const stage of input.stages) {
    facts.push({ kind: 'stage', flowId, ...stage });
  }

  for (const step of input.steps) {
    for (const [key, schemaName] of Object.entries(step.input ?? {})) {
      facts.push({ kind: 'input-key', flowId, stepId: step.id, key, schemaName });
    }

    const { id, input: _input, routes, progress, ...metadata } = step;
    facts.push({ kind: 'step', flowId, stepId: id, ...metadata });

    for (const [outcome, target] of Object.entries(routes ?? {})) {
      const resolved = routeTarget(target);
      facts.push({
        kind: 'route',
        flowId,
        fromStepId: id,
        outcome,
        to: resolved.to,
        ...(resolved.modeOverrides === undefined ? {} : { modeOverrides: resolved.modeOverrides }),
      });
    }

    if (progress !== undefined) {
      facts.push({ kind: 'progress', flowId, stepId: id, ...progress });
    }
  }

  for (const report of input.reports ?? []) {
    facts.push({ kind: 'registered-report', flowId, ...report });
  }

  for (const [slot, resultSchemaNames] of Object.entries(input.writerBindings ?? {}) as [
    WriterSlot,
    readonly string[],
  ][]) {
    for (const resultSchemaName of resultSchemaNames) {
      facts.push({ kind: 'writer-binding', flowId, slot, resultSchemaName });
    }
  }

  for (const hint of input.structuralHints ?? []) {
    facts.push({ kind: 'structural-hint', flowId, ...hint });
  }

  if (input.primaryResult !== undefined) {
    facts.push({ kind: 'primary-result', flowId, ...input.primaryResult });
  }

  const canonicalStagePolicy = input.canonicalStagePolicy;
  if (canonicalStagePolicy !== undefined) {
    if (canonicalStagePolicy.enforcement === 'exempt') {
      facts.push({ kind: 'canonical-stage-policy', flowId, ...canonicalStagePolicy });
    } else {
      facts.push({ kind: 'canonical-stage-policy', flowId, ...canonicalStagePolicy });
    }
  }

  if (input.engineFlags !== undefined) {
    for (const flag of Object.keys(input.engineFlags) as EngineFlag[]) {
      const value = input.engineFlags[flag];
      if (value === undefined) continue;
      facts.push({ kind: 'engine-flag', flowId, flag, value });
    }
  }

  return facts;
}
