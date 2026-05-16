import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mean, rate } from '../lib/aggregation.mjs';
import { readJson } from '../lib/json.mjs';

export function parseCircuitClaim(runFolder) {
  const resultPath = resolve(runFolder, 'reports', 'fix-result.json');
  if (!existsSync(resultPath)) {
    return {
      claimed_fixed: false,
      parse_status: 'missing-fix-result',
      result_path: resultPath,
      proof_quality: 0,
    };
  }
  const result = readJson(resultPath);
  return parseCircuitResult(result, resultPath);
}

export function parseCircuitResult(result, resultPath = undefined) {
  return {
    claimed_fixed: result.outcome === 'fixed',
    parse_status: 'parsed',
    result_path: resultPath,
    fix_outcome: result.outcome,
    verification_status: result.verification_status,
    regression_status: result.regression_status,
    regression_rerun_status: result.regression_rerun_status,
    change_set_status: result.change_set_status,
    review_status: result.review_status,
    review_verdict: result.review_verdict,
    review_skip_reason: result.review_skip_reason,
    proof_quality: circuitProofQuality(result),
  };
}

export function circuitProofQuality(result) {
  if (
    result.regression_status === 'proved' &&
    result.regression_rerun_status === 'cleared' &&
    result.verification_status === 'passed' &&
    result.change_set_status === 'pass'
  ) {
    return 3;
  }
  if (result.regression_status === 'proved' && result.regression_rerun_status === 'cleared') {
    return 2;
  }
  if (result.verification_status === 'passed') return 1;
  return 0;
}

export function parseVanillaClaim(stdout) {
  const parsed = parseLastJsonObject(stdout);
  if (parsed === undefined) {
    return {
      claimed_fixed: /fixed|done|resolved/i.test(stdout),
      parse_status: 'heuristic',
      proof_quality: 0,
    };
  }
  const proof = parsed.regression_proof ?? {};
  const commands = Array.isArray(parsed.commands_run) ? parsed.commands_run : [];
  return {
    claimed_fixed: parsed.claimed_fixed === true,
    parse_status: 'parsed',
    parsed,
    proof_quality: vanillaProofQuality(proof, commands),
  };
}

export function parseLastJsonObject(text) {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  for (const match of fenced.reverse()) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try another candidate.
    }
  }

  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{') starts.push(index);
  }
  for (const start of starts.reverse()) {
    try {
      return JSON.parse(text.slice(start));
    } catch {
      // Try an earlier object start.
    }
  }
  return undefined;
}

export function vanillaProofQuality(proof, commands) {
  const failedBefore = proof.failed_before === true;
  const passedAfter = proof.passed_after === true;
  const hasCommands = commands.length >= 2;
  const hasUnableStatus = commands.some((command) =>
    /unable|could not|permission|error/i.test(String(command.status ?? command.command ?? '')),
  );
  const hasSpeculativeStatus = commands.some((command) =>
    /would|should|expected|manual|not[- ]?run/i.test(String(command.status ?? '')),
  );
  const hasExplicitFailedBefore = commands.some((command) =>
    /failed-before|fail(ed)? before/i.test(String(command.status ?? '')),
  );
  const hasExplicitPassedAfter = commands.some((command) =>
    /passed-after|pass(ed)? after/i.test(String(command.status ?? '')),
  );
  if (hasUnableStatus) return passedAfter || failedBefore ? 1 : 0;
  if (
    failedBefore &&
    passedAfter &&
    hasCommands &&
    hasExplicitFailedBefore &&
    hasExplicitPassedAfter &&
    !hasSpeculativeStatus
  ) {
    return 3;
  }
  if (failedBefore && passedAfter) return 2;
  if (passedAfter || hasCommands) return 1;
  return 0;
}

export function scoreArm({ task, armId, run, checks, diff, claim }) {
  const objectiveFixed = checks.length > 0 && checks.every((check) => check.passed);
  const allowed = new Set(task.allowed_changed_files);
  const outsideAllowed = diff.changed_files.filter((file) => !allowed.has(file));
  return {
    task_id: task.id,
    split: task.split,
    arm_id: armId,
    exit_code: run.exit_code,
    timed_out: run.timed_out,
    wallclock_ms: run.wallclock_ms,
    objective_fixed: objectiveFixed,
    verification_passed: objectiveFixed,
    claimed_fixed: claim.claimed_fixed,
    false_fixed: claim.claimed_fixed && !objectiveFixed,
    proof_quality: claim.proof_quality,
    changed_files: diff.changed_files,
    changed_file_count: diff.changed_files.length,
    outside_allowed_changed_files: outsideAllowed,
    claim,
    checks,
    diff_path: diff.diff_path,
    stdout_path: resolve(dirname(diff.diff_path), 'stdout.txt'),
    stderr_path: resolve(dirname(diff.diff_path), 'stderr.txt'),
  };
}

export function aggregate(taskSummaries, splitFilter = undefined) {
  const arms = ['circuit-claude-code', 'vanilla-claude-code'];
  const filtered =
    splitFilter === undefined ? taskSummaries : taskSummaries.filter((task) => task.split === splitFilter);
  const out = {};
  for (const arm of arms) {
    const scores = filtered.map((task) => task.arms[arm]);
    const count = scores.length;
    out[arm] = {
      task_count: count,
      false_fixed_count: scores.filter((score) => score.false_fixed).length,
      false_fixed_rate: rate(scores.filter((score) => score.false_fixed).length, count),
      objective_fixed_count: scores.filter((score) => score.objective_fixed).length,
      objective_fixed_rate: rate(scores.filter((score) => score.objective_fixed).length, count),
      verification_pass_count: scores.filter((score) => score.verification_passed).length,
      verification_pass_rate: rate(scores.filter((score) => score.verification_passed).length, count),
      mean_proof_quality: mean(scores.map((score) => score.proof_quality)),
      completed_review_count: scores.filter((score) => score.claim.review_status === 'completed').length,
      skipped_review_count: scores.filter((score) => score.claim.review_status === 'skipped').length,
      mean_changed_file_count: mean(scores.map((score) => score.changed_file_count)),
      outside_allowed_change_count: scores.reduce(
        (sum, score) => sum + score.outside_allowed_changed_files.length,
        0,
      ),
      mean_wallclock_ms: mean(scores.map((score) => score.wallclock_ms)),
    };
  }
  return out;
}

export function decideClaim(heldOutAggregate) {
  const circuit = heldOutAggregate['circuit-claude-code'];
  const vanilla = heldOutAggregate['vanilla-claude-code'];
  if (circuit.task_count === 0 || vanilla.task_count === 0) {
    return { supported: false, reason: 'no held-out tasks were scored' };
  }
  if (circuit.false_fixed_rate < vanilla.false_fixed_rate) {
    if (circuit.objective_fixed_rate >= vanilla.objective_fixed_rate) {
      return {
        supported: true,
        reason: 'Circuit had a lower held-out false-fixed rate and matched or beat vanilla objective fixed rate.',
      };
    }
    return {
      supported: false,
      reason: 'Circuit had fewer false-fixed outcomes but a lower objective fixed rate.',
    };
  }
  return {
    supported: false,
    reason: 'Circuit did not have a lower held-out false-fixed rate.',
  };
}
