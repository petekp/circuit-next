#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJson } from './lib/json.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const REGISTRY_PATH = resolve(REPO_ROOT, 'evals/registry.json');
const FLOW_REGRESSION_MANIFEST_PATH = resolve(REPO_ROOT, 'evals/flow-regressions/manifest.json');
const FLOW_REGRESSION_RUNNER = 'scripts/evals/run-flow-regression.mjs';
const CLAIM_LEVELS = new Set(['smoke', 'regression', 'discovery', 'claim-grade']);
const CLAIM_GRADE_EVAL_IDS = new Set(['fix-vs-vanilla']);

function fail(message) {
  throw new Error(message);
}

function checkRegistry() {
  const registry = readJson(REGISTRY_PATH);
  const flowRegressionManifest = readJson(FLOW_REGRESSION_MANIFEST_PATH);
  const flowRegressionEvals = Array.isArray(flowRegressionManifest.evals)
    ? flowRegressionManifest.evals
    : [];
  const flowRegressionEvalById = new Map(flowRegressionEvals.map((entry) => [entry.id, entry]));
  const flowRegressionEvalIds = new Set(flowRegressionEvalById.keys());
  const registeredFlowRegressionEvalIds = new Set();
  if (registry.schema_version !== 1) fail('evals/registry.json must have schema_version: 1');
  if (!Array.isArray(registry.evals)) fail('evals/registry.json must contain evals array');
  const ids = new Set();
  for (const entry of registry.evals) {
    if (typeof entry.id !== 'string' || entry.id.length === 0) fail('registry entry missing id');
    if (ids.has(entry.id)) fail(`duplicate registry id: ${entry.id}`);
    ids.add(entry.id);
    if (!CLAIM_LEVELS.has(entry.claim_level)) {
      fail(`${entry.id}: invalid claim_level ${entry.claim_level}`);
    }
    if (entry.claim_level === 'claim-grade' && !CLAIM_GRADE_EVAL_IDS.has(entry.id)) {
      fail(`${entry.id}: fix-vs-vanilla is the only claim-grade eval today`);
    }
    if (CLAIM_GRADE_EVAL_IDS.has(entry.id) && entry.claim_level !== 'claim-grade') {
      fail(`${entry.id}: expected claim_level claim-grade`);
    }
    if (CLAIM_GRADE_EVAL_IDS.has(entry.id) && entry.claim_eligible !== true) {
      fail(`${entry.id}: expected claim_eligible true`);
    }
    if (entry.claim_eligible === true && entry.claim_level !== 'claim-grade') {
      fail(`${entry.id}: only claim-grade evals can be claim eligible`);
    }
    if (!Array.isArray(entry.default_command) || entry.default_command.length === 0) {
      fail(`${entry.id}: default_command must be a non-empty array`);
    }
    const flowRegressionRunnerIndex = entry.default_command.indexOf(FLOW_REGRESSION_RUNNER);
    if (flowRegressionRunnerIndex !== -1) {
      const evalIdFlagIndex = entry.default_command.indexOf('--eval-id');
      const evalId = evalIdFlagIndex === -1 ? undefined : entry.default_command[evalIdFlagIndex + 1];
      if (evalId !== entry.id) {
        fail(`${entry.id}: flow regression default_command must use --eval-id ${entry.id}`);
      }
      if (!flowRegressionEvalIds.has(entry.id)) {
        fail(`${entry.id}: missing from flow regression manifest`);
      }
      const manifestEntry = flowRegressionEvalById.get(entry.id);
      if (manifestEntry.flow !== entry.flow) {
        fail(`${entry.id}: registry flow does not match flow regression manifest`);
      }
      if (manifestEntry.claim_level !== entry.claim_level) {
        fail(`${entry.id}: registry claim_level does not match flow regression manifest`);
      }
      registeredFlowRegressionEvalIds.add(entry.id);
    }
    if (entry.default_command[0] === 'node') {
      const scriptIndex = entry.default_command.findIndex((part) =>
        /^(evals|scripts)\/.*\.(mjs|js|ts)$/.test(String(part)),
      );
      if (scriptIndex !== -1 && !existsSync(resolve(REPO_ROOT, entry.default_command[scriptIndex]))) {
        fail(`${entry.id}: default command script does not exist`);
      }
    }
    if (typeof entry.readme_path !== 'string' || !existsSync(resolve(REPO_ROOT, entry.readme_path))) {
      fail(`${entry.id}: readme_path does not exist`);
    }
    if (typeof entry.primary_metric !== 'string' || entry.primary_metric.length === 0) {
      fail(`${entry.id}: primary_metric is required`);
    }
    if (!Array.isArray(entry.secondary_metrics)) {
      fail(`${entry.id}: secondary_metrics must be an array`);
    }
  }
  for (const id of CLAIM_GRADE_EVAL_IDS) {
    if (!ids.has(id)) fail(`${id}: missing required claim-grade eval`);
  }
  for (const id of flowRegressionEvalIds) {
    if (!registeredFlowRegressionEvalIds.has(id)) {
      fail(`${id}: flow regression manifest entry is not registered`);
    }
  }
  return registry;
}

try {
  const registry = checkRegistry();
  process.stdout.write(`Eval registry OK (${registry.evals.length} evals)\n`);
} catch (error) {
  process.stderr.write(`Eval registry check failed: ${error.message}\n`);
  process.exit(1);
}
