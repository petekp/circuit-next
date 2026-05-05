import { RUN_RESULT_RELATIVE_PATH } from '../../shared/result-path.js';
import type { RunClosedOutcomeV2, RunId } from '../domain/run.js';
import type { RunFileStore } from '../run-files/run-file-store.js';

export interface RunResultV2 {
  readonly schema_version: 1;
  readonly run_id: RunId;
  readonly flow_id: string;
  readonly goal: string;
  readonly outcome: RunClosedOutcomeV2;
  readonly summary: string;
  readonly closed_at: string;
  readonly trace_entries_observed: number;
  readonly manifest_hash: string;
  readonly reason?: string;
  readonly verdict?: string;
}

export async function writeRunResultV2(files: RunFileStore, result: RunResultV2): Promise<string> {
  return await files.writeJson(RUN_RESULT_RELATIVE_PATH, result);
}
