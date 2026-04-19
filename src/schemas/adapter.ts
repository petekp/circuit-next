import { z } from 'zod';

export const BuiltInAdapter = z.enum(['agent', 'codex', 'codex-isolated']);
export type BuiltInAdapter = z.infer<typeof BuiltInAdapter>;

export const AdapterName = z.string().regex(/^[a-z][a-z0-9-]*$/);
export type AdapterName = z.infer<typeof AdapterName>;

export const CustomAdapterDescriptor = z
  .object({
    kind: z.literal('custom'),
    name: AdapterName,
    command: z.array(z.string()).min(1),
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
