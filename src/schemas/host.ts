import { z } from 'zod';

export const HostKind = z.enum(['generic-shell', 'claude-code', 'codex']);
export type HostKind = z.infer<typeof HostKind>;

export const HostConfig = z
  .object({
    kind: HostKind.default('generic-shell'),
  })
  .strict();
export type HostConfig = z.infer<typeof HostConfig>;
