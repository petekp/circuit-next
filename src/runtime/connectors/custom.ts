import { type ChildProcess, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { CustomConnectorDescriptor } from '../../schemas/connector.js';
import type { ConnectorRelayInput, RelayResult } from './shared.js';
import { extractJsonObject } from './shared.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const SIGTERM_TO_SIGKILL_GRACE_MS = 2_000;
const STDOUT_MAX_BYTES = 16 * 1024 * 1024;
const STDERR_MAX_BYTES = 1024 * 1024;

export interface CustomRelayInput extends ConnectorRelayInput {
  readonly descriptor: CustomConnectorDescriptor;
}

function extractConfiguredOutput(
  descriptor: CustomConnectorDescriptor,
  stdout: string,
): { readonly receiptId: string; readonly resultBody: string } {
  const jsonText = extractJsonObject(stdout);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      `custom connector '${descriptor.name}' stdout did not contain a JSON object: ${(err as Error).message}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`custom connector '${descriptor.name}' stdout JSON must be an object`);
  }
  const record = parsed as Record<string, unknown>;
  const raw = record[descriptor.output.field];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(
      `custom connector '${descriptor.name}' output field '${descriptor.output.field}' must be a non-empty string`,
    );
  }
  const receipt = record.receipt_id;
  return {
    receiptId:
      typeof receipt === 'string' && receipt.length > 0
        ? receipt
        : `custom:${descriptor.name}:${Date.now()}`,
    resultBody: extractJsonObject(raw),
  };
}

export async function relayCustom(input: CustomRelayInput): Promise<RelayResult> {
  const { descriptor } = input;
  if (descriptor.prompt_transport !== 'append-argv') {
    throw new Error(
      `custom connector '${descriptor.name}' prompt transport '${descriptor.prompt_transport}' is not implemented`,
    );
  }
  const [executable, ...baseArgs] = descriptor.command;
  if (executable === undefined) {
    throw new Error(`custom connector '${descriptor.name}' command is empty`);
  }
  const args = [...baseArgs, input.prompt];
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = performance.now();

  return await new Promise<RelayResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
        detached: true,
      });
    } catch (err) {
      reject(
        new Error(`custom connector '${descriptor.name}' spawn failed: ${(err as Error).message}`),
      );
      return;
    }

    let stdout = '';
    let stdoutBytes = 0;
    let stderr = '';
    let stderrBytes = 0;
    let stdoutCapped = false;
    let stderrCapped = false;
    let timedOut = false;
    let killGroupSucceeded = false;

    const killProcessGroup = (signal: NodeJS.Signals): boolean => {
      const pid = child.pid;
      if (typeof pid !== 'number') return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup('SIGTERM');
      setTimeout(() => {
        killProcessGroup('SIGKILL');
      }, SIGTERM_TO_SIGKILL_GRACE_MS);
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES) {
        stdoutCapped = true;
        return;
      }
      stdout += chunk;
      stdoutBytes += chunk.length;
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderrBytes + chunk.length > STDERR_MAX_BYTES) {
        stderrCapped = true;
        return;
      }
      stderr += chunk;
      stderrBytes += chunk.length;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`custom connector '${descriptor.name}' spawn error: ${err.message}`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const duration_ms = performance.now() - start;
      if (timedOut) {
        reject(
          new Error(
            `custom connector '${descriptor.name}' timed out after ${timeoutMs}ms; group-kill ${killGroupSucceeded ? 'sent' : 'failed'}; final signal=${signal ?? 'none'}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `custom connector '${descriptor.name}' exited with code ${code}${signal ? ` (signal ${signal})` : ''}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (stdoutCapped) {
        reject(
          new Error(
            `custom connector '${descriptor.name}' stdout exceeded ${STDOUT_MAX_BYTES} bytes`,
          ),
        );
        return;
      }
      try {
        const extracted = extractConfiguredOutput(descriptor, stdout);
        resolve({
          request_payload: input.prompt,
          receipt_id: extracted.receiptId,
          result_body: extracted.resultBody,
          duration_ms,
          cli_version: `custom:${descriptor.name}`,
        });
      } catch (err) {
        const stderrSuffix = stderrCapped ? ' [stderr capped]' : '';
        reject(
          new Error(
            `custom connector '${descriptor.name}': ${(err as Error).message}; stdout[:500]=${stdout.slice(0, 500)}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`,
          ),
        );
      }
    });
  });
}
