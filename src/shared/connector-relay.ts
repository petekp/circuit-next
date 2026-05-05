import { createHash } from 'node:crypto';
import type { ResolvedSelection } from '../schemas/selection-policy.js';

// Shared relay-result shape produced by connector subprocess implementations.
// Materializers and v2 executors consume this shape without branching on the
// connector that produced it.
export interface RelayResult {
  readonly request_payload: string;
  readonly receipt_id: string;
  readonly result_body: string;
  readonly duration_ms: number;
  readonly cli_version: string;
}

export interface ConnectorRelayInput {
  prompt: string;
  timeoutMs?: number;
  resolvedSelection?: ResolvedSelection;
}

export function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
