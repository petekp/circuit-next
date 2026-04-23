#!/usr/bin/env node
/**
 * circuit-next plan-lint.
 *
 * Pre-operator-signoff quality gate for multi-slice / ratchet-advancing
 * plans. Enforces ADR-0010 Arc Planning Readiness Gate rules against a
 * single plan file. Unlike scripts/audit.mjs (which runs against
 * committed state), plan-lint operates on arbitrary paths including
 * untracked files — so it can be invoked during draft authoring.
 *
 * Usage:
 *   npm run plan:lint -- <path-to-plan.md>
 *   node scripts/plan-lint.mjs <path-to-plan.md>
 *
 * Exit codes:
 *   0 — no findings (plan passes).
 *   1 — one or more findings (plan fails).
 *   2 — invocation error (missing path, unreadable file, etc.).
 *
 * The authoritative source for invariant enforcement-layer vocabulary
 * is `specs/invariants.json::enforcement_state_semantics`. This script
 * reads that JSON at lint time.
 *
 * Rules (per ADR-0010 §6) — 22 total:
 *   #1  evidence-census-present
 *   #2  tbd-in-acceptance-evidence
 *   #3  test-path-extension
 *   #4  stale-symbol-citation
 *   #5  arc-close-claim-without-gate
 *   #6  signoff-while-pending
 *   #7  invariant-without-enforcement-layer            (Slice 59)
 *   #8  blocked-invariant-without-full-escrow          (Slice 59)
 *   #9  contract-shaped-payload-without-characterization
 *   #10 unverified-hypothesis-presented-as-decided
 *   #11 arc-trajectory-check-present
 *   #12 live-state-evidence-ledger-complete
 *   #13 cli-invocation-shape-matches
 *   #14 artifact-cardinality-mapped-to-reference
 *   #15 status-field-valid
 *   #16 untracked-plan-cannot-claim-post-draft-status
 *   #17 status-challenger-cleared-requires-fresh-committed-challenger-artifact
 *   #18 canonical-phase-set-maps-to-schema-vocabulary
 *   #19 verdict-determinism-includes-verification-passes-for-successor-to-live
 *   #20 verification-runtime-capability-assumed-without-substrate-slice
 *   #21 artifact-materialization-uses-registered-schema
 *   #22 blocked-invariant-must-resolve-before-arc-close (Slice 59)
 *
 * Slice 58 lands rules #1-#6, #9-#21 (19 structural/shape + state-machine +
 * P2.9 HIGH-coverage rules). Slice 59 lands rules #7, #8, #22 (invariant
 * dimension trio: enforcement-layer required, blocked escrow, blocked-must-
 * resolve-before-close).
 *
 * Per-rule severity: all rules are HIGH unless stated otherwise.
 * Findings emit JSON-per-line on stderr (machine-readable) + a
 * human-readable summary on stdout.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return process.cwd();
  }
})();

const PLAN_STATUS_SET = new Set([
  'evidence-draft',
  'challenger-pending',
  'challenger-cleared',
  'operator-signoff',
  'closed',
]);

const POST_DRAFT_STATUSES = new Set([
  'challenger-pending',
  'challenger-cleared',
  'operator-signoff',
  'closed',
]);

const ACCEPT_CLASS_VERDICTS = new Set(['ACCEPT', 'ACCEPT-WITH-FOLD-INS']);

// Revision 05 (post-pass-04 CRITICAL 1 fold-in): the legacy boundary is
// the meta-arc's first commit SHA (Slice 57a, committed 2026-04-22
// evening Pacific / 2026-04-23 UTC). Plans whose first commit is a
// strict ancestor of this commit are legacy. The meta-arc itself and
// all subsequent plans are post-effective. This avoids timezone edge
// cases entirely — the effective date (2026-04-23 per ADR-0010) is
// codified by commit ancestry rather than by date parsing.
const META_ARC_FIRST_COMMIT = 'c91469053a95519645280fd80394a4966ac7948e';

/**
 * Parse a plan file's YAML frontmatter + body.
 * Returns { frontmatter, body, rawFrontmatter, sections }.
 * sections is an array of { title, startOffset, endOffset, kind } where
 * kind is one of: 'narrative', 'rule-description', 'normative'.
 * If no frontmatter found, frontmatter is {} and rawFrontmatter is ''.
 */
function parsePlan(contents) {
  const match = contents.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  let frontmatter = {};
  let body = contents;
  let rawFrontmatter = '';
  if (match) {
    const [, raw, bodyMatched] = match;
    frontmatter = parseSimpleYaml(raw);
    body = bodyMatched;
    rawFrontmatter = raw;
  }
  const sections = parseSections(body);
  return { frontmatter, body, rawFrontmatter, sections };
}

/**
 * Identify top-level sections and classify each as narrative (skip some
 * rules), rule-description (skip rule #3, #7, #8 false positives), or
 * normative (all rules apply).
 */
function parseSections(body) {
  const sections = [];
  const headerRe = /^## (§\d+[. ]*[—–-]?\s*)?([^\n]+)$/gm;
  const headers = [];
  for (const match of body.matchAll(headerRe)) {
    headers.push({ index: match.index, title: (match[2] ?? '').trim() });
  }
  for (let i = 0; i < headers.length; i++) {
    const { index, title } = headers[i];
    const endIndex = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const lowerTitle = title.toLowerCase();
    let kind = 'normative';
    if (/failure[-\s]mode\s+ledger|failure modes|what went wrong/i.test(lowerTitle)) {
      kind = 'narrative';
    } else if (/lint[-\s]rule\s+inventory|rule inventory/i.test(lowerTitle)) {
      kind = 'rule-description';
    } else if (/vocabulary (authority|alignment)/i.test(lowerTitle)) {
      kind = 'rule-description';
    } else if (/codex foldin map|prior[-\s]objection resolution/i.test(lowerTitle)) {
      kind = 'narrative';
    }
    sections.push({ title, startOffset: index, endOffset: endIndex, kind });
  }
  return sections;
}

