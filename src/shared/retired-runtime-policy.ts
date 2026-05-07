import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RETIRED_RUNTIME_RUN_FOLDER_MESSAGE =
  'This run folder was created by the retired runtime. Start a fresh run.';

export const RETIRED_RUNTIME_RUN_FOLDER_ERROR_CODE = 'retired_runtime_run_folder';

export const RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE =
  'This invocation requires the retired runtime. Use a v2-supported flow run.';

export type RunFolderTraceRuntime = 'core-v2' | 'retired' | 'unknown';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function traceString(entry: Record<string, unknown>, key: string): string | undefined {
  const value = entry[key];
  if (typeof value === 'string' && value.length > 0) return value;
  const data = entry.data;
  if (!isRecord(data)) return undefined;
  const dataValue = data[key];
  return typeof dataValue === 'string' && dataValue.length > 0 ? dataValue : undefined;
}

export function detectRunFolderTraceRuntime(runFolder: string): RunFolderTraceRuntime {
  try {
    const firstLine = readFileSync(join(runFolder, 'trace.ndjson'), 'utf8').split(/\r?\n/, 1)[0];
    if (firstLine === undefined || firstLine.length === 0) return 'unknown';
    const raw: unknown = JSON.parse(firstLine);
    if (!isRecord(raw) || typeof raw.kind !== 'string' || raw.kind.length === 0) {
      return 'unknown';
    }
    return traceString(raw, 'engine') === 'core-v2' &&
      raw.kind === 'run.bootstrapped' &&
      traceString(raw, 'manifest_hash') !== undefined
      ? 'core-v2'
      : 'retired';
  } catch {
    return 'unknown';
  }
}
