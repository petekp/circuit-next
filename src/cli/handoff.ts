import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readManifestSnapshot } from '../runtime/manifest-snapshot-writer.js';
import { deriveSnapshot } from '../runtime/snapshot-writer.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import {
  ContinuityIndex,
  ContinuityRecord,
  type ContinuityRecord as ContinuityRecordValue,
} from '../schemas/continuity.js';
import type { ControlPlaneFileStem } from '../schemas/scalars.js';
import type { Snapshot } from '../schemas/snapshot.js';
import { utilityProgress } from './utility-progress.js';

type HandoffAction = 'save' | 'resume' | 'done';

interface HandoffArgs {
  readonly action: HandoffAction;
  readonly goal?: string;
  readonly next?: string;
  readonly stateMarkdown?: string;
  readonly debtMarkdown?: string;
  readonly runFolder?: string;
  readonly controlPlane?: string;
  readonly projectRoot?: string;
  readonly recordId?: string;
  readonly createdAt?: string;
  readonly progress: boolean;
}

export interface HandoffMainOptions {
  readonly now?: () => Date;
}

const DEFAULT_CONTROL_PLANE = '.circuit-next';

function usage(): string {
  return [
    'usage: circuit-next handoff [save] --goal "<goal>" --next "<next>" [--state-markdown <md>] [--debt-markdown <md>] [--run-folder <path>] [--control-plane <path>] [--record-id <stem>] [--progress jsonl]',
    '       circuit-next handoff resume [--control-plane <path>] [--progress jsonl]',
    '       circuit-next handoff done [--control-plane <path>] [--progress jsonl]',
  ].join('\n');
}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const next = argv[index + 1];
  if (next === undefined || next.length === 0) throw new Error(`${flag} requires a value`);
  return next;
}

function parseArgs(argv: readonly string[]): HandoffArgs {
  let action: HandoffAction = 'save';
  let goal: string | undefined;
  let next: string | undefined;
  let stateMarkdown: string | undefined;
  let debtMarkdown: string | undefined;
  let runFolder: string | undefined;
  let controlPlane: string | undefined;
  let projectRoot: string | undefined;
  let recordId: string | undefined;
  let createdAt: string | undefined;
  let progress = false;

  let start = 0;
  const first = argv[0];
  if (first === 'save' || first === 'resume' || first === 'done') {
    action = first;
    start = 1;
  }

  for (let i = start; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok === '--goal') {
      goal = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--next') {
      next = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--state-markdown') {
      stateMarkdown = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--debt-markdown') {
      debtMarkdown = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--run-folder') {
      runFolder = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--control-plane') {
      controlPlane = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--project-root') {
      projectRoot = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--record-id') {
      recordId = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--created-at') {
      createdAt = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--progress') {
      const value = takeValue(argv, i, tok);
      if (value !== 'jsonl') throw new Error("--progress only supports 'jsonl'");
      progress = true;
      i += 1;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    throw new Error(tok.startsWith('--') ? `unknown flag: ${tok}` : `unexpected argument: ${tok}`);
  }

  return {
    action,
    progress,
    ...(goal === undefined ? {} : { goal }),
    ...(next === undefined ? {} : { next }),
    ...(stateMarkdown === undefined ? {} : { stateMarkdown }),
    ...(debtMarkdown === undefined ? {} : { debtMarkdown }),
    ...(runFolder === undefined ? {} : { runFolder }),
    ...(controlPlane === undefined ? {} : { controlPlane }),
    ...(projectRoot === undefined ? {} : { projectRoot }),
    ...(recordId === undefined ? {} : { recordId }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
}

function continuityRoot(controlPlane: string): string {
  return resolve(controlPlane, 'continuity');
}

function recordsRoot(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'records');
}

function indexPath(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'index.json');
}

function recordPath(controlPlane: string, recordId: string): string {
  return join(recordsRoot(controlPlane), `${recordId}.json`);
}

function utilityReportsRoot(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'reports');
}

function handoffResultPath(controlPlane: string, action: HandoffAction): string {
  return join(utilityReportsRoot(controlPlane), `${action}-result.json`);
}

function operatorSummaryPath(controlPlane: string): string {
  return join(utilityReportsRoot(controlPlane), 'operator-summary.md');
}

