import type { VerificationCommandObservation } from '../../registries/verification-writers/types.js';
import { PursuitVerification } from '../reports.js';

export function projectPursuitVerification(
  observations: readonly VerificationCommandObservation[],
): PursuitVerification {
  const overallStatus = observations.some((observation) => observation.status === 'failed')
    ? 'failed'
    : 'passed';

  return PursuitVerification.parse({
    overall_status: overallStatus,
    commands: observations.map((observation) => ({
      command_id: observation.command.id,
      argv: observation.command.argv,
      cwd: observation.command.cwd,
      exit_code: observation.exit_code,
      status: observation.status,
      duration_ms: observation.duration_ms,
      stdout_summary: observation.stdout_summary,
      stderr_summary: observation.stderr_summary,
    })),
  });
}
