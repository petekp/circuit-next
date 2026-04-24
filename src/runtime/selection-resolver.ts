import type { LayeredConfig } from '../schemas/config.js';
import type { SkillId } from '../schemas/ids.js';
import {
  type AppliedEntry,
  type ResolvedSelection,
  SelectionOverride,
  type SelectionOverride as SelectionOverrideValue,
  SelectionResolution,
  type SelectionSource,
  type SkillOverride,
} from '../schemas/selection-policy.js';
import type { Workflow } from '../schemas/workflow.js';

const PRE_WORKFLOW_CONFIG_SOURCES = ['default', 'user-global', 'project'] as const;

export interface ResolveSelectionInput {
  readonly workflow: Workflow;
  readonly step: Workflow['steps'][number];
  readonly configLayers?: readonly LayeredConfig[];
}

function overrideContributes(o: SelectionOverrideValue): boolean {
  if (o.model !== undefined) return true;
  if (o.effort !== undefined) return true;
  if (o.rigor !== undefined) return true;
  if (o.skills.mode !== 'inherit') return true;
  if (Object.keys(o.invocation_options).length > 0) return true;
  return false;
}

function composeConfigLayerSelection(
  base: SelectionOverrideValue | undefined,
  circuit: SelectionOverrideValue | undefined,
  current: ResolvedSelection,
): SelectionOverrideValue | undefined {
  if (base === undefined && circuit === undefined) return undefined;
  const baseSkillOp = base?.skills.mode === 'inherit' ? undefined : base?.skills;
  const circuitSkillOp = circuit?.skills.mode === 'inherit' ? undefined : circuit?.skills;
  let skills: SkillOverride | undefined;
  if (baseSkillOp !== undefined || circuitSkillOp !== undefined) {
    // One applied entry represents the whole config source, so same-file
    // default + per-workflow skill ops are normalized to their effective set.
    const baseSkills =
      baseSkillOp !== undefined ? applySkillOp(current.skills, baseSkillOp) : current.skills;
    const composedSkills =
      circuitSkillOp !== undefined ? applySkillOp(baseSkills, circuitSkillOp) : baseSkills;
    skills = { mode: 'replace', skills: [...composedSkills] as SkillId[] };
  }

  const raw = {
    ...(base?.model !== undefined || circuit?.model !== undefined
      ? { model: circuit?.model ?? base?.model }
      : {}),
    ...(base?.effort !== undefined || circuit?.effort !== undefined
      ? { effort: circuit?.effort ?? base?.effort }
      : {}),
    ...(skills !== undefined ? { skills } : {}),
    ...(base?.rigor !== undefined || circuit?.rigor !== undefined
      ? { rigor: circuit?.rigor ?? base?.rigor }
      : {}),
    invocation_options: {
      ...(base?.invocation_options ?? {}),
      ...(circuit?.invocation_options ?? {}),
    },
  };

  const parsed = SelectionOverride.parse(raw);
  return overrideContributes(parsed) ? parsed : undefined;
}

function configLayerSelection(
  workflowId: string,
  layer: LayeredConfig,
  current: ResolvedSelection,
): SelectionOverrideValue | undefined {
  const circuits = layer.config.circuits as Record<
    string,
    { readonly selection?: SelectionOverrideValue } | undefined
  >;
  const circuit = Object.hasOwn(circuits, workflowId) ? circuits[workflowId] : undefined;
  return composeConfigLayerSelection(layer.config.defaults.selection, circuit?.selection, current);
}

function applySkillOp(base: readonly SkillId[], op: SkillOverride): readonly SkillId[] {
  if (op.mode === 'inherit') return base;
  if (op.mode === 'replace') return op.skills;
  if (op.mode === 'append') {
    const seen = new Set<string>(base);
    const out = [...base];
    for (const s of op.skills) {
      const key = s as unknown as string;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }
  const removeSet = new Set<string>(op.skills as ReadonlyArray<string>);
  return base.filter((s) => !removeSet.has(s as unknown as string));
}

function applyOverride(
  current: ResolvedSelection,
  override: SelectionOverrideValue,
): ResolvedSelection {
  const model = override.model ?? current.model;
  const effort = override.effort ?? current.effort;
  const rigor = override.rigor ?? current.rigor;
  const skills = applySkillOp(current.skills, override.skills) as ResolvedSelection['skills'];
  const invocation_options = {
    ...current.invocation_options,
    ...override.invocation_options,
  };

  return {
    ...(model !== undefined ? { model } : {}),
    ...(effort !== undefined ? { effort } : {}),
    skills,
    ...(rigor !== undefined ? { rigor } : {}),
    invocation_options,
  };
}

function pushIfContributing(
  applied: AppliedEntry[],
  entry: AppliedEntry,
  resolved: ResolvedSelection,
): ResolvedSelection {
  if (!overrideContributes(entry.override)) return resolved;
  applied.push(entry);
  return applyOverride(resolved, entry.override);
}

function configLayersBySource(
  layers: readonly LayeredConfig[],
): Partial<Record<SelectionSource, LayeredConfig>> {
  const out: Partial<Record<SelectionSource, LayeredConfig>> = {};
  const seen = new Set<string>();
  for (const layer of layers) {
    if (seen.has(layer.layer)) {
      throw new Error(`duplicate selection config layer '${layer.layer}'`);
    }
    seen.add(layer.layer);
    out[layer.layer] = layer;
  }
  return out;
}

export function resolveSelectionForDispatch(input: ResolveSelectionInput): SelectionResolution {
  const workflowId = input.workflow.id as unknown as string;
  const stepId = input.step.id as unknown as string;
  const applied: AppliedEntry[] = [];
  let resolved: ResolvedSelection = { skills: [], invocation_options: {} };
  const configLayers = configLayersBySource(input.configLayers ?? []);

  for (const source of PRE_WORKFLOW_CONFIG_SOURCES) {
    const layer = configLayers[source];
    if (layer === undefined) continue;
    const override = configLayerSelection(workflowId, layer, resolved);
    if (override === undefined) continue;
    resolved = pushIfContributing(
      applied,
      {
        source,
        override,
      },
      resolved,
    );
  }

  if (input.workflow.default_selection !== undefined) {
    resolved = pushIfContributing(
      applied,
      { source: 'workflow', override: input.workflow.default_selection },
      resolved,
    );
  }

  for (const phase of input.workflow.phases) {
    const phaseSteps = phase.steps as ReadonlyArray<string>;
    if (!phaseSteps.includes(stepId)) continue;
    if (phase.selection === undefined) continue;
    resolved = pushIfContributing(
      applied,
      { source: 'phase', phase_id: phase.id, override: phase.selection },
      resolved,
    );
  }

  if (input.step.selection !== undefined) {
    resolved = pushIfContributing(
      applied,
      { source: 'step', step_id: input.step.id, override: input.step.selection },
      resolved,
    );
  }

  const invocationLayer = configLayers.invocation;
  const invocationOverride =
    invocationLayer === undefined
      ? undefined
      : configLayerSelection(workflowId, invocationLayer, resolved);
  if (invocationOverride !== undefined) {
    resolved = pushIfContributing(
      applied,
      { source: 'invocation', override: invocationOverride },
      resolved,
    );
  }

  return SelectionResolution.parse({ resolved, applied });
}
