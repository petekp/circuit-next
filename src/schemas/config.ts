import { z } from 'zod';
import { AdapterName, BuiltInAdapter, CustomAdapterDescriptor } from './adapter.js';
import { WorkflowId } from './ids.js';
import { SelectionOverride } from './selection-policy.js';
import { DispatchRole } from './step.js';

const AdapterReference = z.union([
  z.object({ kind: z.literal('builtin'), name: BuiltInAdapter }),
  z.object({ kind: z.literal('named'), name: AdapterName }),
]);
export type AdapterReference = z.infer<typeof AdapterReference>;

const DispatchConfigBody = z.object({
  default: z.union([BuiltInAdapter, z.literal('auto'), AdapterName]).default('auto'),
  roles: z.record(DispatchRole, AdapterReference).default({}),
  circuits: z.record(WorkflowId, AdapterReference).default({}),
  adapters: z.record(AdapterName, CustomAdapterDescriptor).default({}),
});

const issueAt = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

export const DispatchConfig = DispatchConfigBody.superRefine((cfg, ctx) => {
  const known = new Set<string>(['auto', ...BuiltInAdapter.options, ...Object.keys(cfg.adapters)]);
  if (typeof cfg.default === 'string' && !known.has(cfg.default)) {
    issueAt(ctx, ['default'], `dispatch.default references unknown adapter: ${cfg.default}`);
  }
  for (const [role, ref] of Object.entries(cfg.roles)) {
    if (ref && ref.kind === 'named' && !cfg.adapters[ref.name]) {
      issueAt(ctx, ['roles', role], `role adapter not registered: ${ref.name}`);
    }
  }
  for (const [circuit, ref] of Object.entries(cfg.circuits)) {
    if (ref && ref.kind === 'named' && !cfg.adapters[ref.name]) {
      issueAt(ctx, ['circuits', circuit], `circuit adapter not registered: ${ref.name}`);
    }
  }
});
export type DispatchConfig = z.infer<typeof DispatchConfig>;

export const CircuitOverride = z.object({
  skills: z.array(z.string()).default([]),
  selection: SelectionOverride.optional(),
});
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
