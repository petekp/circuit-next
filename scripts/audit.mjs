#!/usr/bin/env node
/**
 * circuit-next drift-visibility audit.
 *
 * Walks recent commits and checks the discipline rules from ADR-0001
 * (methodology) and ADR-0002 (bootstrap discipline). Commits before the
 * ADR-0002 floor are reported as pre-discipline (informational only).
 *
 * Usage:
 *   npm run audit            # last 10 commits
 *   npm run audit -- 25      # last 25 commits
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DELIM = '<<<CIRCUIT-NEXT-AUDIT-END>>>';

const LANES = [
  'Ratchet-Advance',
  'Equivalence Refactor',
  'Migration Escrow',
  'Discovery',
  'Disposable',
  'Break-Glass',
];

const SMELL_PATTERNS = [
  { pattern: /\bbecause circuit (does|works|is)\b/i, label: 'because-circuit-does' },
  { pattern: /\bmatches circuit(?:'|\u2019)s\b/i, label: 'matches-circuits' },
  {
    pattern: /\bcircuit(?:'|\u2019)s (pattern|shape|design|approach)\b/i,
    label: 'circuits-pattern',
  },
  { pattern: /\bcopy circuit(?:'|\u2019)s\b/i, label: 'copy-circuits' },
  { pattern: /\bfollow circuit(?:'|\u2019)s lead\b/i, label: 'follow-circuits-lead' },
];

const CITATION_PATTERNS = [
  /specs\/evidence\.md/i,
  /specs\/contracts\//i,
  /specs\/methodology\//i,
  /specs\/domain\.md/i,
  /specs\/behavioral\//i,
  /specs\/risks\.md/i,
  /bootstrap\//i,
  /CLAUDE\.md/i,
  /\bADR-\d{4}/i,
];

const SURFACE_CLASSES = new Set([
  'greenfield',
  'successor-to-live',
  'legacy-compatible',
  'migration-source',
  'external-protocol',
  'unknown-blocking',
]);

const COMPATIBILITY_POLICIES = new Set(['n/a', 'clean-break', 'parse-legacy', 'unknown']);

const DANGLING_REFERENCE_POLICIES = new Set([
  'n/a',
  'unknown-blocking',
  'error-at-resolve',
  'warn',
  'allow',
]);

/**
 * Slice 12 — plane classifier (ADR-0004). Closed two-element set.
 * Promoted to structurally required in schema version 2 (ADR-0005);
 * the PLANE_DEFERRED_IDS allowlist no longer exists.
 */
const PLANES = new Set(['control-plane', 'data-plane']);

/**
 * Slice 12 — data-plane origin tokens (ADR-0004). A data-plane artifact's
 * `trust_boundary` prose MUST name at least one of these concrete origin
 * kinds. `mixed` was removed from the set during Codex fold-in (HIGH #3):
 * it describes *cardinality* of origins, not an origin itself, so it
 * cannot satisfy "who can lie to this reader?" on its own. Mixed-trust
 * artifacts are classified as data-plane at v2 (ADR-0005) under the
 * worst-case-producer rule.
 */
const DATA_PLANE_ORIGIN_TOKENS = ['operator-local', 'engine-computed', 'model-authored'];

/**
 * Slice 12 — negation markers checked against the immediate left-context
 * of an origin-token match. Codex fold-in HIGH #2: without this, a prose
 * like "never operator-local; author-signed only" passes substring match
 * while semantically asserting the opposite. The window is a handful of
 * characters before the match; longer-range negation ("X is not Y ... but
 * really operator-local") is not detected, but the structured prose we
 * write tends to put negation immediately before the negated noun.
 */
const NEGATION_MARKERS = ['not ', 'non-', 'no ', 'never '];
const NEGATION_WINDOW = 8;

const ARTIFACT_REQUIRED_BASE_FIELDS = [
  'id',
  'surface_class',
  'compatibility_policy',
  'description',
  'schema_file',
  'schema_exports',
  'writers',
  'readers',
  'backing_paths',
  'identity_fields',
  'dangerous_sinks',
  'trust_boundary',
];

