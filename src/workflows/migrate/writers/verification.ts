// Migrate verification writer.
//
// Sources commands from migrate.brief@v1 — Migrate has no separate plan
// step (the coexistence plan is strategy/rollback content, not command
// authoring), so the brief itself carries the verification command
// candidates. Emits the MigrateVerification artifact, which structurally
// matches BuildVerification (re-exported from migrate schemas) — a
// migration verification just needs to prove no regression was
// introduced by the batch sub-run.

import { readFileSync } from 'node:fs';
import { artifactPathForSchemaInWorkflow } from '../../../runtime/registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../../runtime/registries/verification-writers/types.js';
import { resolveRunRelative } from '../../../runtime/run-relative-path.js';
import { MigrateBrief, MigrateVerification } from '../artifacts.js';

export const migrateVerificationWriter: VerificationBuilder = {
  resultSchemaName: 'migrate.verification@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const briefPath = artifactPathForSchemaInWorkflow(context.workflow, 'migrate.brief@v1');
    if (!context.step.reads.includes(briefPath as never)) {
      throw new Error(
        `migrate.verification@v1 requires step '${context.step.id}' to read ${briefPath}`,
      );
    }
    const brief = MigrateBrief.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runRoot, briefPath), 'utf8')),
    );
    return brief.verification_command_candidates;
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    const overallStatus = observations.some((o) => o.status === 'failed') ? 'failed' : 'passed';
    return MigrateVerification.parse({
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
