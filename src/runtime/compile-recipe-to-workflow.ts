// Pure compiler: WorkflowRecipe → Workflow(s). Takes a fully-populated recipe
// (recipe-level entry/entry_modes/spine_policy/phases/version present;
// per-item protocol/writes/gate present) and produces compiled Workflow
// objects shaped like the existing committed `.claude-plugin/skills/<id>/`
// fixtures.
//
// Compile is per entry mode: routes are resolved against
// `route_overrides[outcome][mode.rigor]` when the recipe declares one;
// reachability is computed against that resolved graph and unreachable
// items are dropped per mode. The result is a discriminated union:
//
//   - `kind: 'single'`  when the recipe declares no route_overrides anywhere.
//                       All entry modes share the same compiled graph; the
//                       returned Workflow's entry_modes is the full recipe
//                       list. Build-time emit writes one `circuit.json`.
//
//   - `kind: 'per-mode'` when at least one item declares route_overrides.
//                        Returns one Workflow per entry mode, each with
//                        `entry_modes: [<this mode>]`. Build-time emit
//                        groups by graph identity, writes the largest
//                        group to `circuit.json` (with entry_modes merged)
//                        and remaining modes to `<mode-name>.json`.
//
// Failure modes are deliberate: if any compile-required field is missing,
// or any `kind ↔ artifact schema` pair is one the runner does not support,
// the compile throws with a clear message naming the offending item.

import type { CanonicalPhase } from '../schemas/phase.js';
import { CANONICAL_PHASES } from '../schemas/phase.js';
import type { Step } from '../schemas/step.js';
import type { WorkflowPrimitiveContractRef } from '../schemas/workflow-primitives.js';
import type {
  WorkflowRecipe,
  WorkflowRecipeEntryMode,
  WorkflowRecipeItem,
  WorkflowRecipeWrites,
} from '../schemas/workflow-recipe.js';
import type { Workflow as WorkflowValue } from '../schemas/workflow.js';
import { Workflow } from '../schemas/workflow.js';
import { findCheckpointBriefBuilder } from './registries/checkpoint-writers/registry.js';
import { findVerificationWriter } from './registries/verification-writers/registry.js';

export class WorkflowRecipeCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowRecipeCompileError';
  }
}

export type CompileResult =
  | { kind: 'single'; workflow: WorkflowValue }
  | { kind: 'per-mode'; workflows: Map<string, WorkflowValue> };

function fail(message: string): never {
  throw new WorkflowRecipeCompileError(message);
}

const RECIPE_TO_WORKFLOW_ROUTE: Record<string, string> = {
  continue: 'pass',
  complete: 'pass',
};

// Recipe-level routes that the runtime cannot execute through the static
// Workflow's per-step `routes` map (one edge per gate outcome). They are
// intentionally treated as authoring metadata until the runtime grows
// per-attempt path indexing or new terminal outcomes; the compiler drops them.
const RECIPE_ROUTES_DROPPED_AT_COMPILE = new Set([
  'retry',
  'revise',
  'stop',
  'ask',
  'handoff',
  'escalate',
]);

// (step kind, artifact schema) pairs the runner's writers actually
// understand. Both verification and checkpoint kinds consult their
// per-kind writer registries (the single source of truth — adding a
// writer there auto-permits the schema here).
function ensureSupportedKindArtifactPair(item: WorkflowRecipeItem): void {
  if (item.execution.kind === 'verification') {
    if (findVerificationWriter(item.output as unknown as string) === undefined) {
      fail(
        `recipe item '${item.id}' has verification kind but writes '${item.output}'; no verification writer is registered for that schema (see src/runtime/registries/verification-writers/registry.ts)`,
      );
    }
  }
  if (item.execution.kind === 'checkpoint' && item.writes?.artifact_path !== undefined) {
    if (findCheckpointBriefBuilder(item.output as unknown as string) === undefined) {
      fail(
        `recipe item '${item.id}' has checkpoint kind writing artifact '${item.output}'; no checkpoint writer is registered for that schema (see src/runtime/registries/checkpoint-writers/registry.ts)`,
      );
    }
  }
}