const ARTIFACT_NON_GREENFIELD_REQUIRED = [
  'reference_surfaces',
  'reference_evidence',
  'migration_policy',
  'legacy_parse_policy',
];

const PATH_SAFE_PRIMITIVES = ['ControlPlaneFileStem'];

/**
 * Slice 11 — schema_exports existence check. Returns true iff `name` appears
 * as `export const <name>` in the source (word-boundary exact match on the
 * identifier). Matches only top-level `export const`, not `export { name }`
 * re-exports, by design: artifacts.json names the DEFINING module, not
 * wherever the identifier happens to be re-exported. Extending to cover
 * `export function <name>` / `export class <name>` / `export type <name>` /
 * `export { <name> }` is a v0.2 scope item once an artifact actually needs
 * one of those export forms.
 */
export function schemaExportPresent(schemaSrc, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^export const ${escaped}\\b`, 'm');
  return pattern.test(schemaSrc);
}

/**
 * Slice 12 — plane classifier validity check (ADR-0004). Returns true iff
 * `plane` is one of the closed two-element set `{control-plane, data-plane}`.
 */
export function planeIsValid(plane) {
  return PLANES.has(plane);
}

/**
 * Slice 12 — data-plane trust-boundary-detail check (ADR-0004). Returns
 * true iff the prose `trust_boundary` names at least one **unnegated**
 * origin token from the closed set {operator-local, engine-computed,
 * model-authored}. Codex fold-in HIGH #2: checks NEGATION_MARKERS in the
 * immediate left-context of every match and rejects those matches; if
 * every match of every token is negated, the rule returns false.
 * Case-insensitive. Control-plane artifacts are not subject to this rule;
 * the caller is responsible for gating on plane.
 */
export function trustBoundaryHasOriginToken(boundary) {
  if (typeof boundary !== 'string' || boundary.length === 0) return false;
  const lower = boundary.toLowerCase();
  for (const token of DATA_PLANE_ORIGIN_TOKENS) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(token, from);
      if (idx === -1) break;
      const windowStart = Math.max(0, idx - NEGATION_WINDOW);
      const before = lower.slice(windowStart, idx);
      const negated = NEGATION_MARKERS.some((m) => before.endsWith(m));
      if (!negated) return true;
      from = idx + token.length;
    }
  }
  return false;
}

function sh(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT }).toString();
}

function shSafe(cmd) {
  try {
    return sh(cmd).trim();
  } catch {
    return '';
  }
}

function getCommits(n) {
  const raw = sh(`git log -n ${n} --format="%H|%s%n%b%n${DELIM}"`);
  return raw
    .split(`${DELIM}\n`)
    .filter((block) => block.trim())
    .map((block) => {
      const nl = block.indexOf('\n');
      const header = block.slice(0, nl);
      const body = block.slice(nl + 1);
      const pipe = header.indexOf('|');
      const hash = header.slice(0, pipe);
      const subject = header.slice(pipe + 1);
      return { hash, short: hash.slice(0, 7), subject, body };
    });
}

function findDisciplineFloor() {
  return shSafe(`git log --grep='adr-0002' --format='%H' -n 1`) || null;
}

function checkLane(body) {
  const found = LANES.find((lane) => body.includes(`Lane: ${lane}`));
  return found ?? null;
}

function checkFraming(body) {
  return {
    failureMode: /failure mode:/i.test(body),
    acceptanceEvidence: /acceptance evidence:/i.test(body),
    alternateFraming: /alternate framing:/i.test(body),
  };
}

function checkCitation(body) {
  return CITATION_PATTERNS.some((p) => p.test(body));
}

function checkSmells(body) {
  return SMELL_PATTERNS.filter(({ pattern }) => pattern.test(body)).map(({ label }) => label);
}

function checkCircuitAdditions() {
  const staged = shSafe('git diff --cached --name-only -- .circuit/').split('\n').filter(Boolean);
  const untracked = shSafe('git ls-files --others --exclude-standard -- .circuit/')
    .split('\n')
    .filter(Boolean);
  const allowedPrefix = '.circuit/circuit-runs/phase-1-step-contract-authorship/';
  const filter = (list) => list.filter((p) => !p.startsWith(allowedPrefix));
  return { staged: filter(staged), untracked: filter(untracked) };
}

function countTests(ref) {
  const path = 'tests/contracts/schema-parity.test.ts';
  const content = ref
    ? shSafe(`git show ${ref}:${path}`)
    : existsSync(join(REPO_ROOT, path))
      ? readFileSync(join(REPO_ROOT, path), 'utf-8')
      : '';
  if (!content) return null;
  const matches = content.match(/^\s*(it|test)\(/gm);
  return matches ? matches.length : 0;
}

function projectStateCurrent(recentCount) {
  const lastTouch = shSafe("git log -1 --format='%H' -- PROJECT_STATE.md");
  if (!lastTouch) return false;
  const recent = shSafe(`git log -n ${recentCount} --format='%H'`).split('\n').filter(Boolean);
  return recent.includes(lastTouch);
}

function verifyStatus() {
  try {
    execSync('npm run verify', { cwd: REPO_ROOT, stdio: 'pipe' });
    return { pass: true, detail: null };
  } catch (err) {
    const tail = (err.stdout?.toString() ?? err.message ?? '').slice(-600);
    return { pass: false, detail: tail };
  }
}

function readFrontmatter(absPath) {
  if (!existsSync(absPath)) return { ok: false, error: 'missing' };
  const content = readFileSync(absPath, 'utf-8');
  if (!content.startsWith('---\n')) return { ok: false, error: 'no-frontmatter' };
  const end = content.indexOf('\n---', 4);
  if (end === -1) return { ok: false, error: 'unterminated-frontmatter' };
  const fm = content.slice(4, end);
  const result = {};
  let _currentKey = null;
  let currentList = null;
  for (const rawLine of fm.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) {
      _currentKey = null;
      currentList = null;
      continue;
    }
    const listMatch = line.match(/^\s*-\s*(.+?)\s*$/);
    if (listMatch && currentList !== null) {
      currentList.push(listMatch[1].replace(/^['"]|['"]$/g, ''));
      continue;
    }
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '') {
      const list = [];
      result[key] = list;
      _currentKey = key;
      currentList = list;
    } else {
      const bracketList = value.match(/^\[(.*)\]$/);
      if (bracketList) {
        const items = bracketList[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        result[key] = items;
      } else {
        result[key] = value.replace(/^['"]|['"]$/g, '');
      }
      _currentKey = key;
      currentList = null;
    }
  }
  return { ok: true, frontmatter: result };
}

function loadArtifactsGraph() {
  const artifactsJsonPath = join(REPO_ROOT, 'specs', 'artifacts.json');
  const artifactsMdPath = join(REPO_ROOT, 'specs', 'artifacts.md');
  const issues = [];

  if (!existsSync(artifactsJsonPath)) {
    issues.push('specs/artifacts.json missing');
  }
  if (!existsSync(artifactsMdPath)) {
    issues.push('specs/artifacts.md missing');
  }
  if (issues.length > 0) return { issues, graph: null };

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(artifactsJsonPath, 'utf-8'));
  } catch (err) {
    issues.push(`specs/artifacts.json is invalid JSON: ${err.message}`);
    return { issues, graph: null };
  }

  if (!parsed || typeof parsed !== 'object') {
    issues.push('specs/artifacts.json is not an object');
    return { issues, graph: null };
  }
  if (!Array.isArray(parsed.artifacts)) {
    issues.push('specs/artifacts.json is missing "artifacts" array');
    return { issues, graph: null };
  }

  return { issues, graph: parsed };
}

function checkAuthorityGraph() {
  const findings = [];
  const { issues: loadIssues, graph } = loadArtifactsGraph();
  for (const iss of loadIssues) findings.push({ level: 'red', detail: iss });
  if (!graph) {
    return { level: 'red', findings, summary: 'authority graph absent' };
  }

  const ids = graph.artifacts.map((a) => a.id);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      findings.push({ level: 'red', detail: `duplicate artifact id: ${id}` });
    }
    seen.add(id);
  }

  const byId = new Map(graph.artifacts.map((a) => [a.id, a]));

  for (const artifact of graph.artifacts) {
    if (!SURFACE_CLASSES.has(artifact.surface_class)) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: unknown surface_class "${artifact.surface_class}"`,
      });
    }
    if (!COMPATIBILITY_POLICIES.has(artifact.compatibility_policy)) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: unknown compatibility_policy "${artifact.compatibility_policy}"`,
      });
    }
    if (
      Object.hasOwn(artifact, 'dangling_reference_policy') &&
      !DANGLING_REFERENCE_POLICIES.has(artifact.dangling_reference_policy)
    ) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: unknown dangling_reference_policy "${artifact.dangling_reference_policy}"`,
      });
    }
    // Slice 12 — plane classifier (ADR-0004). Promoted to structurally required at
    // v2 (ADR-0005): every artifact MUST declare plane, no deferral allowlist.
    // When plane is declared: value in closed set; data-plane requires trust_boundary
    // to name an unnegated origin token (Codex HIGH #2, #3); control-plane may not have
    // path_derived_fields (Codex MED #6 — plugin-authored static content should not
    // derive identity from filesystem paths).
    if (!Object.hasOwn(artifact, 'plane')) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: missing required field "plane"; classify as control-plane or data-plane. If neither is defensible, write a superseding ADR to split the artifact into per-layer ids or widen the plane set (see ADR-0005 §Reopen conditions)`,
      });
    } else if (!planeIsValid(artifact.plane)) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: unknown plane "${artifact.plane}" (expected one of ${[...PLANES].join(', ')})`,
      });
    } else {
      if (
        artifact.plane === 'data-plane' &&
        !trustBoundaryHasOriginToken(artifact.trust_boundary)
      ) {
        findings.push({
          level: 'red',
          detail: `${artifact.id} (data-plane): trust_boundary must name an unnegated origin token (${DATA_PLANE_ORIGIN_TOKENS.join(', ')}); got "${artifact.trust_boundary}"`,
        });
      }
      if (
        artifact.plane === 'control-plane' &&
        Array.isArray(artifact.path_derived_fields) &&
        artifact.path_derived_fields.length > 0
      ) {
        findings.push({
          level: 'red',
          detail: `${artifact.id} (control-plane): path_derived_fields is non-empty (${artifact.path_derived_fields.join(', ')}); plugin-authored static artifacts must not derive identity from filesystem paths`,
        });
      }
    }
    for (const field of ARTIFACT_REQUIRED_BASE_FIELDS) {
      if (!Object.hasOwn(artifact, field)) {
        findings.push({
          level: 'red',
          detail: `${artifact.id}: missing required base field "${field}"`,
        });
      }
    }
    const nonGreenfieldNonExternal =
      artifact.surface_class !== 'greenfield' && artifact.surface_class !== 'external-protocol';
    if (nonGreenfieldNonExternal) {
      for (const field of ARTIFACT_NON_GREENFIELD_REQUIRED) {
        if (!Object.hasOwn(artifact, field)) {
          findings.push({
            level: 'red',
            detail: `${artifact.id} (${artifact.surface_class}): missing ${field}`,
          });
        }
      }
      if (artifact.compatibility_policy === 'unknown') {
        findings.push({
          level: 'red',
          detail: `${artifact.id} (${artifact.surface_class}): compatibility_policy=unknown blocks contract authorship`,
        });
      }
    }
    if (artifact.surface_class === 'legacy-compatible') {
      const fixtureDir = join(REPO_ROOT, 'tests', 'fixtures', 'reference', 'legacy-circuit');
      if (!existsSync(fixtureDir)) {
        findings.push({
          level: 'red',
          detail: `${artifact.id} (legacy-compatible): missing tests/fixtures/reference/legacy-circuit/`,
        });
      }
    }
    if (Array.isArray(artifact.reference_evidence)) {
      for (const relPath of artifact.reference_evidence) {
        const abs = join(REPO_ROOT, relPath);
        if (!existsSync(abs)) {
          findings.push({
            level: 'red',
            detail: `${artifact.id}: reference_evidence file missing — ${relPath}`,
          });
        }
      }
    }
    if (Array.isArray(artifact.path_derived_fields) && artifact.path_derived_fields.length > 0) {
      const contractPath = artifact.contract ? join(REPO_ROOT, artifact.contract) : null;
      let primitiveCited = false;
      if (contractPath && existsSync(contractPath)) {
        const contractText = readFileSync(contractPath, 'utf-8');
        primitiveCited = PATH_SAFE_PRIMITIVES.some((p) => contractText.includes(p));
      }
      if (!primitiveCited && artifact.contract !== null) {
        findings.push({
          level: 'red',
          detail: `${artifact.id}: path_derived_fields present but no path-safe primitive (${PATH_SAFE_PRIMITIVES.join(', ')}) cited in contract ${artifact.contract ?? '(none)'}`,
        });
      }
    }
    if (artifact.schema_file) {
      const schemaAbs = join(REPO_ROOT, artifact.schema_file);
      if (!existsSync(schemaAbs)) {
        findings.push({
          level: 'red',
          detail: `${artifact.id}: schema_file missing — ${artifact.schema_file}`,
        });
      } else if (Array.isArray(artifact.schema_exports)) {
        // Slice 11 — schema_exports existence hardening. For every name the
        // authority graph claims is exported from the schema file, regex-check
        // that the name appears in an `export const <name>` position in the
        // source. Catches the class of drift where the graph names a stale
        // export (renamed, deleted, never-landed) and the audit would pass
        // because only array non-emptiness was checked.
        const schemaSrc = readFileSync(schemaAbs, 'utf-8');
        for (const exportName of artifact.schema_exports) {
          if (!schemaExportPresent(schemaSrc, exportName)) {
            findings.push({
              level: 'red',
              detail: `${artifact.id}: schema_exports names "${exportName}" but it is not \`export const ${exportName}\`d from ${artifact.schema_file}`,
            });
          }
        }
      }
    }
  }

  const contractsDir = join(REPO_ROOT, 'specs', 'contracts');
  const contractFiles = existsSync(contractsDir)
    ? readdirSync(contractsDir).filter((f) => f.endsWith('.md'))
    : [];
  for (const file of contractFiles) {
    const absContract = join(contractsDir, file);
    const { ok, frontmatter, error } = readFrontmatter(absContract);
    if (!ok) {
      findings.push({
        level: 'red',
        detail: `specs/contracts/${file}: frontmatter ${error ?? 'unreadable'}`,
      });
      continue;
    }
    const artifactIds = frontmatter.artifact_ids;
    if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
      findings.push({
        level: 'red',
        detail: `specs/contracts/${file}: missing or empty artifact_ids frontmatter`,
      });
      continue;
    }
    for (const id of artifactIds) {
      if (!byId.has(id)) {
        findings.push({
          level: 'red',
          detail: `specs/contracts/${file}: artifact_ids references ${id} not in specs/artifacts.json`,
        });
      }
    }
  }

  const continuityContract = join(REPO_ROOT, 'specs', 'contracts', 'continuity.md');
  if (existsSync(continuityContract)) {
    for (const requiredId of ['continuity.record', 'continuity.index']) {
      const art = byId.get(requiredId);
      if (!art) {
        findings.push({
          level: 'red',
          detail: `specs/contracts/continuity.md exists but ${requiredId} is absent from specs/artifacts.json`,
        });
      } else if (art.compatibility_policy === 'unknown') {
        findings.push({
          level: 'red',
          detail: `specs/contracts/continuity.md exists but ${requiredId} has compatibility_policy=unknown`,
        });
      }
    }
  }

  const level = findings.some((f) => f.level === 'red') ? 'red' : 'green';
  // ADR-0005 v2: plane is structurally required; every artifact classifies or the audit
  // reds. The summary no longer reports a deferral count because the allowlist no longer
  // exists.
  const planeClassified = graph.artifacts.filter((a) => Object.hasOwn(a, 'plane')).length;
  const total = graph.artifacts.length;
  return {
    level,
    findings,
    summary:
      level === 'green'
        ? `${total} artifacts, all surface_class-classified; ${planeClassified}/${total} plane-classified; ${contractFiles.length} contracts bound`
        : `${findings.length} authority-graph violation${findings.length === 1 ? '' : 's'}`,
  };
}

