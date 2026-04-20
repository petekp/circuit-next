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
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

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
  'contract',
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
 * Slice 23 — compile-time parity guards. Identifiers matching this exact
 * pattern are excluded from the schema-export coverage ledger because they
 * are type-level cross-module parity checks (Codex MED #8 fold-in: the
 * previous broad `_`-prefix filter let any `_`-prefixed export escape the
 * ledger). Any future guard MUST conform to this pattern; an `_`-prefixed
 * export outside it fails the ledger.
 */
export const COMPILE_TIME_GUARD_PATTERN = /^_compileTime[A-Z][A-Za-z0-9_]*Parity$/;

/**
 * Slice 23 — schema-file allowlist for the schema-export coverage ledger
 * (HIGH #4 fold-in, with Codex fold-ins layered on top). Every file in
 * `src/schemas/` except `index.ts` must either be referenced as some
 * artifact's `schema_file` OR appear here with full metadata. Catches the
 * class of correlated miss where a schema file lands without an artifact
 * row (config.md is the named case from
 * `specs/reviews/arc-phase-1-close-codex.md` — MED #18).
 *
 * Entry shape:
 *   category: 'shared-primitive' — building blocks consumed by multiple
 *                                  artifacts, not a first-class artifact.
 *             'pending-artifact'  — schema file that SHOULD map to an
 *                                  artifact row but does not yet. Required
 *                                  fields below apply.
 *   reason: non-empty prose.
 *   known_exports: exhaustive list of the file's runtime exports (Codex
 *                  HIGH #4 fold-in: symbol-level check catches new exports
 *                  added to an allowlisted file, which would otherwise be
 *                  invisible — a one-level-deeper version of the original
 *                  omitted-artifact class).
 *   tracking_slice (pending-artifact only, Codex MED #9 fold-in): integer
 *                  slice id that will convert this entry to an artifact.
 *   tracking_objection (pending-artifact only, Codex MED #9 fold-in):
 *                  citation path#id into the originating review record.
 */
export const SCHEMA_FILE_ALLOWLIST = {
  'src/schemas/ids.ts': {
    category: 'shared-primitive',
    reason:
      'branded id primitives (WorkflowId, PhaseId, StepId, RunId, ...) consumed by every artifact',
    known_exports: [
      'WorkflowId',
      'PhaseId',
      'StepId',
      'RunId',
      'InvocationId',
      'SkillId',
      'ProtocolId',
    ],
  },
  'src/schemas/primitives.ts': {
    category: 'shared-primitive',
    reason: 'path-safe primitives (ControlPlaneFileStem) per ADR-0003',
    known_exports: ['ControlPlaneFileStem'],
  },
  'src/schemas/lane.ts': {
    category: 'shared-primitive',
    reason: 'lane enum used by methodology discipline, not a runtime artifact',
    known_exports: [
      'Lane',
      'StandardLane',
      'MigrationEscrowLane',
      'BreakGlassLane',
      'LaneDeclaration',
    ],
  },
  'src/schemas/rigor.ts': {
    category: 'shared-primitive',
    reason: 'rigor-level enum used in selection composition',
    known_exports: ['Rigor', 'CONSEQUENTIAL_RIGORS', 'isConsequentialRigor'],
  },
  'src/schemas/role.ts': {
    category: 'shared-primitive',
    reason: 'role-name enum used in dispatch + selection',
    known_exports: ['Role'],
  },
  'src/schemas/gate.ts': {
    category: 'shared-primitive',
    reason: 'gate shapes embedded in step.definition; step contract governs them',
    known_exports: [
      'ArtifactSource',
      'CheckpointResponseSource',
      'DispatchResultSource',
      'GateSource',
      'SchemaSectionsGate',
      'CheckpointSelectionGate',
      'ResultVerdictGate',
      'Gate',
    ],
  },
  'src/schemas/event.ts': {
    category: 'pending-artifact',
    reason:
      'event-writer boundary contract pending — HIGH #7 (arc-phase-1-close-codex.md) scheduled Slice 30',
    tracking_slice: 30,
    tracking_objection: 'specs/reviews/arc-phase-1-close-codex.md#HIGH-7',
    known_exports: [
      'Event',
      'RunBootstrappedEvent',
      'StepEnteredEvent',
      'StepArtifactWrittenEvent',
      'GateEvaluatedEvent',
      'CheckpointRequestedEvent',
      'CheckpointResolvedEvent',
      'DispatchStartedEvent',
      'DispatchCompletedEvent',
      'StepCompletedEvent',
      'StepAbortedEvent',
      'RunClosedEvent',
      'RunClosedOutcome',
    ],
  },
};

/**
 * Slice 23 — collect top-level runtime identifiers from a schema source.
 * Matches `export const|type|function|class <Name>` (Codex HIGH #6 fold-in:
 * the prior `export const`-only regex missed type-only exports like
 * `AppliedEntry`, `JsonObject`). `_`-prefixed names are excluded only if
 * they match `COMPILE_TIME_GUARD_PATTERN` — a stricter filter than the
 * previous broad `_` check (Codex MED #8). Re-exports and `export default`
 * are out of scope for v0.1; full TS AST coverage is tracked v0.2.
 */
export function collectSchemaExports(schemaSrc) {
  const names = new Set();
  const pattern = /^export (?:const|type|function|class) ([A-Za-z_][A-Za-z0-9_]*)\b/gm;
  let match = pattern.exec(schemaSrc);
  while (match !== null) {
    const name = match[1];
    const isKnownGuard = name.startsWith('_') && COMPILE_TIME_GUARD_PATTERN.test(name);
    if (!isKnownGuard) names.add(name);
    match = pattern.exec(schemaSrc);
  }
  return names;
}