function requireRecipeField<T>(value: T | undefined, fieldName: string, recipeId: string): T {
  if (value === undefined) {
    fail(`recipe '${recipeId}' is missing required compile-time field '${fieldName}'`);
  }
  return value;
}

function requireItemField<T>(value: T | undefined, fieldName: string, itemId: string): T {
  if (value === undefined) {
    fail(`recipe item '${itemId}' is missing required compile-time field '${fieldName}'`);
  }
  return value;
}

// Resolve a single recipe-side route outcome to its target after applying
// any mode-specific override. The override map is keyed by Rigor; we look
// it up using `mode.rigor`, not `mode.name` (the schema declares it that
// way so authors can express "lite-rigor variants of this workflow skip
// review" without naming individual entry modes).
function resolveRouteTarget(
  item: WorkflowRecipeItem,
  outcome: string,
  mode: WorkflowRecipeEntryMode,
): string | undefined {
  const overrides = item.route_overrides[outcome];
  const overridden = overrides?.[mode.rigor];
  if (overridden !== undefined) return overridden;
  return item.routes[outcome];
}

// Compute the set of items reachable for a given mode by following only
// the routes that the compiler maps to executable Workflow edges
// (continue/complete → pass) with mode-specific overrides applied. Items
// referenced only by dropped outcomes (retry/revise/stop/ask/handoff/
// escalate) are intentionally unreachable here; they live in the recipe
// as authoring intent but are not emitted into the compiled Workflow
// until the runtime grows the corresponding outcomes.
function computeReachableForMode(
  recipe: WorkflowRecipe,
  mode: WorkflowRecipeEntryMode,
): Set<string> {
  const itemById = new Map(recipe.items.map((item) => [item.id as unknown as string, item]));
  const reachable = new Set<string>();
  const queue: string[] = [recipe.starts_at as unknown as string];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) continue;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const item = itemById.get(id);
    if (item === undefined) {
      fail(
        `recipe '${recipe.id as unknown as string}' references unknown item id '${id}' through routes (or starts_at)`,
      );
    }
    for (const outcome of Object.keys(item.routes)) {
      if (RECIPE_ROUTES_DROPPED_AT_COMPILE.has(outcome)) continue;
      if (RECIPE_TO_WORKFLOW_ROUTE[outcome] === undefined) {
        // Defer the precise error to compileRoutes so the message is
        // produced once and includes the offending item id.
        continue;
      }
      const target = resolveRouteTarget(item, outcome, mode);
      if (target === undefined) continue;
      if (target.startsWith('@')) continue;
      queue.push(target);
    }
  }
  return reachable;
}

// Build a contract → producing item index from the reachable items. Used
// to resolve the read-paths for each consuming item's typed input
// contracts. If a contract has no producer (and is not in
// initial_contracts) the consumer's compile fails.
function buildContractProducerIndex(
  recipeId: string,
  items: readonly WorkflowRecipeItem[],
): Map<WorkflowPrimitiveContractRef, WorkflowRecipeItem> {
  const index = new Map<WorkflowPrimitiveContractRef, WorkflowRecipeItem>();
  for (const item of items) {
    if (index.has(item.output)) {
      const prior = index.get(item.output);
      fail(
        `recipe '${recipeId}' items '${prior?.id}' and '${item.id}' both write contract '${item.output}' on the same compiled graph — read-path resolution requires a single producer per contract per mode`,
      );
    }
    index.set(item.output, item);
  }
  return index;
}

function readPathForProducer(producer: WorkflowRecipeItem): string {
  // Prefer the typed artifact path; fall back to the dispatch result path
  // when the producer is a dispatch step that does not emit a typed
  // artifact (Review's audit-step pattern).
  const writes = requireItemField(producer.writes, 'writes', producer.id);
  if (writes.artifact_path !== undefined) return writes.artifact_path;
  if (writes.result_path !== undefined) return writes.result_path;
  fail(
    `recipe item '${producer.id}' produces '${producer.output}' but has no writes.artifact_path or writes.result_path — downstream consumers cannot find a read path`,
  );
}

