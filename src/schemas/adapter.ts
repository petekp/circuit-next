import { z } from 'zod';
import { WorkflowId } from './ids.js';
import { DispatchRole } from './step.js';

export const BuiltInAdapter = z.enum(['agent', 'codex', 'codex-isolated']);
export type BuiltInAdapter = z.infer<typeof BuiltInAdapter>;

// ADAPTER-I2: the `'auto'` literal is a reserved sentinel for
// `DispatchConfig.default`; adapter names must not collide with it.
export const RESERVED_ADAPTER_NAMES: readonly string[] = [
  ...BuiltInAdapter.options,
  'auto',
] as const;

export const AdapterName = z.string().regex(/^[a-z][a-z0-9-]*$/);
export type AdapterName = z.infer<typeof AdapterName>;

// ADAPTER-I3: element-level `.min(1)` forbids empty argv elements
// (e.g. `['']` or `['codex', '']`) which either signal a bug or are a
// silent gotcha — shells drop them; `execve(2)` does not.
export const CustomAdapterDescriptor = z
  .object({
    kind: z.literal('custom'),
    name: AdapterName,
    command: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CustomAdapterDescriptor = z.infer<typeof CustomAdapterDescriptor>;

export const BuiltInAdapterRef = z
  .object({
    kind: z.literal('builtin'),
    name: BuiltInAdapter,
  })
  .strict();
export type BuiltInAdapterRef = z.infer<typeof BuiltInAdapterRef>;

export const NamedAdapterRef = z
  .object({
    kind: z.literal('named'),
    name: AdapterName,
  })
  .strict();
export type NamedAdapterRef = z.infer<typeof NamedAdapterRef>;

export const AdapterRef = z.discriminatedUnion('kind', [
  BuiltInAdapterRef,
  NamedAdapterRef,
  CustomAdapterDescriptor,
]);
export type AdapterRef = z.infer<typeof AdapterRef>;

// Codex HIGH #1 fold-in — a resolved adapter MUST NOT still be a named
// reference. Named references are pre-resolution pointers at the registry;
// the dispatcher must dereference them before emitting DispatchStartedEvent.
// `ResolvedAdapter` is the 2-variant discriminated union used at the event
// layer; `AdapterRef` remains the 3-variant pre-resolution union used in
// config and CLI parsing.
export const ResolvedAdapter = z.discriminatedUnion('kind', [
  BuiltInAdapterRef,
  CustomAdapterDescriptor,
]);
export type ResolvedAdapter = z.infer<typeof ResolvedAdapter>;

// ADAPTER-I7: dispatch resolution source with category + disambiguator.
// Closes the category-only-provenance gap pre-emptively (same shape as
// SEL-I7 applied[] entries for selection). An audit reading
// `DispatchStartedEvent.resolved_from` can identify the exact config
// entry that chose the adapter.
const ExplicitResolutionSource = z.object({ source: z.literal('explicit') }).strict();
const RoleResolutionSource = z.object({ source: z.literal('role'), role: DispatchRole }).strict();
const CircuitResolutionSource = z
  .object({ source: z.literal('circuit'), workflow_id: WorkflowId })
  .strict();
const DefaultResolutionSource = z.object({ source: z.literal('default') }).strict();
const AutoResolutionSource = z.object({ source: z.literal('auto') }).strict();

export const DispatchResolutionSource = z.discriminatedUnion('source', [
  ExplicitResolutionSource,
  RoleResolutionSource,
  CircuitResolutionSource,
  DefaultResolutionSource,
  AutoResolutionSource,
]);
export type DispatchResolutionSource = z.infer<typeof DispatchResolutionSource>;