/**
 * Slice 23 — check artifact-to-contract reciprocation (HIGH #4 fold-in).
 * Returns true iff the contract's `artifact_ids` frontmatter list contains
 * `artifactId`. Used both by audit.mjs and by artifact-authority.test.ts to
 * assert the reverse direction of the authority graph: an artifact row's
 * `contract` pointer must be reciprocated by the contract naming it back.
 */
export function contractReciprocatesArtifact(contractFrontmatter, artifactId) {
  const ids = contractFrontmatter?.artifact_ids;
  if (!Array.isArray(ids)) return false;
  return ids.includes(artifactId);
}

/**
 * Slice 11 — schema_exports existence check. Returns true iff `name` appears
 * as a top-level defining export in the source (word-boundary exact match
 * on the identifier). Matches `export const|type|function|class <name>`
 * (Codex HIGH #6 fold-in: prior `const`-only regex missed type-only
 * exports like `AppliedEntry`, `JsonObject`). Does not match
 * `export { <name> }` re-exports or `export default` — artifacts.json
 * names the DEFINING module, and defaults have no stable identifier to
 * pin. Full TypeScript AST-based coverage is tracked v0.2.
 */
export function schemaExportPresent(schemaSrc, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^export (?:const|type|function|class) ${escaped}\\b`, 'm');
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

// Static test-declaration count across all test files at a given ref.
// Counts lines matching /^\s*(it|test)\(/, which is the authored-test shape.
// This is a STATIC FLOOR, not a runtime total: tests generated dynamically
// inside `for` loops or `it.each` tables are not counted. At 2026-04-20 the
// static floor across 8 test files is 433; the vitest runtime total is 482
// (24 dynamic in schema-parity.test.ts, 23 in primitives.test.ts, 2 in
// artifact-authority.test.ts). The ratchet uses the same method at both
// refs, so the static floor is consistent and a regression in authored
// tests still fires. Runtime count comes from `npm run test` (the verify
// gate) — the audit displays the static floor to make the ratchet
// deterministic without shelling into vitest.
function countTests(ref) {
  const files = testFileList(ref);
  if (!files.length) return null;
  let count = 0;
  for (const path of files) {
    const content = ref
      ? shSafe(`git show ${ref}:${path}`)
      : existsSync(join(REPO_ROOT, path))
        ? readFileSync(join(REPO_ROOT, path), 'utf-8')
        : '';
    if (!content) continue;
    const matches = content.match(/^\s*(it|test)\(/gm);
    if (matches) count += matches.length;
  }
  return count;
}

// Lists test files tracked at a given git ref (HEAD, HEAD~1, ...), or the
// working tree if ref is null. Uses `git ls-tree` to enumerate tracked
// files so we get the set that actually existed at that commit.
function testFileList(ref) {
  if (ref) {
    const raw = shSafe(`git ls-tree -r --name-only ${ref}`);
    return raw.split('\n').filter((p) => /^tests\/.*\.test\.(ts|mts|js|mjs)$/.test(p));
  }
  const raw = shSafe('git ls-files -- tests');
  return raw.split('\n').filter((p) => /^tests\/.*\.test\.(ts|mts|js|mjs)$/.test(p));
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

/**
 * Slice 25 — invariant ledger integrity audit dimension. Loads
 * specs/invariants.json and reports load-ability, duplicate detection,
 * and enforcement_state distribution. The full set-equality + binding-ref
 * enforcement lives in tests/contracts/invariant-ledger.test.ts (which
 * runs as part of `npm run verify`); this audit dimension surfaces ledger
 * presence at a glance and fails red if the ledger is missing or
 * structurally broken. Per Codex challenger MED 10 fold-in.
 */
// Slice 25a — Methodology artifact portability (FUP-1, ADR-0001 addendum).
// Absolute symlinks under specs/ bind the repo's authority surface to the
// author's host filesystem; on any clone they resolve to broken paths and the
// methodology artifacts stop being readable. Portability requires that every
// symlink under specs/ be either (a) absolute → rejected, or (b) relative and
// resolving to a path still inside the repo containment boundary. A relative
// link like `../../../../tmp/host-local` is syntactically relative but escapes
// the repo, so it fails portability the same way an absolute target does.
//
// Exported so tests/contracts/specs-portability.test.ts can exercise the guard
// against a constructed fixture without shelling out to the audit CLI.
// Each violation carries a `reason` field: 'absolute' or 'escapes-repo'.
//
// Scope note (Codex MED #7): the scan walks the working tree, not the git
// index. `.gitignore`-ed detritus (.DS_Store, build output) is filtered by
// directory-name so local noise does not red the audit. A future regression
// where an ignored absolute symlink slips in would still fail at clone time
// on any machine that does not have the same ignored artifact — acceptable
// because the audit is host-local signal, not distributed proof.
const IGNORED_DIRS_FOR_PORTABILITY = new Set(['node_modules', '.git', 'dist', 'coverage']);
const IGNORED_BASENAMES_FOR_PORTABILITY = new Set(['.DS_Store']);

export function findAbsoluteSymlinks(rootDir, containmentRoot) {
  const containment = containmentRoot ?? rootDir;
  const violations = [];
  if (!existsSync(rootDir)) return violations;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS_FOR_PORTABILITY.has(entry.name)) continue;
      if (IGNORED_BASENAMES_FOR_PORTABILITY.has(entry.name)) continue;
      const full = join(dir, entry.name);
      let stat;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(full);
        if (isAbsolute(target)) {
          violations.push({ path: full, target, reason: 'absolute' });
          continue;
        }
        // Relative-target containment check (Codex HIGH #2). Resolve the link
        // against its parent directory and assert the result stays inside the
        // containment root. `path.relative` returning a `..`-prefixed value
        // means the resolved path escapes.
        const resolvedTarget = resolve(dir, target);
        const rel = relative(containment, resolvedTarget);
        if (rel === '' || rel === '.' || (!rel.startsWith('..') && !isAbsolute(rel))) {
          // Target stays within containment — portable.
        } else {
          violations.push({ path: full, target, reason: 'escapes-repo' });
        }
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(rootDir);
  return violations;
}

function checkSpecsPortability() {
  const specsDir = join(REPO_ROOT, 'specs');
  const violations = findAbsoluteSymlinks(specsDir, REPO_ROOT);
  if (violations.length === 0) {
    return {
      level: 'green',
      detail: 'No absolute or repo-escaping symlinks under specs/ (ADR-0001 portability addendum).',
    };
  }
  const rels = violations.map(
    (v) => `${v.path.slice(REPO_ROOT.length + 1)} → ${v.target} [${v.reason}]`,
  );
  return {
    level: 'red',
    detail: `${violations.length} non-portable symlink(s) under specs/: ${rels.join('; ')}`,
  };
}

function checkInvariantLedger() {
  const ledgerPath = join(REPO_ROOT, 'specs', 'invariants.json');
  if (!existsSync(ledgerPath)) {
    return { level: 'red', detail: 'specs/invariants.json missing' };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(ledgerPath, 'utf-8'));
  } catch (err) {
    return { level: 'red', detail: `specs/invariants.json invalid JSON: ${err.message}` };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { level: 'red', detail: 'specs/invariants.json is not an object' };
  }
  if (!Array.isArray(parsed.invariants) || !Array.isArray(parsed.properties)) {
    return {
      level: 'red',
      detail: 'specs/invariants.json missing invariants[] or properties[]',
    };
  }
  const invIds = new Set();
  const invDupes = [];
  for (const entry of parsed.invariants) {
    if (invIds.has(entry.id)) invDupes.push(entry.id);
    invIds.add(entry.id);
  }
  const propIds = new Set();
  const propDupes = [];
  for (const entry of parsed.properties) {
    if (propIds.has(entry.id)) propDupes.push(entry.id);
    propIds.add(entry.id);
  }
  if (invDupes.length || propDupes.length) {
    return {
      level: 'red',
      detail: `duplicate ids — invariants: [${invDupes.join(', ')}], properties: [${propDupes.join(', ')}]`,
    };
  }
  const stateCounts = {};
  for (const entry of parsed.invariants) {
    stateCounts[entry.enforcement_state] = (stateCounts[entry.enforcement_state] ?? 0) + 1;
  }
  const statePart = Object.entries(stateCounts)
    .map(([s, n]) => `${s}=${n}`)
    .join(', ');
  return {
    level: 'green',
    detail: `${parsed.invariants.length} invariants (${statePart}), ${parsed.properties.length} properties. Full binding + set-equality enforced by tests/contracts/invariant-ledger.test.ts.`,
  };
}

export function readFrontmatter(absPath) {
  if (!existsSync(absPath)) return { ok: false, error: 'missing' };
  const content = readFileSync(absPath, 'utf-8');
  if (!content.startsWith('---\n')) return { ok: false, error: 'no-frontmatter' };
  const end = content.indexOf('\n---', 4);
  if (end === -1) return { ok: false, error: 'unterminated-frontmatter' };
  const fm = content.slice(4, end);
  const result = {};
  let currentList = null;
  for (const rawLine of fm.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) {
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
      currentList = null;
    }
  }
  return { ok: true, frontmatter: result };
}

function stripCellMarkup(value) {
  return value.trim().replace(/^`|`$/g, '').trim();
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map(stripCellMarkup);
}

function isMarkdownSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

export function parseMarkdownTable(markdown, requiredColumns) {
  const lines = markdown.split(/\r?\n/);
  const lowerRequired = requiredColumns.map((c) => c.toLowerCase());
  for (let i = 0; i < lines.length - 1; i++) {
    const header = splitMarkdownTableRow(lines[i]);
    if (!header) continue;
    const lowerHeader = header.map((c) => c.toLowerCase());
    if (!lowerRequired.every((c) => lowerHeader.includes(c))) continue;
    const separator = splitMarkdownTableRow(lines[i + 1]);
    if (!separator || !isMarkdownSeparatorRow(separator)) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length; j++) {
      const cells = splitMarkdownTableRow(lines[j]);
      if (!cells) {
        if (rows.length > 0) break;
        continue;
      }
      if (cells.every((cell) => cell.length === 0)) continue;
      const row = {};
      for (let k = 0; k < header.length; k++) {
        const key = header[k];
        if (!key) continue;
        row[key] = cells[k] ?? '';
      }
      rows.push(row);
    }
    return { ok: true, columns: header, rows };
  }
  return {
    ok: false,
    error: `missing markdown table with columns: ${requiredColumns.join(', ')}`,
    columns: [],
    rows: [],
  };
}

function parseBooleanCell(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

export function parseProductGateExemptionLedger(ledgerPath) {
  const issues = [];
  if (!existsSync(ledgerPath)) {
    return { ok: false, issues: ['product-gate-exemptions.md missing'], rows: [] };
  }
  const fm = readFrontmatter(ledgerPath);
  if (!fm.ok) {
    issues.push(`frontmatter ${fm.error ?? 'unreadable'}`);
  } else {
    if (fm.frontmatter.type !== 'ledger') issues.push('frontmatter type must be ledger');
    for (const key of ['name', 'description', 'date']) {
      if (typeof fm.frontmatter[key] !== 'string' || fm.frontmatter[key].length === 0) {
        issues.push(`frontmatter missing ${key}`);
      }
    }
  }
  const content = readFileSync(ledgerPath, 'utf-8');
  const table = parseMarkdownTable(content, [
    'phase_id',
    'slice',
    'reason',
    'consumed',
    'authorization_record',
  ]);
  if (!table.ok) {
    issues.push(table.error);
    return { ok: false, issues, rows: [] };
  }
  const rows = table.rows.map((row, index) => {
    const consumed = parseBooleanCell(row.consumed ?? '');
    if (consumed === null) {
      issues.push(`row ${index + 1}: consumed must be true or false`);
    }
    return {
      phase_id: row.phase_id ?? '',
      slice: row.slice ?? '',
      reason: row.reason ?? '',
      consumed: consumed ?? false,
      authorization_record: stripCellMarkup(row.authorization_record ?? ''),
    };
  });
  return { ok: issues.length === 0, issues, rows };
}

const AMEND_D1_D3_PATTERN = /\bamend(?:s|ing)?\s+D[13]\b/i;

export function checkProductRealityGateVisibility(rootDir = REPO_ROOT) {
  const relPath = 'specs/methodology/product-gate-exemptions.md';
  const ledgerPath = join(rootDir, relPath);
  const parsed = parseProductGateExemptionLedger(ledgerPath);
  if (!parsed.ok) {
    return {
      level: 'red',
      detail: `${relPath} malformed: ${parsed.issues.join('; ')}`,
    };
  }
  const seed = parsed.rows.find(
    (row) =>
      row.phase_id === 'phase-1-pre-1.5-reopen' && row.slice === '25b' && row.consumed === true,
  );
  if (!seed) {
    return {
      level: 'red',
      detail:
        'specs/methodology/product-gate-exemptions.md missing consumed Slice 25b bootstrap-exception row',
    };
  }
  const findings = [];
  for (const [index, row] of parsed.rows.entries()) {
    const rowLabel = `row ${index + 1} (${row.phase_id || 'unknown'}/${row.slice || '?'})`;
    if (!row.authorization_record || row.authorization_record.length === 0) {
      findings.push(`${rowLabel}: authorization_record is empty`);
    } else if (!existsSync(join(rootDir, row.authorization_record))) {
      findings.push(
        `${rowLabel}: authorization_record does not exist — ${row.authorization_record}`,
      );
    }
    if (AMEND_D1_D3_PATTERN.test(row.reason)) {
      findings.push(`${rowLabel}: reason attempts to amend D1 or D3 (not waivable)`);
    }
  }
  if (findings.length > 0) {
    return {
      level: 'red',
      detail: `${parsed.rows.length} exemption row(s); ${findings.join('; ')}`,
    };
  }
  return {
    level: 'green',
    detail: `${parsed.rows.length} exemption row(s); consumed seed row present for phase-1-pre-1.5-reopen / 25b; all rows carry an authorization_record.`,
  };
}

function splitFilePathCell(value) {
  return value
    .replaceAll('<br>', ';')
    .replaceAll('<br/>', ';')
    .replaceAll('<br />', ';')
    .split(/[;,]/)
    .map(stripCellMarkup)
    .filter(Boolean);
}

export function parseTierClaims(tierPath) {
  const issues = [];
  if (!existsSync(tierPath)) return { ok: false, issues: ['TIER.md missing'], rows: [] };
  const content = readFileSync(tierPath, 'utf-8');
  const table = parseMarkdownTable(content, [
    'claim_id',
    'status',
    'file_path',
    'planned_slice',
    'rationale',
  ]);
  if (!table.ok) return { ok: false, issues: [table.error], rows: [] };
  const rows = table.rows.map((row) => ({
    claim_id: row.claim_id ?? '',
    status: (row.status ?? '').toLowerCase(),
    file_paths: splitFilePathCell(row.file_path ?? ''),
    planned_slice: row.planned_slice ?? '',
    rationale: row.rationale ?? '',
  }));
  for (const [index, row] of rows.entries()) {
    if (!row.claim_id) issues.push(`row ${index + 1}: missing claim_id`);
  }
  return { ok: issues.length === 0, issues, rows };
}

const ALLOWED_TIER_STATUSES = new Set(['enforced', 'planned', 'not claimed']);

export function checkTierOrphanClaims(rootDir = REPO_ROOT) {
  const parsed = parseTierClaims(join(rootDir, 'TIER.md'));
  if (!parsed.ok) {
    return { level: 'red', detail: `TIER.md malformed: ${parsed.issues.join('; ')}` };
  }
  const findings = [];
  let enforced = 0;
  let planned = 0;
  let notClaimed = 0;
  for (const row of parsed.rows) {
    const hasFilePath = row.file_paths.length > 0;
    const hasPlannedSlice = row.planned_slice.trim().length > 0;
    const isNotClaimed = row.status === 'not claimed';
    if (!ALLOWED_TIER_STATUSES.has(row.status)) {
      findings.push(
        `${row.claim_id}: status "${row.status}" not in {enforced, planned, not claimed}`,
      );
      continue;
    }
    const modes = [hasFilePath, hasPlannedSlice, isNotClaimed].filter(Boolean).length;
    if (modes === 0) {
      findings.push(`${row.claim_id}: orphan claim (no file_path, planned_slice, or not claimed)`);
      continue;
    }
    if (modes > 1) {
      findings.push(
        `${row.claim_id}: multiple claim classifications present; expected exactly one`,
      );
      continue;
    }
    if (hasFilePath) {
      if (row.status !== 'enforced') {
        findings.push(
          `${row.claim_id}: status "${row.status}" disagrees with file_path signal (expected enforced)`,
        );
        continue;
      }
      enforced++;
      for (const relPath of row.file_paths) {
        if (!existsSync(join(rootDir, relPath))) {
          findings.push(`${row.claim_id}: file_path does not exist — ${relPath}`);
        }
      }
    } else if (hasPlannedSlice) {
      if (row.status !== 'planned') {
        findings.push(
          `${row.claim_id}: status "${row.status}" disagrees with planned_slice signal (expected planned)`,
        );
        continue;
      }
      planned++;
    } else if (isNotClaimed) {
      notClaimed++;
      if (row.rationale.trim().length === 0) {
        findings.push(`${row.claim_id}: not claimed row missing rationale`);
      }
    }
  }
  const summary = `${parsed.rows.length} claims - ${enforced} enforced (file_path), ${planned} planned (slice), ${notClaimed} not claimed`;
  if (findings.length > 0) {
    return { level: 'red', detail: `${summary}; ${findings.join('; ')}` };
  }
  return { level: 'green', detail: summary };
}

const ARTIFACT_CLASS_CAPS = {
  reversible: 2,
  governance: 3,
  irreversible: 4,
};

const PLACEHOLDER_JUSTIFICATION_PATTERN = /^(n\/a|none|see body|tbd|\.|justified|-|–|—)\s*$/i;
const MIN_PAST_CAP_JUSTIFICATION_CHARS = 30;

export function checkAdversarialYieldLedger(rootDir = REPO_ROOT) {
  const relPath = 'specs/reviews/adversarial-yield-ledger.md';
  const ledgerPath = join(rootDir, relPath);
  if (!existsSync(ledgerPath)) return { level: 'red', detail: `${relPath} missing` };
  const content = readFileSync(ledgerPath, 'utf-8');
  const table = parseMarkdownTable(content, [
    'pass_date',
    'artifact_path',
    'artifact_class',
    'pass_number_for_artifact',
    'reviewer_id',
    'mode',
    'HIGH_count',
    'MED_count',
    'LOW_count',
    'verdict',
    'operator_justification_if_past_cap',
  ]);
  if (!table.ok) return { level: 'red', detail: `${relPath} malformed: ${table.error}` };
  if (table.rows.length === 0) {
    return { level: 'red', detail: `${relPath} has no data rows` };
  }

  const findings = [];
  const parsedRows = [];
  for (const [index, raw] of table.rows.entries()) {
    const rowLabel = `row ${index + 1}`;
    const artifactPath = stripCellMarkup(raw.artifact_path ?? '');
    const artifactClass = stripCellMarkup(raw.artifact_class ?? '').toLowerCase();
    const passNumberText = stripCellMarkup(raw.pass_number_for_artifact ?? '');
    const passNumber = Number.parseInt(passNumberText, 10);
    const mode = stripCellMarkup(raw.mode ?? '');
    const justification = stripCellMarkup(raw.operator_justification_if_past_cap ?? '');
    if (!artifactPath) {
      findings.push(`${rowLabel}: artifact_path is empty`);
    }
    if (!(artifactClass in ARTIFACT_CLASS_CAPS)) {
      findings.push(
        `${rowLabel}: artifact_class "${artifactClass}" not in {reversible, governance, irreversible}`,
      );
      continue;
    }
    if (!Number.isFinite(passNumber) || passNumber < 1) {
      findings.push(`${rowLabel}: pass_number_for_artifact must be a positive integer`);
      continue;
    }
    const cap = ARTIFACT_CLASS_CAPS[artifactClass];
    if (passNumber > cap) {
      if (
        justification.length === 0 ||
        PLACEHOLDER_JUSTIFICATION_PATTERN.test(justification) ||
        justification.length < MIN_PAST_CAP_JUSTIFICATION_CHARS
      ) {
        findings.push(
          `${rowLabel}: pass ${passNumber} > cap ${cap} for ${artifactClass}; operator_justification_if_past_cap must be substantive (≥ ${MIN_PAST_CAP_JUSTIFICATION_CHARS} chars, not placeholder)`,
        );
      }
    }
    parsedRows.push({ artifactPath, artifactClass, passNumber, mode });
  }

  const byArtifact = new Map();
  for (const row of parsedRows) {
    if (!byArtifact.has(row.artifactPath)) byArtifact.set(row.artifactPath, []);
    byArtifact.get(row.artifactPath).push(row);
  }
  for (const [artifactPath, rows] of byArtifact) {
    rows.sort((a, b) => a.passNumber - b.passNumber);
    for (let i = 2; i < rows.length; i++) {
      const a = rows[i - 2].mode;
      const b = rows[i - 1].mode;
      const c = rows[i].mode;
      if (a && a === b && b === c) {
        findings.push(
          `mode-cycle violation on ${artifactPath}: three consecutive passes in mode "${a}" (passes ${rows[i - 2].passNumber}/${rows[i - 1].passNumber}/${rows[i].passNumber})`,
        );
        break;
      }
    }
  }

  if (findings.length > 0) {
    return {
      level: 'red',
      detail: `${table.rows.length} yield-ledger row(s); ${findings.join('; ')}`,
    };
  }
  return {
    level: 'green',
    detail: `${table.rows.length} yield-ledger row(s) present; caps + mode-cycle clean`,
  };
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
    // Slice 23 — reverse reciprocation check (HIGH #4 fold-in). An artifact
    // row that names a contract file must be reciprocated: the contract's
    // frontmatter `artifact_ids` list must include this artifact's id.
    // Catches cases where a contract is edited to drop an artifact id or
    // an artifact is re-pointed to a contract that doesn't claim it back.
    // Codex HIGH #1 fold-in: `contract` is structurally required; a missing
    // or non-string contract field is a red finding independent of the
    // reverse check.
    if (!Object.hasOwn(artifact, 'contract')) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: missing required field "contract" (must be a non-empty path to specs/contracts/<name>.md)`,
      });
    } else if (typeof artifact.contract !== 'string' || artifact.contract.length === 0) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: contract must be a non-empty string path; got ${JSON.stringify(artifact.contract)}`,
      });
    } else {
      const contractAbs = join(REPO_ROOT, artifact.contract);
      if (!existsSync(contractAbs)) {
        findings.push({
          level: 'red',
          detail: `${artifact.id}: contract "${artifact.contract}" does not exist on disk`,
        });
      } else {
        const { ok, frontmatter, error } = readFrontmatter(contractAbs);
        if (!ok) {
          findings.push({
            level: 'red',
            detail: `${artifact.id}: contract "${artifact.contract}" frontmatter ${error ?? 'unreadable'}`,
          });
        } else if (!contractReciprocatesArtifact(frontmatter, artifact.id)) {
          findings.push({
            level: 'red',
            detail: `${artifact.id}: contract "${artifact.contract}" does not reciprocate — its artifact_ids frontmatter does not contain "${artifact.id}"`,
          });
        }
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
    // Codex HIGH #2 fold-in: every id in artifact_ids must resolve to an
    // artifact AND that artifact's contract field must point back at this
    // contract file. Prevents "false claim" drift where a contract lists
    // an artifact id that actually belongs to a different contract.
    const contractRelPath = `specs/contracts/${file}`;
    for (const id of artifactIds) {
      const art = byId.get(id);
      if (!art) {
        findings.push({
          level: 'red',
          detail: `specs/contracts/${file}: artifact_ids references ${id} not in specs/artifacts.json`,
        });
      } else if (art.contract !== contractRelPath) {
        findings.push({
          level: 'red',
          detail: `specs/contracts/${file}: claims ${id} but the artifact's contract field is ${JSON.stringify(art.contract)} (expected "${contractRelPath}")`,
        });
      }
    }
    // Codex HIGH #2 fold-in (symmetric): every artifact whose contract
    // points at this file must be listed in this file's artifact_ids.
    const listedIds = new Set(artifactIds);
    for (const art of graph.artifacts) {
      if (art.contract !== contractRelPath) continue;
      if (!listedIds.has(art.id)) {
        findings.push({
          level: 'red',
          detail: `specs/contracts/${file}: artifact "${art.id}" points at this contract but is missing from artifact_ids`,
        });
      }
    }
  }

  // Slice 23 — schema-export coverage ledger (HIGH #4 fold-in). Every
  // non-index schema file in src/schemas/ must either be referenced by some
  // artifact.schema_file OR be on SCHEMA_FILE_ALLOWLIST. Every exported
  // `export const <Name>` symbol must either appear in some artifact's
  // schema_exports OR live in an allowlisted file. This is the ledger that
  // would have flagged config.ts schemas being absorbed by adapter.registry
  // without a first-class config artifact row (MED #18, named
  // Knight-Leveson correlated miss).
  const schemasDir = join(REPO_ROOT, 'src', 'schemas');
  if (existsSync(schemasDir)) {
    const schemaFiles = readdirSync(schemasDir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
      .map((f) => `src/schemas/${f}`)
      .sort();
    const artifactSchemaFiles = new Set(graph.artifacts.map((a) => a.schema_file).filter(Boolean));
    const allExpectedExports = new Set();
    for (const artifact of graph.artifacts) {
      if (!Array.isArray(artifact.schema_exports)) continue;
      for (const name of artifact.schema_exports) {
        allExpectedExports.add(`${artifact.schema_file}::${name}`);
      }
    }
    for (const relPath of schemaFiles) {
      const onAllowlist = Object.hasOwn(SCHEMA_FILE_ALLOWLIST, relPath);
      const isArtifactFile = artifactSchemaFiles.has(relPath);
      if (!onAllowlist && !isArtifactFile) {
        findings.push({
          level: 'red',
          detail: `${relPath}: schema file is neither referenced by an artifact row nor present in SCHEMA_FILE_ALLOWLIST — add an artifact to specs/artifacts.json or explicitly allowlist with a reason`,
        });
        continue;
      }
      if (onAllowlist && isArtifactFile) {
        findings.push({
          level: 'red',
          detail: `${relPath}: schema file is both referenced by an artifact row AND on SCHEMA_FILE_ALLOWLIST — remove from the allowlist (artifact wins)`,
        });
      }
      if (isArtifactFile) {
        const schemaAbs = join(REPO_ROOT, relPath);
        if (existsSync(schemaAbs)) {
          const defined = collectSchemaExports(readFileSync(schemaAbs, 'utf-8'));
          const claimedForThisFile = new Set();
          for (const artifact of graph.artifacts) {
            if (artifact.schema_file !== relPath) continue;
            if (!Array.isArray(artifact.schema_exports)) continue;
            for (const name of artifact.schema_exports) claimedForThisFile.add(name);
          }
          for (const name of defined) {
            if (!claimedForThisFile.has(name)) {
              findings.push({
                level: 'red',
                detail: `${relPath}: defines \`export ${name}\` but no artifact.schema_exports claims it — add it to the owning artifact or document it as an internal-only helper`,
              });
            }
          }
        }
      }
      // Codex HIGH #4 fold-in: symbol-level allowlist check. For an
      // allowlisted file, every runtime export must appear in the entry's
      // known_exports list. A new export added to an allowlisted file fails
      // audit — closes the "allowlisted file is a black box" blind spot.
      if (onAllowlist) {
        const entry = SCHEMA_FILE_ALLOWLIST[relPath];
        if (!Array.isArray(entry.known_exports)) {
          findings.push({
            level: 'red',
            detail: `${relPath}: SCHEMA_FILE_ALLOWLIST entry missing required known_exports list`,
          });
        } else {
          const schemaAbs = join(REPO_ROOT, relPath);
          if (existsSync(schemaAbs)) {
            const defined = collectSchemaExports(readFileSync(schemaAbs, 'utf-8'));
            const known = new Set(entry.known_exports);
            for (const name of defined) {
              if (!known.has(name)) {
                findings.push({
                  level: 'red',
                  detail: `${relPath}: defines \`export ${name}\` but it is not in SCHEMA_FILE_ALLOWLIST.known_exports — add it explicitly or promote the file to an artifact row`,
                });
              }
            }
            for (const name of known) {
              if (!defined.has(name)) {
                findings.push({
                  level: 'red',
                  detail: `${relPath}: SCHEMA_FILE_ALLOWLIST.known_exports lists "${name}" but the file does not define it — remove stale entry`,
                });
              }
            }
          }
        }
        // Codex MED #9 fold-in: pending-artifact entries require a tracking
        // slice + objection citation so they cannot drift indefinitely.
        if (entry.category === 'pending-artifact') {
          if (typeof entry.tracking_slice !== 'number' || entry.tracking_slice <= 0) {
            findings.push({
              level: 'red',
              detail: `${relPath}: pending-artifact entry missing tracking_slice (positive integer)`,
            });
          }
          if (
            typeof entry.tracking_objection !== 'string' ||
            entry.tracking_objection.length === 0
          ) {
            findings.push({
              level: 'red',
              detail: `${relPath}: pending-artifact entry missing tracking_objection (citation path#id)`,
            });
          }
        }
      }
    }
  }

  // Codex HIGH #5 fold-in: pending_rehome metadata. Catches the
  // "laundered correlated miss" where a known-misbinding (e.g.
  // CircuitOverride temporarily on adapter.registry until Slice 26 lands
  // the config.* artifact) is machine-invisible. Any artifact declaring
  // pending_rehome must name a target_slice, target_artifact_prefix, and
  // items; audit flags unresolved pending_rehome as yellow so it remains
  // visible rather than passing silently.
  for (const artifact of graph.artifacts) {
    if (!artifact.pending_rehome) continue;
    const pr = artifact.pending_rehome;
    if (typeof pr.target_slice !== 'number' || pr.target_slice <= 0) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: pending_rehome missing target_slice (positive integer)`,
      });
    }
    if (typeof pr.target_artifact_prefix !== 'string' || pr.target_artifact_prefix.length === 0) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: pending_rehome missing target_artifact_prefix`,
      });
    }
    if (!Array.isArray(pr.items) || pr.items.length === 0) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: pending_rehome.items must be a non-empty list of export names awaiting relocation`,
      });
    }
    if (typeof pr.target_objection !== 'string' || pr.target_objection.length === 0) {
      findings.push({
        level: 'red',
        detail: `${artifact.id}: pending_rehome missing target_objection (citation path#id)`,
      });
    }
  }

  // Codex HIGH #3 fold-in: index.ts barrel-export check. The arc review
  // (HIGH #4) explicitly scoped a "schema-export coverage ledger test for
  // src/schemas/index.ts". Every non-index schema file (bound or
  // allowlisted) must be re-exported via `export * from './<file>.js'`.
  // No stale exports to deleted files.
  const indexPath = join(REPO_ROOT, 'src', 'schemas', 'index.ts');
  if (existsSync(indexPath) && existsSync(schemasDir)) {
    const schemaFiles = readdirSync(schemasDir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
      .sort();
    const indexSrc = readFileSync(indexPath, 'utf-8');
    const reExportPattern = /^export \* from '\.\/([A-Za-z0-9_-]+)\.js';?\s*$/gm;
    const reExported = new Set();
    let m = reExportPattern.exec(indexSrc);
    while (m !== null) {
      reExported.add(`${m[1]}.ts`);
      m = reExportPattern.exec(indexSrc);
    }
    for (const file of schemaFiles) {
      if (!reExported.has(file)) {
        findings.push({
          level: 'red',
          detail: `src/schemas/index.ts: missing barrel re-export for ${file} — add \`export * from './${file.replace(/\.ts$/, '.js')}';\``,
        });
      }
    }
    for (const reExportedFile of reExported) {
      if (!schemaFiles.includes(reExportedFile)) {
        findings.push({
          level: 'red',
          detail: `src/schemas/index.ts: stale re-export for ${reExportedFile} (file does not exist)`,
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

/**
 * Slice 26a — multi-leaf persisted-shape wrapper-aggregate binding guard
 * (ADR-0003 Addendum B).
 *
 * Structural defense against the HIGH #1 failure mode in
 * `specs/reviews/arc-progress-codex.md`: an artifact row can name the right
 * `surface_class`, classify its `schema_file`, claim `schema_exports`,
 * reciprocate with a `contract`, AND bind to a persisted backing path — and
 * still be structurally wrong because the claimed export is an in-memory
 * aggregate of shapes that persist as SEPARATE files under OTHER artifacts.
 * The bytes on disk at the backing path carry ONE leaf, not the aggregate.
 *
 * Enforcement model per Addendum B: this is a **named allowlist**, not an
 * AST/body detector. A multi-leaf persisted-shape wrapper aggregate is a
 * schema export whose fields are themselves artifact-bound schema exports
 * persisting as separate files. Multi-field schemas whose fields are
 * structural parts of one manifest/carrier (e.g. Workflow, LayeredConfig)
 * do not qualify and are out of scope.
 *
 * Any artifact that claims one of the allowlisted exports MUST have an
 * empty `backing_paths` list. When a new schema meeting the definition is
 * introduced in `src/schemas/`, the introducing slice MUST extend this
 * allowlist with a reason that references Addendum B.
 */
export const WRAPPER_AGGREGATE_EXPORTS = {
  RunProjection: {
    reason:
      'in-memory {log, snapshot} aggregate — log persists at run.log (events.ndjson), snapshot persists at run.snapshot (state.json); state.json never carries the aggregate shape',
    added_in_slice: '26a',
    adr_addendum: 'ADR-0003 Addendum B',
  },
};

/**
 * Pure, test-exported helper. Given one artifact row, return a violation
 * descriptor if any of its `schema_exports` is in `WRAPPER_AGGREGATE_EXPORTS`
 * while `backing_paths` is non-empty. Returns `null` otherwise. Kept
 * separate from the full-file check so tests can exercise constructed
 * fixtures without touching the filesystem.
 */
export function detectWrapperAggregateBinding(artifact) {
  if (!artifact || typeof artifact !== 'object') return null;
  const exportsClaimed = Array.isArray(artifact.schema_exports) ? artifact.schema_exports : [];
  const backingPaths = Array.isArray(artifact.backing_paths) ? artifact.backing_paths : [];
  if (backingPaths.length === 0) return null;
  for (const name of exportsClaimed) {
    if (Object.hasOwn(WRAPPER_AGGREGATE_EXPORTS, name)) {
      return {
        wrapper_export: name,
        reason: WRAPPER_AGGREGATE_EXPORTS[name].reason,
        backing_paths: [...backingPaths],
      };
    }
  }
  return null;
}

export function checkPersistedWrapperBinding(rootDir = REPO_ROOT) {
  const artifactsPath = join(rootDir, 'specs/artifacts.json');
  if (!existsSync(artifactsPath)) {
    return { level: 'yellow', detail: 'specs/artifacts.json missing' };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(artifactsPath, 'utf-8'));
  } catch (err) {
    return { level: 'red', detail: `specs/artifacts.json parse error: ${err.message}` };
  }
  const artifacts = Array.isArray(parsed?.artifacts) ? parsed.artifacts : [];
  const violations = [];
  for (const artifact of artifacts) {
    const hit = detectWrapperAggregateBinding(artifact);
    if (hit) {
      violations.push(
        `${artifact.id}: claims wrapper-aggregate export "${hit.wrapper_export}" yet binds persisted path(s) ${JSON.stringify(
          hit.backing_paths,
        )} — ${hit.reason}`,
      );
    }
  }
  const allowlistNames = Object.keys(WRAPPER_AGGREGATE_EXPORTS);
  const allowlistSummary = allowlistNames.length > 0 ? allowlistNames.join(', ') : 'empty';
  if (violations.length === 0) {
    return {
      level: 'green',
      detail: `${artifacts.length} artifacts scanned; no wrapper-aggregate export bound to a persisted backing_path (allowlist: ${allowlistSummary})`,
    };
  }
  return {
    level: 'red',
    detail: `persisted-wrapper-binding violations (ADR-0003 Addendum B):\n${violations
      .map((v) => `    - ${v}`)
      .join('\n')}`,
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
      detail: 'No tests/**/*.test.{ts,mts,js,mjs} files found',
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

  // Check 10: Invariant ledger integrity (Slice 25 — AR-M2 + Codex challenger MED 10).
  const ledger = checkInvariantLedger();
  counters[ledger.level]++;
  findings.push({
    level: ledger.level,
    check: 'Invariant ledger (specs/invariants.json)',
    detail: ledger.detail,
  });

  // Check 11: Specs portability (Slice 25a — FUP-1, ADR-0001 addendum).
  const portability = checkSpecsPortability();
  counters[portability.level]++;
  findings.push({
    level: portability.level,
    check: 'Specs portability (absolute symlinks)',
    detail: portability.detail,
  });

  // Check 12: Product Reality Gate visibility (Slice 25b — D1 bootstrap ledger).
  const productGate = checkProductRealityGateVisibility();
  counters[productGate.level]++;
  findings.push({
    level: productGate.level,
    check: 'Product Reality Gate visibility',
    detail: productGate.detail,
  });

  // Check 13: TIER orphan-claim rejection (Slice 25b — D9 honesty guard).
  const tierClaims = checkTierOrphanClaims();
  counters[tierClaims.level]++;
  findings.push({
    level: tierClaims.level,
    check: 'TIER orphan-claim rejection',
    detail: tierClaims.detail,
  });

  // Check 14: Adversarial yield ledger presence (Slice 25b — D10 evidence source).
  const yieldLedger = checkAdversarialYieldLedger();
  counters[yieldLedger.level]++;
  findings.push({
    level: yieldLedger.level,
    check: 'Adversarial yield ledger',
    detail: yieldLedger.detail,
  });

  // Check 16: Persisted-wrapper binding (Slice 26a — ADR-0003 Addendum B).
  const wrapperBinding = checkPersistedWrapperBinding();
  counters[wrapperBinding.level]++;
  findings.push({
    level: wrapperBinding.level,
    check: 'Persisted-wrapper binding (ADR-0003 Addendum B)',
    detail: wrapperBinding.detail,
  });

  // Check 15: npm run verify currently green.
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