function computeReads(
  item: WorkflowRecipeItem,
  initialContracts: ReadonlySet<WorkflowPrimitiveContractRef>,
  producerByContract: ReadonlyMap<WorkflowPrimitiveContractRef, WorkflowRecipeItem>,
): string[] {
  const reads: string[] = [];
  const seen = new Set<string>();
  // Iterate inputs in declaration order so the emitted reads list is
  // stable and matches the recipe author's intent.
  for (const contract of Object.values(item.input)) {
    if (initialContracts.has(contract)) continue;
    const producer = producerByContract.get(contract);
    if (producer === undefined) {
      fail(
        `recipe item '${item.id}' input contract '${contract}' has no producer reachable in this mode and is not in initial_contracts`,
      );
    }
    const path = readPathForProducer(producer);
    if (!seen.has(path)) {
      reads.push(path);
      seen.add(path);
    }
  }
  return reads;
}

// Map recipe routes to Workflow routes for a given mode. The runtime's
// gate emits 'pass' or 'fail' uniformly across all gate kinds; recipes
// carry author-friendly outcome names. Only continue and complete map to
// pass; the rest are non-executable metadata for now and are dropped at
// compile.
function compileRoutesForMode(
  item: WorkflowRecipeItem,
  mode: WorkflowRecipeEntryMode,
): Record<string, string> {
  const routes: Record<string, string> = {};
  let passSet = false;
  for (const outcome of Object.keys(item.routes)) {
    if (RECIPE_ROUTES_DROPPED_AT_COMPILE.has(outcome)) continue;
    const workflowRoute = RECIPE_TO_WORKFLOW_ROUTE[outcome];
    if (workflowRoute === undefined) {
      fail(
        `recipe item '${item.id}' has route outcome '${outcome}' the compiler does not know how to map to the Workflow's pass/fail route alphabet`,
      );
    }
    if (workflowRoute === 'pass' && passSet) {
      fail(
        `recipe item '${item.id}' has multiple outcomes that map to 'pass' (only one allowed); pick whichever maps to the live runtime success edge`,
      );
    }
    const target = resolveRouteTarget(item, outcome, mode);
    if (target === undefined) {
      fail(
        `recipe item '${item.id}' route outcome '${outcome}' has no target after applying mode '${mode.name}' (rigor '${mode.rigor}') overrides`,
      );
    }
    routes[workflowRoute] = target;
    if (workflowRoute === 'pass') passSet = true;
  }
  if (!passSet) {
    fail(
      `recipe item '${item.id}' has no outcome that maps to 'pass'; declare a 'continue' or 'complete' route so the compiled Workflow has a success edge`,
    );
  }
  return routes;
}

