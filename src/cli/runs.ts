import {
  RunStatusFolderError,
  projectRunStatusFromRunFolder,
} from '../run-status/project-run-folder.js';
import { type EngineErrorCodeV1, EngineErrorV1 } from '../schemas/run-status.js';

function engineError(input: {
  readonly code: EngineErrorCodeV1;
  readonly message: string;
  readonly runFolder?: string;
}): EngineErrorV1 {
  return EngineErrorV1.parse({
    api_version: 'engine-error-v1',
    schema_version: 1,
    error: {
      code: input.code,
      message: input.message,
    },
    ...(input.runFolder === undefined ? {} : { run_folder: input.runFolder }),
  });
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function invalidInvocation(message: string, runFolder?: string): number {
  writeJson(
    engineError({
      code: 'invalid_invocation',
      message,
      ...(runFolder === undefined ? {} : { runFolder }),
    }),
  );
  return 2;
}

function parseShowArgs(argv: readonly string[]): { readonly runFolder: string } | string {
  let runFolder: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--run-folder') {
      const value = argv[i + 1];
      if (value === undefined || value.length === 0) return '--run-folder requires a value';
      if (runFolder !== undefined) return 'supply --run-folder only once';
      runFolder = value;
      i += 1;
      continue;
    }
    if (token.startsWith('--')) return `unknown flag: ${token}`;
    return `unexpected positional argument: ${token}`;
  }

  if (!json) return 'runs show requires --json';
  if (runFolder === undefined) return '--run-folder is required';
  return { runFolder };
}

export async function runRunsCommand(argv: readonly string[]): Promise<number> {
  const subcommand = argv[0];
  if (subcommand !== 'show') {
    return invalidInvocation(
      subcommand === undefined
        ? 'runs requires a subcommand'
        : `unknown runs subcommand: ${subcommand}`,
    );
  }

  const parsed = parseShowArgs(argv.slice(1));
  if (typeof parsed === 'string') return invalidInvocation(parsed);

  try {
    writeJson(projectRunStatusFromRunFolder(parsed.runFolder));
    return 0;
  } catch (err) {
    if (err instanceof RunStatusFolderError) {
      writeJson(
        engineError({
          code: err.code,
          message: err.message,
          runFolder: err.runFolder,
        }),
      );
      return 1;
    }
    writeJson(
      engineError({
        code: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
        runFolder: parsed.runFolder,
      }),
    );
    return 1;
  }
}
