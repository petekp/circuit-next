import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  OperatorSummary,
  type OperatorSummaryReportLink,
  type OperatorSummaryWarning,
} from '../schemas/operator-summary.js';
import { resolveRunRelative } from './run-relative-path.js';
import type { CheckpointWaitingResult, CompiledFlowRunResult } from './runner-types.js';

type RouteSummary = {
  readonly selectedFlow: string;
  readonly routedBy?: 'explicit' | 'classifier';
  readonly routerReason?: string;
};

export type OperatorSummaryWriteResult = {
  readonly summary: OperatorSummary;
  readonly jsonPath: string;
  readonly markdownPath: string;
};

type JsonObject = Record<string, unknown>;

const FLOW_RESULT_PATHS: Record<string, string> = {
  build: 'reports/build-result.json',
  explore: 'reports/explore-result.json',
  fix: 'reports/fix-result.json',
  migrate: 'reports/migrate-result.json',
  review: 'reports/review-result.json',
  sweep: 'reports/sweep-result.json',
};

function jsonPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.json');
}

function markdownPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.md');
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonIfPresent(runFolder: string, relPath: string): JsonObject | undefined {
  const path = resolveRunRelative(runFolder, relPath);
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isObject(parsed) ? parsed : undefined;
}

function stringField(report: JsonObject | undefined, key: string): string | undefined {
  const value = report?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberField(report: JsonObject | undefined, key: string): number | undefined {
  const value = report?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function arrayField(report: JsonObject | undefined, key: string): unknown[] {
  const value = report?.[key];
  return Array.isArray(value) ? value : [];
}

function plural(count: number, singular: string, pluralText = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

function reportLink(
  runFolder: string,
  label: string,
  relPath: string,
  schema?: string,
): OperatorSummaryReportLink {
  return {
    label,
    path: resolveRunRelative(runFolder, relPath),
    ...(schema === undefined ? {} : { schema }),
  };
}

function warningRecords(report: JsonObject | undefined): OperatorSummaryWarning[] {
  return arrayField(report, 'evidence_warnings').flatMap((item) => {
    if (!isObject(item)) return [];
    const kind = stringField(item, 'kind');
    const message = stringField(item, 'message');
    if (kind === undefined || message === undefined) return [];
    const path = stringField(item, 'path');
    return [{ kind, message, ...(path === undefined ? {} : { path }) }];
  });
}

function evidenceLinks(
  runFolder: string,
  report: JsonObject | undefined,
): OperatorSummaryReportLink[] {
  return arrayField(report, 'evidence_links').flatMap((item) => {
    if (!isObject(item)) return [];
    const reportId = stringField(item, 'report_id');
    const path = stringField(item, 'path');
    if (reportId === undefined || path === undefined) return [];
    return [reportLink(runFolder, reportId, path, stringField(item, 'schema'))];
  });
}

function flowHeadline(input: {
  readonly flowId: string;
  readonly resultSummary: string;
  readonly flowReport: JsonObject | undefined;
}): string {
  const { flowId, flowReport, resultSummary } = input;
  if (flowId === 'review') {
    const verdict = stringField(flowReport, 'verdict') ?? 'review complete';
    const findings = arrayField(flowReport, 'findings').length;
    return `Review ${verdict}: ${plural(findings, 'finding')}.`;
  }
  if (flowId === 'build') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    return `Build ${outcome}: verification ${verification}, review ${review}.`;
  }
  if (flowId === 'fix') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review =
      stringField(flowReport, 'review_verdict') ??
      stringField(flowReport, 'review_status') ??
      'unknown';
    return `Fix ${outcome}: verification ${verification}, review ${review}.`;
  }
  if (flowId === 'migrate') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    return `Migrate ${outcome}: verification ${verification}, review ${review}.`;
  }
  if (flowId === 'explore') {
    const verdictSnapshot = isObject(flowReport?.verdict_snapshot)
      ? flowReport.verdict_snapshot
      : undefined;
    const review = stringField(verdictSnapshot, 'review_verdict') ?? 'complete';
    const summary = stringField(flowReport, 'summary') ?? resultSummary;
    return `Explore ${review}: ${summary}`;
  }
  if (flowId === 'sweep') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const deferred = numberField(flowReport, 'deferred_count');
    return deferred === undefined
      ? `Sweep ${outcome}.`
      : `Sweep ${outcome}: ${plural(deferred, 'deferred item')}.`;
  }
  return resultSummary;
}

function flowDetails(input: {
  readonly flowId: string;
  readonly flowReport: JsonObject | undefined;
}): string[] {
  const { flowId, flowReport } = input;
  const details: string[] = [];
  const summary = stringField(flowReport, 'summary');
  if (summary !== undefined) details.push(`Result headline: ${summary}`);
  if (flowId === 'review') {
    const findings = arrayField(flowReport, 'findings').length;
    details.push(`Findings: ${findings}`);
  }
  if (flowId === 'build' || flowId === 'fix' || flowId === 'migrate') {
    const outcome = stringField(flowReport, 'outcome');
    const verification = stringField(flowReport, 'verification_status');
    const review = stringField(flowReport, 'review_verdict');
    if (outcome !== undefined) details.push(`Flow result: ${outcome}`);
    if (verification !== undefined) details.push(`Verification: ${verification}`);
    if (review !== undefined) details.push(`Review verdict: ${review}`);
  }
  return details;
}

