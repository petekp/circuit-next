#!/usr/bin/env node
/**
 * Product-surface inventory (Slice 27b baseline).
 *
 * Records which runtime product surfaces the Phase 1.5 Alpha Proof path
 * (dogfood-run-0) requires, and whether each is present at HEAD. The 27b
 * landing is the baseline snapshot; Slices 27c and 27d acceptance rerun
 * `npm run inventory` and assert specific surfaces flip from
 * `present: false` to `present: true`. Placeholder rows (empty files,
 * echo-only npm scripts, test files without an it/test/describe block,
 * JSON manifests missing required fields) are rejected by the detectors
 * so a future slice cannot stub a surface into "present" without real
 * runtime evidence.
 *
 * Outputs:
 *   reports/product-surface.inventory.json
 *   reports/product-surface.inventory.md
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractCurrentSliceMarker } from './audit.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const REPORT_SCHEMA_VERSION = '1';
const REPORT_SLICE = '27b';
const STATUS_EPOCH_FILES = ['README.md', 'PROJECT_STATE.md', 'TIER.md'];

// ---------- filesystem helpers ----------

function absPath(relPath) {
  return join(REPO_ROOT, relPath);
}

function readText(relPath) {
  return readFileSync(absPath(relPath), 'utf8');
}

function fileExists(relPath) {
  return existsSync(absPath(relPath));
}

function fileSize(relPath) {
  try {
    const s = statSync(absPath(relPath));
    return s.isFile() ? s.size : 0;
  } catch {
    return 0;
  }
}

function loadJson(relPath) {
  if (!fileExists(relPath)) return null;
  try {
    return JSON.parse(readText(relPath));
  } catch {
    return null;
  }
}

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

function walkTestsDir() {
  const root = absPath('tests');
  if (!fileExists('tests')) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(full);
      else if (s.isFile() && entry.endsWith('.test.ts')) {
        out.push(relative(REPO_ROOT, full));
      }
    }
  };
  walk(root);
  return out.sort();
}

// ---------- presence detectors ----------

/**
 * Each detector returns `{ present: boolean, reason: string }`. `reason`
 * is a human-readable summary that goes into the Markdown and JSON reports.
 * Detectors MUST NOT accept placeholder evidence:
 *   - empty or whitespace-only files,
 *   - echo/true/noop shell commands,
 *   - JSON manifests missing required fields,
 *   - test files with no it/test/describe block.
 * This is what makes the inventory a real delta oracle rather than a
 * reviewer checklist.
 */

const PLACEHOLDER_FIRST_TOKENS = new Set(['echo', 'true', ':']);

function isPlaceholderCommand(cmd) {
  const trimmed = cmd.trim();
  if (trimmed === '') return true;
  const firstToken = trimmed.split(/\s+/)[0] ?? '';
  if (PLACEHOLDER_FIRST_TOKENS.has(firstToken)) return true;
  if (/^exit\s+\d+$/.test(trimmed)) return true;
  return false;
}

function checkPackageScript(pkg, name) {
  if (!pkg || typeof pkg !== 'object' || typeof pkg.scripts !== 'object' || !pkg.scripts) {
    return { present: false, reason: 'package.json scripts block missing or not an object' };
  }
  const cmd = pkg.scripts[name];
  if (typeof cmd !== 'string' || cmd.trim() === '') {
    return { present: false, reason: `scripts.${name} absent or empty` };
  }
  if (isPlaceholderCommand(cmd)) {
    return {
      present: false,
      reason: `scripts.${name} is a placeholder (echo/true/noop): ${JSON.stringify(cmd)}`,
    };
  }
  return { present: true, reason: `scripts.${name} = ${JSON.stringify(cmd)}` };
}

function checkPluginManifest() {
  const rel = '.claude-plugin/plugin.json';
  if (!fileExists(rel)) return { present: false, reason: `${rel} missing` };
  const m = loadJson(rel);
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    return { present: false, reason: `${rel} does not parse as a JSON object` };
  }
  const required = ['name', 'version'];
  const missing = required.filter((k) => typeof m[k] !== 'string' || m[k].length === 0);
  if (missing.length > 0) {
    return {
      present: false,
      reason: `${rel} missing required string fields: ${missing.join(', ')}`,
    };
  }
  return {
    present: true,
    reason: `${rel} parses with name=${JSON.stringify(m.name)} version=${JSON.stringify(m.version)}`,
  };
}