function compileItem(
  item: WorkflowRecipeItem,
  reads: readonly string[],
  routes: Record<string, string>,
): Step {
  const protocol = requireItemField(item.protocol, 'protocol', item.id);
  const writes = requireItemField(item.writes, 'writes', item.id);
  const gate = requireItemField(item.gate, 'gate', item.id);
  ensureSupportedKindArtifactPair(item);

  const stepBase = {
    id: item.id,
    title: item.title,
    protocol,
    reads: [...reads],
    routes,
    ...(item.selection !== undefined ? { selection: item.selection } : {}),
  } as const;

  switch (item.execution.kind) {
    case 'synthesis': {
      const artifactPath = requireWritesField(writes, 'artifact_path', item.id, 'synthesis');
      return {
        ...stepBase,
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: artifactPath, schema: item.output },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: requireGateField(gate.required, 'required', item.id, 'synthesis'),
        },
      } as Step;
    }
    case 'verification': {
      const artifactPath = requireWritesField(writes, 'artifact_path', item.id, 'verification');
      return {
        ...stepBase,
        executor: 'orchestrator',
        kind: 'verification',
        writes: {
          artifact: { path: artifactPath, schema: item.output },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: requireGateField(gate.required, 'required', item.id, 'verification'),
        },
      } as Step;
    }
    case 'checkpoint': {
      const policy = requireItemField(item.checkpoint_policy, 'checkpoint_policy', item.id);
      const requestPath = requireWritesField(
        writes,
        'checkpoint_request_path',
        item.id,
        'checkpoint',
      );
      const responsePath = requireWritesField(
        writes,
        'checkpoint_response_path',
        item.id,
        'checkpoint',
      );
      const checkpointWrites: {
        request: string;
        response: string;
        artifact?: { path: string; schema: string };
      } = {
        request: requestPath,
        response: responsePath,
      };
      if (writes.artifact_path !== undefined) {
        checkpointWrites.artifact = { path: writes.artifact_path, schema: item.output };
      }
      return {
        ...stepBase,
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy,
        writes: checkpointWrites,
        gate: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: requireGateField(gate.allow, 'allow', item.id, 'checkpoint'),
        },
      } as Step;
    }
    case 'dispatch': {
      const role = item.execution.role;
      if (role === undefined) {
        fail(`recipe item '${item.id}' has dispatch kind but no execution.role`);
      }
      const requestPath = requireWritesField(writes, 'request_path', item.id, 'dispatch');
      const receiptPath = requireWritesField(writes, 'receipt_path', item.id, 'dispatch');
      const resultPath = requireWritesField(writes, 'result_path', item.id, 'dispatch');
      const dispatchWrites: {
        request: string;
        receipt: string;
        result: string;
        artifact?: { path: string; schema: string };
      } = {
        request: requestPath,
        receipt: receiptPath,
        result: resultPath,
      };
      if (writes.artifact_path !== undefined) {
        dispatchWrites.artifact = { path: writes.artifact_path, schema: item.output };
      }
      return {
        ...stepBase,
        executor: 'worker',
        kind: 'dispatch',
        role,
        writes: dispatchWrites,
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: requireGateField(gate.pass, 'pass', item.id, 'dispatch'),
        },
      } as Step;
    }
    case 'sub-run': {
      const workflowRef = item.execution.workflow_ref;
      const goal = item.execution.goal;
      const rigor = item.execution.rigor;
      if (workflowRef === undefined) {
        fail(`recipe item '${item.id}' has sub-run kind but no execution.workflow_ref`);
      }
      if (goal === undefined) {
        fail(`recipe item '${item.id}' has sub-run kind but no execution.goal`);
      }
      if (rigor === undefined) {
        fail(`recipe item '${item.id}' has sub-run kind but no execution.rigor`);
      }
      const resultPath = requireWritesField(writes, 'result_path', item.id, 'sub-run');
      // Emit writes.artifact as a schema annotation pointing at the same
      // path as writes.result. The child's result.json IS the typed
      // artifact for downstream consumers — no separate materialization
      // is needed (the sub-run handler short-circuits the v0 abort when
      // artifact.path equals result path). This lets close-writers
      // resolve `migrate.batch@v1` (or any sub-run output schema) via
      // artifactPathForSchemaInWorkflow without special-casing sub-run.
      return {
        ...stepBase,
        executor: 'orchestrator',
        kind: 'sub-run',
        workflow_ref: workflowRef,
        goal,
        rigor,
        writes: {
          result: resultPath,
          artifact: { path: resultPath, schema: item.output },
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: requireGateField(gate.pass, 'pass', item.id, 'sub-run'),
        },
      } as Step;
    }
  }
}

function requireWritesField(
  writes: WorkflowRecipeWrites,
  field: keyof WorkflowRecipeWrites,
  itemId: string,
  kind: string,
): string {
  const value = writes[field];
  if (value === undefined) {
    fail(`recipe item '${itemId}' (${kind}) is missing writes.${field}`);
  }
  return value;
}

function requireGateField(
  value: readonly string[] | undefined,
  field: 'required' | 'allow' | 'pass',
  itemId: string,
  kind: string,
): string[] {
  if (value === undefined) {
    fail(`recipe item '${itemId}' (${kind}) is missing gate.${field}`);
  }
  return [...value];
}