function renderMarkdown(summary: OperatorSummary): string {
  const lines = [
    '# Circuit Summary',
    '',
    summary.headline,
    '',
    `- Selected flow: \`${summary.selected_flow}\``,
    `- Outcome: \`${summary.outcome}\``,
  ];
  if (summary.routed_by !== undefined) lines.push(`- Routed by: \`${summary.routed_by}\``);
  if (summary.router_reason !== undefined) lines.push(`- Router reason: ${summary.router_reason}`);
  lines.push(`- Run folder: ${summary.run_folder}`);
  if (summary.result_path !== undefined) lines.push(`- Result path: ${summary.result_path}`);

  if (summary.checkpoint !== undefined) {
    lines.push('', '## Checkpoint', '');
    lines.push(`- Step: \`${summary.checkpoint.step_id}\``);
    lines.push(`- Request: ${summary.checkpoint.request_path}`);
    lines.push(`- Choices: ${summary.checkpoint.allowed_choices.join(', ')}`);
  }

  if (summary.details.length > 0) {
    lines.push('', '## Details', '');
    for (const detail of summary.details) lines.push(`- ${detail}`);
  }

  lines.push('', '## Evidence Warnings', '');
  if (summary.evidence_warnings.length === 0) {
    lines.push('- None');
  } else {
    for (const warning of summary.evidence_warnings) {
      const path = warning.path === undefined ? '' : ` (${warning.path})`;
      lines.push(`- ${warning.kind}${path}: ${warning.message}`);
    }
  }

  lines.push('', '## Reports', '');
  for (const report of summary.report_paths) {
    const schema = report.schema === undefined ? '' : ` — ${report.schema}`;
    lines.push(`- ${report.label}: ${report.path}${schema}`);
  }

  return `${lines.join('\n')}\n`;
}

export function writeOperatorSummary(input: {
  readonly runFolder: string;
  readonly runResult: CompiledFlowRunResult['result'];
  readonly route: RouteSummary;
}): OperatorSummaryWriteResult {
  const flowId = input.runResult.flow_id as unknown as string;
  const flowResultRelPath = FLOW_RESULT_PATHS[flowId];
  const flowReport =
    flowResultRelPath === undefined
      ? undefined
      : readJsonIfPresent(input.runFolder, flowResultRelPath);
  const resultRelPath = 'reports/result.json';
  const resultPath =
    input.runResult.outcome === 'checkpoint_waiting'
      ? undefined
      : resolveRunRelative(input.runFolder, resultRelPath);

  const reportPaths: OperatorSummaryReportLink[] = [];
  if (resultPath !== undefined)
    reportPaths.push(reportLink(input.runFolder, 'Run result', resultRelPath));
  if (flowResultRelPath !== undefined && flowReport !== undefined) {
    reportPaths.push(reportLink(input.runFolder, `${flowId} result`, flowResultRelPath));
  }
  if (input.runResult.outcome === 'checkpoint_waiting') {
    const checkpoint = (input.runResult as CheckpointWaitingResult).checkpoint;
    reportPaths.push({
      label: 'Checkpoint request',
      path: checkpoint.request_path,
    });
  }
  reportPaths.push(...evidenceLinks(input.runFolder, flowReport));

  const details = [
    `Circuit summary: ${input.runResult.summary}`,
    ...flowDetails({ flowId, flowReport }),
  ];
  if (input.runResult.outcome === 'aborted' && input.runResult.reason !== undefined) {
    details.push(`Abort reason: ${input.runResult.reason}`);
  }

  const candidate = OperatorSummary.parse({
    schema_version: 1,
    run_id: input.runResult.run_id,
    flow_id: input.runResult.flow_id,
    selected_flow: input.route.selectedFlow,
    ...(input.route.routedBy === undefined ? {} : { routed_by: input.route.routedBy }),
    ...(input.route.routerReason === undefined ? {} : { router_reason: input.route.routerReason }),
    outcome: input.runResult.outcome,
    headline:
      input.runResult.outcome === 'checkpoint_waiting'
        ? 'Circuit is waiting for a checkpoint choice.'
        : input.runResult.outcome === 'aborted'
          ? 'Circuit run aborted.'
          : flowHeadline({ flowId, flowReport, resultSummary: input.runResult.summary }),
    details,
    evidence_warnings: warningRecords(flowReport),
    run_folder: input.runFolder,
    ...(resultPath === undefined ? {} : { result_path: resultPath }),
    report_paths: reportPaths,
    ...(input.runResult.outcome === 'checkpoint_waiting'
      ? { checkpoint: (input.runResult as CheckpointWaitingResult).checkpoint }
      : {}),
  });

  const outJsonPath = jsonPath(input.runFolder);
  const outMarkdownPath = markdownPath(input.runFolder);
  mkdirSync(dirname(outJsonPath), { recursive: true });
  writeFileSync(outJsonPath, `${JSON.stringify(candidate, null, 2)}\n`);
  writeFileSync(outMarkdownPath, renderMarkdown(candidate));
  return { summary: candidate, jsonPath: outJsonPath, markdownPath: outMarkdownPath };
}
