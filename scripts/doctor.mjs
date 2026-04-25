#!/usr/bin/env node
/**
 * Slice 30 (DOG+2) — `slice:doctor`.
 *
 * Cold-operator briefing for opening the next slice. Prints the facts an
 * operator needs before the first commit in a new slice, sourced from the
 * same helpers the audit gate uses so the briefing cannot drift from the
 * gate. See `specs/plans/phase-1-close-revised.md` §Slice DOG+2.
 *
 * Sections printed:
 *   1. Where you are            (HEAD, branch, current_slice marker)
 *   2. Next slice               (numeric successor + plan pointer)
 *   3. Required lane (pick one) (6 literals imported from audit.mjs)
 *   4. Framing pair             (failure mode + acceptance evidence +
 *                                why-this-not-adjacent literals)
 *   5. Verify commands          (the gates that must pass before commit)
 *   6. Product ratchets         (inventory surfaces + audit-based ratchets)
 *   7. Files touched by HEAD    (hint — often the next slice continues here)
 *   8. Commit-message skeleton  (lane + framing + citation shape)
 *
 * The script is a briefing, not a gate. It exits 0 even when ratchets are
 * red — the gate for that is `npm run audit`.
 */

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FRAMING_LITERALS,
  LANES,
  checkAdversarialYieldLedger,
  checkPhaseAuthoritySemantics,
  checkPinnedRatchetFloor,
  checkProductRealityGateVisibility,
  checkStatusDocsCurrent,
  checkStatusEpochAlignment,
  checkTierOrphanClaims,
  extractCurrentSliceMarker,
} from './audit.mjs';
import { buildInventory } from './inventory.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const PLAN_PATH = 'specs/plans/phase-1-close-revised.md';
const AGENTS_MD_PATH = 'AGENTS.md';

function sh(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function shSafe(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

function header(title) {
  console.log('');
  console.log(`━━━ ${title} ━━━`);
}

function row(level, label, detail) {
  const mark = level === 'green' ? '✓' : level === 'yellow' ? '~' : '✗';
  console.log(`  ${mark} [${level.padEnd(6)}] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function readReadmeSliceMarker() {
  const text = shSafe('cat README.md');
  return extractCurrentSliceMarker(text);
}

function suggestNextSliceId(current) {
  if (!current) return null;
  const match = current.match(/^([0-9]+)([a-z]?)$/);
  if (!match) return null;
  const [, num, letter] = match;
  if (letter) {
    return `${num}${String.fromCharCode(letter.charCodeAt(0) + 1)}  (letter bump) OR ${Number(num) + 1}  (numeric bump)`;
  }
  return `${Number(num) + 1}  (numeric bump) OR ${num}a  (letter variant)`;
}

function main() {
  const head = shSafe('git rev-parse HEAD');
  const headShort = head ? head.slice(0, 7) : '(unknown)';
  const headSubject = shSafe('git log -1 --pretty=%s');
  const branch = shSafe('git rev-parse --abbrev-ref HEAD');
  const currentSlice = readReadmeSliceMarker();
  const suggested = suggestNextSliceId(currentSlice);

  console.log('circuit-next — slice:doctor');
  console.log(`generated ${new Date().toISOString()}`);

  header('1. Where you are');
  console.log(`  HEAD:           ${headShort}  ${headSubject}`);
  console.log(`  branch:         ${branch}`);
  console.log(`  current_slice:  ${currentSlice ?? '(no aligned marker)'}`);

  header('2. Next slice');
  console.log(`  Plan (authoritative):  ${PLAN_PATH}`);
  console.log(`  Methodology:           ${AGENTS_MD_PATH}  (lane + trajectory rules)`);
  console.log(`  Suggested next id:     ${suggested ?? '(cannot infer from current marker)'}`);
  console.log('  Note: SLICE_ID_PATTERN = ^[0-9]+[a-z]?$ — non-conforming ids need an ADR first.');

  header('3. Required lane (pick one)');
  for (const lane of LANES) {
    console.log(`  Lane: ${lane}`);
  }
  console.log('  (Commit body must contain `Lane: <one of the above>` verbatim.)');

  header('4. Framing pair (required in commit body)');
  console.log('  Framing literals (commit body must contain each line):');
  console.log(`    ${FRAMING_LITERALS.failureMode} <one-line description>`);
  console.log(`    ${FRAMING_LITERALS.acceptanceEvidence} <what proves it worked>`);
  console.log(
    `    ${FRAMING_LITERALS.whyThisNotAdjacent} <adversarial framing + arc-trajectory check>`,
  );

  header('5. Verification commands (all must pass before commit)');
  console.log('  npm run check    # tsc --noEmit');
  console.log('  npm run lint     # biome check .');
  console.log('  npm run test     # vitest run');
  console.log('  npm run verify   # all of the above');
  console.log('  npm run audit    # drift-visibility audit (this is the gate)');

  header('6. Product ratchets');
  console.log('  Inventory surfaces (scripts/inventory.mjs):');
  const inventory = buildInventory();
  for (const s of inventory.surfaces) {
    row(s.present ? 'green' : 'red', s.id, s.evidence_summary);
  }
  console.log('');
  console.log('  Audit-based ratchets (scripts/audit.mjs):');
  const auditRatchets = [
    ['status-epoch alignment', checkStatusEpochAlignment()],
    ['status docs current', checkStatusDocsCurrent()],
    ['pinned ratchet floor', checkPinnedRatchetFloor()],
    ['adversarial yield ledger', checkAdversarialYieldLedger()],
    ['TIER orphan-claim', checkTierOrphanClaims()],
    ['product reality gate', checkProductRealityGateVisibility()],
    ['phase authority semantics', checkPhaseAuthoritySemantics()],
  ];
  for (const [label, result] of auditRatchets) {
    row(result.level, label, result.detail);
  }

  header('7. Files touched by HEAD');
  const headFiles = shSafe('git show --name-only --pretty=format: HEAD')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  if (headFiles.length === 0) {
    console.log('  (none)');
  } else {
    for (const f of headFiles.slice(0, 15)) {
      console.log(`  ${f}`);
    }
    if (headFiles.length > 15) {
      console.log(`  … (+${headFiles.length - 15} more)`);
    }
  }

  header('8. Commit-message skeleton');
  const nextId =
    suggested && /^\d+$/.test(String(Number(currentSlice) + 1))
      ? String(Number(currentSlice) + 1)
      : '<id>';
  console.log(`  slice-${nextId}: <concise subject>`);
  console.log('');
  console.log('  Lane: <one of the 6 literals above>');
  console.log(`  ${FRAMING_LITERALS.failureMode} <what this slice addresses>`);
  console.log(`  ${FRAMING_LITERALS.acceptanceEvidence} <what proves it worked>`);
  console.log(`  ${FRAMING_LITERALS.whyThisNotAdjacent} <adversarial + trajectory framing>`);
  console.log(
    `  Authority: <citation — ${PLAN_PATH}, ADR-NNNN, specs/contracts/..., or AGENTS.md>`,
  );
  console.log('');
  console.log('  <body: what changed, why, evidence citations>');
  console.log('');
  console.log('(End of briefing. slice:doctor is a read-only hint; the gate is `npm run audit`.)');
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');

if (invokedDirectly) {
  main();
}

export { main, suggestNextSliceId };