function compileEntryMode(
  mode: WorkflowRecipeEntryMode,
  startsAt: string,
): {
  name: string;
  start_at: string;
  rigor: string;
  description: string;
  default_lane?: string;
} {
  return {
    name: mode.name,
    start_at: startsAt,
    rigor: mode.rigor,
    description: mode.description,
    ...(mode.default_lane !== undefined ? { default_lane: mode.default_lane } : {}),
  };
}

function recipeHasOverrides(recipe: WorkflowRecipe): boolean {
  return recipe.items.some((item) => Object.keys(item.route_overrides).length > 0);
}

interface RecipeFrame {
  recipeId: string;
  version: string;
  purpose: string;
  entry: {
    signals: { include: readonly string[]; exclude: readonly string[] };
    intent_prefixes: readonly string[];
  };
  startsAt: string;
  initialContracts: Set<WorkflowPrimitiveContractRef>;
  phaseEntries: readonly { canonical: CanonicalPhase; id: string; title: string }[];
  declaredOmits: readonly CanonicalPhase[];
  spineRationale: string | undefined;
  defaultSelection: WorkflowRecipe['default_selection'];
}

function frameRecipe(recipe: WorkflowRecipe): RecipeFrame {
  const recipeId = recipe.id as unknown as string;
  const version = requireRecipeField(recipe.version, 'version', recipeId);
  const entry = requireRecipeField(recipe.entry, 'entry', recipeId);
  const phaseEntries = requireRecipeField(recipe.phases, 'phases', recipeId);
  const spinePolicy = requireRecipeField(recipe.spine_policy, 'spine_policy', recipeId);
  return {
    recipeId,
    version,
    purpose: recipe.purpose,
    entry: {
      signals: {
        include: entry.signals.include,
        exclude: entry.signals.exclude,
      },
      intent_prefixes: entry.intent_prefixes,
    },
    startsAt: recipe.starts_at as unknown as string,
    initialContracts: new Set(recipe.initial_contracts),
    phaseEntries: phaseEntries.map((p) => ({
      canonical: p.canonical,
      id: p.id as unknown as string,
      title: p.title,
    })),
    declaredOmits: spinePolicy.mode === 'partial' ? spinePolicy.omits : [],
    spineRationale: spinePolicy.mode === 'partial' ? spinePolicy.rationale : undefined,
    defaultSelection: recipe.default_selection,
  };
}

