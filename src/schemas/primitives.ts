import { z } from 'zod';

/**
 * Path-safe filename stem for control-plane artifacts (continuity records,
 * run roots, similar). Used for any field whose value is joined into a
 * filesystem path AT PARSE TIME, not at the call site.
 *
 * Authority: artifacts.json rows with `path_derived_fields` MUST use this
 * (or a conservatively-equivalent primitive) for those fields. Enforced
 * by ADR-0003 and `scripts/audit.mjs` authority-graph dimension.
 */
export const ControlPlaneFileStem = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, {
    message:
      'must match /^[a-z0-9][a-z0-9._-]*$/ (lowercase alnum start; alnum, dot, underscore, hyphen thereafter)',
  })
  .refine((value) => value !== '.' && value !== '..', {
    message: 'must not be a current or parent directory segment',
  })
  .refine((value) => !value.includes('..'), {
    message: 'must not contain parent-directory traversal',
  })
  .refine((value) => !value.includes('/') && !value.includes('\\'), {
    message: 'must not contain path separators',
  });

export type ControlPlaneFileStem = z.infer<typeof ControlPlaneFileStem>;