function activeRunPath(controlPlane: string): string {
  return join(controlPlane, 'active-run.md');
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeMarkdown(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`);
}

function loadRunBackedSnapshot(runFolder: string): {
  readonly snapshot: Snapshot;
  readonly currentStage: string;
} {
  const snapshot = deriveSnapshot(runFolder);
  const manifest = readManifestSnapshot(runFolder);
  const flow = CompiledFlow.parse(
    JSON.parse(Buffer.from(manifest.bytes_base64, 'base64').toString('utf8')),
  );
  const currentStep = snapshot.current_step ?? flow.entry_modes[0]?.start_at;
  if (currentStep === undefined) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  const stage = flow.stages.find((candidate) => candidate.steps.includes(currentStep as never));
  return {
    snapshot: { ...snapshot, current_step: currentStep },
    currentStage: stage?.canonical ?? stage?.id ?? 'frame',
  };
}

function buildRecord(args: HandoffArgs, now: () => Date): ContinuityRecordValue {
  if (args.goal === undefined || args.goal.length === 0) {
    throw new Error('--goal is required when saving handoff continuity');
  }
  if (args.next === undefined || args.next.length === 0) {
    throw new Error('--next is required when saving handoff continuity');
  }
  const projectRoot = resolve(args.projectRoot ?? process.cwd());
  const createdAt = args.createdAt ?? now().toISOString();
  const recordId = (args.recordId ?? `continuity-${randomUUID()}`) as ControlPlaneFileStem;
  const base = {
    schema_version: 1 as const,
    record_id: recordId,
    project_root: projectRoot,
    created_at: createdAt,
    git: { cwd: projectRoot },
    narrative: {
      goal: args.goal,
      next: args.next,
      state_markdown: args.stateMarkdown ?? '- No extra session state was provided.',
      debt_markdown: args.debtMarkdown ?? '- No open debt was recorded.',
    },
  };

  if (args.runFolder === undefined) {
    return ContinuityRecord.parse({
      ...base,
      continuity_kind: 'standalone',
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
  }

  const runFolder = resolve(args.runFolder);
  const { snapshot, currentStage } = loadRunBackedSnapshot(runFolder);
  if (snapshot.current_step === undefined) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  return ContinuityRecord.parse({
    ...base,
    continuity_kind: 'run-backed',
    run_ref: {
      run_id: snapshot.run_id,
      ...(snapshot.invocation_id === undefined ? {} : { invocation_id: snapshot.invocation_id }),
      current_stage: currentStage,
      current_step: snapshot.current_step,
      runtime_status: snapshot.status,
      runtime_updated_at: snapshot.updated_at,
    },
    resume_contract: {
      mode: 'resume_run',
      auto_resume: false,
      requires_explicit_resume: true,
    },
  });
}

function summaryForRecord(record: ContinuityRecordValue, source: string): string {
  return [
    '# Circuit Handoff',
    '',
    `Source: ${source}`,
    `Record: ${record.record_id}`,
    `Kind: ${record.continuity_kind}`,
    '',
    '## Goal',
    record.narrative.goal,
    '',
    '## Next Action',
    record.narrative.next,
    '',
    '## State',
    record.narrative.state_markdown,
    '',
    '## Debt',
    record.narrative.debt_markdown,
  ].join('\n');
}

function writeActiveRun(controlPlane: string, record: ContinuityRecordValue): string | undefined {
  if (record.continuity_kind !== 'run-backed') return undefined;
  const path = activeRunPath(controlPlane);
  writeMarkdown(
    path,
    [
      '# Active Circuit Run',
      '',
      `Run: ${record.run_ref.run_id}`,
      `Status: ${record.run_ref.runtime_status}`,
      `Stage: ${record.run_ref.current_stage}`,
      `Step: ${record.run_ref.current_step}`,
      '',
      `Next: ${record.narrative.next}`,
    ].join('\n'),
  );
  return path;
}

function saveContinuity(args: HandoffArgs, now: () => Date) {
  const controlPlane = resolve(args.controlPlane ?? DEFAULT_CONTROL_PLANE);
  const record = buildRecord(args, now);
  const recordAbs = recordPath(controlPlane, record.record_id);
  writeJson(recordAbs, record);
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: record.project_root,
    pending_record: {
      record_id: record.record_id,
      continuity_kind: record.continuity_kind,
      created_at: record.created_at,
    },
    current_run:
      record.continuity_kind === 'run-backed'
        ? {
            run_id: record.run_ref.run_id,
            current_stage: record.run_ref.current_stage,
            current_step: record.run_ref.current_step,
            runtime_status: record.run_ref.runtime_status,
            attached_at: record.created_at,
            last_validated_at: record.created_at,
          }
        : null,
  });
  writeJson(indexPath(controlPlane), index);
  const activeRun = writeActiveRun(controlPlane, record);
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, summaryForRecord(record, 'saved continuity record'));
  const result = {
    schema_version: 1,
    action: 'save',
    status: 'saved',
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexPath(controlPlane),
    ...(activeRun === undefined ? {} : { active_run_path: activeRun }),
    operator_summary_markdown_path: summaryPath,
  };
  const resultPath = handoffResultPath(controlPlane, 'save');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

function resumeContinuity(args: HandoffArgs) {
  const controlPlane = resolve(args.controlPlane ?? DEFAULT_CONTROL_PLANE);
  const indexAbs = indexPath(controlPlane);
  if (!existsSync(indexAbs)) {
    const summaryPath = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath, '# Circuit Handoff\n\nNo saved continuity found.');
    const result = {
      schema_version: 1,
      action: 'resume',
      status: 'not_found',
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath,
    };
    const resultPath = handoffResultPath(controlPlane, 'resume');
    writeJson(resultPath, result);
    return { ...result, result_path: resultPath };
  }
  const index = ContinuityIndex.parse(JSON.parse(readFileSync(indexAbs, 'utf8')));
  if (index.pending_record === null) {
    const summaryPath = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath, '# Circuit Handoff\n\nNo saved continuity found.');
    const result = {
      schema_version: 1,
      action: 'resume',
      status: 'not_found',
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath,
    };
    const resultPath = handoffResultPath(controlPlane, 'resume');
    writeJson(resultPath, result);
    return { ...result, result_path: resultPath };
  }
  const recordAbs = recordPath(controlPlane, index.pending_record.record_id);
  if (!existsSync(recordAbs)) {
    throw new Error(`continuity index points at missing record: ${recordAbs}`);
  }
  const record = ContinuityRecord.parse(JSON.parse(readFileSync(recordAbs, 'utf8')));
  if (record.continuity_kind !== index.pending_record.continuity_kind) {
    throw new Error(
      `continuity index kind '${index.pending_record.continuity_kind}' disagrees with record kind '${record.continuity_kind}' for ${record.record_id}`,
    );
  }
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, summaryForRecord(record, 'pending_record'));
  const result = {
    schema_version: 1,
    action: 'resume',
    status: 'resumed',
    source: 'pending_record',
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexAbs,
    operator_summary_markdown_path: summaryPath,
  };
  const resultPath = handoffResultPath(controlPlane, 'resume');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

function clearContinuity(args: HandoffArgs, now: () => Date) {
  const controlPlane = resolve(args.controlPlane ?? DEFAULT_CONTROL_PLANE);
  const projectRoot = resolve(args.projectRoot ?? process.cwd());
  const createdAt = args.createdAt ?? now().toISOString();
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: projectRoot,
    pending_record: null,
    current_run: null,
  });
  writeJson(indexPath(controlPlane), index);
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, '# Circuit Handoff\n\nContinuity cleared.');
  const result = {
    schema_version: 1,
    action: 'done',
    status: 'cleared',
    index_path: indexPath(controlPlane),
    operator_summary_markdown_path: summaryPath,
    cleared_at: createdAt,
  };
  const resultPath = handoffResultPath(controlPlane, 'done');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

export async function runHandoffCommand(
  argv: readonly string[],
  options: HandoffMainOptions = {},
): Promise<number> {
  let args: HandoffArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  const now = options.now ?? (() => new Date());
  const progress = utilityProgress({
    enabled: args.progress,
    flowId: 'handoff',
    now,
  });
  progress?.emit({
    type: 'route.selected',
    recorded_at: now().toISOString(),
    label: 'Selected Handoff',
    display: {
      text: `Circuit selected handoff ${args.action}.`,
      importance: 'major',
      tone: 'info',
    },
    selected_flow: 'handoff' as never,
    routed_by: 'explicit',
    router_reason: 'explicit handoff utility command',
  });

  try {
    const result =
      args.action === 'save'
        ? saveContinuity(args, now)
        : args.action === 'resume'
          ? resumeContinuity(args)
          : clearContinuity(args, now);
    progress?.emit({
      type: 'run.completed',
      recorded_at: now().toISOString(),
      label: 'Handoff completed',
      display: {
        text:
          args.action === 'resume' && result.status === 'not_found'
            ? 'No saved Circuit handoff was found.'
            : `Circuit handoff ${args.action} completed.`,
        importance: 'major',
        tone: result.status === 'not_found' ? 'warning' : 'success',
      },
      outcome: 'complete',
      result_path: result.result_path,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    return 1;
  }
}

export const handoffPathsForTests = {
  continuityRoot,
  recordsRoot,
  indexPath,
  recordPath,
  operatorSummaryPath,
  activeRunPath,
  handoffResultPath,
};