function checkDogfoodWorkflowFixture() {
  const rel = '.claude-plugin/skills/dogfood-run-0/circuit.json';
  if (!fileExists(rel)) return { present: false, reason: `${rel} missing` };
  const m = loadJson(rel);
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    return { present: false, reason: `${rel} does not parse as a JSON object` };
  }
  if (Object.keys(m).length === 0) {
    return { present: false, reason: `${rel} parses but is an empty object (placeholder)` };
  }
  return {
    present: true,
    reason: `${rel} parses as non-empty object (${Object.keys(m).length} top-level keys)`,
  };
}

function checkRuntimeEntrypoint() {
  const rel = 'src/runtime';
  if (!fileExists(rel)) {
    return { present: false, reason: `${rel}/ missing; no runner entrypoint` };
  }
  const dirAbs = absPath(rel);
  let entries;
  try {
    entries = readdirSync(dirAbs);
  } catch {
    return { present: false, reason: `${rel}/ not readable` };
  }
  const tsFiles = entries.filter((e) => e.endsWith('.ts'));
  if (tsFiles.length === 0) {
    return { present: false, reason: `${rel}/ has no .ts files` };
  }
  const substantive = tsFiles.filter((f) => {
    const body = readText(join(rel, f));
    // Strip block comments + line comments + whitespace; require >= 40 chars left.
    const stripped = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');
    return stripped.length >= 40 && /\bexport\b/.test(body);
  });
  if (substantive.length === 0) {
    return {
      present: false,
      reason: `${rel}/ has ${tsFiles.length} .ts file(s) but none export substantive (non-comment) content`,
    };
  }
  return {
    present: true,
    reason: `${rel}/ contains ${substantive.length} non-placeholder TS module(s): ${substantive.join(', ')}`,
  };
}

/**
 * Detect a runtime artifact by id pattern in specs/artifacts.json.
 * Presence requires:
 *   (a) a row whose `id` matches the pattern,
 *   (b) at least one backing_paths or schema_file entry that resolves to a
 *       non-empty file on disk (path placeholders like `<run-root>/...` are
 *       skipped — those are persisted paths, not repo files).
 */
function checkArtifactRow(artifacts, idPattern, label) {
  if (!artifacts || !Array.isArray(artifacts.artifacts)) {
    return { present: false, reason: `specs/artifacts.json unreadable or malformed (${label})` };
  }
  const row = artifacts.artifacts.find(
    (a) => a && typeof a.id === 'string' && idPattern.test(a.id),
  );
  if (!row) {
    return {
      present: false,
      reason: `no specs/artifacts.json row matches /${idPattern.source}/ for ${label}`,
    };
  }
  const candidatePaths = [];
  if (typeof row.schema_file === 'string') candidatePaths.push(row.schema_file);
  if (Array.isArray(row.backing_paths)) {
    for (const p of row.backing_paths) {
      if (typeof p === 'string' && !p.startsWith('<')) candidatePaths.push(p);
    }
  }
  if (candidatePaths.length === 0) {
    return {
      present: false,
      reason: `artifact ${row.id} has no repo-local schema_file or backing_paths (only persisted placeholders) — 27c must bind a non-empty schema file`,
    };
  }
  const nonEmpty = candidatePaths.filter((p) => fileSize(p) > 0);
  if (nonEmpty.length === 0) {
    return {
      present: false,
      reason: `artifact ${row.id} names ${candidatePaths.join(', ')} but none exist / are non-empty on disk`,
    };
  }
  return {
    present: true,
    reason: `artifact ${row.id} present; backing file(s): ${nonEmpty.join(', ')}`,
  };
}

