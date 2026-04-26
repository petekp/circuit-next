// Sweep verification writer.
//
// Sources commands from sweep.brief@v1 — Sweep has no separate plan
// step (its triage step classifies items, not commands), so the brief
// itself carries the verification command candidates. Emits the
// SweepVerification artifact, which structurally matches BuildVerification
// (re-exported from sweep schemas) — Sweep doesn't need Fix's
// timeout/env-echoing repro fields because sweep verification only
// needs to prove no regression was introduced.

import { readFileSync } from 'node:fs';
import { SweepBrief, SweepVerification } from '../../schemas/artifacts/sweep.js';
import { artifactPathForSchemaInWorkflow } from '../close-writers/shared.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from './types.js';

export const sweepVerificationWriter: VerificationBuilder = {
  resultSchemaName: 'sweep.verification@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const briefPath = artifactPathForSchemaInWorkflow(context.workflow, 'sweep.brief@v1');
    if (!context.step.reads.includes(briefPath as never)) {
      throw new Error(
        `sweep.verification@v1 requires step '${context.step.id}' to read ${briefPath}`,
      );
    }
    const brief = SweepBrief.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runRoot, briefPath), 'utf8')),
    );
    return brief.verification_command_candidates;
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    const overallStatus = observations.some((o) => o.status === 'failed') ? 'failed' : 'passed';
    return SweepVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary,
      })),
    });
  },
};
