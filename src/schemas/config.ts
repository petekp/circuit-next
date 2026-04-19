import { z } from 'zod';
import {
  AdapterName,
  BuiltInAdapter,
  CustomAdapterDescriptor,
  RESERVED_ADAPTER_NAMES,
} from './adapter.js';
import { WorkflowId } from './ids.js';
import { SelectionOverride } from './selection-policy.js';
import { DispatchRole } from './step.js';

// ADAPTER-I5 + ADAPTER-I9: the registry-layer `AdapterReference` is a
// 2-variant discriminated union with per-variant `.strict()`. Inline
// `CustomAdapterDescriptor` is NOT a legal registry-layer reference —
// custom adapters must be registered in `dispatch.adapters` exactly once
// and referenced by name. Surplus keys (typos like `nmae: 'gemini'`) are
// rejected at parse time so they point at the typo directly.
//
// Codex MED #8 fold-in — `AdapterReference` is exported so future callers
// can validate registry-layer references directly (instead of reaching for
// `AdapterRef`, which admits inline custom descriptors and would silently
// relax ADAPTER-I5).
export const AdapterReference = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('builtin'), name: BuiltInAdapter }).strict(),
  z.object({ kind: z.literal('named'), name: AdapterName }).strict(),
]);
export type AdapterReference = z.infer<typeof AdapterReference>;

// ADAPTER-I9: `.strict()` on DispatchConfigBody rejects surplus keys at the
// top level (e.g. `dispatch.adpaters` typo transposition), so the author's
// intent — "register a custom adapter" — fails loudly rather than silently
// producing an empty registry whose named references then fail closure with
// a misleading error far from the typo.
const DispatchConfigBody = z
  .object({
    default: z.union([BuiltInAdapter, z.literal('auto'), AdapterName]).default('auto'),
    roles: z.record(DispatchRole, AdapterReference).default({}),
    circuits: z.record(WorkflowId, AdapterReference).default({}),
    adapters: z.record(AdapterName, CustomAdapterDescriptor).default({}),
  })
  .strict();

const issueAt = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

export const DispatchConfig = DispatchConfigBody.superRefine((cfg, ctx) => {
  // ADAPTER-I2: reserved-name disjointness. A custom adapter keyed under a
  // `BuiltInAdapter` value or the `'auto'` sentinel would silently shadow
  // the built-in in `dispatch.default` resolution — it would parse, appear
  // in the registry, and be picked by `default: 'codex'`, producing a
  // behavior divergence the author did not intend. Reject at parse time.
  //
  // Codex HIGH #3 fold-in — iterate only OWN keys via `Object.keys` and
  // check membership via a Set (not via bracket access on the record), so
  // inherited prototype names like `constructor`, `toString`, `__proto__`,
  // and `hasOwnProperty` cannot smuggle past closure checks. Bracket
  // access `cfg.adapters['constructor']` on a parsed object would resolve
  // to `Object.prototype.constructor` and satisfy a truthiness check even
  // when no own property exists.
  const ownAdapterKeys = Object.keys(cfg.adapters);
  const registered = new Set<string>(ownAdapterKeys);
  const reserved = new Set<string>(RESERVED_ADAPTER_NAMES);
  for (const name of ownAdapterKeys) {
    if (reserved.has(name)) {
      issueAt(
        ctx,
        ['adapters', name],
        `adapter name '${name}' is reserved (built-in or 'auto') and cannot be used as a custom adapter key`,
      );
    }
    // Codex HIGH #2 fold-in — registry key and descriptor `name` must
    // agree. `{adapters: {gemini: {name: 'ollama', ...}}}` parses per
    // AdapterName regex but leaves two adapter identities (`gemini` via
    // registry key, `ollama` via emitted descriptor) for a single
    // registered executor. Events would carry a `name` the audit index
    // doesn't know about.
    const descriptor = cfg.adapters[name];
    if (descriptor && descriptor.name !== name) {
      issueAt(
        ctx,
        ['adapters', name, 'name'],
        `adapter registry key '${name}' does not match descriptor name '${descriptor.name}'`,
      );
    }
  }
  const known = new Set<string>(['auto', ...BuiltInAdapter.options, ...ownAdapterKeys]);
  if (typeof cfg.default === 'string' && !known.has(cfg.default)) {
    issueAt(ctx, ['default'], `dispatch.default references unknown adapter: ${cfg.default}`);
  }
  for (const [role, ref] of Object.entries(cfg.roles)) {
    if (ref && ref.kind === 'named' && !registered.has(ref.name)) {
      issueAt(ctx, ['roles', role], `role adapter not registered: ${ref.name}`);
    }
  }
  for (const [circuit, ref] of Object.entries(cfg.circuits)) {
    if (ref && ref.kind === 'named' && !registered.has(ref.name)) {
      issueAt(ctx, ['circuits', circuit], `circuit adapter not registered: ${ref.name}`);
    }
  }
});
export type DispatchConfig = z.infer<typeof DispatchConfig>;

// Codex HIGH #5 fold-in — legacy `skills: string[]` channel removed. The
// previous shape bypassed `SkillOverride` AND accepted arbitrary strings
// (not `SkillId`-validated). Per-circuit skill contribution flows through
// `selection.skills` via typed `SkillOverride` operations (SEL-I3).
export const CircuitOverride = z
  .object({
    selection: SelectionOverride.optional(),
  })
  .strict();
export type CircuitOverride = z.infer<typeof CircuitOverride>;

export const Config = z.object({
  schema_version: z.literal(1),
  dispatch: DispatchConfig.default({
    default: 'auto',
    roles: {},
    circuits: {},
    adapters: {},
  }),
  circuits: z.record(WorkflowId, CircuitOverride).default({}),
  defaults: z
    .object({
      selection: SelectionOverride.optional(),
    })
    .default({}),
});
export type Config = z.infer<typeof Config>;

export const ConfigLayer = z.enum(['default', 'user-global', 'project', 'invocation']);
export type ConfigLayer = z.infer<typeof ConfigLayer>;

export const LayeredConfig = z.object({
  layer: ConfigLayer,
  source_path: z.string().optional(),
  config: Config,
});
export type LayeredConfig = z.infer<typeof LayeredConfig>;