function checkTestByFilename(filenamePattern, label) {
  const files = walkTestsDir();
  if (files.length === 0) {
    return { present: false, reason: `no .test.ts files found under tests/ (${label})` };
  }
  const matching = files.filter((f) => filenamePattern.test(f));
  if (matching.length === 0) {
    return {
      present: false,
      reason: `no test file matches /${filenamePattern.source}/ (${label})`,
    };
  }
  const exercised = matching.filter((f) => /\b(it|test|describe)\s*\(/.test(readText(f)));
  if (exercised.length === 0) {
    return {
      present: false,
      reason: `matched ${matching.length} file(s) but none contain an it/test/describe block: ${matching.join(', ')}`,
    };
  }
  return {
    present: true,
    reason: `${exercised.length} test file(s) exercise ${label}: ${exercised.join(', ')}`,
  };
}

function checkStatusAlignment() {
  const markers = {};
  for (const rel of STATUS_EPOCH_FILES) {
    if (!fileExists(rel)) {
      return { present: false, reason: `${rel} missing` };
    }
    const marker = extractCurrentSliceMarker(readText(rel));
    if (!marker) {
      return {
        present: false,
        reason: `${rel} has no well-formed <!-- current_slice: <id> --> marker in the status-header zone`,
      };
    }
    markers[rel] = marker;
  }
  const unique = new Set(Object.values(markers));
  if (unique.size !== 1) {
    const pairs = Object.entries(markers)
      .map(([f, v]) => `${f}=${v}`)
      .join(', ');
    return { present: false, reason: `current_slice markers disagree: ${pairs}` };
  }
  const slice = [...unique][0];
  return {
    present: true,
    reason: `current_slice=${slice} across ${STATUS_EPOCH_FILES.join(' / ')}`,
  };
}

// ---------- surface catalog ----------

export function buildInventory({ pkg, artifacts } = {}) {
  const effectivePkg = pkg ?? loadJson('package.json');
  const effectiveArtifacts = artifacts ?? loadJson('specs/artifacts.json');

  const definitions = [
    {
      id: 'runner.cli_script',
      category: 'package_scripts',
      description: 'npm run circuit:run entrypoint (`dogfood-run-0` dry-run invocation)',
      expected_evidence:
        'package.json scripts.circuit:run is a non-placeholder shell command (not echo/true/noop)',
      planned_slice: '27d',
      detect: () => checkPackageScript(effectivePkg, 'circuit:run'),
    },
    {
      id: 'plugin.manifest',
      category: 'plugin_surface',
      description: 'Claude Code plugin manifest',
      expected_evidence:
        '.claude-plugin/plugin.json exists, parses as object, declares non-empty name and version',
      planned_slice: '27d',
      detect: checkPluginManifest,
    },
    {
      id: 'plugin.dogfood_workflow_fixture',
      category: 'plugin_surface',
      description:
        'dogfood-run-0 workflow fixture loaded by `npm run circuit:run -- dogfood-run-0`',
      expected_evidence:
        '.claude-plugin/skills/dogfood-run-0/circuit.json parses as a non-empty JSON object',
      planned_slice: '27d',
      detect: checkDogfoodWorkflowFixture,
    },
    {
      id: 'runner.entrypoint',
      category: 'src_runtime',
      description: 'src/runtime/ module hosting the runner entrypoint(s)',
      expected_evidence:
        'src/runtime/ contains at least one .ts file with an `export` and >=40 non-comment non-whitespace characters',
      planned_slice: '27c',
      detect: checkRuntimeEntrypoint,
    },
    {
      id: 'runner.event_writer',
      category: 'src_runtime',
      description: 'Append-only events.ndjson writer surface',
      expected_evidence:
        'specs/artifacts.json has a row whose id matches /event.?writer/ AND its schema_file or repo-local backing_paths resolve to a non-empty file',
      planned_slice: '27c',
      detect: () => checkArtifactRow(effectiveArtifacts, /event.?writer/i, 'event writer'),
    },
    {
      id: 'runner.snapshot_writer',
      category: 'src_runtime',
      description: 'Reducer-derived state.json writer surface',
      expected_evidence:
        'specs/artifacts.json has a row whose id matches /snapshot.?writer/ AND its schema_file or repo-local backing_paths resolve to a non-empty file',
      planned_slice: '27c',
      detect: () => checkArtifactRow(effectiveArtifacts, /snapshot.?writer/i, 'snapshot writer'),
    },
    {
      id: 'runner.manifest_snapshot',
      category: 'src_runtime',
      description: 'manifest.snapshot.json byte-match writer surface',
      expected_evidence:
        'specs/artifacts.json has a row whose id matches /manifest.?snapshot/ AND its schema_file resolves to a non-empty file',
      planned_slice: '27c',
      detect: () =>
        checkArtifactRow(effectiveArtifacts, /manifest.?snapshot/i, 'manifest snapshot'),
    },
    {
      id: 'tests.runner_smoke',
      category: 'tests_runtime',
      description: 'Runner smoke test exercising at least one dogfood step end-to-end',
      expected_evidence:
        'A tests/ file whose path matches /tests\\/runner\\/.*smoke\\.test\\.ts$/ or /tests\\/.*runner[-_]smoke\\.test\\.ts$/ and contains an it/test/describe block',
      planned_slice: '27d',
      detect: () =>
        checkTestByFilename(
          /(?:^|\/)tests\/runner\/[^/]*smoke\.test\.ts$|(?:^|\/)tests\/[^/]+\/runner[-_]smoke\.test\.ts$/,
          'runner smoke',
        ),
    },
    {
      id: 'tests.event_log_round_trip',
      category: 'tests_runtime',
      description: 'events.ndjson append → parse → reduce → derive state.json round-trip test',
      expected_evidence:
        'A tests/ file whose filename matches /event[-_]?log[-_]?round[-_]?trip\\.test\\.ts$/ and contains an it/test/describe block',
      planned_slice: '27c',
      detect: () =>
        checkTestByFilename(/event[-_]?log[-_]?round[-_]?trip\.test\.ts$/i, 'event-log round-trip'),
    },
    {
      id: 'docs.status_alignment',
      category: 'status_docs',
      description:
        'README.md / PROJECT_STATE.md / TIER.md current_slice markers present and in agreement',
      expected_evidence:
        'All three files carry a well-formed <!-- current_slice: <id> --> marker in the status-header zone, and the ids agree',
      planned_slice: null,
      detect: checkStatusAlignment,
    },
  ];

  const surfaces = definitions.map((def) => {
    const result = def.detect();
    const present = result.present === true;
    return {
      id: def.id,
      category: def.category,
      description: def.description,
      expected_evidence: def.expected_evidence,
      planned_slice: def.planned_slice,
      present,
      evidence_summary: String(result.reason ?? ''),
    };
  });

  const summary = {
    total: surfaces.length,
    present: surfaces.filter((s) => s.present).length,
    absent: surfaces.filter((s) => !s.present).length,
  };

  return { surfaces, summary };
}

export function renderReport({ surfaces, summary, metadata }) {
  return {
    schema_version: REPORT_SCHEMA_VERSION,
    slice: REPORT_SLICE,
    baseline: true,
    metadata,
    summary,
    surfaces,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Product-Surface Inventory');
  lines.push('');
  lines.push(`Schema: v${report.schema_version}`);
  lines.push(`Slice: ${report.slice}`);
  lines.push(`Baseline: ${report.baseline ? 'yes' : 'no'}`);
  lines.push(`Generated: ${report.metadata.generated_at}`);
  lines.push(`HEAD: ${report.metadata.head_commit ?? '(unknown)'}`);
  lines.push('');
  lines.push(
    `**Summary:** ${report.summary.present} / ${report.summary.total} surfaces present, ${report.summary.absent} absent.`,
  );
  lines.push('');
  lines.push('## Surfaces');
  lines.push('');
  lines.push('| id | category | present | planned slice | evidence |');
  lines.push('|---|---|---|---|---|');
  for (const s of report.surfaces) {
    const planned = s.planned_slice ?? '—';
    const ev = s.evidence_summary.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(
      `| \`${s.id}\` | ${s.category} | ${s.present ? 'yes' : 'no'} | ${planned} | ${ev} |`,
    );
  }
  lines.push('');
  lines.push('## Surface details');
  for (const s of report.surfaces) {
    lines.push('');
    lines.push(`### \`${s.id}\``);
    lines.push('');
    lines.push(`- **Description:** ${s.description}`);
    lines.push(`- **Category:** ${s.category}`);
    lines.push(`- **Planned slice:** ${s.planned_slice ?? '—'}`);
    lines.push(`- **Expected evidence:** ${s.expected_evidence}`);
    lines.push(`- **Present at HEAD:** ${s.present ? 'yes' : 'no'}`);
    lines.push(`- **Evidence summary:** ${s.evidence_summary}`);
  }
  lines.push('');
  lines.push('## Delta rule');
  lines.push('');
  lines.push(
    'Per `specs/plans/phase-1-close-revised.md` §Slice 27b, slices 27c and 27d acceptance must rerun `npm run inventory` and assert expected runtime surfaces flip from `present: false` to `present: true`. Placeholder rows — empty files, echo-only scripts, JSON missing required fields, test files with no `it/test/describe` block, or artifact rows without non-empty repo-local schema/backing files — are rejected by the detectors in `scripts/inventory.mjs`.',
  );
  lines.push('');
  return lines.join('\n');
}

// ---------- entrypoint ----------

function runAsScript() {
  const inventory = buildInventory();
  const metadata = {
    generated_at: new Date().toISOString(),
    head_commit: gitHead(),
  };
  const report = renderReport({ ...inventory, metadata });

  mkdirSync(absPath('reports'), { recursive: true });
  const jsonPath = absPath('reports/product-surface.inventory.json');
  const mdPath = absPath('reports/product-surface.inventory.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));

  const { total, present, absent } = report.summary;
  console.log(`Wrote ${relative(REPO_ROOT, jsonPath)}`);
  console.log(`Wrote ${relative(REPO_ROOT, mdPath)}`);
  console.log(`Summary: ${present}/${total} surfaces present, ${absent} absent.`);
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');

if (invokedDirectly) {
  runAsScript();
}

export {
  checkPackageScript,
  checkPluginManifest,
  checkDogfoodWorkflowFixture,
  checkRuntimeEntrypoint,
  checkArtifactRow,
  checkTestByFilename,
  checkStatusAlignment,
  renderMarkdown,
  REPORT_SCHEMA_VERSION,
  REPORT_SLICE,
};
