import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { findVerificationWriter } from '../registries/verification-writers/registry.js';
import { recoveryRouteForStep } from './recovery-route.js';
import { isRunRelativePathError, writeJsonReport } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type VerificationStep = CompiledFlow['steps'][number] & { kind: 'verification' };

function verificationFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `verification step '${stepId}': report writer failed (${message})`;
}

function isInsideOrSame(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

function resolveProjectRelativeCwd(projectRoot: string, cwd: string): string {
  const rootAbs = resolve(projectRoot);
  const targetAbs = resolve(rootAbs, cwd);
  if (!isInsideOrSame(rootAbs, targetAbs)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes project root`);
  }
  if (!existsSync(rootAbs)) {
    throw new Error(`verification project root rejected: ${rootAbs} does not exist`);
  }
  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of cwd.split('/')) {
    if (segment === '.') continue;
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} does not exist`);
    }
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} crosses symlink ${JSON.stringify(cursor)}`,
      );
    }
    const cursorReal = realpathSync.native(cursor);
    if (!isInsideOrSame(rootReal, cursorReal)) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root through ${JSON.stringify(cursor)}`,
      );
    }
  }
  const targetReal = realpathSync.native(targetAbs);
  if (!isInsideOrSame(rootReal, targetReal)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root`);
  }
  return targetReal;
}

const VERIFICATION_ENV_INHERIT_ALLOWLIST = [
  'PATH',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'WINDIR',
] as const;

function verificationEnvironment(commandEnv: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of VERIFICATION_ENV_INHERIT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...commandEnv };
}

function summarizeOutput(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes) return value;
  return bytes.subarray(0, maxBytes).toString('utf8');
}

// Verification step driver. Sources commands from the registered
// VerificationBuilder, executes them via spawnSync, and asks the same
// builder to assemble the result report. The builder owns all
// flow-specific logic; the handler owns subprocess execution and
// summarization.
function writeVerificationReport(input: {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly step: VerificationStep;
  readonly projectRoot: string;
}): { readonly overall_status: 'passed' | 'failed' } {
  const { runFolder, flow, step, projectRoot } = input;
  const builder = findVerificationWriter(step.writes.report.schema);
  if (builder === undefined) {
    throw new Error(`verification step '${step.id}' has unsupported report schema`);
  }
  const commands = builder.loadCommands({ runFolder, flow, step });
  const observations = commands.map((command) => {
    const started = Date.now();
    const result = spawnSync(command.argv[0] as string, command.argv.slice(1), {
      cwd: resolveProjectRelativeCwd(projectRoot, command.cwd),
      env: verificationEnvironment(command.env),
      encoding: 'utf8',
      maxBuffer: command.max_output_bytes,
      shell: false,
      timeout: command.timeout_ms,
    });
    const durationMs = Math.max(0, Date.now() - started);
    const exitCode =
      typeof result.status === 'number' && result.error === undefined ? result.status : 1;
    const status: 'passed' | 'failed' = exitCode === 0 ? 'passed' : 'failed';
    const stderrParts = [
      typeof result.stderr === 'string' ? result.stderr : '',
      result.error === undefined ? '' : result.error.message,
      result.signal === null ? '' : `signal: ${result.signal}`,
    ].filter((part) => part.length > 0);
    return {
      command,
      exit_code: exitCode,
      status,
      duration_ms: durationMs,
      stdout_summary: summarizeOutput(
        typeof result.stdout === 'string' ? result.stdout : '',
        command.max_output_bytes,
      ),
      stderr_summary: summarizeOutput(stderrParts.join('\n'), command.max_output_bytes),
    };
  });
  const report = builder.buildResult(observations) as {
    readonly overall_status: 'passed' | 'failed';
  };
  writeJsonReport(runFolder, step.writes.report.path, report);
  return report;
}

export function runVerificationStep(
  ctx: StepHandlerContext & { readonly step: VerificationStep },
): StepHandlerResult {
  const { runFolder, flow, step, runId, attempt, recordedAt, push, state, projectRoot } = ctx;
  // VerificationBuilders return flow-specific shapes (BuildVerification,
  // FixVerification, etc.). The handler only needs `overall_status` to
  // drive check evaluation; both shapes have it.
  let verification: { readonly overall_status: 'passed' | 'failed' };
  try {
    if (projectRoot === undefined) {
      throw new Error(
        `verification step '${step.id}' requires CompiledFlowInvocation.projectRoot for project-relative cwd resolution`,
      );
    }
    verification = writeVerificationReport({ runFolder, flow, step, projectRoot });
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const reason = verificationFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'schema_sections',
      outcome: 'fail',
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.aborted',
      step_id: step.id,
      attempt,
      reason,
    });
    return { kind: 'aborted', reason };
  }

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.report_written',
    step_id: step.id,
    attempt,
    report_path: step.writes.report.path,
    report_schema: step.writes.report.schema,
  });

  if (verification.overall_status === 'passed') {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'schema_sections',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  }

  const reason = `verification step '${step.id}' failed one or more commands`;
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'schema_sections',
    outcome: 'fail',
    reason,
  });
  const recoveryRoute = recoveryRouteForStep(step);
  if (recoveryRoute !== undefined) {
    return { kind: 'advance', route: recoveryRoute, recovery_reason: reason };
  }
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.aborted',
    step_id: step.id,
    attempt,
    reason,
  });
  return { kind: 'aborted', reason };
}
