import { z } from 'zod';
import { CompiledFlowId } from './ids.js';
import { RelayRole } from './step.js';

export const EnabledConnector = z.enum(['agent', 'codex', 'codex-isolated']);
export type EnabledConnector = z.infer<typeof EnabledConnector>;

// connector-I2: the `'auto'` literal is a reserved sentinel for
// `RelayConfig.default`; connector names must not collide with it.
export const RESERVED_ADAPTER_NAMES: readonly string[] = [
  ...EnabledConnector.options,
  'auto',
] as const;

export const ConnectorName = z.string().regex(/^[a-z][a-z0-9-]*$/);
export type ConnectorName = z.infer<typeof ConnectorName>;

// connector-I3: element-level `.min(1)` forbids empty argv elements
// (e.g. `['']` or `['codex', '']`) which either signal a bug or are a
// silent gotcha — shells drop them; `execve(2)` does not.
export const CustomConnectorDescriptor = z
  .object({
    kind: z.literal('custom'),
    name: ConnectorName,
    command: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CustomConnectorDescriptor = z.infer<typeof CustomConnectorDescriptor>;

export const BuiltInConnectorRef = z
  .object({
    kind: z.literal('builtin'),
    name: EnabledConnector,
  })
  .strict();
export type BuiltInConnectorRef = z.infer<typeof BuiltInConnectorRef>;

export const NamedConnectorRef = z
  .object({
    kind: z.literal('named'),
    name: ConnectorName,
  })
  .strict();
export type NamedConnectorRef = z.infer<typeof NamedConnectorRef>;

export const ConnectorRef = z.discriminatedUnion('kind', [
  BuiltInConnectorRef,
  NamedConnectorRef,
  CustomConnectorDescriptor,
]);
export type ConnectorRef = z.infer<typeof ConnectorRef>;

// A resolved connector MUST NOT still be a named
// reference. Named references are pre-resolution pointers at the registry;
// the relayer must dereference them before emitting RelayStartedTraceEntry.
// `ResolvedConnector` is the 2-variant discriminated union used at the trace_entry
// layer; `ConnectorRef` remains the 3-variant pre-resolution union used in
// config and CLI parsing.
export const ResolvedConnector = z.discriminatedUnion('kind', [
  BuiltInConnectorRef,
  CustomConnectorDescriptor,
]);
export type ResolvedConnector = z.infer<typeof ResolvedConnector>;

// connector-I7: relay resolution source with category + disambiguator.
// Closes the category-only-provenance gap pre-emptively (same shape as
// SEL-I7 applied[] entries for selection). An audit reading
// `RelayStartedTraceEntry.resolved_from` can identify the exact config
// entry that chose the connector.
const ExplicitResolutionSource = z.object({ source: z.literal('explicit') }).strict();
const RoleResolutionSource = z.object({ source: z.literal('role'), role: RelayRole }).strict();
const CircuitResolutionSource = z
  .object({ source: z.literal('circuit'), flow_id: CompiledFlowId })
  .strict();
const DefaultResolutionSource = z.object({ source: z.literal('default') }).strict();
const AutoResolutionSource = z.object({ source: z.literal('auto') }).strict();

export const RelayResolutionSource = z.discriminatedUnion('source', [
  ExplicitResolutionSource,
  RoleResolutionSource,
  CircuitResolutionSource,
  DefaultResolutionSource,
  AutoResolutionSource,
]);
export type RelayResolutionSource = z.infer<typeof RelayResolutionSource>;
