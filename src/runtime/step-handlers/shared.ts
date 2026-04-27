import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveRunRelative } from '../run-relative-path.js';

export function isRunRelativePathError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('run-relative path rejected');
}

export function writeJsonArtifact(runRoot: string, path: string, body: unknown): void {
  const abs = resolveRunRelative(runRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}
