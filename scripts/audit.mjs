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
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  EXEMPT_WORKFLOW_IDS,
  WORKFLOW_KIND_CANONICAL_SETS,
  checkWorkflowKindCanonicalPolicy,
} from './policy/workflow-kind-policy.mjs';

const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DELIM = '<<<CIRCUIT-NEXT-AUDIT-END>>>';

export const LANES = [
  'Ratchet-Advance',
  'Equivalence Refactor',
  'Migration Escrow',
  'Discovery',
  'Disposable',
  'Break-Glass',
];

export const FRAMING_LITERALS = {
  failureMode: 'Failure mode:',
  acceptanceEvidence: 'Acceptance evidence:',
  alternateFraming: 'Alternate framing:',
};

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
      'DispatchRequestEvent',
      'DispatchReceiptEvent',
      'DispatchResultEvent',
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
      row.phase_id === 'phase-1.5-alpha-proof' && row.slice === '25b' && row.consumed === true,
  );
  if (!seed) {
    return {
      level: 'red',
      detail:
        'specs/methodology/product-gate-exemptions.md missing consumed Slice 25b bootstrap-exception row (expected phase_id=phase-1.5-alpha-proof post-Slice-25d)',
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
    detail: `${parsed.rows.length} exemption row(s); consumed seed row present for phase-1.5-alpha-proof / 25b; all rows carry an authorization_record.`,
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

// Slice DOG+1 — D10 extension (rigor-profile binding).
const RIGOR_PROFILE_BUDGETS = {
  lite: 0,
  standard: 1,
  deep: 2,
  tournament: 3,
};
const GRANDFATHER_RIGOR = 'pre-dog-1-grandfather';
const GRANDFATHER_CUTOFF_DATE = '2026-04-20';
const AUTONOMOUS_RIGOR = 'autonomous';
const MIN_WHY_CONTINUE_CHARS = 30;
const PLACEHOLDER_WHY_CONTINUE_PATTERN =
  /^(n\/a|none|tbd|\.|more review|various|general|see body|-|–|—)\s*$/i;
const NA_VALUES = new Set(['n/a', 'na', '-', '–', '—', '']);
const VALID_RIGOR_VALUES = new Set([
  ...Object.keys(RIGOR_PROFILE_BUDGETS),
  AUTONOMOUS_RIGOR,
  GRANDFATHER_RIGOR,
]);

function isNa(value) {
  return NA_VALUES.has(value.trim().toLowerCase());
}

function commitExistsAndTouchesNonReviewPath(sha, rootDir) {
  try {
    const trimmed = sha.trim();
    if (!/^[0-9a-f]{7,40}$/i.test(trimmed)) return { ok: false, reason: 'not a git SHA' };
    // Verify SHA resolves.
    execSync(`git -C "${rootDir}" cat-file -e ${trimmed}^{commit}`, { stdio: 'ignore' });
    // Verify it's an ancestor of HEAD.
    try {
      execSync(`git -C "${rootDir}" merge-base --is-ancestor ${trimmed} HEAD`, { stdio: 'ignore' });
    } catch {
      return { ok: false, reason: 'not an ancestor of HEAD' };
    }
    const diff = execSync(
      `git -C "${rootDir}" diff-tree --no-commit-id --name-only -r --root ${trimmed}`,
      { encoding: 'utf-8' },
    );
    const files = diff
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const nonReview = files.find((f) => !f.startsWith('specs/reviews/'));
    if (!nonReview) {
      return { ok: false, reason: 'commit touches only specs/reviews/ (no execution evidence)' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `git lookup failed: ${err.message}` };
  }
}

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
    'rigor_profile',
    'why_continue_failure_class',
    'prior_execution_commit_sha',
  ]);
  if (!table.ok) return { level: 'red', detail: `${relPath} malformed: ${table.error}` };
  if (table.rows.length === 0) {
    return { level: 'red', detail: `${relPath} has no data rows` };
  }

  const findings = [];
  const warnings = [];
  const parsedRows = [];
  for (const [index, raw] of table.rows.entries()) {
    const rowLabel = `row ${index + 1}`;
    const passDate = stripCellMarkup(raw.pass_date ?? '');
    const artifactPath = stripCellMarkup(raw.artifact_path ?? '');
    const artifactClass = stripCellMarkup(raw.artifact_class ?? '').toLowerCase();
    const passNumberText = stripCellMarkup(raw.pass_number_for_artifact ?? '');
    const passNumber = Number.parseInt(passNumberText, 10);
    const mode = stripCellMarkup(raw.mode ?? '');
    const justification = stripCellMarkup(raw.operator_justification_if_past_cap ?? '');
    const rigorProfile = stripCellMarkup(raw.rigor_profile ?? '').toLowerCase();
    const whyContinue = stripCellMarkup(raw.why_continue_failure_class ?? '');
    const priorExecSha = stripCellMarkup(raw.prior_execution_commit_sha ?? '');
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
    if (!VALID_RIGOR_VALUES.has(rigorProfile)) {
      findings.push(
        `${rowLabel}: rigor_profile "${rigorProfile}" not in {lite, standard, deep, tournament, autonomous, pre-dog-1-grandfather}`,
      );
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

    // Slice DOG+1 — D10 extension: rigor-profile budget, non-LLM-before-pass-3,
    // review-execution alternation, why-continue checkpoint.
    if (rigorProfile === GRANDFATHER_RIGOR) {
      if (passDate > GRANDFATHER_CUTOFF_DATE) {
        findings.push(
          `${rowLabel}: rigor_profile "${GRANDFATHER_RIGOR}" not permitted for pass_date ${passDate} (> cutoff ${GRANDFATHER_CUTOFF_DATE}); new rows must use a concrete rigor value`,
        );
      }
    } else if (rigorProfile === AUTONOMOUS_RIGOR) {
      warnings.push(
        `${rowLabel}: rigor_profile "autonomous" is unbound at ledger-time — prefer recording the resolved parent rigor (standard|deep|tournament)`,
      );
    } else {
      const rigorBudget = RIGOR_PROFILE_BUDGETS[rigorProfile];
      if (passNumber > rigorBudget) {
        if (
          justification.length === 0 ||
          PLACEHOLDER_JUSTIFICATION_PATTERN.test(justification) ||
          justification.length < MIN_PAST_CAP_JUSTIFICATION_CHARS
        ) {
          findings.push(
            `${rowLabel}: pass ${passNumber} exceeds rigor "${rigorProfile}" budget ${rigorBudget}; operator_justification_if_past_cap must be substantive`,
          );
        }
      }
      if (passNumber >= 2) {
        if (
          whyContinue.length === 0 ||
          isNa(whyContinue) ||
          PLACEHOLDER_WHY_CONTINUE_PATTERN.test(whyContinue) ||
          whyContinue.length < MIN_WHY_CONTINUE_CHARS
        ) {
          findings.push(
            `${rowLabel}: why_continue_failure_class must name a specific failure class on pass ${passNumber} (≥ ${MIN_WHY_CONTINUE_CHARS} chars, not placeholder)`,
          );
        }
      }
      if ((rigorProfile === 'deep' || rigorProfile === 'tournament') && passNumber >= 2) {
        if (isNa(priorExecSha)) {
          findings.push(
            `${rowLabel}: prior_execution_commit_sha required for rigor "${rigorProfile}" on pass ${passNumber} (review-execution alternation)`,
          );
        } else {
          const resolved = commitExistsAndTouchesNonReviewPath(priorExecSha, rootDir);
          if (!resolved.ok) {
            findings.push(
              `${rowLabel}: prior_execution_commit_sha "${priorExecSha}" invalid — ${resolved.reason}`,
            );
          }
        }
      }
    }

    parsedRows.push({
      artifactPath,
      artifactClass,
      passNumber,
      mode,
      rigorProfile,
      rowLabel,
    });
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
    // Tournament pass 3 requires a prior row on the same artifact with
    // mode not beginning with "llm-".
    const tournamentPass3 = rows.find((r) => r.rigorProfile === 'tournament' && r.passNumber === 3);
    if (tournamentPass3) {
      const priorRows = rows.filter((r) => r.passNumber < 3);
      const anyNonLlm = priorRows.some((r) => r.mode && !r.mode.toLowerCase().startsWith('llm-'));
      if (!anyNonLlm) {
        findings.push(
          `${tournamentPass3.rowLabel}: tournament pass 3 on ${artifactPath} requires a prior row with mode not starting with "llm-" (non-LLM mode required before pass 3)`,
        );
      }
    }
  }

  const summary = `${table.rows.length} yield-ledger row(s)`;
  if (findings.length > 0) {
    return {
      level: 'red',
      detail: `${summary}; ${findings.join('; ')}`,
    };
  }
  if (warnings.length > 0) {
    return {
      level: 'yellow',
      detail: `${summary}; caps + rigor-binding clean; ${warnings.join('; ')}`,
    };
  }
  return {
    level: 'green',
    detail: `${summary} present; caps + mode-cycle + rigor-binding clean`,
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

// Slice 26b — status-epoch alignment, status-docs-current, and pinned ratchet floor.
//
// These three checks close a false-green close-gate hole that Slice 25b explicitly
// tagged as planned-for-26b in `TIER.md`. The agreement-only `checkPhaseDrift` above
// cannot detect the case where all three docs (README / PROJECT_STATE / TIER)
// consistently tell the same stale story. Slice 26b adds:
//
//   (1) structured `<!-- current_slice: <id> -->` markers on the three docs,
//       anchored to the status-header zone (before the first markdown heading
//       for README/PROJECT_STATE; immediately after frontmatter for TIER). The
//       marker MUST appear exactly once in that zone; duplicates are rejected
//       (Codex MED-3 fold-in).
//   (2) an alignment check that all three carry the marker and agree on <id>,
//   (3) a freshness check that compares that aligned <id> against the most recent
//       slice-shaped commit in git. "No slice-shaped commit found" is red, not
//       yellow (Codex MED-2 fold-in) — in a disciplined repo a missing slice
//       subject is a broken gate, not an unknown.
//   (4) a pinned ratchet floor in `specs/ratchet-floor.json` so close gates no
//       longer depend purely on the `HEAD~1` moving window. Floor metadata
//       (schema_version, last_advanced_at, last_advanced_in_slice) is audit-
//       enforced, not prose-only (Codex HIGH-2 + MED-4 fold-in).
//
// SLICE_ID_PATTERN pins the canonical slice-id shape at the regex layer: digits
// followed by an optional lowercase-letter suffix (e.g. `26`, `26a`, `26b`).
// Draft/provisional/WIP subjects like `slice-26b-wip:` are rejected so a
// work-in-progress commit cannot become the "current slice" epoch (Codex MED-5
// fold-in). Widening the pattern requires a separate ADR amendment.
//
// Kept exported so the contract tests can exercise constructed fixtures.

export const SLICE_ID_PATTERN = /^[0-9]+[a-z]?$/;

export function isValidSliceId(value) {
  return typeof value === 'string' && SLICE_ID_PATTERN.test(value);
}

export const CURRENT_SLICE_MARKER_PATTERN = /<!--\s*current_slice:\s*([0-9a-z-]+)\s*-->/i;
const CURRENT_SLICE_MARKER_PATTERN_GLOBAL = /<!--\s*current_slice:\s*([0-9a-z-]+)\s*-->/gi;

// The "status-header zone" is the portion of each doc before the first
// `# ` markdown heading. All three STATUS_EPOCH_FILES carry the marker in
// that zone by construction: README and PROJECT_STATE put it at the very
// top; TIER puts it between frontmatter and first heading. Scanning only
// the zone prevents a historical quote or an embedded-diff block deeper
// in the file from being read as the current marker (Codex MED-3 fold-in).
function sliceHeaderZone(text) {
  if (typeof text !== 'string') return '';
  const firstHeadingMatch = text.match(/^#\s/m);
  if (!firstHeadingMatch || firstHeadingMatch.index === undefined) return text;
  return text.slice(0, firstHeadingMatch.index);
}

export function extractCurrentSliceMarker(text) {
  if (typeof text !== 'string') return null;
  const zone = sliceHeaderZone(text);
  const all = zone.match(CURRENT_SLICE_MARKER_PATTERN_GLOBAL);
  if (!all || all.length === 0) return null;
  if (all.length > 1) return null;
  const match = zone.match(CURRENT_SLICE_MARKER_PATTERN);
  if (!match) return null;
  const captured = match[1];
  if (!isValidSliceId(captured)) return null;
  return captured;
}

const STATUS_EPOCH_FILES = ['README.md', 'PROJECT_STATE.md', 'TIER.md'];

export function checkStatusEpochAlignment(rootDir = REPO_ROOT) {
  const findings = [];
  const markers = new Map();
  for (const relPath of STATUS_EPOCH_FILES) {
    const absPath = join(rootDir, relPath);
    if (!existsSync(absPath)) {
      findings.push(`${relPath}: file missing`);
      continue;
    }
    const text = readFileSync(absPath, 'utf-8');
    const marker = extractCurrentSliceMarker(text);
    if (marker === null) {
      findings.push(
        `${relPath}: missing / malformed / duplicated \`<!-- current_slice: <id> -->\` marker in status-header zone (must be exactly one, before first markdown heading, with id matching ${SLICE_ID_PATTERN})`,
      );
      continue;
    }
    markers.set(relPath, marker);
  }
  if (findings.length > 0) {
    return {
      level: 'red',
      detail: `status-epoch alignment violations:\n${findings.map((v) => `    - ${v}`).join('\n')}`,
    };
  }
  const values = Array.from(new Set(markers.values()));
  if (values.length > 1) {
    const disagreement = Array.from(markers.entries())
      .map(([file, value]) => `${file}=${value}`)
      .join(', ');
    return {
      level: 'red',
      detail: `status-epoch markers disagree across files: ${disagreement}`,
    };
  }
  return {
    level: 'green',
    detail: `${STATUS_EPOCH_FILES.length} docs aligned on current_slice=${values[0]}`,
  };
}

export const SLICE_COMMIT_SUBJECT_PATTERN = /^slice-([0-9a-z-]+?):\s/;

export function extractSliceIdFromCommitSubject(subject) {
  if (typeof subject !== 'string') return null;
  const match = subject.match(SLICE_COMMIT_SUBJECT_PATTERN);
  if (!match) return null;
  const captured = match[1];
  if (!isValidSliceId(captured)) return null;
  return captured;
}

function findMostRecentSliceCommit(rootDir = REPO_ROOT) {
  // Scan up to 200 commits for a subject matching `slice-<id>:`. Most recent wins.
  const subjects = execSync('git log -200 --pretty=format:%s', {
    cwd: rootDir,
    encoding: 'utf-8',
  })
    .split('\n')
    .filter(Boolean);
  for (const subject of subjects) {
    const sliceId = extractSliceIdFromCommitSubject(subject);
    if (sliceId) return { subject, sliceId };
  }
  return null;
}

export function checkStatusDocsCurrent(rootDir = REPO_ROOT) {
  const alignment = checkStatusEpochAlignment(rootDir);
  if (alignment.level !== 'green') {
    return {
      level: 'red',
      detail: `status-epoch alignment not green (${alignment.level}); freshness cannot be evaluated until alignment is fixed`,
    };
  }
  // Re-extract the aligned slice id (alignment is green so all three agree).
  const readmeText = readFileSync(join(rootDir, 'README.md'), 'utf-8');
  const alignedSlice = extractCurrentSliceMarker(readmeText);
  const mostRecent = findMostRecentSliceCommit(rootDir);
  if (!mostRecent) {
    // Codex MED-2 fold-in: "no slice-shaped commit found" is red, not yellow.
    // A disciplined repo always has at least one `slice-<id>:` commit in the
    // last 200 subjects; its absence means either the discipline is broken
    // or the repo is a shallow checkout deeper than 200 commits — either way
    // the freshness gate cannot be evaluated and blocking is the safe default.
    return {
      level: 'red',
      detail:
        'no slice-shaped commit found in last 200 commits; cannot verify doc freshness (Slice 26b freshness gate blocks)',
    };
  }
  if (alignedSlice !== mostRecent.sliceId) {
    return {
      level: 'red',
      detail: `docs all agree on current_slice=${alignedSlice}, but most recent slice commit is \`${mostRecent.subject}\` (sliceId=${mostRecent.sliceId}); all three docs are stale in unison`,
    };
  }
  return {
    level: 'green',
    detail: `docs current_slice=${alignedSlice} matches most recent slice commit \`${mostRecent.subject}\``,
  };
}

export function readPinnedRatchetFloor(rootDir = REPO_ROOT) {
  const floorPath = join(rootDir, 'specs/ratchet-floor.json');
  if (!existsSync(floorPath)) return null;
  try {
    return JSON.parse(readFileSync(floorPath, 'utf-8'));
  } catch {
    return null;
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Codex HIGH-2 + MED-4 fold-in: the floor-file metadata fields are audit-
// enforced, not prose-only. schema_version must be 1, floors.contract_test_count
// must be a POSITIVE integer (zero floor is meaningless and was previously
// silently accepted), last_advanced_at must be a YYYY-MM-DD string, and
// last_advanced_in_slice must match SLICE_ID_PATTERN. Any violation is red.
export function validatePinnedRatchetFloorData(floorData) {
  const errors = [];
  if (!floorData || typeof floorData !== 'object') {
    errors.push('floor data not an object');
    return errors;
  }
  if (floorData.schema_version !== 1) {
    errors.push(
      `schema_version must be literal 1, got ${JSON.stringify(floorData.schema_version)}`,
    );
  }
  const floors = floorData.floors;
  if (!floors || typeof floors !== 'object') {
    errors.push('floors must be an object');
  } else {
    const count = floors.contract_test_count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) {
      errors.push(
        `floors.contract_test_count must be a positive integer (>0), got ${JSON.stringify(count)} (zero or negative floors silently relax the ratchet and are rejected per Codex HIGH-2 fold-in)`,
      );
    }
  }
  if (
    typeof floorData.last_advanced_at !== 'string' ||
    !ISO_DATE_PATTERN.test(floorData.last_advanced_at)
  ) {
    errors.push(
      `last_advanced_at must be a YYYY-MM-DD string, got ${JSON.stringify(floorData.last_advanced_at)}`,
    );
  }
  if (
    typeof floorData.last_advanced_in_slice !== 'string' ||
    !isValidSliceId(floorData.last_advanced_in_slice)
  ) {
    errors.push(
      `last_advanced_in_slice must match SLICE_ID_PATTERN (${SLICE_ID_PATTERN}), got ${JSON.stringify(floorData.last_advanced_in_slice)}`,
    );
  }
  return errors;
}

export function checkPinnedRatchetFloor(rootDir, headCountInput) {
  const actualRoot = rootDir ?? REPO_ROOT;
  const floorData = readPinnedRatchetFloor(actualRoot);
  if (!floorData) {
    return {
      level: 'red',
      detail:
        'specs/ratchet-floor.json missing or unparseable; close gates depend on it (Slice 26b)',
    };
  }
  const metadataErrors = validatePinnedRatchetFloorData(floorData);
  if (metadataErrors.length > 0) {
    return {
      level: 'red',
      detail: `specs/ratchet-floor.json invalid:\n${metadataErrors.map((e) => `    - ${e}`).join('\n')}`,
    };
  }
  const floor = floorData.floors.contract_test_count;
  const headCount = typeof headCountInput === 'number' ? headCountInput : countTests(null);
  if (headCount === null) {
    return { level: 'red', detail: 'no tests discovered; cannot compare to pinned floor' };
  }
  if (headCount < floor) {
    return {
      level: 'red',
      detail: `contract-test count ${headCount} is below pinned floor ${floor} (last advanced in slice ${floorData.last_advanced_in_slice}); close gate blocked — advance floor only with an explicit ratchet-advance slice`,
    };
  }
  return {
    level: 'green',
    detail: `contract-test count ${headCount} ≥ pinned floor ${floor} (last advanced in slice ${floorData.last_advanced_in_slice})`,
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

// Slice 25d (ADR-0001 Addendum B): phase-graph authority ratchet. Phase 1.5
// semantics live in ADR-0001 Addendum B; decision.md, README, and
// PROJECT_STATE are mirrors. This check closes the D3 failure mode (silent
// phase mutation via decision.md alone) that prose-level discipline cannot
// catch at review time.
//
// Rules enforced here:
// 1. If decision.md mentions "Phase 1.5", it must also cite ADR-0001
//    (phrase "ADR-0001" is sufficient; the addendum letter is not
//    re-validated to avoid over-coupling to label renaming).
// 2. If README or PROJECT_STATE claim "Phase 1.5", ADR-0001 must carry an
//    "Addendum B" heading (the specific heading the Phase 1.5 semantics
//    are authored under). Loose matching is intentional — future addenda
//    won't re-letter B, so the string is stable.
//
// Red: either rule violated. Green: both rules hold OR no Phase 1.5 mention
// anywhere (pre-entry state). Yellow: decision.md or ADR-0001 missing
// (should be caught by earlier checks but guarded defensively).
export function checkPhaseAuthoritySemantics(rootDir = REPO_ROOT) {
  const decisionPath = join(rootDir, 'specs/methodology/decision.md');
  const adrPath = join(rootDir, 'specs/adrs/ADR-0001-methodology-adoption.md');
  const readmePath = join(rootDir, 'README.md');
  const projectStatePath = join(rootDir, 'PROJECT_STATE.md');

  if (!existsSync(adrPath)) {
    return {
      level: 'yellow',
      detail: 'ADR-0001 missing; cannot evaluate phase authority semantics',
    };
  }
  if (!existsSync(decisionPath)) {
    return { level: 'yellow', detail: 'specs/methodology/decision.md missing' };
  }

  const adrText = readFileSync(adrPath, 'utf-8');
  const decisionText = readFileSync(decisionPath, 'utf-8');
  const readmeText = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : '';
  const projectStateText = existsSync(projectStatePath)
    ? readFileSync(projectStatePath, 'utf-8')
    : '';

  // Matches "Phase 1.5", "Phase: 1.5", "**Phase:** 1.5", "Phase — 1.5",
  // etc. Non-word chars (including colons, asterisks, whitespace, em-dashes,
  // hyphens) are allowed between the word "Phase" and "1.5".
  const PHASE_15_PATTERN = /Phase[^A-Za-z0-9]*1\.5/i;
  const ADDENDUM_B_HEADING_PATTERN = /^##\s+Addendum\s+B\s+—\s+2026-04-20\s+\(Slice\s+25d\)/m;
  const ADR0001_CITATION_PATTERN = /ADR-0001/;

  const decisionMentions = PHASE_15_PATTERN.test(decisionText);
  const readmeMentions = PHASE_15_PATTERN.test(readmeText);
  const projectStateMentions = PHASE_15_PATTERN.test(projectStateText);
  const adrHasAddendumB = ADDENDUM_B_HEADING_PATTERN.test(adrText);
  const decisionCitesAdr = ADR0001_CITATION_PATTERN.test(decisionText);

  const errors = [];

  if (decisionMentions && !decisionCitesAdr) {
    errors.push('decision.md mentions Phase 1.5 but does not cite ADR-0001');
  }
  if ((readmeMentions || projectStateMentions) && !adrHasAddendumB) {
    errors.push(
      'README or PROJECT_STATE claims Phase 1.5 but ADR-0001 lacks the "Addendum B — 2026-04-20 (Slice 25d)" heading that authors the semantics',
    );
  }

  if (errors.length > 0) {
    return { level: 'red', detail: errors.join('; ') };
  }

  const mentionsAny = decisionMentions || readmeMentions || projectStateMentions;
  return {
    level: 'green',
    detail: mentionsAny
      ? 'Phase 1.5 claims in decision.md/README/PROJECT_STATE are backed by ADR-0001 Addendum B'
      : 'No Phase 1.5 mention present (pre-entry state); authority surface clean',
  };
}

// Check 21 (Slice 31a): CC#14 retarget presence under ADR-0006.
// When any authority surface (PROJECT_STATE.md, README.md) claims Phase 2
// open, verify the three ADR-0006 retarget artifacts are present and
// correctly shaped:
//   (a) specs/reviews/phase-1.5-operator-product-check.md exists with the
//       required frontmatter fields (name, description, type=review,
//       review_kind=operator-product-direction-check, target_kind=phase-close,
//       review_target=phase-1.5-alpha-proof, review_date, operator, scope,
//       confirmation, not_claimed, authored_by, adr_authority=ADR-0006).
//   (b) specs/reviews/phase-1-close-reform-human.md contains a
//       "## Delegation acknowledgment" section citing ADR-0006.
//   (c) An ADR-0006-*.md file exists under specs/adrs/.
// Phase-2-open claim detection is tolerant: matches "Phase 2", "Phase: 2",
// "**Phase:** 2", or "Phase 2 — Implementation (open" style wording.
export function checkCc14RetargetPresence(rootDir = REPO_ROOT) {
  const projectStatePath = join(rootDir, 'PROJECT_STATE.md');
  const readmePath = join(rootDir, 'README.md');
  const productCheckPath = join(rootDir, 'specs/reviews/phase-1.5-operator-product-check.md');
  const reviewPath = join(rootDir, 'specs/reviews/phase-1-close-reform-human.md');
  const adrsDir = join(rootDir, 'specs/adrs');

  const projectStateText = existsSync(projectStatePath)
    ? readFileSync(projectStatePath, 'utf-8')
    : '';
  const readmeText = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : '';

  // Matches things like "Phase 2", "Phase: 2", "**Phase:** 2", "Phase — 2",
  // but NOT "Phase 2+" (deferral shorthand) on its own. We want a phase-open
  // claim, not a future-work pointer. Guard: require that the match is not
  // immediately followed by "+".
  const PHASE_2_OPEN_PATTERN = /Phase[^A-Za-z0-9]*2(?!\+)(?:\b|[^A-Za-z0-9])/;

  const projectStateClaims =
    PHASE_2_OPEN_PATTERN.test(projectStateText) &&
    /Phase[^A-Za-z0-9]*2[^A-Za-z0-9]*(?:—|-)?[^A-Za-z0-9]*Implementation|Phase[^A-Za-z0-9]*2[^A-Za-z0-9]*\(open/i.test(
      projectStateText,
    );
  const readmeClaims =
    PHASE_2_OPEN_PATTERN.test(readmeText) &&
    /Phase[^A-Za-z0-9]*2[^A-Za-z0-9]*(?:—|-)?[^A-Za-z0-9]*Implementation|Phase[^A-Za-z0-9]*2[^A-Za-z0-9]*\(open/i.test(
      readmeText,
    );

  const claimsPhase2Open = projectStateClaims || readmeClaims;

  if (!claimsPhase2Open) {
    return {
      level: 'green',
      detail:
        'Neither PROJECT_STATE nor README claims Phase 2 open; CC#14 retarget artifacts not required yet',
    };
  }

  const errors = [];

  // (a) 14a artifact exists with required frontmatter fields.
  if (!existsSync(productCheckPath)) {
    errors.push(
      'Phase 2 open claimed but specs/reviews/phase-1.5-operator-product-check.md (ADR-0006 §Decision.2.14a) is missing',
    );
  } else {
    const text = readFileSync(productCheckPath, 'utf-8');
    const requiredFields = [
      /^name:\s+phase-1\.5-operator-product-check\b/m,
      /^description:\s*\S/m,
      /^type:\s+review\b/m,
      /^review_kind:\s+operator-product-direction-check\b/m,
      /^target_kind:\s+phase-close\b/m,
      /^review_target:\s+phase-1\.5-alpha-proof\b/m,
      /^review_date:\s*\S/m,
      /^operator:\s*\S/m,
      /^scope:\s+product-direction-only\b/m,
      /^confirmation:\s*\S/m,
      /^not_claimed:/m,
      /^authored_by:\s*\S/m,
      /^adr_authority:\s+ADR-0006\b/m,
    ];
    const missing = requiredFields
      .filter((re) => !re.test(text))
      .map((re) =>
        re.source
          .replace(/^\^/, '')
          .replace(/\\s\+.*$/, '')
          .replace(/\\b$/, ''),
      );
    if (missing.length > 0) {
      errors.push(
        `14a artifact present but missing required frontmatter field(s): ${missing.join(', ')}`,
      );
    }
  }

  // (b) phase-1-close-reform-human.md contains ## Delegation acknowledgment citing ADR-0006.
  if (!existsSync(reviewPath)) {
    errors.push(
      'specs/reviews/phase-1-close-reform-human.md missing (required for CC#14 14b delegated comprehension)',
    );
  } else {
    const text = readFileSync(reviewPath, 'utf-8');
    const hasHeading = /^##\s+Delegation acknowledgment\b/m.test(text);
    if (!hasHeading) {
      errors.push(
        'phase-1-close-reform-human.md lacks required "## Delegation acknowledgment" section (CC#14 14b surface)',
      );
    } else {
      const headingIdx = text.search(/^##\s+Delegation acknowledgment\b/m);
      const nextHeadingOffset = text.slice(headingIdx + 1).search(/^##\s+/m);
      const sectionEnd =
        nextHeadingOffset === -1 ? text.length : headingIdx + 1 + nextHeadingOffset;
      const section = text.slice(headingIdx, sectionEnd);
      if (!/ADR-0006/.test(section)) {
        errors.push(
          '"## Delegation acknowledgment" section exists but does not cite ADR-0006 (required by CC#14 retarget)',
        );
      }
    }
  }

  // (c) ADR-0006 file exists.
  if (!existsSync(adrsDir)) {
    errors.push('specs/adrs directory missing; cannot verify ADR-0006 presence');
  } else {
    const adrFiles = readdirSync(adrsDir);
    const hasAdr0006 = adrFiles.some((f) => /^ADR-0006-.*\.md$/.test(f));
    if (!hasAdr0006) {
      errors.push(
        'Phase 2 open claimed but no specs/adrs/ADR-0006-*.md file exists (required authority for CC#14 retarget)',
      );
    }
  }

  if (errors.length > 0) {
    return { level: 'red', detail: errors.join('; ') };
  }

  return {
    level: 'green',
    detail:
      'Phase 2 open claim backed by ADR-0006 retarget artifacts: 14a product-check + 14b Delegation acknowledgment + ADR-0006 present',
  };
}

function commitIsSliceShaped(commit) {
  // Merge commits, reverts, and plain housekeeping without a Lane don't warrant slice
  // discipline checks. A "slice" is any commit that declares a Lane.
  return checkLane(commit.body) !== null;
}

// Phase 2 open commit — Slice 31a ceremony per ADR-0001 Addendum B as amended
// by ADR-0006. Used by checkPhase2SliceIsolationCitation to scope the check
// to Phase-2-only commits.
const PHASE_2_OPEN_COMMIT = '0223d1162b35458c22c4b8680859f872a83897c0';

// Paths whose modification during a Phase 2 slice triggers the isolation-
// citation requirement. Ordered roughly from most-invariant (specs, tests) to
// least (hooks/CI). A commit touching any file whose path starts with one of
// these prefixes must declare its isolation posture in the commit body (see
// ADR-0007 §Decision.1 CC#P2-7 interim enforcement).
const ISOLATION_PROTECTED_PREFIXES = [
  'specs/',
  'tests/',
  '.github/',
  '.claude-plugin/',
  '.claude/hooks/',
  'src/',
  'scripts/',
];

function commitIsAtOrAfterPhase2Open(hash) {
  try {
    execSync(`git merge-base --is-ancestor ${PHASE_2_OPEN_COMMIT} ${hash}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function commitChangedFiles(hash) {
  const raw = shSafe(`git show --name-only --pretty=format: ${hash}`);
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// Returns true if ADR-0007 exists in the commit's tree. Used to grandfather
// pre-ADR-0007 Phase 2 commits out of the isolation-citation check (those
// commits could not have known to carry the posture string since the ADR
// requiring it did not yet exist at their authoring time).
function adr0007InCommitTree(hash) {
  try {
    execSync(`git cat-file -e ${hash}:specs/adrs/ADR-0007-phase-2-close-criteria.md`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

// Check 23 (ADR-0007 CC#P2-7 interim enforcement, P2.1). For every Phase 2
// slice commit (past the discipline floor AND at or after Phase 2 open) that
// touches isolation-protected paths, require an explicit isolation posture
// in the commit body: `Isolation: policy-compliant (no implementer separation
// required)` OR `Isolation: re-deferred per ADR-0007 CC#P2-7` OR a Break-
// Glass lane declaration. Purpose: force slice authors to declare isolation
// posture openly rather than silently normalize unisolated Phase 2 execution.
// This is NOT a filesystem-capability check; it is an in-commit-body citation
// audit. Advances the audit-coverage ratchet independently from the close-
// criteria-authority ratchet advanced by the P2.1 ceremony.
export function checkPhase2SliceIsolationCitation(disciplinedCommits) {
  const POSTURES = [
    'Isolation: policy-compliant (no implementer separation required)',
    'Isolation: re-deferred per ADR-0007 CC#P2-7',
  ];

  // Two-stage filter: (1) commit is at or after Phase 2 open; (2) commit's
  // tree already contains ADR-0007 (grandfathering pre-ADR-0007 Phase 2
  // commits that could not have known the posture-string requirement).
  const phase2Commits = disciplinedCommits
    .filter((c) => commitIsAtOrAfterPhase2Open(c.hash))
    .filter((c) => adr0007InCommitTree(c.hash));

  if (phase2Commits.length === 0) {
    return {
      level: 'green',
      detail: 'No post-ADR-0007 Phase 2 slice commits in scanned window; check not applicable',
    };
  }

  const offenders = [];
  for (const c of phase2Commits) {
    const files = commitChangedFiles(c.hash);
    const touchesProtected = files.some((f) =>
      ISOLATION_PROTECTED_PREFIXES.some((p) => f.startsWith(p)),
    );
    if (!touchesProtected) continue;

    const lane = checkLane(c.body);
    const hasPosture = POSTURES.some((p) => c.body.includes(p));
    const isBreakGlass = lane === 'Break-Glass';

    if (!hasPosture && !isBreakGlass) {
      offenders.push(c);
    }
  }

  if (offenders.length > 0) {
    const lines = offenders.map(
      (c) => `${c.short} "${c.subject}" — missing isolation posture in commit body`,
    );
    return {
      level: 'red',
      detail: `Phase 2 slice(s) touch isolation-protected paths without declaring isolation posture (ADR-0007 §Decision.1 CC#P2-7 interim enforcement):\n      ${lines.join('\n      ')}`,
    };
  }

  return {
    level: 'green',
    detail: `${phase2Commits.length} Phase 2 slice commit(s) scanned; all touching isolation-protected paths declare posture or Break-Glass`,
  };
}

// Check 23 (ADR-0007 CC#P2-3 enforcement, P2.2). Verifies closure between the
// plugin manifest's `commands` array and the markdown files under
// `.claude-plugin/commands/`. Enforcement (tightened via P2.2 Codex fold-ins):
//   (a) `.claude-plugin/plugin.json` parses as JSON with a top-level `commands`
//       array of `{ name, file, description }` entries (all non-empty; names
//       and files unique).
//   (b) Every `commands[].file` matches the grammar `commands/<basename>.md`
//       with no nested directory components and no non-.md extensions
//       (Codex HIGH 2 fold-in — grammar is flat-only, rejects
//       `elsewhere/foo.md` and `commands/nested/bar.md`).
//   (c) No manifest file path is a symlink, and realpath must remain under
//       `.claude-plugin/commands/` (Codex HIGH 3 fold-in — lexical check
//       alone is insufficient; lstat/realpath combination rejects symlink
//       escape).
//   (d) Each file has YAML frontmatter whose `name` equals the manifest
//       entry's `name` (Codex HIGH 1 fold-in — prevents silent-rename where
//       `circuit:run` points at the file for `circuit:explore` and vice
//       versa); frontmatter `name` + `description` are YAML-non-empty, not
//       merely regex-non-empty (Codex MED 5 fold-in — `description: ""` and
//       `name: # comment` are rejected).
//   (e) Every `.claude-plugin/commands/**/*.md` file (recursively) has a
//       corresponding entry in `commands[]` (Codex MED 4 fold-in — walk is
//       recursive so nested files cannot orphan-slip; nested files are also
//       always grammar-violations at (b), so they will be double-flagged).
//   (f) The required anchor commands are present AND bound to their
//       canonical files: `circuit:run` → `commands/circuit-run.md`,
//       `circuit:explore` → `commands/circuit-explore.md` (Codex HIGH 1
//       fold-in — anchor names alone are not sufficient).
// Advances the `plugin_surface_present` product ratchet to partial at P2.2 and
// to green at P2.11 (plan §Product ratchets Phase 2 will carry).
export function checkPluginCommandClosure(rootDir = REPO_ROOT) {
  const pluginDir = join(rootDir, '.claude-plugin');
  const manifestPath = join(pluginDir, 'plugin.json');
  const commandsDir = join(pluginDir, 'commands');

  if (!existsSync(manifestPath)) {
    return {
      level: 'red',
      detail: '.claude-plugin/plugin.json missing; required for CC#P2-3',
    };
  }

  // Reject a manifest that is itself a symlink (Codex HIGH 3 fold-in).
  let manifestLstat;
  try {
    manifestLstat = lstatSync(manifestPath);
  } catch {
    manifestLstat = null;
  }
  if (manifestLstat?.isSymbolicLink()) {
    return {
      level: 'red',
      detail: '.claude-plugin/plugin.json is a symlink; rejected per HIGH 3 fold-in',
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    return {
      level: 'red',
      detail: `.claude-plugin/plugin.json failed to parse as JSON: ${err.message}`,
    };
  }

  const errors = [];

  const commands = manifest.commands;
  if (commands === undefined) {
    return {
      level: 'red',
      detail:
        '.claude-plugin/plugin.json missing `commands` array (required by ADR-0007 CC#P2-3 enforcement; plan slice P2.2 scaffold)',
    };
  }
  if (!Array.isArray(commands)) {
    return {
      level: 'red',
      detail: '.claude-plugin/plugin.json `commands` is not an array',
    };
  }

  const manifestFiles = new Set();
  const manifestNames = new Set();
  // Track (name → file) so downstream checks can verify anchor-to-file binding
  // without re-walking commands.
  const manifestNameToFile = new Map();

  // Grammar regex: commands/<single-path-segment>.md
  // Rejects nested directories (e.g. commands/nested/foo.md), non-.md files,
  // empty stems, and backslash separators.
  const COMMAND_FILE_GRAMMAR = /^commands\/[A-Za-z0-9_-]+\.md$/;

  for (let i = 0; i < commands.length; i++) {
    const entry = commands[i];
    const label = `commands[${i}]`;
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${label} is not an object`);
      continue;
    }

    // name
    const rawName = typeof entry.name === 'string' ? entry.name : null;
    if (rawName === null || rawName.trim() === '') {
      errors.push(`${label} missing non-empty string \`name\``);
    } else {
      if (manifestNames.has(rawName)) {
        errors.push(`${label} duplicate command name \`${rawName}\` (must be unique)`);
      }
      manifestNames.add(rawName);
    }

    // file
    const rawFile = typeof entry.file === 'string' ? entry.file : null;
    if (rawFile === null || rawFile.trim() === '') {
      errors.push(`${label} missing non-empty string \`file\``);
      continue;
    }

    // description
    const rawDesc = typeof entry.description === 'string' ? entry.description : null;
    if (rawDesc === null || rawDesc.trim() === '') {
      errors.push(`${label} (${rawName ?? '<unnamed>'}) missing non-empty string \`description\``);
    }

    // Grammar: commands/<basename>.md only, no nesting, no alternate dirs.
    if (!COMMAND_FILE_GRAMMAR.test(rawFile)) {
      errors.push(
        `${label} file path \`${rawFile}\` violates grammar: expected \`commands/<basename>.md\` with only [A-Za-z0-9_-] in basename (Codex HIGH 2 fold-in)`,
      );
      continue;
    }
    if (manifestFiles.has(rawFile)) {
      errors.push(`${label} duplicate command file \`${rawFile}\` (must be unique)`);
    }
    manifestFiles.add(rawFile);
    if (rawName) manifestNameToFile.set(rawName, rawFile);

    const fileAbs = join(pluginDir, rawFile);

    // Symlink rejection (Codex HIGH 3 fold-in): lstat the entry, reject if
    // it resolves outside .claude-plugin/commands/ via symlink.
    let fileLstat;
    try {
      fileLstat = lstatSync(fileAbs);
    } catch {
      fileLstat = null;
    }
    if (!fileLstat) {
      errors.push(`${label} (${rawName ?? '<unnamed>'}) file ${rawFile} does not exist`);
      continue;
    }
    if (fileLstat.isSymbolicLink()) {
      errors.push(
        `${label} (${rawName ?? '<unnamed>'}) file ${rawFile} is a symlink; rejected per Codex HIGH 3 fold-in`,
      );
      continue;
    }
    if (!fileLstat.isFile()) {
      errors.push(`${label} (${rawName ?? '<unnamed>'}) file ${rawFile} is not a regular file`);
      continue;
    }

    const text = readFileSync(fileAbs, 'utf-8');
    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      errors.push(`${label} file ${rawFile} missing YAML frontmatter (--- ... ---)`);
      continue;
    }
    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // YAML-aware value extraction (Codex MED 5 fold-in). Captures the raw
    // value text on the same line (no newline-gobbling), then strips
    // surrounding quotes (single or double) and trailing `#` comments, and
    // finally trims. A value of `""`, `''`, `# comment`, `>`, `|`, or an
    // empty folded scalar is treated as empty.
    const extractYamlScalar = (field) => {
      const match = frontmatter.match(new RegExp(`^${field}:[ \\t]*(.*)$`, 'm'));
      if (!match) return null;
      let raw = match[1];
      // Strip inline YAML comment. YAML comments start at `#` that is either
      // at the start of the value (after key-colon-whitespace), or preceded
      // by a whitespace character. Conservative: handle both.
      raw = raw.replace(/(?:^|\s)#.*$/, '').trim();
      // Folded scalar markers with no continuation are empty.
      if (raw === '>' || raw === '|' || raw === '>-' || raw === '|-') return '';
      // Strip surrounding matching quotes (single or double).
      if (
        (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
        (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
      ) {
        raw = raw.slice(1, -1);
      }
      return raw;
    };
    const nameValue = extractYamlScalar('name');
    const descValue = extractYamlScalar('description');

    if (nameValue === null || nameValue.trim() === '') {
      errors.push(
        `${label} file ${rawFile} frontmatter missing non-empty \`name\` field (after YAML scalar normalization)`,
      );
    } else if (rawName && nameValue !== rawName) {
      // Anchor-to-file binding (Codex HIGH 1 fold-in).
      errors.push(
        `${label} file ${rawFile} frontmatter name \`${nameValue}\` does not match manifest entry name \`${rawName}\` (Codex HIGH 1 fold-in — silent-rename loophole)`,
      );
    }
    if (descValue === null || descValue.trim() === '') {
      errors.push(
        `${label} file ${rawFile} frontmatter missing non-empty \`description\` field (after YAML scalar normalization)`,
      );
    }
    if (body.trim() === '') {
      errors.push(`${label} file ${rawFile} body is empty`);
    }
  }

  // (e) Recursive orphan + nested-file check (Codex MED 4 fold-in).
  if (existsSync(commandsDir)) {
    const walk = (dir, relPrefix) => {
      const results = [];
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return results;
      }
      for (const e of entries) {
        const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
        const full = join(dir, e.name);
        let lst;
        try {
          lst = lstatSync(full);
        } catch {
          continue;
        }
        if (lst.isSymbolicLink()) {
          // Symlinks inside commands/ are flagged regardless of manifest
          // (Codex HIGH 3 fold-in).
          errors.push(
            `commands/${rel} is a symlink inside .claude-plugin/commands/; rejected per Codex HIGH 3 fold-in`,
          );
          continue;
        }
        if (e.isDirectory()) {
          // Nested directories under commands/ are rejected flat-only
          // (Codex MED 4 fold-in — grammar decision).
          errors.push(
            `commands/${rel} is a nested directory under .claude-plugin/commands/; flat-only grammar rejects nesting (Codex MED 4 fold-in)`,
          );
          // Still walk it so nested orphan .md files are also flagged.
          results.push(...walk(full, rel));
        } else if (e.isFile() && e.name.endsWith('.md')) {
          results.push(rel);
        } else if (e.isFile()) {
          errors.push(
            `commands/${rel} is a non-.md file in .claude-plugin/commands/; flat-grammar rejects non-markdown command files`,
          );
        }
      }
      return results;
    };
    const commandMdFiles = walk(commandsDir, '');
    for (const rel of commandMdFiles) {
      const manifestKey = `commands/${rel}`;
      if (!manifestFiles.has(manifestKey)) {
        errors.push(
          `orphan command file ${manifestKey} — present on disk but not listed in .claude-plugin/plugin.json commands array`,
        );
      }
    }
  }

  // (f) Required anchor commands AND canonical-file binding (Codex HIGH 1
  // fold-in). Each anchor must appear in the manifest AND its `file` must be
  // the canonical file for that anchor.
  const REQUIRED_ANCHORS = [
    { name: 'circuit:run', canonicalFile: 'commands/circuit-run.md' },
    { name: 'circuit:explore', canonicalFile: 'commands/circuit-explore.md' },
  ];
  for (const anchor of REQUIRED_ANCHORS) {
    if (!manifestNames.has(anchor.name)) {
      errors.push(
        `required anchor command \`${anchor.name}\` missing from manifest (ADR-0007 CC#P2-3 scaffold requirement)`,
      );
      continue;
    }
    const actualFile = manifestNameToFile.get(anchor.name);
    if (actualFile !== anchor.canonicalFile) {
      errors.push(
        `required anchor command \`${anchor.name}\` points at \`${actualFile}\` instead of canonical \`${anchor.canonicalFile}\` (Codex HIGH 1 fold-in — anchor-to-file binding)`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      level: 'red',
      detail: `plugin command closure violations:\n      - ${errors.join('\n      - ')}`,
    };
  }

  return {
    level: 'green',
    detail: `${commands.length} plugin command(s) closure-consistent with .claude-plugin/commands/*.md; anchors circuit:run + circuit:explore present`,
  };
}

// Check 24 (ADR-0007 CC#P2-6 enforcement + EXPLORE-I1 enforcement, P2.3).
// Verifies that workflow fixtures under `.claude-plugin/skills/<kind>/
// circuit.json` declare the canonical phase set their workflow-kind
// requires. Kinds recognized (single source of truth):
//   scripts/policy/workflow-kind-policy.mjs → WORKFLOW_KIND_CANONICAL_SETS
//
// Slice 43a (HIGH 5 retargeting, P2.5 landing) extracted the canonical-
// phase-set table + canonical-policy check into the shared JS module
// above so this audit-level check and the runtime-level helper at
// src/runtime/policy/workflow-kind-policy.ts share one authoritative
// table. Prior to Slice 43a the table was duplicated between audit.mjs
// and src/cli/dogfood.ts (implicit via hand-parse); drift risk was the
// HIGH 5 finding the composition review surfaced. Check 24 is now the
// audit consumer of that shared policy.
//
// Re-exports pass through so tests/contracts/spine-coverage.test.ts can
// continue importing WORKFLOW_KIND_CANONICAL_SETS + EXEMPT_WORKFLOW_IDS
// from audit.mjs at the same paths they had pre-extraction.
export { WORKFLOW_KIND_CANONICAL_SETS, EXEMPT_WORKFLOW_IDS };

export function checkSpineCoverage(rootDir = REPO_ROOT) {
  const skillsDir = join(rootDir, '.claude-plugin/skills');
  if (!existsSync(skillsDir)) {
    return {
      level: 'green',
      detail: 'No .claude-plugin/skills/ directory; spine-coverage check not applicable',
    };
  }

  const errors = [];
  const findings = [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const circuitJson = join(skillsDir, e.name, 'circuit.json');
    if (!existsSync(circuitJson)) continue;

    let fixture;
    try {
      fixture = JSON.parse(readFileSync(circuitJson, 'utf-8'));
    } catch (err) {
      errors.push(`${e.name}/circuit.json failed to parse: ${err.message}`);
      continue;
    }

    const result = checkWorkflowKindCanonicalPolicy(fixture);
    if (result.kind === 'red') {
      errors.push(result.detail);
    } else {
      findings.push(result.detail);
    }
  }

  if (errors.length > 0) {
    return {
      level: 'red',
      detail: `spine-coverage violations:\n      - ${errors.join('\n      - ')}`,
    };
  }

  if (findings.length === 0) {
    return {
      level: 'green',
      detail: 'No workflow fixtures present; spine-coverage check not applicable',
    };
  }

  return {
    level: 'green',
    detail: `${findings.length} fixture(s) scanned; ${findings.join('; ')}`,
  };
}

// Slice 35 — artifact registry backing-path integrity check.
// Walks specs/artifacts.json and flags any two distinct artifacts whose
// normalized backing_paths collide. Introduced as the minimum-viable
// mechanism that would have caught HIGH 4 in
// specs/reviews/p2-foundation-composition-review.md at slice-34 authorship
// time: run.result and explore.result both resolve to the same real
// filesystem location via different template prefixes
// (<circuit-next-run-root> vs <run-root>).
//
// Name: "backing-path integrity" — not "registry-transitive." The mechanism
// does not walk reader/writer transitive closures or resolver reachability.
// It only detects duplicate normalized backing_paths with allowlist
// semantics. Fold-in from Slice 35 Codex challenger LOW 1: do not overstate
// coverage.
//
// Normalization pipeline:
//   1. Strip trailing parenthetical comment (e.g. " (as Workflow.steps[])").
//   2. Replace known template-prefix synonyms (<circuit-next-run-root>,
//      <circuit-run-root> → <run-root>).
//   3. Collapse path-segment redundancies: `./`, consecutive slashes.
//   (Fold-in from Slice 35 Codex MED 1: `<run-root>/artifacts/./result.json`
//   must normalize equivalently to `<run-root>/artifacts/result.json`.)
//
// Container-path allowlist: paths legitimately shared among multiple
// artifacts because they are composite containers. Each entry carries a
// closed set of allowed artifact ids. A collision sharer outside the
// allowed set is a red finding even if the path is a container. (Fold-in
// from Slice 35 Codex HIGH 3: container allowlist must be collision-class-
// specific, not path-global.)
//
// Tracked-collision allowlist: entries match (normalized path, artifact-id
// set) tuples that are known-accepted with a closing slice reference.
// Lifecycle enforcement (fold-in from Slice 35 Codex HIGH 2):
//   - If an allowlist entry has no matching live collision → red (stale).
//   - Untracked collisions are red.
//   - Tracked collisions that match an entry → yellow.
// New known-collision entries MUST carry a challenger pass per CLAUDE.md
// §Hard invariants #6 (every allowlist-ratchet change is a ratchet change).
export const ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS = Object.freeze({
  '<circuit-next-run-root>': '<run-root>',
  '<circuit-run-root>': '<run-root>',
});

export const ARTIFACT_BACKING_PATH_CONTAINER_PATHS = new Map([
  [
    '<plugin>/skills/<workflow-id>/circuit.yaml',
    Object.freeze({
      rationale:
        'Plugin workflow definition file — composes workflow/phase/step definitions + selection + adapter + config rows at distinct JSON paths.',
      allowed_artifact_ids: Object.freeze(
        new Set([
          'workflow.definition',
          'step.definition',
          'phase.definition',
          'selection.override',
          'adapter.registry',
          'adapter.reference',
          'config.root',
          'config.circuit-override',
        ]),
      ),
    }),
  ],
  [
    '<run-root>/events.ndjson',
    Object.freeze({
      rationale:
        'Run event log — ndjson stream composing run.log + event payload families within the same file.',
      allowed_artifact_ids: Object.freeze(
        new Set(['run.log', 'adapter.resolved', 'selection.resolution']),
      ),
    }),
  ],
  [
    '~/.config/circuit-next/config.yaml',
    Object.freeze({
      rationale:
        'User-global config file — composes config + selection + adapter rows as layered configuration sections.',
      allowed_artifact_ids: Object.freeze(
        new Set([
          'config.root',
          'config.circuit-override',
          'selection.override',
          'adapter.registry',
          'adapter.reference',
        ]),
      ),
    }),
  ],
  [
    '<project>/.circuit/config.yaml',
    Object.freeze({
      rationale:
        'Project-local config file — composes config + selection + adapter rows as layered configuration sections.',
      allowed_artifact_ids: Object.freeze(
        new Set([
          'config.root',
          'config.circuit-override',
          'selection.override',
          'adapter.registry',
          'adapter.reference',
        ]),
      ),
    }),
  ],
]);

// ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS — tracked-collision allowlist.
// Slice 39 closed the Slice 35 founding entry ({explore.result, run.result}
// at <run-root>/artifacts/result.json) by path-splitting explore.result to
// <run-root>/artifacts/explore-result.json. The allowlist is intentionally
// empty now. Future tracked-collision entries must carry a Codex challenger
// pass per CLAUDE.md §Hard invariants #6 and a `closing_slice` reference.
// Tests that need to exercise the tracked-collision / stale-entry paths
// inject a synthetic allowlist via checkArtifactBackingPathIntegrity's
// `opts.knownCollisions` parameter.
export const ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS = Object.freeze([]);

export function normalizeArtifactBackingPath(raw) {
  if (typeof raw !== 'string') return null;
  let p = raw.trim();
  if (p.length === 0) return null;
  // (1) Strip trailing parenthetical comment (trailing-only regex; fold-in
  // from Slice 35 Codex LOW 2).
  p = p.replace(/\s*\([^)]*\)\s*$/, '');
  p = p.trim();
  if (p.length === 0) return null;
  // (2) Replace known synonym prefixes.
  for (const [from, to] of Object.entries(ARTIFACT_BACKING_PATH_PREFIX_SYNONYMS)) {
    if (p.startsWith(from)) {
      p = to + p.slice(from.length);
      break;
    }
  }
  // (3) Collapse path-segment redundancies (fold-in from Slice 35 Codex MED
  // 1). The leading template token (e.g. `<run-root>`) may be followed by a
  // `/` so we only touch the tail after the first `/`.
  const firstSlash = p.indexOf('/');
  if (firstSlash !== -1) {
    const head = p.slice(0, firstSlash);
    let tail = p.slice(firstSlash);
    // Collapse consecutive slashes.
    tail = tail.replace(/\/+/g, '/');
    // Collapse `/./` segments iteratively.
    while (tail.includes('/./')) tail = tail.replace('/./', '/');
    // Strip trailing `/.`.
    if (tail.endsWith('/.')) tail = tail.slice(0, -2);
    p = head + tail;
  }
  return p;
}

export function checkArtifactBackingPathIntegrity(rootDir = REPO_ROOT, opts = {}) {
  // opts.strictAllowlist controls whether stale-allowlist detection fires.
  // Default: true when rootDir is the live repo (global allowlist is
  // authoritative for that root), false for test fixtures (fixtures do not
  // exercise the global allowlist; tests that care about stale-detection
  // semantics must opt in explicitly).
  //
  // opts.knownCollisions — optional override of the module-level
  // ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS constant. Added at Slice 39 so
  // tests can inject synthetic tracked-collision entries after the founding
  // allowlist entry was deleted (HIGH 4 fold-in). Defaults to the module
  // constant for the live check.
  const strictAllowlist =
    typeof opts.strictAllowlist === 'boolean' ? opts.strictAllowlist : rootDir === REPO_ROOT;
  const knownCollisions = Array.isArray(opts.knownCollisions)
    ? opts.knownCollisions
    : ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS;
  const path = join(rootDir, 'specs/artifacts.json');
  if (!existsSync(path)) {
    return {
      level: 'green',
      detail: 'No specs/artifacts.json present; backing-path integrity check not applicable',
    };
  }

  let graph;
  try {
    graph = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    return {
      level: 'red',
      detail: `specs/artifacts.json failed to parse: ${err.message}`,
    };
  }

  if (!Array.isArray(graph?.artifacts)) {
    return {
      level: 'red',
      detail: 'specs/artifacts.json: `artifacts` field missing or not an array',
    };
  }

  const artifacts = graph.artifacts;
  const malformedRows = [];
  const pathToIds = new Map();
  let totalPathEntries = 0;

  for (let i = 0; i < artifacts.length; i++) {
    const art = artifacts[i];
    const id = art?.id;
    if (typeof id !== 'string' || id.length === 0) {
      malformedRows.push(`row ${i}: missing/invalid \`id\` string`);
      continue;
    }
    if (!('backing_paths' in (art ?? {}))) {
      malformedRows.push(`${id}: missing \`backing_paths\` field`);
      continue;
    }
    if (!Array.isArray(art.backing_paths)) {
      malformedRows.push(`${id}: \`backing_paths\` must be an array`);
      continue;
    }
    for (let j = 0; j < art.backing_paths.length; j++) {
      const raw = art.backing_paths[j];
      if (typeof raw !== 'string') {
        malformedRows.push(`${id}.backing_paths[${j}]: must be a string`);
        continue;
      }
      const normalized = normalizeArtifactBackingPath(raw);
      if (normalized === null) continue;
      if (!normalized.includes('/')) continue;
      totalPathEntries++;
      if (!pathToIds.has(normalized)) pathToIds.set(normalized, new Set());
      pathToIds.get(normalized).add(id);
    }
  }

  if (malformedRows.length > 0) {
    return {
      level: 'red',
      detail: `specs/artifacts.json: ${malformedRows.length} malformed row(s):\n      - ${malformedRows.join('\n      - ')}`,
    };
  }

  const untrackedCollisions = [];
  const trackedCollisions = [];
  const matchedKnownEntries = new Set();
  let containerPathCount = 0;

  for (const [normalized, idSet] of pathToIds) {
    if (idSet.size < 2) continue;
    const ids = [...idSet].sort();

    // Container paths: must be listed AND every sharing artifact id must be
    // in the allowed set. Unlisted sharers are real collisions even if the
    // path is a container. (Fold-in Slice 35 Codex HIGH 3.)
    const containerEntry = ARTIFACT_BACKING_PATH_CONTAINER_PATHS.get(normalized);
    if (containerEntry) {
      const unauthorized = ids.filter((id) => !containerEntry.allowed_artifact_ids.has(id));
      if (unauthorized.length === 0) {
        containerPathCount++;
        continue;
      }
      untrackedCollisions.push(
        `${normalized} shared by {${ids.join(', ')}} — container allowlist permits {${[
          ...containerEntry.allowed_artifact_ids,
        ]
          .sort()
          .join(', ')}} only; unauthorized sharer(s): {${unauthorized.join(', ')}}`,
      );
      continue;
    }

    const known = knownCollisions.find((entry) => {
      if (entry.normalized !== normalized) return false;
      if (entry.artifact_ids.length !== ids.length) return false;
      const entrySet = new Set(entry.artifact_ids);
      return ids.every((i) => entrySet.has(i));
    });

    if (known) {
      matchedKnownEntries.add(known);
      trackedCollisions.push(
        `${normalized} shared by {${ids.join(', ')}} — tracked (closing slice ${known.closing_slice}): ${known.reason}`,
      );
    } else {
      untrackedCollisions.push(
        `${normalized} shared by {${ids.join(', ')}} — register at distinct paths, extend ARTIFACT_BACKING_PATH_CONTAINER_PATHS with this path + allowed-ids set if legitimately composite, OR add a tracked-collision entry in ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS citing the closing slice (challenger pass required per CLAUDE.md §Hard invariants #6)`,
      );
    }
  }

  // Stale-allowlist check (fold-in Slice 35 Codex HIGH 2): any tracked-
  // collision entry without a matching live collision is a stale allowlist
  // entry that must be deleted when the closing slice resolves it. Only
  // fires when strictAllowlist is true (live repo or test-explicit).
  const staleEntries = [];
  if (strictAllowlist) {
    for (const entry of knownCollisions) {
      if (!matchedKnownEntries.has(entry)) {
        staleEntries.push(
          `entry for ${entry.normalized} citing closing slice ${entry.closing_slice} has no matching live collision — delete from ARTIFACT_BACKING_PATH_KNOWN_COLLISIONS (the closing slice has presumably resolved it)`,
        );
      }
    }
  }

  if (untrackedCollisions.length > 0 || staleEntries.length > 0) {
    const parts = [];
    if (untrackedCollisions.length > 0) {
      parts.push(
        `backing_path collision(s) untracked:\n      - ${untrackedCollisions.join('\n      - ')}`,
      );
    }
    if (staleEntries.length > 0) {
      parts.push(
        `stale tracked-collision allowlist entries:\n      - ${staleEntries.join('\n      - ')}`,
      );
    }
    return { level: 'red', detail: parts.join('\n      ') };
  }

  if (trackedCollisions.length > 0) {
    return {
      level: 'yellow',
      detail: `${pathToIds.size} normalized backing_path(s) across ${artifacts.length} artifact(s) / ${totalPathEntries} raw entries; ${containerPathCount} container-path share(s) (legitimate); 0 untracked collisions; ${trackedCollisions.length} tracked collision(s):\n      - ${trackedCollisions.join('\n      - ')}`,
    };
  }

  return {
    level: 'green',
    detail: `${pathToIds.size} normalized backing_path(s) across ${artifacts.length} artifact(s) / ${totalPathEntries} raw entries; ${containerPathCount} container-path share(s) (legitimate); no collisions`,
  };
}

// Slice 35 — arc-close composition-review presence check.
// Fold-in from Slice 35 Codex HIGH 4: the CLAUDE.md §Cross-slice composition
// review cadence rule is not a machine-checkable ratchet unless something
// binds the rule to an audit gate.
//
// Slice 44 arc-close ceremony (convergent Claude+Codex HIGH 3 fold-in):
// generalized from the single-arc hardcode to an iteration over
// ARC_CLOSE_GATES. Each gate names one closed arc + its ceremony slice +
// its review-file regex + its plan file. Adding a new arc = adding an
// entry here; no new check function needed. The old arc constant
// (PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE) is preserved as a
// backward-compat export consumed by tests/contracts/artifact-backing-
// path-integrity.test.ts; the new 41-to-43 arc constant
// (PHASE_2_P2_4_P2_5_ARC_LAST_SLICE) is exported symmetrically. A fully
// automatic arc-ledger gate (derived from arc metadata in specs/arcs.json
// or equivalent) remains a candidate further step if maintaining this
// table becomes costly; at two entries it is still easier than authoring
// a ledger schema.
export const PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE = 40;
export const PHASE_2_P2_4_P2_5_ARC_LAST_SLICE = 44;

export const ARC_CLOSE_GATES = Object.freeze([
  Object.freeze({
    arc_id: 'phase-2-foundation-foldins-slices-35-to-40',
    description: 'pre-P2.4 fold-in arc',
    ceremony_slice: PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE,
    plan_path: 'specs/plans/phase-2-foundation-foldins.md',
    review_file_regex: /(arc.*35.*40|phase-2-foundation-foldins-arc-close|foldins-arc-close)/i,
  }),
  Object.freeze({
    arc_id: 'phase-2-p2.4-p2.5-arc-slices-41-to-43',
    description: 'P2.4 + P2.5 adapter + e2e arc',
    ceremony_slice: PHASE_2_P2_4_P2_5_ARC_LAST_SLICE,
    plan_path: 'specs/plans/phase-2-implementation.md',
    review_file_regex: /arc.*41.*43/i,
  }),
]);

export function checkArcCloseCompositionReviewPresence(rootDir = REPO_ROOT) {
  const statePath = join(rootDir, 'PROJECT_STATE.md');
  if (!existsSync(statePath)) {
    return {
      level: 'green',
      detail: 'PROJECT_STATE.md not present; arc-close review check not applicable',
    };
  }

  // A gate is only applicable in repos where its plan file exists (the
  // bootstrap / test-fixture escape — the pre-Slice-44 single-arc check
  // returned not-applicable when specs/plans/phase-2-foundation-foldins.md
  // was absent, which mattered for temp-repo tests). Filter first so
  // repos that only have one of the plan files still work correctly.
  const applicableGates = ARC_CLOSE_GATES.filter((gate) =>
    existsSync(join(rootDir, gate.plan_path)),
  );
  if (applicableGates.length === 0) {
    return {
      level: 'green',
      detail:
        'no arc-ledger plan files present (none of ARC_CLOSE_GATES applicable); arc-close review check not applicable',
    };
  }

  const stateText = readFileSync(statePath, 'utf-8');
  const sliceMarker = extractCurrentSliceMarker(stateText);
  if (sliceMarker === null) {
    return {
      level: 'yellow',
      detail: 'PROJECT_STATE.md has no current_slice marker; cannot bind arc-close review gate',
    };
  }
  const sliceNum = Number.parseInt(sliceMarker.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(sliceNum)) {
    return {
      level: 'yellow',
      detail: `PROJECT_STATE.md current_slice marker "${sliceMarker}" not numeric; cannot bind arc-close review gate`,
    };
  }

  const reviewsDir = join(rootDir, 'specs/reviews');
  const redDetails = [];
  const greenDetails = [];
  const progressDetails = [];

  for (const gate of applicableGates) {
    const gateResult = evaluateArcCloseGate(gate, sliceNum, reviewsDir);
    if (gateResult.level === 'red') {
      redDetails.push(`[${gate.arc_id}] ${gateResult.detail}`);
    } else if (gateResult.status === 'in_progress') {
      progressDetails.push(`[${gate.arc_id}] ${gateResult.detail}`);
    } else {
      greenDetails.push(`[${gate.arc_id}] ${gateResult.detail}`);
    }
  }

  if (redDetails.length > 0) {
    return { level: 'red', detail: redDetails.join(' | ') };
  }
  const allParts = [...greenDetails, ...progressDetails];
  return { level: 'green', detail: allParts.join(' | ') };
}

// Per-gate evaluator extracted from the original check body. Returns a
// standard {level, status, detail} triple; `status` distinguishes
// "in_progress" (green but arc not yet closed) from "satisfied" (green,
// both prongs present with ACCEPT). Detail substrings are preserved so
// the pre-Slice-44 single-arc tests still match: "still in progress",
// "no arc-close composition review file matches", "Codex prong ... lack
// ACCEPT", "missing Codex prong", "missing Claude prong", "two-prong
// gate satisfied".
function evaluateArcCloseGate(gate, sliceNum, reviewsDir) {
  if (sliceNum < gate.ceremony_slice) {
    return {
      level: 'green',
      status: 'in_progress',
      detail: `${gate.description} still in progress (current_slice=${sliceNum} < arc-close slice ${gate.ceremony_slice}); arc-close composition review not yet required`,
    };
  }

  if (!existsSync(reviewsDir)) {
    return {
      level: 'red',
      status: 'red',
      detail: `${gate.description} closed (current_slice=${sliceNum} >= ${gate.ceremony_slice}) but specs/reviews/ directory not present`,
    };
  }

  const files = readdirSync(reviewsDir);
  const candidates = files.filter((f) => gate.review_file_regex.test(f));

  if (candidates.length === 0) {
    return {
      level: 'red',
      status: 'red',
      detail: `${gate.description} closed (current_slice=${sliceNum} >= ${gate.ceremony_slice}) but no arc-close composition review file matches pattern ${gate.review_file_regex} under specs/reviews/`,
    };
  }

  const claudeProngs = candidates.filter((f) => /claude/i.test(f));
  const codexProngs = candidates.filter((f) => /codex/i.test(f));

  if (claudeProngs.length === 0 || codexProngs.length === 0) {
    const missing = [];
    if (claudeProngs.length === 0) missing.push('Claude prong (name-match *claude*)');
    if (codexProngs.length === 0) missing.push('Codex prong (name-match *codex*)');
    return {
      level: 'red',
      status: 'red',
      detail: `${gate.description} closed (current_slice=${sliceNum} >= ${gate.ceremony_slice}) but two-prong arc-close composition review incomplete — missing: ${missing.join(', ')}. CLAUDE.md §Cross-slice composition review cadence requires both prongs: fresh-read Claude composition-adversary pass + Codex cross-model challenger.`,
    };
  }

  function hasAcceptClosingVerdict(fileName) {
    const body = readFileSync(join(reviewsDir, fileName), 'utf-8');
    if (/closing_verdict:\s*(ACCEPT|ACCEPT-WITH-FOLD-INS)/i.test(body)) return true;
    if (/\b(ACCEPT|ACCEPT-WITH-FOLD-INS)\b/.test(body) && /closing/i.test(body)) return true;
    return false;
  }

  const claudeAccepted = claudeProngs.filter(hasAcceptClosingVerdict);
  const codexAccepted = codexProngs.filter(hasAcceptClosingVerdict);

  if (claudeAccepted.length === 0 || codexAccepted.length === 0) {
    const failing = [];
    if (claudeAccepted.length === 0)
      failing.push(`Claude prong(s) [${claudeProngs.join(', ')}] lack ACCEPT closing verdict`);
    if (codexAccepted.length === 0)
      failing.push(`Codex prong(s) [${codexProngs.join(', ')}] lack ACCEPT closing verdict`);
    return {
      level: 'red',
      status: 'red',
      detail: `${gate.description} closed but arc-close composition review two-prong gate failing: ${failing.join('; ')}`,
    };
  }

  return {
    level: 'green',
    status: 'satisfied',
    detail: `${gate.description} closed (current_slice=${sliceNum}); arc-close composition review two-prong gate satisfied — Claude: ${claudeAccepted.join(', ')}; Codex: ${codexAccepted.join(', ')}`,
  };
}

// Check 27 (Slice 38 — ADR-0008 §Decision.4 binding). Adapter-binding
// coverage gate: any workflow fixture under
// `.claude-plugin/skills/<kind>/circuit.json` whose `id` is registered
// in `WORKFLOW_KIND_CANONICAL_SETS` (i.e., scheduled for P2.5+
// enforcement under CC#P2-1) must satisfy three rules per ADR-0008:
//   (1) minimum-dispatch: at least one step with `kind: "dispatch"`;
//   (2) kind-specific step-id binding (WORKFLOW_KIND_DISPATCH_POLICY):
//       for kinds with a policy row, every listed step id must exist
//       and have `kind: "dispatch"` (Codex Slice 38 MED 2 fold-in —
//       the initial any-dispatch-step gate was weaker than the
//       ADR-0008 binding requiring both Synthesize and Review);
//   (3) dispatch result-to-artifact materialization precondition
//       (per ADR-0008 §Decision.3a): for kinds with
//       require_writes_artifact_on_dispatch, every dispatch step
//       declares `writes.artifact` alongside the required
//       `writes.result` (Codex Slice 38 HIGH 2 fold-in).
// Exempt fixtures (`dogfood-run-0`) pass through green. Unknown
// workflow kinds produce a yellow finding (Codex Slice 38 MED 2
// fold-in — the previous green pass-through silently accepted new
// workflow kinds that may have zero dispatch steps).
//
// Closes composition review HIGH 1 (explore fixture at v0.1 had zero
// dispatch steps) plus the Codex Slice 38 fold-in strengthenings.
export const WORKFLOW_KIND_DISPATCH_POLICY = {
  explore: {
    require_dispatch_step_ids: ['synthesize-step', 'review-step'],
    require_writes_artifact_on_dispatch: true,
    authority:
      'ADR-0008 §Decision.1 (executor+kind table) + §Decision.3a (result-to-artifact materialization rule)',
  },
};

export function checkAdapterBindingCoverage(rootDir = REPO_ROOT) {
  const skillsDir = join(rootDir, '.claude-plugin/skills');
  if (!existsSync(skillsDir)) {
    return {
      level: 'green',
      detail: 'No .claude-plugin/skills/ directory; adapter-binding-coverage check not applicable',
    };
  }

  const errors = [];
  const warnings = [];
  const findings = [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const circuitJson = join(skillsDir, e.name, 'circuit.json');
    if (!existsSync(circuitJson)) continue;

    let fixture;
    try {
      fixture = JSON.parse(readFileSync(circuitJson, 'utf-8'));
    } catch (err) {
      errors.push(`${e.name}/circuit.json failed to parse: ${err.message}`);
      continue;
    }

    const id = fixture?.id;
    if (typeof id !== 'string') {
      errors.push(`${e.name}/circuit.json missing top-level \`id\` string field`);
      continue;
    }

    if (EXEMPT_WORKFLOW_IDS.has(id)) {
      findings.push(`${id}: exempt from adapter-binding-coverage (partial-spine, recorded)`);
      continue;
    }

    const expected = WORKFLOW_KIND_CANONICAL_SETS[id];
    if (!expected) {
      // Codex Slice 38 MED 2 fold-in — unknown workflow kinds now produce a
      // yellow finding rather than silently passing green. If this fixture
      // is a P2.5+ enforcement target, it must be registered; if not, the
      // author must explicitly acknowledge the kind is out-of-scope.
      warnings.push(
        `${id}: unregistered workflow kind (no entry in WORKFLOW_KIND_CANONICAL_SETS) — if this fixture is a P2.5+ enforcement target, add it to WORKFLOW_KIND_CANONICAL_SETS and ensure at least one adapter-binding step per ADR-0008 §Decision.4; otherwise add to EXEMPT_WORKFLOW_IDS with rationale`,
      );
      continue;
    }

    const steps = Array.isArray(fixture.steps) ? fixture.steps : [];
    const dispatchSteps = steps.filter((s) => s?.kind === 'dispatch');

    // Rule (1) — minimum-dispatch coverage.
    if (dispatchSteps.length === 0) {
      errors.push(
        `${id}: workflow targets an adapter (scheduled for P2.5+ enforcement per WORKFLOW_KIND_CANONICAL_SETS) but fixture exercises zero \`kind: "dispatch"\` steps — ADR-0008 §Decision.4 requires at least one adapter-binding step so the P2.5 golden-parity path has a real dispatch to verify. Got steps: ${steps.map((s) => `${s?.id ?? '?'}:${s?.kind ?? '?'}`).join(', ') || '(none)'}`,
      );
      continue;
    }

    const policy = WORKFLOW_KIND_DISPATCH_POLICY[id];

    // Rule (2) — kind-specific dispatch step-id binding.
    if (policy && Array.isArray(policy.require_dispatch_step_ids)) {
      const stepById = new Map(steps.filter((s) => s?.id).map((s) => [s.id, s]));
      const missingStepIds = [];
      const wrongKindStepIds = [];
      for (const requiredId of policy.require_dispatch_step_ids) {
        const step = stepById.get(requiredId);
        if (!step) {
          missingStepIds.push(requiredId);
          continue;
        }
        if (step.kind !== 'dispatch') {
          wrongKindStepIds.push(`${requiredId}:${step.kind}`);
        }
      }
      if (missingStepIds.length > 0 || wrongKindStepIds.length > 0) {
        const parts = [];
        if (missingStepIds.length > 0) {
          parts.push(`missing step id(s): ${missingStepIds.join(', ')}`);
        }
        if (wrongKindStepIds.length > 0) {
          parts.push(`wrong-kind step(s) (expected \`dispatch\`): ${wrongKindStepIds.join(', ')}`);
        }
        errors.push(
          `${id}: ${policy.authority} requires specific dispatch step ids [${policy.require_dispatch_step_ids.join(', ')}] — ${parts.join('; ')}`,
        );
        continue;
      }
    }

    // Rule (3) — dispatch result-to-artifact materialization precondition.
    if (policy?.require_writes_artifact_on_dispatch) {
      const missingArtifact = dispatchSteps.filter((s) => {
        const writes = s?.writes;
        return (
          !writes ||
          typeof writes !== 'object' ||
          !writes.artifact ||
          typeof writes.artifact !== 'object'
        );
      });
      if (missingArtifact.length > 0) {
        const missingIds = missingArtifact.map((s) => s?.id ?? '?').join(', ');
        errors.push(
          `${id}: dispatch step(s) [${missingIds}] missing \`writes.artifact\` — ADR-0008 §Decision.3a (dispatch result-to-artifact materialization rule) requires every adapter-bound dispatch step to declare \`writes.artifact\` alongside the required \`writes.result\`, so the runtime has a canonical materialization target. Without \`writes.artifact\`, downstream steps reading the artifact path would observe an unwritten file.`,
        );
        continue;
      }
    }

    const dispatchIds = dispatchSteps.map((s) => s.id).filter(Boolean);
    findings.push(
      `${id}: ${dispatchSteps.length} dispatch step(s) present (${dispatchIds.join(', ')}); policy satisfied`,
    );
  }

  if (errors.length > 0) {
    return { level: 'red', detail: errors.join('\n') };
  }
  if (warnings.length > 0) {
    const body = [...findings, ...warnings].join('; ');
    return {
      level: 'yellow',
      detail: body,
    };
  }

  return {
    level: 'green',
    detail:
      findings.length === 0
        ? 'No workflow fixtures scanned'
        : `${findings.length} fixture(s) scanned; ${findings.join('; ')}`,
  };
}

// Check 28 (Slice 41 — ADR-0009 §4 binding). Adapter invocation discipline:
// `package.json` MUST NOT declare any forbidden-SDK dep identifier, because
// ADR-0009 decides subprocess-per-adapter for v0 built-in adapters. A
// future slice can relax this list via ADR-0009 reopen (Options A / B2 /
// C / D in §3); until then any appearance of a forbidden id in
// `dependencies`, `devDependencies`, `optionalDependencies`, or
// `peerDependencies` fires red.
//
// Why package.json and not import-level scanning: at Slice 41 landing,
// no adapter code exists yet. A dep-level guardrail catches the decision
// violation at the point a future slice tries to add the SDK, which is
// strictly earlier than an import appearing. An import-level check over
// `src/runtime/adapters/**` is deferred to the adapter-landing slice
// (P2.4 / Slice 42).
// Direct vendor SDKs. A future slice adding any of these to package.json
// must reopen ADR-0009 via the matching §3 option first.
//
// Bypass-hardening additions from Codex Slice 41 HIGH 2 fold-in
// (2026-04-21): wrapper/provider SDKs (Vercel AI SDK `ai` + `@ai-sdk/*`;
// LangChain `@langchain/*` vendor bindings) also enable in-process
// direct-SDK-style invocation; these would route built-ins around the
// subprocess decision without tripping the pre-fold-in eight-identifier
// list. They are named-out below.
//
// Scope limitation (Codex Slice 41 HIGH 2 fold-in, part 2): Check 28 is
// a root-`package.json`-only guard. Lockfile packages, nested workspace
// manifests, and arbitrary `require('some-provider-sdk')` imports from
// transitively-available packages are NOT detected by this check. The
// import-level scan over `src/runtime/adapters/**` is mandatory at
// Slice 42 (P2.4 — first adapter-code slice) per the ADR-0009 §4
// Slice 42 pre-adapter-code binding; until then, adapter code does not
// exist so import scanning is vacuous.
export const FORBIDDEN_ADAPTER_SDK_DEPS = Object.freeze([
  // Direct vendor SDKs (v0 pre-fold-in list).
  '@anthropic-ai/sdk',
  '@anthropic-ai/tokenizer',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/vertex-sdk',
  'openai',
  '@openai/realtime-api-beta',
  '@google/genai',
  '@google/generative-ai',
  // Wrapper/provider SDKs (Codex Slice 41 HIGH 2 fold-in). These packages
  // expose direct-SDK-style APIs that would route adapter dispatches
  // in-process without invoking the vendor CLI, thereby circumventing
  // ADR-0009 §1 subprocess-per-adapter even though no direct vendor SDK
  // appears in deps.
  'ai', // Vercel AI SDK (provides generateText/streamText/etc. in-process)
  '@ai-sdk/anthropic',
  '@ai-sdk/openai',
  '@ai-sdk/google',
  '@langchain/anthropic',
  '@langchain/openai',
  '@langchain/google-genai',
]);

const PACKAGE_JSON_DEP_FIELDS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

export function checkAdapterInvocationDiscipline(rootDir = REPO_ROOT, opts = {}) {
  const pkgPath = opts.packageJsonPath ?? join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return {
      level: 'red',
      detail: `package.json not found at ${pkgPath} — adapter-invocation-discipline check cannot verify dep fields`,
    };
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch (err) {
    return {
      level: 'red',
      detail: `package.json failed to parse: ${err.message}`,
    };
  }

  const forbiddenList = Array.isArray(opts.forbiddenDeps)
    ? opts.forbiddenDeps
    : FORBIDDEN_ADAPTER_SDK_DEPS;

  if (forbiddenList.length === 0) {
    // Defensive: an empty list would pass green vacuously; treat as a
    // misconfiguration at the callsite.
    return {
      level: 'red',
      detail:
        'FORBIDDEN_ADAPTER_SDK_DEPS is empty — check would pass vacuously; populate the list or remove the check',
    };
  }

  const matches = [];
  for (const field of PACKAGE_JSON_DEP_FIELDS) {
    const deps = pkg[field];
    if (deps === undefined || deps === null) continue;
    if (typeof deps !== 'object' || Array.isArray(deps)) {
      return {
        level: 'red',
        detail: `package.json \`${field}\` must be a plain object; got ${Array.isArray(deps) ? 'array' : typeof deps}`,
      };
    }
    for (const dep of Object.keys(deps)) {
      if (forbiddenList.includes(dep)) {
        matches.push(`${field}.${dep}`);
      }
    }
  }

  if (matches.length > 0) {
    return {
      level: 'red',
      detail: `forbidden adapter-SDK dep(s) declared in package.json: ${matches.join(', ')}. ADR-0009 decides subprocess-per-adapter for v0; to add this dep, reopen ADR-0009 via the matching §3 option (A = SDK direct, B2 = runner pause/resume + native Task, C = pooling, D = streaming) with the named forcing function, and update FORBIDDEN_ADAPTER_SDK_DEPS accordingly`,
    };
  }

  return {
    level: 'green',
    detail: `package.json clean: 0 forbidden dep(s) across ${PACKAGE_JSON_DEP_FIELDS.length} dep-fields (forbidden-list size: ${forbiddenList.length})`,
  };
}

// Check 29 (Slice 42 — ADR-0009 §4 Slice 42 binding). Adapter invocation
// discipline, import-level scan. Complements Check 28 (dep-level) by
// rejecting any `from '<forbidden>'` import statement under
// `src/runtime/adapters/**` for any identifier in
// FORBIDDEN_ADAPTER_SDK_DEPS. Closes the transitive-install bypass: even
// if a forbidden SDK reaches the installed package tree via a transitive
// dep (not declared in root package.json), adapter code cannot import it
// without this check firing red.
//
// Scope at Slice 42 landing: the check walks all `.ts` / `.mts` / `.cts` /
// `.tsx` files under src/runtime/adapters/**, extracting import/require
// specifiers via regex and matching against the forbidden list. Sub-path
// imports (`'@anthropic-ai/sdk/whatever'`) are matched by
// `startsWith(<id>/)` in addition to exact-match. Declaration files
// (`.d.ts` / `.d.mts` / `.d.cts`) are skipped — they declare types, not
// runtime imports.
//
// Regex approach is a deliberate v0 trade-off: an AST-based scan is
// more precise (ignores strings/comments, handles multiline formatting
// robustly) but adds a TS-parser dependency for a small-codebase guard.
// The regex is tight (anchored on `from`/`require`/`import(`) and the
// adapters directory is small; precision can tighten under a dedicated
// AST slice if false positives/negatives surface.
export function checkAdapterImportDiscipline(rootDir = REPO_ROOT, opts = {}) {
  const adaptersDir = opts.adaptersDir ?? join(rootDir, 'src/runtime/adapters');
  const forbiddenList = Array.isArray(opts.forbiddenDeps)
    ? opts.forbiddenDeps
    : FORBIDDEN_ADAPTER_SDK_DEPS;

  if (forbiddenList.length === 0) {
    return {
      level: 'red',
      detail:
        'FORBIDDEN_ADAPTER_SDK_DEPS is empty — import check would pass vacuously; populate the list or remove the check',
    };
  }

  if (!existsSync(adaptersDir)) {
    return {
      level: 'green',
      detail: `${relative(rootDir, adaptersDir)} does not exist — import scan vacuous (pre-adapter-code state)`,
    };
  }

  const files = listAdapterSourceFiles(adaptersDir);
  if (files.length === 0) {
    return {
      level: 'green',
      detail: `${relative(rootDir, adaptersDir)} contains no adapter source files — import scan empty`,
    };
  }

  const matches = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const specifiers = extractImportSpecifiers(content);
    for (const spec of specifiers) {
      for (const forbidden of forbiddenList) {
        if (spec === forbidden || spec.startsWith(`${forbidden}/`)) {
          matches.push(`${relative(rootDir, file)}: '${spec}'`);
        }
      }
    }
  }

  if (matches.length > 0) {
    return {
      level: 'red',
      detail: `forbidden SDK import(s) under src/runtime/adapters/**: ${matches.join('; ')}. ADR-0009 §4 mandates subprocess-per-adapter — reopen ADR-0009 via the matching §3 option before importing this SDK.`,
    };
  }

  return {
    level: 'green',
    detail: `${files.length} adapter source file(s) scanned; 0 forbidden imports (forbidden-list size: ${forbiddenList.length})`,
  };
}

// Check 30 (Slice 43c — P2.5 CC#P2-1 + CC#P2-2 binding). AGENT_SMOKE
// fingerprint commit-ancestor audit.
//
// When `tests/fixtures/agent-smoke/last-run.json` exists, verify the
// `commit_sha` field names a git commit that is an ancestor of HEAD.
// This binds the ADR-0007 CC#P2-2 CI-skip semantics: the end-to-end
// explore smoke run is gated by `AGENT_SMOKE=1` (skipped on CI by
// default per Slice 42 precedent), but when a local run produces the
// fingerprint, the ancestor check forever after catches regressions
// that land a fingerprint pointing at an orphaned or rewritten commit.
//
// Missing fingerprint is yellow (not red) until Phase 2 close — the
// operator may commit new runtime/fixture slices without being
// required to first produce a local AGENT_SMOKE artifact. Non-JSON,
// missing fields, or non-ancestor SHA is red.
//
// Slice 45 (P2.6) — the Check 32 `checkCodexSmokeFingerprint` export
// below reuses the same validation shape against the codex-smoke
// fingerprint path; both checks share identical semantics and differ
// only in which fingerprint file they bind to. A third adapter would
// motivate generalizing the two into an iteration (same pattern Slice
// 44 applied to Check 26 via `ARC_CLOSE_GATES`); two adapters fit
// plainly-repeated checks per "three similar lines is better than a
// premature abstraction."
export function checkAgentSmokeFingerprint(rootDir = REPO_ROOT, opts = {}) {
  const fingerprintPath =
    opts.fingerprintPath ?? join(rootDir, 'tests/fixtures/agent-smoke/last-run.json');

  if (!existsSync(fingerprintPath)) {
    return {
      level: 'yellow',
      detail: `${relative(rootDir, fingerprintPath)} absent — ADR-0007 CC#P2-2 CI-skip semantics: missing fingerprint is acceptable until Phase 2 close. Run the explore e2e with AGENT_SMOKE=1 to produce one.`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(fingerprintPath, 'utf-8'));
  } catch (err) {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} is not valid JSON: ${err.message}`,
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} is not a JSON object`,
    };
  }

  const commitSha = parsed.commit_sha;
  if (typeof commitSha !== 'string' || commitSha.length === 0) {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} missing required 'commit_sha' string`,
    };
  }

  if (!/^[0-9a-f]{7,40}$/i.test(commitSha)) {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} commit_sha '${commitSha}' is not a valid git SHA`,
    };
  }

  const resultSha256 = parsed.result_sha256;
  if (typeof resultSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(resultSha256)) {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} missing or malformed 'result_sha256' (must be 64-char lowercase hex)`,
    };
  }

  try {
    execSync(`git -C "${rootDir}" cat-file -e ${commitSha}^{commit}`, { stdio: 'ignore' });
  } catch {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} commit_sha '${commitSha}' does not resolve to a git commit in this repository`,
    };
  }

  try {
    execSync(`git -C "${rootDir}" merge-base --is-ancestor ${commitSha} HEAD`, {
      stdio: 'ignore',
    });
  } catch {
    return {
      level: 'red',
      detail: `${relative(rootDir, fingerprintPath)} commit_sha '${commitSha}' is not an ancestor of HEAD (fingerprint produced on an orphaned or rewritten commit)`,
    };
  }

  return {
    level: 'green',
    detail: `${relative(rootDir, fingerprintPath)} commit_sha ${commitSha.slice(0, 12)} is an ancestor of HEAD; result_sha256=${resultSha256.slice(0, 12)}…`,
  };
}

// Check 32 (Slice 45 — P2.6 CC#P2-2 second-adapter-evidence binding).
// CODEX_SMOKE fingerprint audit. Base validation delegates to Check 30
// `checkAgentSmokeFingerprint` (parse + commit-ancestor-of-HEAD); the
// Codex Slice 45 HIGH 4 fold-in extension layers **adapter-surface
// drift detection** on top: when the fingerprint records an
// `adapter_source_sha256`, the check re-hashes the current adapter-
// layer source files and flags drift as yellow ("fingerprint exists
// but the adapter has changed since the last CODEX_SMOKE run —
// re-promote via `CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1`"). This
// closes the ancestor-only staleness gap the challenger pass flagged:
// once a fingerprint lands, later edits to codex.ts / shared.ts /
// dispatch-materializer.ts are surfaced by the drift comparison, not
// hidden by the ancestor-only relationship. (Earlier draft cited
// CC#P2-4; ADR-0007 CC#P2-4 is session hooks, not second adapter.
// Corrected per Codex Slice 45 HIGH 1 fold-in.)
export const CODEX_ADAPTER_SOURCE_PATHS = Object.freeze([
  'src/runtime/adapters/codex.ts',
  'src/runtime/adapters/shared.ts',
  'src/runtime/adapters/dispatch-materializer.ts',
]);

export function computeCodexAdapterSourceSha256(rootDir = REPO_ROOT) {
  const h = createHash('sha256');
  for (const rel of CODEX_ADAPTER_SOURCE_PATHS) {
    const abs = join(rootDir, rel);
    h.update(`${abs}\n`);
    h.update(readFileSync(abs));
    h.update('\n');
  }
  return h.digest('hex');
}

export function checkCodexSmokeFingerprint(rootDir = REPO_ROOT, opts = {}) {
  const fingerprintPath =
    opts.fingerprintPath ?? join(rootDir, 'tests/fixtures/codex-smoke/last-run.json');
  const base = checkAgentSmokeFingerprint(rootDir, { ...opts, fingerprintPath });
  if (base.level !== 'green') return base;

  // Base ancestor check is green; layer adapter-surface drift detection.
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(fingerprintPath, 'utf-8'));
  } catch {
    // Base check already validated JSON parse; a regression here is a
    // race with the file changing between reads. Fall back to the base
    // verdict in that case.
    return base;
  }

  const recorded = parsed.adapter_source_sha256;
  if (typeof recorded !== 'string' || !/^[0-9a-f]{64}$/.test(recorded)) {
    return {
      level: 'yellow',
      detail: `${relative(rootDir, fingerprintPath)} missing or malformed 'adapter_source_sha256' (Slice 45 HIGH 4: schema_version 2 fingerprints must include this field; re-run CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1 to promote a fresh fingerprint bound to the current adapter surface)`,
    };
  }

  let current;
  try {
    current = computeCodexAdapterSourceSha256(rootDir);
  } catch (err) {
    return {
      level: 'red',
      detail: `failed to hash adapter source files for drift check: ${err.message}`,
    };
  }
  if (recorded !== current) {
    return {
      level: 'yellow',
      detail: `${relative(rootDir, fingerprintPath)} adapter_source_sha256 mismatch (recorded ${recorded.slice(0, 12)}… vs current ${current.slice(0, 12)}…) — codex adapter surface has changed since the last CODEX_SMOKE run; re-promote via CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1`,
    };
  }

  const cliVersion = parsed.cli_version;
  const cliVersionNote =
    typeof cliVersion === 'string' && cliVersion.length > 0 ? `; cli_version=${cliVersion}` : '';
  return {
    level: 'green',
    detail: `${base.detail}; adapter_source_sha256=${current.slice(0, 12)}… matches current surface${cliVersionNote}`,
  };
}

function listAdapterSourceFiles(dir) {
  const out = [];
  const SOURCE_EXT = /\.(?:m?ts|cts|tsx)$/;
  const DECLARATION_EXT = /\.d\.(?:m?ts|cts)$/;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (
        entry.isFile() &&
        SOURCE_EXT.test(entry.name) &&
        !DECLARATION_EXT.test(entry.name)
      ) {
        out.push(p);
      }
    }
  }
  walk(dir);
  return out;
}

// Extract ESM + CJS import specifiers. Patterns handled:
//   import … from '<spec>'      — default/named/namespace
//   import '<spec>'             — side-effect
//   export … from '<spec>'      — re-export
//   await import('<spec>')      — dynamic import
//   require('<spec>')           — CJS (not used in this codebase but handled
//                                 for completeness against future addition)
//
// Comment stripping (Codex Slice 42 MED 1 fold-in): // line comments and
// /* block */ comments are removed before regex extraction so a string
// that only appears inside comments (e.g. an example in a docstring)
// does not trigger a false positive. Regex-based comment stripping is
// correct for ordinary code; it may mishandle contrived cases where a
// `//` appears inside a string literal spanning lines — an AST-based
// scan handles those cleanly and is the deferred upgrade path.
export function extractImportSpecifiers(content) {
  const stripped = stripCommentsAndLiteralBodies(content);
  const out = [];
  // `import ... from '...'` / `export ... from '...'` — cross-line tolerant.
  const fromRe = /\b(?:import|export)\b[^'";]*?\bfrom\s+['"]([^'"]+)['"]/g;
  // Side-effect `import '...'`.
  const sideEffectRe = /\bimport\s+['"]([^'"]+)['"]/g;
  // Dynamic `import('...')`.
  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // CJS `require('...')`.
  const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Inline `createRequire(...)(<spec>)` — Codex Slice 42 MED 1 fold-in
  // bypass pattern. An adversary can synthesize a require function via
  // `import { createRequire } from 'node:module'; createRequire(import
  // .meta.url)('openai')`. The inline call form can be matched by regex;
  // the ALIASED form (`const r = createRequire(...); r('openai')`) is
  // not detectable without flow analysis — that remains a documented
  // trade-off of the regex-based scan, captured by the audit.mjs
  // comment and deferred to an AST-upgrade slice.
  const createRequireRe = /\bcreateRequire\s*\([^)]*\)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [fromRe, sideEffectRe, dynamicRe, requireRe, createRequireRe]) {
    for (const m of stripped.matchAll(re)) {
      out.push(m[1]);
    }
  }
  return out;
}

// Replace string-literal bodies, // line comments, and /* block */
// comments with whitespace so downstream regex sees only code-level
// tokens. We replace with same-length whitespace so line/column offsets
// stay stable for any future audit surface that cares.
function stripCommentsAndLiteralBodies(source) {
  const out = [];
  const len = source.length;
  let i = 0;
  while (i < len) {
    const c = source[i];
    const n = source[i + 1];
    // // line comment
    if (c === '/' && n === '/') {
      out.push(' ', ' ');
      i += 2;
      while (i < len && source[i] !== '\n') {
        out.push(source[i] === '\t' ? '\t' : ' ');
        i++;
      }
      continue;
    }
    // /* block comment */
    if (c === '/' && n === '*') {
      out.push(' ', ' ');
      i += 2;
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
        out.push(source[i] === '\n' ? '\n' : source[i] === '\t' ? '\t' : ' ');
        i++;
      }
      if (i < len) {
        out.push(' ', ' ');
        i += 2;
      }
      continue;
    }
    // String literal. We preserve the quote characters + pass the body
    // through unchanged so the import specifier inside `from 'openai'`
    // still matches. Only body contents that look like code but live
    // inside quotes could false-positive here — but since we're looking
    // specifically for import/require specifier strings, and those are
    // strings by construction, the body-preserving approach is correct.
    // We DO consume the literal as a whole to avoid the naive regex
    // matching `/* from 'x' */` inside a comment — but that case is
    // already handled by the block-comment branch above.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out.push(c);
      i++;
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < len) {
          out.push(source[i], source[i + 1]);
          i += 2;
          continue;
        }
        out.push(source[i]);
        i++;
      }
      if (i < len) {
        out.push(source[i]);
        i++;
      }
      continue;
    }
    out.push(c);
    i++;
  }
  return out.join('');
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

  // Check 17: Status-epoch alignment (Slice 26b — current_slice marker on README/PROJECT_STATE/TIER).
  const statusAlignment = checkStatusEpochAlignment();
  counters[statusAlignment.level]++;
  findings.push({
    level: statusAlignment.level,
    check: 'Status-epoch alignment (README/PROJECT_STATE/TIER)',
    detail: statusAlignment.detail,
  });

  // Check 18: Status docs current (Slice 26b — aligned marker matches most recent slice commit).
  const statusCurrent = checkStatusDocsCurrent();
  counters[statusCurrent.level]++;
  findings.push({
    level: statusCurrent.level,
    check: 'Status docs current (aligned marker matches most recent slice commit)',
    detail: statusCurrent.detail,
  });

  // Check 19: Pinned ratchet floor (Slice 26b — close gates no longer depend on HEAD~1 alone).
  const pinnedFloor = checkPinnedRatchetFloor(REPO_ROOT, headCount);
  counters[pinnedFloor.level]++;
  findings.push({
    level: pinnedFloor.level,
    check: 'Pinned ratchet floor (specs/ratchet-floor.json)',
    detail: pinnedFloor.detail,
  });

  // Check 20: Phase authority semantics (Slice 25d — ADR-0001 Addendum B).
  // Phase 1.5 claims must be backed by ADR-0001 Addendum B; decision.md
  // citing Phase 1.5 must cite ADR-0001. Closes the D3 failure mode
  // (silent phase mutation via decision.md alone).
  const phaseAuthority = checkPhaseAuthoritySemantics();
  counters[phaseAuthority.level]++;
  findings.push({
    level: phaseAuthority.level,
    check: 'Phase authority semantics (ADR-0001 Addendum B)',
    detail: phaseAuthority.detail,
  });

  // Check 21: CC#14 retarget presence under ADR-0006 (Slice 31a). When any
  // authority surface claims Phase 2 open, the 14a operator product-direction
  // check + the 14b Delegation acknowledgment section + ADR-0006 must all be
  // present. Advances the audit-coverage ratchet independently of the
  // phase-graph authority ratchet (Check 20), per CLAUDE.md hard invariant #8.
  const cc14Retarget = checkCc14RetargetPresence();
  counters[cc14Retarget.level]++;
  findings.push({
    level: cc14Retarget.level,
    check: 'CC#14 retarget presence (ADR-0006)',
    detail: cc14Retarget.detail,
  });

  // Check 22: Phase 2 slice isolation citation (ADR-0007 CC#P2-7 interim
  // enforcement, P2.1). For every Phase 2 slice commit touching isolation-
  // protected paths (specs/, tests/, .github/, .claude-plugin/, .claude/hooks/,
  // src/, scripts/), require explicit isolation posture in the commit body
  // OR a Break-Glass lane. Advances the audit-coverage ratchet independently
  // from the close-criteria-authority ratchet advanced by the P2.1 ceremony.
  const phase2Isolation = checkPhase2SliceIsolationCitation(disciplinedCommits);
  counters[phase2Isolation.level]++;
  findings.push({
    level: phase2Isolation.level,
    check: 'Phase 2 slice isolation citation (ADR-0007 CC#P2-7)',
    detail: phase2Isolation.detail,
  });

  // Check 23: Plugin command closure (ADR-0007 CC#P2-3 enforcement, P2.2).
  // Verifies that `.claude-plugin/plugin.json` carries a `commands` array,
  // every entry has a corresponding `.claude-plugin/commands/*.md` file with
  // non-empty frontmatter and body, no orphan command files exist on disk,
  // and the required anchor commands (`circuit:run`, `circuit:explore`) are
  // present. Advances the `plugin_surface_present` product ratchet to
  // partial at P2.2 and to green at P2.11.
  const pluginClosure = checkPluginCommandClosure();
  counters[pluginClosure.level]++;
  findings.push({
    level: pluginClosure.level,
    check: 'Plugin command closure (ADR-0007 CC#P2-3)',
    detail: pluginClosure.detail,
  });

  // Check 24: Spine coverage (ADR-0007 CC#P2-6 enforcement + EXPLORE-I1,
  // P2.3). For every workflow fixture under `.claude-plugin/skills/<kind>/
  // circuit.json` whose `id` matches a registered workflow-kind canonical
  // set, verify declared phases cover exactly the expected canonical set
  // and `spine_policy.omits` matches. Unknown kinds pass through
  // information-only; `dogfood-run-0` is exempt as the Phase 1.5 Alpha
  // Proof partial fixture. Inserted here shifts the prior verify-gate
  // check to Check 25.
  const spineCoverage = checkSpineCoverage();
  counters[spineCoverage.level]++;
  findings.push({
    level: spineCoverage.level,
    check: 'Spine coverage (ADR-0007 CC#P2-6 / EXPLORE-I1)',
    detail: spineCoverage.detail,
  });

  // Check 25: Artifact registry backing-path integrity (Slice 35,
  // specs/plans/phase-2-foundation-foldins.md). Walks specs/artifacts.json
  // and flags any two distinct artifacts whose normalized backing_paths
  // collide. This is the minimum-viable mechanism that would have caught
  // HIGH 4 in specs/reviews/p2-foundation-composition-review.md at slice-34
  // authorship time. Known tracked collisions are downgraded to yellow with
  // a closing-slice reference; untracked collisions are red. Stale allowlist
  // entries (no matching live collision) are red.
  const backingPathIntegrity = checkArtifactBackingPathIntegrity();
  counters[backingPathIntegrity.level]++;
  findings.push({
    level: backingPathIntegrity.level,
    check: 'Artifact registry backing-path integrity (Slice 35 / pre-P2.4 fold-ins)',
    detail: backingPathIntegrity.detail,
  });

  // Check 26: Arc-close composition-review presence (Slice 35 fold-in of
  // Codex challenger HIGH 4). Binds the CLAUDE.md §Cross-slice composition
  // review cadence rule to a machine-checkable gate for the pre-P2.4 fold-in
  // arc. Fires red when the arc's last slice has landed but no arc-close
  // composition review exists under specs/reviews/ with an ACCEPT or
  // ACCEPT-WITH-FOLD-INS closing verdict.
  const arcCloseReview = checkArcCloseCompositionReviewPresence();
  counters[arcCloseReview.level]++;
  findings.push({
    level: arcCloseReview.level,
    check: 'Arc-close composition review (Slice 35 / pre-P2.4 fold-ins)',
    detail: arcCloseReview.detail,
  });

  // Check 27: Adapter-binding coverage (Slice 38 — ADR-0008 §Decision.4).
  // Any workflow fixture whose `id` is registered in
  // WORKFLOW_KIND_CANONICAL_SETS (scheduled for P2.5+ enforcement) must
  // exercise at least one `kind: "dispatch"` step. Closes composition-
  // review HIGH 1 ("explore has no step that dispatches") as a structural
  // gate that recurs on every new workflow-kind landing.
  const adapterBindingCoverage = checkAdapterBindingCoverage();
  counters[adapterBindingCoverage.level]++;
  findings.push({
    level: adapterBindingCoverage.level,
    check: 'Adapter-binding coverage (Slice 38 / ADR-0008)',
    detail: adapterBindingCoverage.detail,
  });

  // Check 28: Adapter invocation discipline — dep-level (Slice 41 —
  // ADR-0009 §4). Package.json must not declare any forbidden-SDK dep
  // identifier; v0 invocation pattern is subprocess-per-adapter. Paired
  // with Check 29 (import-level scan) to close the transitive-install
  // bypass at Slice 42.
  const adapterInvocationDiscipline = checkAdapterInvocationDiscipline();
  counters[adapterInvocationDiscipline.level]++;
  findings.push({
    level: adapterInvocationDiscipline.level,
    check: 'Adapter invocation discipline — dep-level (Slice 41 / ADR-0009)',
    detail: adapterInvocationDiscipline.detail,
  });

  // Check 29: Adapter invocation discipline — import-level (Slice 42 —
  // ADR-0009 §4 Slice 42 binding, Codex Slice 41 HIGH 2 fold-in). Scans
  // src/runtime/adapters/** for any import statement whose specifier
  // matches FORBIDDEN_ADAPTER_SDK_DEPS. Complement to Check 28: catches
  // transitively-available SDK imports that would circumvent the
  // dep-level guard.
  const adapterImportDiscipline = checkAdapterImportDiscipline();
  counters[adapterImportDiscipline.level]++;
  findings.push({
    level: adapterImportDiscipline.level,
    check: 'Adapter invocation discipline — import-level (Slice 42 / ADR-0009)',
    detail: adapterImportDiscipline.detail,
  });

  // Check 30: AGENT_SMOKE fingerprint commit-ancestor audit (Slice 43c —
  // P2.5 CC#P2-1 + CC#P2-2 binding). When
  // `tests/fixtures/agent-smoke/last-run.json` exists, the fingerprint's
  // commit_sha must resolve in-repo and be an ancestor of HEAD so a
  // future regression cannot land a fingerprint against an orphaned or
  // rewritten commit. Missing file is yellow (ADR-0007 CC#P2-2 CI-skip
  // semantics — local AGENT_SMOKE runs are opt-in until Phase 2 close).
  const agentSmokeFingerprint = checkAgentSmokeFingerprint();
  counters[agentSmokeFingerprint.level]++;
  findings.push({
    level: agentSmokeFingerprint.level,
    check: 'AGENT_SMOKE fingerprint commit-ancestor (Slice 43c / ADR-0007 CC#P2-2)',
    detail: agentSmokeFingerprint.detail,
  });

  // Check 32: CODEX_SMOKE fingerprint commit-ancestor audit (Slice 45 —
  // P2.6 CC#P2-2 second-adapter-evidence binding). Extends Check 30's
  // parse + ancestor validation with adapter-surface-binding drift
  // detection per Codex Slice 45 HIGH 4 fold-in.
  const codexSmokeFingerprint = checkCodexSmokeFingerprint();
  counters[codexSmokeFingerprint.level]++;
  findings.push({
    level: codexSmokeFingerprint.level,
    check:
      'CODEX_SMOKE fingerprint commit-ancestor + adapter-surface binding (Slice 45 / ADR-0007 CC#P2-2)',
    detail: codexSmokeFingerprint.detail,
  });

  // Check 31: npm run verify currently green. (Runs last so the report's
  // bottom line is the verify-gate status; numbering bumped 31 → 32 by
  // Slice 45 which inserted Check 32 for CODEX_SMOKE fingerprint audit.
  // Prior bumps: Slice 43c 30 → 31; Slice 42 29 → 30; Slice 41 28 → 29;
  // Slice 38 27 → 28; Slice 35 25 → 27; P2.3 24 → 25; P2.2 23 → 24;
  // P2.1 22 → 23; Slice 31a 21 → 22; Slice 26b 15 → 20; Slice 25d
  // 20 → 21.)
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
