import { DispatchRole } from './step.js';

// Convenience re-export. Dispatch roles are the authoritative enum.
// `orchestrator` is an executor, not a role — it does not dispatch.
export const Role = DispatchRole;
export type Role = DispatchRole;