/**
 * Return the section kind at a given body offset. Default 'normative'
 * if outside any identified section.
 */
function sectionKindAtOffset(sections, offset) {
  for (const s of sections) {
    if (offset >= s.startOffset && offset < s.endOffset) {
      return s.kind;
    }
  }
  return 'normative';
}

/**
 * Minimal YAML subset parser: key: value on each line; block scalar
 * values (|, >) are read as multi-line strings; lists (`- item`)
 * accumulate as arrays. Nested mappings are NOT supported — plan
 * frontmatter is intentionally flat.
 */
function parseSimpleYaml(raw) {
  const out = {};
  const lines = raw.split('\n');
  let currentKey = null;
  let currentList = null;
  let currentBlockScalar = null;
  let currentBlockIndent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (currentBlockScalar !== null) currentBlockScalar.push('');
      continue;
    }

    if (currentBlockScalar !== null) {
      const indent = line.match(/^ */)[0].length;
      if (currentBlockIndent === null) currentBlockIndent = indent;
      if (indent >= currentBlockIndent) {
        currentBlockScalar.push(line.slice(currentBlockIndent));
        continue;
      }
      out[currentKey] = currentBlockScalar.join('\n');
      currentBlockScalar = null;
      currentBlockIndent = null;
      currentKey = null;
    }

    if (currentList !== null) {
      if (line.startsWith('  - ') || line.startsWith('- ')) {
        currentList.push(line.replace(/^(?: {2})?- /, '').trim());
        continue;
      }
      out[currentKey] = currentList;
      currentList = null;
      currentKey = null;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!value.trim()) {
      // next line is either a list or a block scalar or nothing
      const next = lines[i + 1] ?? '';
      if (next.match(/^\s*- /)) {
        currentList = [];
        currentKey = key;
      } else if (next.trim()) {
        // empty value + non-empty next line → treat as empty string
        out[key] = '';
      } else {
        out[key] = '';
      }
    } else if (value.startsWith('|') || value.startsWith('>')) {
      currentBlockScalar = [];
      currentKey = key;
      currentBlockIndent = null;
    } else {
      out[key] = value.trim();
    }
  }
  if (currentBlockScalar !== null && currentKey) {
    out[currentKey] = currentBlockScalar.join('\n');
  }
  if (currentList !== null && currentKey) {
    out[currentKey] = currentList;
  }
  return out;
}

/**
 * Check if the file at `path` is git-tracked (in HEAD, index, or both).
 */
