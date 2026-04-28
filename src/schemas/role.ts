import { RelayRole } from './step.js';

// Convenience re-export. Relay roles are the authoritative enum.
// `orchestrator` is an executor, not a role — it does not relay.
export const Role = RelayRole;
export type Role = RelayRole;
