import type { VerificationCommandObservation } from '../../registries/verification-writers/types.js';
import { FixRegressionProof, FixRegressionRerun } from '../reports.js';

function regressionObservationPayload(observation: VerificationCommandObservation) {
  return {
    command_id: observation.command.id,
    cwd: observation.command.cwd,
    argv: observation.command.argv,
    timeout_ms: observation.command.timeout_ms,
    max_output_bytes: observation.command.max_output_bytes,
    env: observation.command.env,
    exit_code: observation.exit_code,
    command_status: observation.status,
    duration_ms: observation.duration_ms,
    stdout_summary: observation.stdout_summary,
    stderr_summary: observation.stderr_summary,
  };
}

export function projectFixRegressionBaseline(
  observations: readonly VerificationCommandObservation[],
): FixRegressionProof {
  if (observations.length === 0) {
    return FixRegressionProof.parse({
      status: 'deferred',
      overall_status: 'passed',
      reason: 'Brief deferred the regression test; no runtime baseline was collected.',
    });
  }
  const observation = observations[0];
  if (observation === undefined) {
    throw new Error('fix.regression-proof@v1: regression baseline observation missing');
  }
  const baseline = regressionObservationPayload(observation);
  if (observation.status === 'failed') {
    return FixRegressionProof.parse({
      status: 'proved',
      overall_status: 'passed',
      baseline,
    });
  }
  return FixRegressionProof.parse({
    status: 'not-proved',
    overall_status: 'failed',
    reason:
      'Brief claimed the regression test fails before the fix, but the runtime observed it pass. The brief selected the wrong pre-fix proof command or the bug no longer reproduces.',
    baseline,
  });
}

export function projectFixRegressionRerun(
  observations: readonly VerificationCommandObservation[],
): FixRegressionRerun {
  if (observations.length === 0) {
    return FixRegressionRerun.parse({
      status: 'deferred',
      overall_status: 'passed',
      reason: 'Brief deferred the regression test; no runtime rerun was performed.',
    });
  }
  const observation = observations[0];
  if (observation === undefined) {
    throw new Error('fix.regression-rerun@v1: regression rerun observation missing');
  }
  const rerun = regressionObservationPayload(observation);
  if (observation.status === 'passed') {
    return FixRegressionRerun.parse({
      status: 'cleared',
      overall_status: 'passed',
      rerun,
    });
  }
  return FixRegressionRerun.parse({
    status: 'still-failing',
    overall_status: 'failed',
    reason:
      'Brief declared the regression test fails before the fix and the baseline confirmed that, but the same command still fails after the fix. The fix did not clear the regression.',
    rerun,
  });
}