function isGitTracked(path) {
  try {
    const relPath = isAbsolute(path) ? path.slice(REPO_ROOT.length + 1) : path;
    execSync(`git ls-files --error-unmatch ${JSON.stringify(relPath)}`, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the authoritative invariant enforcement-layer vocabulary.
 * Returns Set<string>. Falls back to a hardcoded set if the JSON
 * file is missing (this is a soft fallback for pre-revision-02
 * scenarios; Slice 57 ADR-0010 ensures specs/invariants.json exists).
 */
function loadInvariantLayerVocab() {
  const jsonPath = join(REPO_ROOT, 'specs', 'invariants.json');
  try {
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const keys = Object.keys(json.enforcement_state_semantics ?? {});
    if (keys.length > 0) return new Set(keys);
  } catch {
    // fall through
  }
  return new Set(['test-enforced', 'audit-only', 'static-anchor', 'prose-only', 'phase2-property']);
}

/**
 * Determine whether a plan file is "legacy grandfathered" — authored
 * before the planning-readiness-meta-arc landed. Legacy plans are
 * fully exempt from ALL plan-lint rules per ADR-0010 §Migration.
 *
 * Revision 04 (pass 03 HIGH 3 fold-in): distinguishes legacy-committed
 * files from arbitrary new paths. A plan is legacy ONLY if its first
 * committed version in git predates the effective date. Untracked plans
 * and new-plan backdating are NOT legacy — they must pass the full
 * rule set.
 */
function isLegacyPlan(_frontmatter, planPath) {
  // Revision 05 (pass-04 CRITICAL 1 fold-in): the legacy boundary is
  // the meta-arc's first commit SHA. A plan is legacy iff its first
  // commit is a STRICT ANCESTOR of META_ARC_FIRST_COMMIT. Otherwise
  // (untracked, or same-as / descendant of the meta-arc first commit)
  // it is post-effective and goes through the full 22-rule gate.
  //
  // Why this approach instead of date comparison: timezone edge cases
  // around the effective-date boundary (pacific-evening commits that
  // land in UTC early-morning of the effective date) misclassify
  // plans as post-effective when they predate the meta-arc itself.
  // Using ancestry gives a principled, commit-local boundary.
  if (!planPath) return false;
  let firstCommitSha;
  try {
    const relPath = isAbsolute(planPath) ? planPath.slice(REPO_ROOT.length + 1) : planPath;
    const out = execSync(
      `git log --diff-filter=A --follow --format=%H -- ${JSON.stringify(relPath)}`,
      {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
    firstCommitSha = out.length > 0 ? out[out.length - 1] : null;
  } catch {
    firstCommitSha = null;
  }
  if (!firstCommitSha) return false; // untracked / no history → NOT legacy
  // Ask git: is firstCommitSha a strict ancestor of META_ARC_FIRST_COMMIT?
  // merge-base --is-ancestor X Y exits 0 iff X is ancestor of Y (including equal).
  // To match "strict ancestor", also check firstCommitSha !== META_ARC_FIRST_COMMIT.
  if (firstCommitSha === META_ARC_FIRST_COMMIT) return false; // same-as boundary = non-legacy
  try {
    execSync(`git merge-base --is-ancestor ${firstCommitSha} ${META_ARC_FIRST_COMMIT}`, {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true; // firstCommitSha is ancestor → legacy
  } catch {
    return false; // not an ancestor → post-effective
  }
}

/**
 * Retained alias for rule #1/#11 yellow-vs-red logic. Rule applies
 * only to post-effective plans anyway (legacy plans skip ALL rules).
 */
function isGrandfathered(frontmatter, planPath) {
  return isLegacyPlan(frontmatter, planPath);
}

// ----- RULES -----

/**
 * Rule #1 — evidence-census-present.
 * Plan must have a §Evidence census section OR a §1 with verified /
 * inferred / unknown-blocking vocabulary.
 */
function rule1EvidenceCensus(plan, planPath) {
  const hasSection = /§Evidence census|## §1.*Evidence census|## §1 —/i.test(plan.body);
  const hasVocabulary = /verified|inferred|unknown-blocking/i.test(plan.body);
  if (!hasSection || !hasVocabulary) {
    return [
      {
        rule: 'plan-lint.evidence-census-present',
        severity: isGrandfathered(plan.frontmatter, planPath) ? 'yellow' : 'red',
        message:
          'Plan missing §Evidence census section (or equivalent) with verified / inferred / unknown-blocking vocabulary',
        location: 'plan body',
      },
    ];
  }
  return [];
}

/**
 * Rule #2 — tbd-in-acceptance-evidence.
 */
function rule2TbdInAcceptance(plan) {
  const findings = [];
  const acceptanceBlocks =
    plan.body.match(/\*\*Acceptance evidence:\*\*[\s\S]*?(?=\*\*|\n##|\n### |$)/g) ?? [];
  for (const block of acceptanceBlocks) {
    if (/\bTBD\b|\bTODO\b/i.test(block)) {
      findings.push({
        rule: 'plan-lint.tbd-in-acceptance-evidence',
        severity: 'red',
        message: 'TBD or TODO found in an Acceptance evidence block',
        location: 'acceptance evidence block',
      });
    }
  }
  return findings;
}

/**
 * Rule #3 — test-path-extension.
 * Test deliverable paths ending in .md where they should be .test.ts.
 * Section-aware: skips matches inside narrative sections (§2 Failure-mode).
 */
function rule3TestPathExtension(plan) {
  const findings = [];
  const testMdRe = /tests\/[a-z/]+\.md\b/g;
  for (const match of plan.body.matchAll(testMdRe)) {
    const path = match[0];
    // tests/fixtures/**/*.md and tests/mutation/*.md are legitimate.
    if (/^tests\/fixtures\//.test(path) || /^tests\/mutation\//.test(path)) continue;
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind === 'narrative') continue; // reference to P2.9 bad example, not own deliverable
    findings.push({
      rule: 'plan-lint.test-path-extension',
      severity: 'red',
      message: `Test deliverable cited as .md path: ${path}. Real tests are .test.ts`,
      location: path,
    });
  }
  return findings;
}

/**
 * Rule #4 — stale-symbol-citation.
 * path/file.ext:Name references where file doesn't exist OR symbol
 * not present at cited location.
 */
function rule4StaleSymbolCitation(plan) {
  const findings = [];
  // Match patterns like `scripts/audit.mjs:WORKFLOW_KIND_CANONICAL_SETS`
  // or `src/runtime/runner.ts::writeSynthesisArtifact`.
  const pathSymbolRe =
    /`([a-zA-Z0-9_./-]+\.(?:mjs|ts|tsx|js|jsx|mts|cts|json|md))(?:::?)([A-Za-z_][A-Za-z0-9_]*)`/g;
  for (const match of plan.body.matchAll(pathSymbolRe)) {
    const [full, relPath, symbol] = match;
    const absPath = isAbsolute(relPath) ? relPath : join(REPO_ROOT, relPath);
    if (!existsSync(absPath)) {
      findings.push({
        rule: 'plan-lint.stale-symbol-citation',
        severity: 'red',
        message: `Cited file does not exist: ${relPath}`,
        location: full,
      });
      continue;
    }
    try {
      const contents = readFileSync(absPath, 'utf8');
      const symbolRe = new RegExp(`\\b${symbol}\\b`);
      if (!symbolRe.test(contents)) {
        findings.push({
          rule: 'plan-lint.stale-symbol-citation',
          severity: 'red',
          message: `Symbol "${symbol}" not found in ${relPath}`,
          location: full,
        });
      }
    } catch (err) {
      findings.push({
        rule: 'plan-lint.stale-symbol-citation',
        severity: 'yellow',
        message: `Could not read ${relPath}: ${err.message}`,
        location: full,
      });
    }
  }
  return findings;
}

/**
 * Rule #5 — arc-close-claim-without-gate.
 * Arc-close-criterion-satisfied claims without naming the audit gate.
 */
function rule5ArcCloseClaim(plan) {
  const findings = [];
  const claimRe = /\barc[ -]?close\b[^\n]*\b(satisf|pass|green|complete)/gi;
  const lines = plan.body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (claimRe.test(line)) {
      // Look for a gate citation (Check NN) in this or next 3 lines.
      const context = lines.slice(i, i + 4).join(' ');
      if (!/Check \d+|audit\.mjs|\bgate\b/i.test(context)) {
        findings.push({
          rule: 'plan-lint.arc-close-claim-without-gate',
          severity: 'red',
          message: 'Arc-close-criterion-satisfied claim without naming the enforcing audit gate',
          location: `body line ~${i + 1}: "${line.slice(0, 80)}"`,
        });
      }
    }
  }
  return findings;
}

/**
 * Rule #6 — signoff-while-pending.
 * operator_signoff: ready while challenger_status: pending or missing.
 */
function rule6SignoffWhilePending(plan) {
  const fm = plan.frontmatter;
  if (fm.operator_signoff === 'ready') {
    if (!fm.challenger_status || fm.challenger_status === 'pending') {
      return [
        {
          rule: 'plan-lint.signoff-while-pending',
          severity: 'red',
          message: 'operator_signoff is ready while challenger_status is pending or missing',
          location: 'frontmatter',
        },
      ];
    }
  }
  return [];
}

/**
 * Rule #7 — invariant-without-enforcement-layer (Slice 59).
 * Invariants declared without enforcement_layer from authoritative set.
 * Section-aware: skips matches in rule-description / narrative sections.
 */
function rule7InvariantWithoutLayer(plan) {
  const findings = [];
  const vocab = loadInvariantLayerVocab();
  const invariantDeclRe = /(?:#{2,4}\s+|\*\*|__)[A-Z]+-I\d+\b/g;
  for (const match of plan.body.matchAll(invariantDeclRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const chunk = plan.body.slice(match.index, match.index + 500);
    const layerMatch = chunk.match(/enforcement_layer:\s*([a-z-]+)/i);
    if (!layerMatch) {
      findings.push({
        rule: 'plan-lint.invariant-without-enforcement-layer',
        severity: 'red',
        message: 'Invariant declared without enforcement_layer field',
        location: `body offset ~${match.index}`,
      });
      continue;
    }
    const layer = layerMatch[1];
    if (!vocab.has(layer) && layer !== 'blocked') {
      findings.push({
        rule: 'plan-lint.invariant-without-enforcement-layer',
        severity: 'red',
        message: `enforcement_layer "${layer}" not in authoritative set (${[...vocab].join(', ')}) + "blocked" extension`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

/**
 * Rule #8 — blocked-invariant-without-full-escrow (Slice 59).
 * Revision 03: requires full escrow terms (substrate_slice + owner +
 * expiry_date + reopen_condition + acceptance_evidence).
 * Section-aware: skips matches in rule-description / narrative sections.
 */
function rule8BlockedInvariantWithoutSlice(plan) {
  const findings = [];
  const blockedRe = /enforcement_layer:\s*blocked\b/g;
  for (const match of plan.body.matchAll(blockedRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const chunk = plan.body.slice(match.index, match.index + 1500);
    const requiredFields = [
      'substrate_slice:',
      'owner:',
      'expiry_date:',
      'reopen_condition:',
      'acceptance_evidence:',
    ];
    const missing = requiredFields.filter((f) => !chunk.includes(f));
    if (missing.length > 0) {
      findings.push({
        rule: 'plan-lint.blocked-invariant-without-full-escrow',
        severity: 'red',
        message: `\`enforcement_layer: blocked\` invariant missing escrow fields: ${missing.join(', ')}`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

/**
 * Rule #9 — contract-shaped-payload-without-characterization.
 * Plan declaring artifact ids, invariant text, verdict vocab, or CLI
 * shape for a successor-to-live surface without a characterization
 * slice landing first in the arc.
 */
function rule9ContractShapedPayload(plan) {
  const findings = [];
  // Heuristic: plan declares one or more of (a) artifact_ids listing,
  // (b) INVARIANT-I1-style definition, (c) CLI --flag invocation, AND
  // cites a successor-to-live or reference surface AND does NOT have
  // a §Characterization or §Reference-read or §Slice-<N>-characterization section.
  const hasArtifactIds = /\bartifact_ids:\s*\[/i.test(plan.body);
  const hasInvariantDef = /\b[A-Z]+-I\d+\s+definition/i.test(plan.body);
  const hasCliInvocation = /`?npm run circuit:run.*--[a-z]+/i.test(plan.body);
  const hasSuccessorToLive =
    /successor-to-live|~\/Code\/circuit\/(skills|commands|\.circuit)/i.test(plan.body);
  const hasCharacterizationSlice = /Characterization|specs\/reference\//i.test(plan.body);

  if (
    (hasArtifactIds || hasInvariantDef || hasCliInvocation) &&
    hasSuccessorToLive &&
    !hasCharacterizationSlice
  ) {
    findings.push({
      rule: 'plan-lint.contract-shaped-payload-without-characterization',
      severity: 'red',
      message:
        'Plan declares contract-shaped payload (artifacts / invariants / CLI shape) for a successor-to-live surface without a characterization slice',
      location: 'plan body',
    });
  }
  return findings;
}

/**
 * Rule #10 — unverified-hypothesis-presented-as-decided.
 * target: X or decision: X where X is not in verified evidence rows.
 */
function rule10UnverifiedDecision(plan) {
  const findings = [];
  const fm = plan.frontmatter;
  if (fm.target) {
    // target can be "planning discipline" (non-testable) or a workflow name
    const target = String(fm.target);
    // If frontmatter target is a workflow name AND no §Evidence census mentions "target selection confirmed" or "target reselection"
    if (
      /\bworkflow\b/i.test(target) ||
      ['explore', 'review', 'repair', 'build'].includes(target.trim())
    ) {
      const hasTargetJustification =
        /target (selection|reselection|confirmed|decided)/i.test(plan.body) ||
        /hypothesis.*target/i.test(plan.body);
      if (!hasTargetJustification) {
        findings.push({
          rule: 'plan-lint.unverified-hypothesis-presented-as-decided',
          severity: 'red',
          message: `Frontmatter target "${target}" not backed by Evidence-census verified row or marked hypothesis:`,
          location: 'frontmatter.target',
        });
      }
    }
  }
  return findings;
}

/**
 * Rule #11 — arc-trajectory-check-present.
 * Plan missing arc-level trajectory justification.
 */
function rule11ArcTrajectory(plan, planPath) {
  const hasEntryState = /§Entry state|## §?Entry|Arc trajectory|arc-level trajectory/i.test(
    plan.body,
  );
  const hasWhyExists = /## Why this plan exists|## Why (this|the) (plan|arc)/i.test(plan.body);
  if (!hasEntryState && !hasWhyExists) {
    return [
      {
        rule: 'plan-lint.arc-trajectory-check-present',
        severity: isGrandfathered(plan.frontmatter, planPath) ? 'yellow' : 'red',
        message:
          'Plan missing arc-level trajectory justification (§Entry state, §Why-this-plan, or equivalent)',
        location: 'plan body',
      },
    ];
  }
  return [];
}

/**
 * Rule #12 — live-state-evidence-ledger-complete.
 * Plan cites symbols/files without corresponding census row.
 *
 * Weak enforcement in Slice 58: verifies that if the plan cites
 * path/file.ext, there's at least one verified / inferred / hypothesis
 * status flag near the citation OR in an Evidence-census section
 * that references the path. Strong cross-reference is deferred.
 */
function rule12LiveStateLedger(plan) {
  // If Evidence-census is absent, rule #1 already fires; skip here.
  if (!/verified|inferred|unknown-blocking/i.test(plan.body)) {
    return [];
  }
  // Count citations vs census rows. Citations = path/file.ext patterns
  // outside code blocks.
  const citationMatches =
    plan.body.match(/\b[a-z/]+\/[a-zA-Z_-]+\.(mjs|ts|tsx|js|json|md)\b/g) ?? [];
  const uniqueCitations = new Set(citationMatches);
  const censusRows =
    plan.body.match(/\|\s*(verified|inferred|unknown-blocking|hypothesis)\s*\|/g) ?? [];
  // Heuristic: if there are more than 10 unique citations but fewer than
  // 5 census rows, the ledger is incomplete.
  if (uniqueCitations.size >= 10 && censusRows.length < 5) {
    return [
      {
        rule: 'plan-lint.live-state-evidence-ledger-complete',
        severity: 'red',
        message: `Plan has ${uniqueCitations.size} unique file citations but only ${censusRows.length} census rows — ledger appears incomplete`,
        location: 'plan body',
      },
    ];
  }
  return [];
}

/**
 * Rule #13 — cli-invocation-shape-matches.
 * Plan's CLI --flag usage must match actual CLI argv parser.
 */
function rule13CliShape(plan) {
  const findings = [];
  const cliRe = /npm run circuit:run(?:\s+--)?\s+(\S+)\s+(--?[a-z-]+)/g;
  // Try to read the actual CLI file to extract accepted flags.
  const cliPath = join(REPO_ROOT, 'src', 'cli', 'dogfood.ts');
  if (!existsSync(cliPath)) return findings;
  const cliContent = readFileSync(cliPath, 'utf8');
  const acceptedFlags = new Set();
  const flagRe = /(?:argv\.|args\.|options\.|\["?)(--?[a-z-]+)/g;
  for (const m of cliContent.matchAll(flagRe)) {
    acceptedFlags.add(m[1]);
  }
  // Also scan for --flag patterns in strings
  const stringFlagRe = /'(--[a-z-]+)'|"(--[a-z-]+)"/g;
  for (const m of cliContent.matchAll(stringFlagRe)) {
    acceptedFlags.add(m[1] ?? m[2]);
  }
  for (const match of plan.body.matchAll(cliRe)) {
    const flag = match[2];
    if (!acceptedFlags.has(flag) && !acceptedFlags.has(flag.replace(/^-+/, '--'))) {
      findings.push({
        rule: 'plan-lint.cli-invocation-shape-matches',
        severity: 'red',
        message: `CLI flag "${flag}" not found in src/cli/dogfood.ts argv parser (accepted flags: ${[...acceptedFlags].join(', ')})`,
        location: `plan body: "${match[0]}"`,
      });
    }
  }
  return findings;
}

/**
 * Rule #14 — artifact-cardinality-mapped-to-reference.
 */
function rule14ArtifactCardinality(plan) {
  // Trigger only if plan declares successor-to-live artifacts.
  if (!/successor-to-live/i.test(plan.body)) return [];
  // Look for artifact count declarations: "N new artifact rows" or
  // "declares N artifacts". Also look for reference cardinality:
  // "reference emits N" or "exactly one artifact".
  const selfCardinalityMatch = plan.body.match(
    /\b(\d+) (?:new |data-plane )?artifact(?:s|\s+rows|\s+ids)\b/i,
  );
  const referenceCardinalityMatch =
    plan.body.match(/reference (?:surface|Circuit|emits?).*?(\d+|one|two) artifact/i) ??
    plan.body.match(/\b(\d+|one|two) artifact.{0,50}reference/i);
  if (selfCardinalityMatch && !referenceCardinalityMatch) {
    return [
      {
        rule: 'plan-lint.artifact-cardinality-mapped-to-reference',
        severity: 'red',
        message: `Plan declares ${selfCardinalityMatch[1]} artifacts for successor-to-live surface without recording reference-surface cardinality`,
        location: 'plan body',
      },
    ];
  }
  return [];
}

/**
 * Rule #15 — status-field-valid.
 */
function rule15StatusValid(plan) {
  const status = plan.frontmatter.status;
  if (!status) {
    return [
      {
        rule: 'plan-lint.status-field-valid',
        severity: 'red',
        message: 'Missing status: field in frontmatter',
        location: 'frontmatter',
      },
    ];
  }
  if (!PLAN_STATUS_SET.has(status.trim())) {
    return [
      {
        rule: 'plan-lint.status-field-valid',
        severity: 'red',
        message: `Invalid status "${status}". Valid: ${[...PLAN_STATUS_SET].join(', ')}`,
        location: 'frontmatter.status',
      },
    ];
  }
  return [];
}

/**
 * Rule #16 — untracked-plan-cannot-claim-post-draft-status.
 */
function rule16UntrackedPostDraft(plan, planPath) {
  const status = plan.frontmatter.status;
  if (!status) return [];
  if (POST_DRAFT_STATUSES.has(status.trim()) && !isGitTracked(planPath)) {
    return [
      {
        rule: 'plan-lint.untracked-plan-cannot-claim-post-draft-status',
        severity: 'red',
        message: `Plan status "${status}" requires git-tracked state. File is untracked.`,
        location: 'filesystem',
      },
    ];
  }
  return [];
}

/**
 * Rule #17 — status-challenger-cleared-requires-fresh-committed-challenger-artifact.
 * Revision 04 (pass 03 CRITICAL 1 fold-in): binds challenger review to
 * plan slug + revision + base_commit (required, not optional) + content
 * SHA-256 hash. Stale ACCEPT paths reject.
 */
function rule17ClearedRequiresArtifact(plan, planPath) {
  const status = plan.frontmatter.status;
  if (!status) return [];
  if (!['challenger-cleared', 'operator-signoff', 'closed'].includes(status.trim())) return [];
  const planSlug = planPath.replace(/.*\//, '').replace(/\.md$/, '');
  const reviewsDir = join(REPO_ROOT, 'specs', 'reviews');
  if (!existsSync(reviewsDir)) {
    return [
      {
        rule: 'plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact',
        severity: 'red',
        message: 'specs/reviews/ directory missing; cannot verify challenger artifact',
        location: 'specs/reviews',
      },
    ];
  }
  let matches;
  try {
    matches = execSync(`git ls-files "specs/reviews/${planSlug}-codex-challenger-*.md"`, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    matches = [];
  }
  if (matches.length === 0) {
    return [
      {
        rule: 'plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact',
        severity: 'red',
        message: `Plan claims status "${status}" but no committed specs/reviews/${planSlug}-codex-challenger-*.md exists`,
        location: 'specs/reviews',
      },
    ];
  }
  const planRevision = String(plan.frontmatter.revision ?? '').trim();
  const planBaseCommit = String(plan.frontmatter.base_commit ?? '').trim();
  if (!planBaseCommit) {
    return [
      {
        rule: 'plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact',
        severity: 'red',
        message: `Plan claims status "${status}" but frontmatter lacks required base_commit field`,
        location: 'plan frontmatter',
      },
    ];
  }
  // Compute current plan content SHA-256 for freshness binding.
  let currentContentSha256 = null;
  try {
    currentContentSha256 = createHash('sha256')
      .update(readFileSync(planPath, 'utf8'))
      .digest('hex');
  } catch {
    // leave null; will fail through if challenger lacks hash field
  }
  // Find at least one challenger file with all freshness fields matching.
  let foundFresh = false;
  const rejections = [];
  for (const m of matches) {
    try {
      const contents = readFileSync(join(REPO_ROOT, m), 'utf8');
      const verdictMatch = contents.match(/^verdict:\s*([A-Z-]+)/m);
      if (!verdictMatch || !ACCEPT_CLASS_VERDICTS.has(verdictMatch[1])) {
        rejections.push(`${m}: verdict not accept-class (${verdictMatch?.[1] ?? 'missing'})`);
        continue;
      }
      const slugMatch = contents.match(/plan_slug:\s*([^\n]+)/);
      const revMatch = contents.match(/plan_revision:\s*(\d+)/);
      const baseCommitMatch = contents.match(/plan_base_commit:\s*([a-f0-9]+)/);
      const contentHashMatch = contents.match(/plan_content_sha256:\s*([a-f0-9]+)/);
      if (!slugMatch || !revMatch || !baseCommitMatch) {
        rejections.push(
          `${m}: missing reviewed_plan binding (slug / revision / base_commit all required)`,
        );
        continue;
      }
      if (slugMatch[1].trim() !== planSlug) {
        rejections.push(`${m}: plan_slug "${slugMatch[1].trim()}" != current "${planSlug}"`);
        continue;
      }
      if (revMatch[1].trim() !== planRevision) {
        rejections.push(`${m}: plan_revision "${revMatch[1].trim()}" != current "${planRevision}"`);
        continue;
      }
      if (!planBaseCommit.startsWith(baseCommitMatch[1].trim())) {
        rejections.push(`${m}: plan_base_commit mismatch`);
        continue;
      }
      if (currentContentSha256) {
        if (!contentHashMatch) {
          rejections.push(`${m}: missing plan_content_sha256 (required by rule #17 revision 04)`);
          continue;
        }
        if (contentHashMatch[1].trim() !== currentContentSha256) {
          rejections.push(`${m}: plan_content_sha256 mismatch (stale content)`);
          continue;
        }
      }
      foundFresh = true;
      break;
    } catch {
      // skip
    }
  }
  if (!foundFresh) {
    return [
      {
        rule: 'plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact',
        severity: 'red',
        message: `Plan claims status "${status}" but no committed challenger artifact matches plan identity (revision ${planRevision}, base_commit ${planBaseCommit.slice(0, 7)}). Rejections: ${rejections.join('; ')}`,
        location: 'specs/reviews',
      },
    ];
  }
  return [];
}

/**
 * Rule #18 — canonical-phase-set-maps-to-schema-vocabulary.
 * Catches P2.9 HIGH 1: plan declares workflow phase set with titles not
 * matching canonical vocabulary AND no explicit title→canonical map.
 */
function rule18CanonicalPhaseSet(plan) {
  // Trigger only if plan declares workflow phase set for a successor-
  // to-live surface.
  if (!/successor-to-live/i.test(plan.body)) return [];
  // Read canonical set from policy file.
  const policyPath = join(REPO_ROOT, 'scripts', 'policy', 'workflow-kind-policy.mjs');
  if (!existsSync(policyPath)) return [];
  const policyContent = readFileSync(policyPath, 'utf8');
  const canonicalMatch = policyContent.match(/canonicals:\s*\[([^\]]+)\]/);
  if (!canonicalMatch) return [];
  const canonicals = new Set(
    canonicalMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"`]/g, ''))
      .filter(Boolean),
  );
  // Look for phase set declarations: "4-phase" or "{Foo, Bar, Baz, Qux}" or "canonical phase set"
  const phaseSetRe =
    /(?:canonical phase set|[345]-phase spine|phase set of)[^\n]{0,150}?\{([^}]+)\}/gi;
  const findings = [];
  for (const match of plan.body.matchAll(phaseSetRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const phases = match[1]
      .split(',')
      .map((s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^a-z]/g, ''),
      )
      .filter(Boolean);
    const nonCanonical = phases.filter((p) => !canonicals.has(p));
    if (nonCanonical.length > 0) {
      // Check for explicit title→canonical map nearby.
      const chunk = plan.body.slice(match.index, match.index + 1500);
      const hasMap = /title.{0,5}→.{0,5}canonical|canonical.{0,20}map|spine_policy\.omits/.test(
        chunk,
      );
      if (!hasMap) {
        findings.push({
          rule: 'plan-lint.canonical-phase-set-maps-to-schema-vocabulary',
          severity: 'red',
          message: `Phase set {${phases.join(', ')}} includes non-canonical titles [${nonCanonical.join(', ')}]; canonical set is {${[...canonicals].join(', ')}}. No title→canonical map declared.`,
          location: `body offset ~${match.index}`,
        });
      }
    }
  }
  return findings;
}

/**
 * Rule #19 — verdict-determinism-includes-verification-passes-for-successor-to-live.
 * Catches P2.9 HIGH 4: plan's verdict rule missing verification-passes clause.
 */
function rule19VerdictDeterminism(plan) {
  if (!/successor-to-live/i.test(plan.body)) return [];
  // Look for verdict rule declarations.
  const verdictRe = /CLEAN (?:iff|if|when)([^\n.]+)/gi;
  const findings = [];
  for (const match of plan.body.matchAll(verdictRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const ruleText = match[1].toLowerCase();
    const hasVerification = /verification|verify.{0,10}pass|verify command/.test(ruleText);
    if (!hasVerification) {
      findings.push({
        rule: 'plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live',
        severity: 'red',
        message: `Successor-to-live verdict rule "CLEAN ${match[0].slice(0, 80)}..." missing verification-passes clause`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

/**
 * Rule #20 — verification-runtime-capability-assumed-without-substrate-slice.
 * Catches P2.9 HIGH 5: plan deliverable assumes runtime capability
 * (subprocess exec, markdown materialization) without substrate-widening slice.
 */
function rule20VerificationRuntime(plan) {
  const findings = [];
  // Look for "subprocess", "verification command rerun", "executes commands", etc.
  const runtimeAssumeRe =
    /(?:subprocess execution|verification[- ]command[- ](?:rerun|execution)|orchestrator-executed subprocess|execs? verification commands)/gi;
  for (const match of plan.body.matchAll(runtimeAssumeRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    // Check for substrate-widening slice reference nearby.
    const chunk = plan.body.slice(Math.max(0, match.index - 500), match.index + 1500);
    const hasSubstrate =
      /substrate.{0,20}slice|runtime widening|step kind.{0,20}landing|\bverification-exec\b|widens synthesis/.test(
        chunk,
      );
    if (!hasSubstrate) {
      findings.push({
        rule: 'plan-lint.verification-runtime-capability-assumed-without-substrate-slice',
        severity: 'red',
        message: `Plan assumes runtime capability "${match[0]}" without substrate-widening slice reference`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

/**
 * Rule #21 — artifact-materialization-uses-registered-schema.
 * Catches P2.9 HIGH 6: plan declares Markdown artifact via dispatch
 * without schema widening.
 */
function rule21ArtifactMaterialization(plan) {
  const findings = [];
  // Look for "Markdown-authored", "model-authored Markdown", ".md artifact", etc.
  const markdownArtifactRe =
    /(?:model[- ]authored (?:adversarial )?(?:Markdown|audit|review)|Markdown artifact materialization|report\.md|review\.report\.md|\.md primary)/gi;
  for (const match of plan.body.matchAll(markdownArtifactRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const chunk = plan.body.slice(Math.max(0, match.index - 500), match.index + 1500);
    // Check if dispatch step writes this, and whether schema widening is scheduled.
    const dispatchLinked = /dispatch[- ]step|dispatch[- ]shape|role=reviewer/.test(chunk);
    if (!dispatchLinked) continue;
    const hasSchemaSlice =
      /schema widening|src\/schemas\/|schema_file|registered schema|structured JSON/.test(chunk);
    if (!hasSchemaSlice) {
      findings.push({
        rule: 'plan-lint.artifact-materialization-uses-registered-schema',
        severity: 'red',
        message: `Plan declares model-authored Markdown-shaped dispatch artifact "${match[0]}" without registered-schema binding or schema-widening slice`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

/**
 * Rule #22 — blocked-invariant-must-resolve-before-arc-close.
 * Forbids status: closed or status: operator-signoff with unresolved
 * blocked invariants.
 */
function rule22BlockedMustResolve(plan) {
  const status = plan.frontmatter.status;
  if (!status) return [];
  if (!['operator-signoff', 'closed'].includes(status.trim())) return [];
  const findings = [];
  const blockedRe = /enforcement_layer:\s*blocked\b/g;
  for (const match of plan.body.matchAll(blockedRe)) {
    const kind = sectionKindAtOffset(plan.sections, match.index);
    if (kind !== 'normative') continue;
    const chunk = plan.body.slice(match.index, match.index + 1500);
    // Check for acceptance_evidence proving resolution.
    const hasResolutionEvidence =
      /acceptance_evidence:\s*[^\n]*(resolved|landed|closed|merged|enforced)/i.test(chunk);
    if (!hasResolutionEvidence) {
      findings.push({
        rule: 'plan-lint.blocked-invariant-must-resolve-before-arc-close',
        severity: 'red',
        message: `Plan status "${status}" with unresolved blocked invariant (no acceptance_evidence proving resolution)`,
        location: `body offset ~${match.index}`,
      });
    }
  }
  return findings;
}

// ----- MAIN -----

function runAllRules(plan, planPath) {
  // Legacy-plan exemption per ADR-0010 §Migration.
  if (isLegacyPlan(plan.frontmatter, planPath)) {
    return [];
  }
  return [
    ...rule1EvidenceCensus(plan, planPath),
    ...rule2TbdInAcceptance(plan),
    ...rule3TestPathExtension(plan),
    ...rule4StaleSymbolCitation(plan),
    ...rule5ArcCloseClaim(plan),
    ...rule6SignoffWhilePending(plan),
    ...rule7InvariantWithoutLayer(plan),
    ...rule8BlockedInvariantWithoutSlice(plan),
    ...rule9ContractShapedPayload(plan),
    ...rule10UnverifiedDecision(plan),
    ...rule11ArcTrajectory(plan, planPath),
    ...rule12LiveStateLedger(plan),
    ...rule13CliShape(plan),
    ...rule14ArtifactCardinality(plan),
    ...rule15StatusValid(plan),
    ...rule16UntrackedPostDraft(plan, planPath),
    ...rule17ClearedRequiresArtifact(plan, planPath),
    ...rule18CanonicalPhaseSet(plan),
    ...rule19VerdictDeterminism(plan),
    ...rule20VerificationRuntime(plan),
    ...rule21ArtifactMaterialization(plan),
    ...rule22BlockedMustResolve(plan),
  ];
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: plan-lint <path-to-plan.md>');
    process.exit(2);
  }
  const planPath = resolve(args[0]);
  if (!existsSync(planPath)) {
    console.error(`plan-lint: file not found: ${planPath}`);
    process.exit(2);
  }
  const contents = readFileSync(planPath, 'utf8');
  const plan = parsePlan(contents);
  const findings = runAllRules(plan, planPath);

  const reds = findings.filter((f) => f.severity === 'red');
  const yellows = findings.filter((f) => f.severity === 'yellow');

  if (findings.length === 0) {
    console.log(`plan-lint: ${planPath} — GREEN (no findings)`);
    process.exit(0);
  }

  console.log(`plan-lint: ${planPath} — ${reds.length} red, ${yellows.length} yellow`);
  console.log('');
  for (const f of findings) {
    console.log(`  ${f.severity.toUpperCase()} [${f.rule}]`);
    console.log(`    ${f.message}`);
    console.log(`    at: ${f.location}`);
    console.log('');
  }
  // Machine-readable JSONL on stderr
  for (const f of findings) {
    process.stderr.write(`${JSON.stringify(f)}\n`);
  }
  process.exit(reds.length > 0 ? 1 : 0);
}

main();
