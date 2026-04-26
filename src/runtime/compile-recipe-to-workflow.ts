// Pure compiler: WorkflowRecipe → Workflow. Takes a fully-populated recipe
// (recipe-level entry/entry_modes/spine_policy/phases/version present;
// per-item protocol/writes/gate present) and produces a Workflow object
// shaped like the existing committed `.claude-plugin/skills/<id>/circuit.json`
// fixtures. Build-time emit (Phase 4) writes the result to disk; the CI
// drift check recompiles and diffs.
//
// Failure modes are deliberate: if any compile-required field is missing,
// or any `kind ↔ artifact schema` pair is one the runner does not support,
// the compile throws with a clear message naming the offending item.

import type { CanonicalPhase } from '../schemas/phase.js';
import type { Step } from '../schemas/step.js';
import type { WorkflowPrimitiveContractRef } from '../schemas/workflow-primitives.js';
import type {
  WorkflowRecipe,
  WorkflowRecipeItem,
  WorkflowRecipeWrites,
} from '../schemas/workflow-recipe.js';
import type { Workflow as WorkflowValue } from '../schemas/workflow.js';
import { Workflow } from '../schemas/workflow.js';

export class WorkflowRecipeCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowRecipeCompileError';
  }
}

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
// per-attempt path indexing; the compiler drops them.
const RECIPE_ROUTES_DROPPED_AT_COMPILE = new Set(['retry', 'revise', 'stop', 'ask']);

// (step kind, artifact schema) pairs the runner's hardcoded synthesis/
// verification/checkpoint writers actually understand. Anything else is
// rejected at compile so the recipe author finds out before runtime.
//
//   - verification kind: only build.verification@v1 (writeVerificationArtifact
//     in runner.ts hardcodes this; everything else throws at runtime).
//   - checkpoint kind with a typed artifact: only build.brief@v1
//     (CheckpointStep superRefine already enforces this at the Workflow
//     parse layer; we mirror it here so the compile error is local).
function ensureSupportedKindArtifactPair(item: WorkflowRecipeItem): void {
  if (item.execution.kind === 'verification') {
    if (item.output !== 'build.verification@v1') {
      fail(
        `recipe item '${item.id}' has verification kind but writes '${item.output}'; runner only supports verification writing build.verification@v1`,
      );
    }
  }
  if (item.execution.kind === 'checkpoint' && item.writes?.artifact_path !== undefined) {
    if (item.output !== 'build.brief@v1') {
      fail(
        `recipe item '${item.id}' has checkpoint kind writing artifact '${item.output}'; runner only supports checkpoint artifact writing for build.brief@v1`,
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

// Build a contract → producing item index. Used to resolve the read-paths
// for each consuming item's typed input contracts. If a contract has no
// producer (and is not in initial_contracts) the consumer's compile fails.
function buildContractProducerIndex(
  recipe: WorkflowRecipe,
): Map<WorkflowPrimitiveContractRef, WorkflowRecipeItem> {
  const index = new Map<WorkflowPrimitiveContractRef, WorkflowRecipeItem>();
  for (const item of recipe.items) {
    if (index.has(item.output)) {
      // Multiple items writing the same contract is structurally
      // ambiguous for read resolution. Surface it now.
      const prior = index.get(item.output);
      fail(
        `recipe items '${prior?.id}' and '${item.id}' both write contract '${item.output}' — read-path resolution requires a single producer per contract`,
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
        `recipe item '${item.id}' input contract '${contract}' has no producer and is not in initial_contracts`,
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

// Map recipe routes to Workflow routes. The runtime's gate emits 'pass'
// or 'fail' uniformly across all gate kinds; recipes carry author-friendly
// outcome names (continue/complete/retry/revise/stop/ask). Only continue
// and complete map to pass; the rest are non-executable metadata for now
// and are dropped at compile (see RECIPE_ROUTES_DROPPED_AT_COMPILE).
function compileRoutes(item: WorkflowRecipeItem): Record<string, string> {
  const routes: Record<string, string> = {};
  let passSet = false;
  for (const [outcome, target] of Object.entries(item.routes)) {
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

export function compileRecipeToWorkflow(recipe: WorkflowRecipe): WorkflowValue {
  const version = requireRecipeField(recipe.version, 'version', recipe.id as unknown as string);
  const entry = requireRecipeField(recipe.entry, 'entry', recipe.id as unknown as string);
  const entryModes = requireRecipeField(
    recipe.entry_modes,
    'entry_modes',
    recipe.id as unknown as string,
  );
  const spinePolicy = requireRecipeField(
    recipe.spine_policy,
    'spine_policy',
    recipe.id as unknown as string,
  );
  const phaseEntries = requireRecipeField(recipe.phases, 'phases', recipe.id as unknown as string);

  const initialContracts = new Set(recipe.initial_contracts);
  const producerByContract = buildContractProducerIndex(recipe);

  // Group items by canonical phase preserving recipe order.
  const itemsByCanonical = new Map<CanonicalPhase, WorkflowRecipeItem[]>();
  for (const item of recipe.items) {
    const list = itemsByCanonical.get(item.phase) ?? [];
    list.push(item);
    itemsByCanonical.set(item.phase, list);
  }

  const phases = phaseEntries.map((phase) => {
    const items = itemsByCanonical.get(phase.canonical) ?? [];
    if (items.length === 0) {
      fail(
        `recipe '${recipe.id as unknown as string}' phases entry for canonical '${phase.canonical}' has no items — declare items in this phase or remove the entry from phases`,
      );
    }
    return {
      id: phase.id,
      title: phase.title,
      canonical: phase.canonical,
      steps: items.map((item) => item.id),
    };
  });

  const steps: Step[] = recipe.items.map((item) => {
    const reads = computeReads(item, initialContracts, producerByContract);
    const routes = compileRoutes(item);
    return compileItem(item, reads, routes);
  });

  const compiledEntryModes = entryModes.map((mode) => ({
    name: mode.name,
    start_at: recipe.starts_at,
    rigor: mode.rigor,
    description: mode.description,
    ...(mode.default_lane !== undefined ? { default_lane: mode.default_lane } : {}),
  }));

  const workflow: unknown = {
    schema_version: '2',
    id: recipe.id,
    version,
    purpose: recipe.purpose,
    entry: {
      signals: {
        include: entry.signals.include,
        exclude: entry.signals.exclude,
      },
      intent_prefixes: entry.intent_prefixes,
    },
    entry_modes: compiledEntryModes,
    phases,
    spine_policy: spinePolicy,
    steps,
    ...(recipe.default_selection !== undefined
      ? { default_selection: recipe.default_selection }
      : {}),
  };

  // Final parse: surface any structural issue Workflow's superRefine
  // catches (terminal reachability, pass-route cycle, dead steps) as a
  // compile error rather than a runtime surprise.
  const parsed = Workflow.safeParse(workflow);
  if (!parsed.success) {
    fail(
      `recipe '${recipe.id as unknown as string}' compiled to a Workflow that fails parse: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