const PHASE_PATTERNS = [
  /\*\*Phase[:*]+\*\*\s*([0-9]+(?:\.[0-9]+)?)/i,
  /\*\*Phase\s+([0-9]+(?:\.[0-9]+)?)/i,
  /Current phase\s*[:\-—]\s*Phase\s*([0-9]+(?:\.[0-9]+)?)/i,
  /^##\s+Phase\s+([0-9]+(?:\.[0-9]+)?)\s*[—\-]/im,
  /^\s*Phase\s+([0-9]+(?:\.[0-9]+)?)\s*[—\-]/im,
];

function extractPhaseMention(text) {
  for (const pattern of PHASE_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function checkPhaseDrift() {
  const readmePath = join(REPO_ROOT, 'README.md');
  const projectStatePath = join(REPO_ROOT, 'PROJECT_STATE.md');
  if (!existsSync(readmePath) || !existsSync(projectStatePath)) {
    return { level: 'yellow', detail: 'README.md or PROJECT_STATE.md missing' };
  }
  const readme = readFileSync(readmePath, 'utf-8');
  const projectState = readFileSync(projectStatePath, 'utf-8');
  const readmeStatusSlice = readme.split('\n').slice(0, 50).join('\n');
  const psStatusSlice = projectState.split('\n').slice(0, 10).join('\n');
  const readmePhase = extractPhaseMention(readmeStatusSlice);
  const psPhase = extractPhaseMention(psStatusSlice);
  if (readmePhase === null || psPhase === null) {
    return {
      level: 'yellow',
      detail: `could not extract phase from README (${readmePhase}) or PROJECT_STATE (${psPhase})`,
    };
  }
  if (readmePhase !== psPhase) {
    return {
      level: 'red',
      detail: `README says Phase ${readmePhase}; PROJECT_STATE says Phase ${psPhase}`,
    };
  }
  return { level: 'green', detail: `README and PROJECT_STATE agree on Phase ${readmePhase}` };
}

function commitIsSliceShaped(commit) {
  // Merge commits, reverts, and plain housekeeping without a Lane don't warrant slice
  // discipline checks. A "slice" is any commit that declares a Lane.
  return checkLane(commit.body) !== null;
}

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function mark(level) {
  if (level === 'green') return `${GREEN}✓${RESET}`;
  if (level === 'yellow') return `${YELLOW}⚠${RESET}`;
  if (level === 'red') return `${RED}✗${RESET}`;
  return '·';
}

function header(text) {
  console.log(`\n${BOLD}${text}${RESET}`);
  console.log('─'.repeat(text.length));
}

function main() {
  const arg = process.argv[2];
  const N = arg ? Number(arg) : 10;
  if (!Number.isFinite(N) || N <= 0) {
    console.error('Usage: npm run audit [-- <n-commits>]');
    process.exit(2);
  }

  const floor = findDisciplineFloor();
  const floorShort = floor ? floor.slice(0, 7) : null;
  const commits = getCommits(N);

  // Classify commits.
  let pastFloor = false;
  for (const c of commits) {
    c.preDiscipline = pastFloor;
    if (floor && c.hash === floor) pastFloor = true;
  }
  if (!floor) {
    for (const c of commits) c.preDiscipline = true;
  }

  const disciplinedCommits = commits.filter((c) => !c.preDiscipline);
  const preDisciplineCommits = commits.filter((c) => c.preDiscipline);

  const counters = { green: 0, yellow: 0, red: 0 };
  const findings = [];

  // Check 1: Lane declaration on each disciplined commit.
  const laneResults = disciplinedCommits.map((c) => ({ commit: c, lane: checkLane(c.body) }));
  const missingLane = laneResults.filter((r) => r.lane === null);
  if (missingLane.length === 0) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Lane declaration',
      detail: `${laneResults.length}/${laneResults.length} disciplined commits declare a lane`,
    });
  } else {
    counters.red++;
    findings.push({
      level: 'red',
      check: 'Lane declaration',
      detail: `${missingLane.length}/${laneResults.length} missing: ${missingLane
        .map((r) => `${r.commit.short} "${r.commit.subject}"`)
        .join(', ')}`,
    });
  }

  // Check 2: Framing triplet on slice-shaped commits.
  const framingGaps = [];
  for (const c of disciplinedCommits) {
    if (!commitIsSliceShaped(c)) continue;
    const f = checkFraming(c.body);
    const missing = [];
    if (!f.failureMode) missing.push('failure mode');
    if (!f.acceptanceEvidence) missing.push('acceptance evidence');
    if (!f.alternateFraming) missing.push('alternate framing');
    if (missing.length > 0) framingGaps.push({ commit: c, missing });
  }
  if (framingGaps.length === 0) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Framing triplet',
      detail: 'All slice commits include failure mode + acceptance evidence + alternate framing',
    });
  } else {
    counters.yellow++;
    findings.push({
      level: 'yellow',
      check: 'Framing triplet',
      detail: framingGaps
        .map((g) => `${g.commit.short} missing: ${g.missing.join(', ')}`)
        .join('; '),
    });
  }

  // Check 3: Citation rule (ADR-0002).
  const citationGaps = disciplinedCommits.filter(
    (c) => commitIsSliceShaped(c) && !checkCitation(c.body),
  );
  if (citationGaps.length === 0) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Citation rule (ADR-0002)',
      detail: 'All slice commits cite specs/, CLAUDE.md, bootstrap/, or an ADR',
    });
  } else {
    counters.red++;
    findings.push({
      level: 'red',
      check: 'Citation rule (ADR-0002)',
      detail: citationGaps.map((c) => `${c.short} "${c.subject}"`).join(', '),
    });
  }

  // Check 4: Circuit-as-justification smells (ADR-0002).
  const smellHits = [];
  for (const c of disciplinedCommits) {
    const labels = checkSmells(c.body);
    if (labels.length > 0) smellHits.push({ commit: c, labels });
  }
  if (smellHits.length === 0) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'No Circuit-as-justification smell',
      detail: 'No disciplined commit justifies a decision by citing existing Circuit behavior',
    });
  } else {
    counters.yellow++;
    findings.push({
      level: 'yellow',
      check: 'Circuit-as-justification smell',
      detail: smellHits.map((h) => `${h.commit.short} — ${h.labels.join(', ')}`).join('; '),
    });
  }

  // Check 5: No new .circuit/ additions.
  const circuitAdds = checkCircuitAdditions();
  const hasAdds = circuitAdds.staged.length + circuitAdds.untracked.length > 0;
  if (!hasAdds) {
    counters.green++;
    findings.push({
      level: 'green',
      check: '.circuit/ gitignore rule',
      detail: 'No new orchestration artifacts staged or untracked in project tree',
    });
  } else {
    counters.yellow++;
    findings.push({
      level: 'yellow',
      check: '.circuit/ gitignore rule',
      detail: [
        circuitAdds.staged.length > 0 ? `staged: ${circuitAdds.staged.join(', ')}` : null,
        circuitAdds.untracked.length > 0
          ? `untracked: ${circuitAdds.untracked.length} paths`
          : null,
      ]
        .filter(Boolean)
        .join('; '),
    });
  }

  // Check 6: Contract test ratchet (monotonic non-decreasing).
  const headCount = countTests(null);
  const prevCount = countTests('HEAD~1');
  if (headCount === null) {
    counters.yellow++;
    findings.push({
      level: 'yellow',
      check: 'Contract test ratchet',
      detail: 'tests/contracts/schema-parity.test.ts not found',
    });
  } else if (prevCount === null || headCount >= prevCount) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Contract test ratchet',
      detail: `${headCount} tests at HEAD${
        prevCount !== null
          ? ` (HEAD~1: ${prevCount}, Δ ${headCount - prevCount >= 0 ? '+' : ''}${headCount - prevCount})`
          : ''
      }`,
    });
  } else {
    counters.red++;
    findings.push({
      level: 'red',
      check: 'Contract test ratchet',
      detail: `REGRESSION: HEAD has ${headCount}, HEAD~1 had ${prevCount}`,
    });
  }

  // Check 7: PROJECT_STATE.md current vs HEAD.
  const psCurrent = projectStateCurrent(Math.min(disciplinedCommits.length || 1, 3));
  if (psCurrent) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'PROJECT_STATE.md current',
      detail: 'Updated within the last few commits',
    });
  } else {
    counters.yellow++;
    findings.push({
      level: 'yellow',
      check: 'PROJECT_STATE.md current',
      detail: 'Stale vs recent commits — consider updating',
    });
  }

  // Check 8: Authority graph (ADR-0003).
  const authority = checkAuthorityGraph();
  if (authority.level === 'green') {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Authority graph (ADR-0003)',
      detail: authority.summary,
    });
  } else {
    counters.red++;
    const bullets = authority.findings
      .slice(0, 20)
      .map((f) => `    - ${f.detail}`)
      .join('\n');
    const more =
      authority.findings.length > 20 ? `\n    - (+${authority.findings.length - 20} more)` : '';
    findings.push({
      level: 'red',
      check: 'Authority graph (ADR-0003)',
      detail: `${authority.summary}:\n${bullets}${more}`,
    });
  }

  // Check 9: README / PROJECT_STATE phase consistency.
  const phaseDrift = checkPhaseDrift();
  counters[phaseDrift.level]++;
  findings.push({
    level: phaseDrift.level,
    check: 'Phase consistency (README ↔ PROJECT_STATE)',
    detail: phaseDrift.detail,
  });

  // Check 10: npm run verify currently green.
  const verify = verifyStatus();
  if (verify.pass) {
    counters.green++;
    findings.push({
      level: 'green',
      check: 'Verify gate',
      detail: 'npm run verify passes (tsc --strict + biome + vitest)',
    });
  } else {
    counters.red++;
    findings.push({
      level: 'red',
      check: 'Verify gate',
      detail: `FAIL — tail:\n${verify.detail}`,
    });
  }

  // Report.
  console.log(`${BOLD}circuit-next audit${RESET} — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`${DIM}Commits scanned: ${commits.length} (last ${N})${RESET}`);
  console.log(
    `${DIM}Discipline floor: ${floorShort ?? '<not found>'} — ${disciplinedCommits.length} under discipline, ${preDisciplineCommits.length} pre-discipline${RESET}`,
  );

  header('Checks');
  for (const f of findings) {
    console.log(`  ${mark(f.level)} ${BOLD}${f.check}${RESET}`);
    console.log(`      ${DIM}${f.detail}${RESET}`);
  }

  if (preDisciplineCommits.length > 0) {
    header('Pre-discipline commits (informational)');
    for (const c of preDisciplineCommits) {
      console.log(`  ${DIM}${c.short} ${c.subject}${RESET}`);
    }
  }

  header('Summary');
  const summaryLine = `${GREEN}${counters.green} green${RESET}  ${YELLOW}${counters.yellow} yellow${RESET}  ${RED}${counters.red} red${RESET}`;
  console.log(`  ${summaryLine}`);

  const exitCode = counters.red > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Only run main() when invoked directly (`node scripts/audit.mjs`), not when
// imported as a module (e.g. by tests/contracts/artifact-authority.test.ts for
// the `schemaExportPresent` helper). Without this guard, every import of this
// file would shell out to `npm run verify`, which itself runs vitest, which
// re-imports this file — a fork-bomb observed during Slice 11 authoring.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