// Compile the recipe for a single entry mode. Reachability + overrides are
// applied; unreachable items are dropped, empty phases are filtered, and
// spine_policy.omits is widened to include any canonical that ends up
// empty in this mode (so the Workflow validator's spine completeness rule
// stays satisfied).
function compileForMode(
  recipe: WorkflowRecipe,
  frame: RecipeFrame,
  mode: WorkflowRecipeEntryMode,
): WorkflowValue {
  const reachable = computeReachableForMode(recipe, mode);
  const reachableItems = recipe.items.filter((item) => reachable.has(item.id as unknown as string));
  if (reachableItems.length === 0) {
    fail(
      `recipe '${frame.recipeId}' has no reachable items from starts_at '${frame.startsAt}' for mode '${mode.name}'`,
    );
  }

  const producerByContract = buildContractProducerIndex(frame.recipeId, reachableItems);

  const phases: { id: string; title: string; canonical: CanonicalPhase; steps: string[] }[] = [];
  const reachedCanonicals = new Set<CanonicalPhase>();
  for (const phase of frame.phaseEntries) {
    const items = reachableItems.filter((i) => i.phase === phase.canonical);
    if (items.length === 0) continue;
    reachedCanonicals.add(phase.canonical);
    phases.push({
      id: phase.id,
      title: phase.title,
      canonical: phase.canonical,
      steps: items.map((i) => i.id as unknown as string),
    });
  }
  if (phases.length === 0) {
    fail(`recipe '${frame.recipeId}' compiled to zero phases for mode '${mode.name}'`);
  }

  const steps: Step[] = reachableItems.map((item) => {
    const reads = computeReads(item, frame.initialContracts, producerByContract);
    const routes = compileRoutesForMode(item, mode);
    return compileItem(item, reads, routes);
  });

  // Per-mode spine_policy: union of recipe-declared omits and any
  // canonical that ended up empty for this mode. The rationale gets
  // a per-mode suffix so the file is self-explanatory.
  const declaredOmitSet = new Set<CanonicalPhase>(frame.declaredOmits);
  const autoOmits: CanonicalPhase[] = [];
  for (const canonical of CANONICAL_PHASES) {
    if (declaredOmitSet.has(canonical)) continue;
    if (reachedCanonicals.has(canonical)) continue;
    // Only add if the recipe had a phase entry for this canonical
    // (otherwise it was already absent at the recipe level).
    const wasDeclared = frame.phaseEntries.some((p) => p.canonical === canonical);
    if (wasDeclared) autoOmits.push(canonical);
  }
  const omits: CanonicalPhase[] = [...frame.declaredOmits, ...autoOmits];

  // SpinePolicy discriminator: 'strict' when zero omits, 'partial' when at
  // least one. If the recipe was 'strict' and per-mode reachability auto-
  // omits a phase, the compiled output flips to 'partial' with an auto-
  // generated rationale.
  const spinePolicy =
    omits.length === 0
      ? { mode: 'strict' as const }
      : {
          mode: 'partial' as const,
          omits,
          rationale: composeSpineRationale(frame.spineRationale, autoOmits, mode),
        };

  const compiledEntryMode = compileEntryMode(mode, frame.startsAt);

  const workflow: unknown = {
    schema_version: '2',
    id: recipe.id,
    version: frame.version,
    purpose: frame.purpose,
    entry: {
      signals: {
        include: frame.entry.signals.include,
        exclude: frame.entry.signals.exclude,
      },
      intent_prefixes: frame.entry.intent_prefixes,
    },
    entry_modes: [compiledEntryMode],
    phases,
    spine_policy: spinePolicy,
    steps,
    ...(frame.defaultSelection !== undefined ? { default_selection: frame.defaultSelection } : {}),
  };

  const parsed = Workflow.safeParse(workflow);
  if (!parsed.success) {
    fail(
      `recipe '${frame.recipeId}' compiled to a Workflow that fails parse for mode '${mode.name}': ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function composeSpineRationale(
  declared: string | undefined,
  autoOmits: readonly CanonicalPhase[],
  mode: WorkflowRecipeEntryMode,
): string {
  if (autoOmits.length === 0) {
    return declared ?? '';
  }
  const autoNote = `mode '${mode.name}' (rigor '${mode.rigor}') also omits ${autoOmits
    .map((c) => `'${c}'`)
    .join(', ')} because route_overrides leave those canonicals with no reachable items.`;
  return declared !== undefined && declared.length > 0 ? `${declared} ${autoNote}` : autoNote;
}

export function compileRecipeToWorkflow(recipe: WorkflowRecipe): CompileResult {
  const frame = frameRecipe(recipe);
  const entryModes = requireRecipeField(recipe.entry_modes, 'entry_modes', frame.recipeId);

  if (!recipeHasOverrides(recipe)) {
    // No mode-specific topology. Compile once for the first mode, then
    // expand entry_modes to the full recipe list. This preserves the
    // historical single-circuit.json shape for build/explore/review.
    const firstMode = entryModes[0];
    if (firstMode === undefined) {
      fail(`recipe '${frame.recipeId}' has empty entry_modes`);
    }
    const single = compileForMode(recipe, frame, firstMode);
    const expanded = {
      ...single,
      entry_modes: entryModes.map((mode) => compileEntryMode(mode, frame.startsAt)),
    };
    const reparsed = Workflow.safeParse(expanded);
    if (!reparsed.success) {
      fail(
        `recipe '${frame.recipeId}' failed to re-parse after entry_modes expansion: ${reparsed.error.message}`,
      );
    }
    return { kind: 'single', workflow: reparsed.data };
  }

  const workflows = new Map<string, WorkflowValue>();
  for (const mode of entryModes) {
    workflows.set(mode.name, compileForMode(recipe, frame, mode));
  }
  return { kind: 'per-mode', workflows };
}
