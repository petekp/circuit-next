import { join } from 'node:path';

export const RUN_RESULT_RELATIVE_PATH = 'reports/result.json';

export function runResultPath(runFolder: string): string {
  return join(runFolder, RUN_RESULT_RELATIVE_PATH);
}
