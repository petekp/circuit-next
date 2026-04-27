// Verification writer registry types.
//
// A verification step has three pieces of workflow-specific logic:
//
//   1. Where do the commands come from? (Build sources from
//      build.plan@v1; Fix sources from fix.brief@v1.)
//   2. What's the output artifact's shape? (BuildVerification vs.
//      FixVerification — Fix's wider schema carries timeout/env per
//      command result.)
//   3. What's the output schema name?
//
// The runner's spawnSync loop, output summarization, and event-writing
// stay universal. Each VerificationBuilder fills the workflow-specific
// holes.
//
// To add a new workflow's verification step:
//   1. Define the result schema in src/workflows/<wf>/artifacts.ts
//   2. Implement a VerificationBuilder in
//      src/runtime/verification-writers/<schema>.ts
//   3. Register it in src/runtime/verification-writers/registry.ts

import type { Workflow } from '../../../schemas/workflow.js';

export type VerificationStep = Workflow['steps'][number] & {
  readonly kind: 'verification';
  readonly writes: { readonly artifact: { readonly schema: string; readonly path: string } };
};

// One command to execute. Both Build and Fix use the same command
// shape (id, cwd, argv, timeout_ms, max_output_bytes, env), so this
// type is the structural intersection.
export interface VerificationCommand {
  readonly id: string;
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly timeout_ms: number;
  readonly max_output_bytes: number;
  readonly env: Readonly<Record<string, string>>;
}

// What the runner observes after executing one command. Workflow-
// specific result schemas may include a subset (Build) or superset
// (Fix carries the original timeout/env so the result is
// self-contained as repro evidence).
export interface VerificationCommandObservation {
  readonly command: VerificationCommand;
  readonly exit_code: number;
  readonly status: 'passed' | 'failed';
  readonly duration_ms: number;
  readonly stdout_summary: string;
  readonly stderr_summary: string;
}

export interface VerificationBuildContext {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly step: VerificationStep;
}

export interface VerificationBuilder {
  // Schema name of the artifact this builder produces (e.g.
  // 'build.verification@v1', 'fix.verification@v1'). Acts as the
  // registry key.
  readonly resultSchemaName: string;
  // Source the command list for this verification step. Workflow-
  // specific: Build reads from build.plan@v1; Fix reads from
  // fix.brief@v1.
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[];
  // Assemble the verification result artifact from the observed
  // command outcomes. Workflow-specific: Build produces a narrow
  // BuildVerification; Fix produces a wider FixVerification with
  // per-command repro fields.
  buildResult(observations: readonly VerificationCommandObservation[]): unknown;
}
