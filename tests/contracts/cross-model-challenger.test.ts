import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const CLAUDE_MD = resolve(REPO_ROOT, 'CLAUDE.md');
const TRACK_MD = resolve(REPO_ROOT, 'specs/behavioral/cross-model-challenger.md');
const CONTRACTS_DIR = resolve(REPO_ROOT, 'specs/contracts');
const REVIEWS_DIR = resolve(REPO_ROOT, 'specs/reviews');

// Contract-review record shape per specs/behavioral/cross-model-challenger.md
// §Planned test location + CHALLENGER-I3. The six already-committed contract
// review records (adapter, continuity, phase, run, selection, skill) carry
// this exact shape.
const CONTRACT_REVIEW_FRONTMATTER_KEYS: string[] = [
  'contract_target',
  'contract_version',
  'reviewer_model',
  'review_kind',
  'review_date',
  'verdict',
  'authored_by',
];

// ADR reviews (adr-0004-plane-split-codex.md, adr-0005-v2-plane-required-codex.md)
// currently carry a looser frontmatter shape with opening_verdict / closing_verdict
// + reviewer + date. v0.1 of the track codifies the CONTRACT review shape as
// authoritative; ADR review records are checked against a minimal shape so the
// test is honest about current state. Harmonization to the contract-review shape
// is tracked as v0.2 scope in specs/behavioral/cross-model-challenger.md §Evolution.
const ADR_REVIEW_MINIMAL_KEYS: string[] = ['reviewer', 'date'];
const ADR_REVIEW_VERDICT_KEYS: string[] = ['opening_verdict', 'closing_verdict'];

// Accepted verdict shapes in contract-review records. Prefix-match plus
// optional parenthetical suffix (observed examples include
// "(after fold-in)", "(after fold-in + v0.2 scoping)", "(all objections
// folded into v0.1)"). Free-form verdicts fail.
const CONTRACT_VERDICT_PREFIXES: string[] = [
  'ACCEPT',
  'REJECT → incorporated → ACCEPT',
  'NEEDS ADJUSTMENT → incorporated → ACCEPT',
  'REJECT pending HIGH fold-ins',
  'ACCEPT-with-deferrals',
];

// Body-level fold-in-discipline tokens per CHALLENGER-I4. A contract-review body
// must name at least one disposition verb; silent ignores are rejected by the
// track.
const FOLD_IN_DISPOSITION_TOKENS: RegExp[] = [
  /\bIncorporated\b/i,
  /\bScoped to v0\.2\b/i,
  /\bRejected\b/i,
  /\bfolded (?:in|into)\b/i,
  /\bdeferred\b/i,
];

type Frontmatter = Map<string, string>;

function parseFrontmatter(markdown: string): Frontmatter {
  const map: Frontmatter = new Map();
  if (!markdown.startsWith('---')) return map;
  const closeIdx = markdown.indexOf('\n---', 3);
  if (closeIdx < 0) return map;
  const fm = markdown.slice(3, closeIdx);
  let currentKey: string | null = null;
  for (const line of fm.split('\n')) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv?.[1] !== undefined) {
      currentKey = kv[1];
      map.set(currentKey, (kv[2] ?? '').trim());
    } else if (currentKey && line.trim().length > 0) {
      // Continuation line for a block value — append.
      const prev = map.get(currentKey) ?? '';
      map.set(currentKey, `${prev} ${line.trim()}`);
    }
  }
  return map;
}

function listReviewFiles(): string[] {
  const out = execSync('ls specs/reviews', { cwd: REPO_ROOT, encoding: 'utf-8' });
  return out
    .split('\n')
    .filter((name) => name.endsWith('-codex.md'))
    .map((name) => resolve(REVIEWS_DIR, name));
}

function listContractFiles(): string[] {
  const out = execSync('ls specs/contracts', { cwd: REPO_ROOT, encoding: 'utf-8' });
  return out
    .split('\n')
    .filter((name) => name.endsWith('.md'))
    .map((name) => resolve(CONTRACTS_DIR, name));
}

function classifyReview(file: string): 'contract' | 'adr' | 'unknown' {
  const base = basename(file);
  if (/^adr-/.test(base)) return 'adr';
  if (/-v\d+\.\d+-codex\.md$/.test(base)) return 'contract';
  return 'unknown';
}

// CHALLENGER-I5 — dispatch via /codex skill (pipes to codex exec), not the
// codex:rescue subagent. CLAUDE.md §Cross-model challenger protocol names
// the rule; the memory file is the discipline backstop. This test asserts
// the rule is visible inline in CLAUDE.md so a reader sees it during every
// session start.
describe('cross-model-challenger — CHALLENGER-I5 /codex dispatch documented', () => {
  it('CLAUDE.md references the /codex skill', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    expect(/`\/codex`/.test(text), 'CLAUDE.md must name the /codex skill explicitly.').toBe(true);
  });

  it('CLAUDE.md explicitly rejects the codex:rescue subagent', () => {
    const text = readFileSync(CLAUDE_MD, 'utf-8');
    // Tolerates line-wrapping between the negation and "codex:rescue" since
    // CLAUDE.md's 80-column prose often splits "Never\nuse the codex:rescue".
    const singleLined = text.replace(/\s+/g, ' ');
    expect(
      /never use\b[^.]*codex:rescue/i.test(singleLined),
      'CLAUDE.md must explicitly tell agents not to use the codex:rescue subagent.',
    ).toBe(true);
  });
});

// CHALLENGER-I3 — recorded, not conversational. Every review record lives at
// specs/reviews/<target>-v<version>-codex.md and carries standardized
// frontmatter. v0.1 asserts the CONTRACT review shape; ADR reviews assert a
// minimal shape with the verdict-pair variant. Harmonization to a unified
// shape is tracked as v0.2.
describe('cross-model-challenger — CHALLENGER-I3 review records are recorded artifacts', () => {
  const reviewFiles = listReviewFiles();

  it('specs/reviews/ contains at least one review record', () => {
    expect(reviewFiles.length).toBeGreaterThan(0);
  });

  it('every review file is classifiable as contract-review or ADR-review', () => {
    for (const path of reviewFiles) {
      expect(
        classifyReview(path),
        `${path}: filename does not match contract-review or ADR-review pattern.`,
      ).not.toBe('unknown');
    }
  });

  it('every contract-review record carries the seven standardized frontmatter keys', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'contract') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of CONTRACT_REVIEW_FRONTMATTER_KEYS) {
        expect(fm.has(key), `${path}: missing required key "${key}".`).toBe(true);
      }
    }
  });

  it('every contract-review frontmatter contract_target matches the filename stem', () => {
    // Filename: <target>-md-v<version>-codex.md. Frontmatter: contract_target.
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'contract') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const m = basename(path).match(/^([a-z0-9-]+)-md-v(\d+\.\d+)-codex\.md$/);
      expect(m, `${path}: filename does not match <target>-md-v<version>-codex.md`).not.toBeNull();
      if (!m) continue;
      expect(
        fm.get('contract_target'),
        `${path}: contract_target (${fm.get('contract_target')}) does not match filename stem (${m[1]})`,
      ).toBe(m[1]);
      expect(
        fm.get('contract_version'),
        `${path}: contract_version (${fm.get('contract_version')}) does not match filename version (${m[2]})`,
      ).toBe(m[2]);
    }
  });

  it('every contract-review verdict begins with one of the canonical prefixes', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'contract') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const verdict = fm.get('verdict') ?? '';
      const ok = CONTRACT_VERDICT_PREFIXES.some((prefix) => verdict.startsWith(prefix));
      expect(
        ok,
        `${path}: verdict "${verdict}" does not begin with any canonical prefix.\nPermitted prefixes:\n  ${CONTRACT_VERDICT_PREFIXES.join('\n  ')}\nAn optional parenthetical suffix (e.g. "(after fold-in)") is allowed after the prefix.`,
      ).toBe(true);
    }
  });

  it('every ADR-review record carries at least reviewer + date + opening + closing verdict', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'adr') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of ADR_REVIEW_MINIMAL_KEYS) {
        expect(fm.has(key), `${path}: ADR review missing "${key}".`).toBe(true);
      }
      for (const key of ADR_REVIEW_VERDICT_KEYS) {
        expect(fm.has(key), `${path}: ADR review missing "${key}".`).toBe(true);
      }
    }
  });
});

// CHALLENGER-I3 (contract side) — every contract file that carries a
// `codex_adversarial_review: <path>` frontmatter resolves to an existing
// review file, and that review file's contract_target matches.
describe('cross-model-challenger — CHALLENGER-I3 contract → review linkage', () => {
  const contractFiles = listContractFiles();

  it('every codex_adversarial_review path resolves to an existing file', () => {
    for (const contractPath of contractFiles) {
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const reviewPath = fm.get('codex_adversarial_review');
      if (!reviewPath) continue;
      const abs = resolve(REPO_ROOT, reviewPath);
      expect(
        existsSync(abs),
        `${contractPath}: codex_adversarial_review points at "${reviewPath}" which does not exist.`,
      ).toBe(true);
    }
  });

  it('every codex_adversarial_review resolves to a review whose contract_target matches the contract', () => {
    for (const contractPath of contractFiles) {
      const contractFm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const reviewRel = contractFm.get('codex_adversarial_review');
      if (!reviewRel) continue;
      const reviewAbs = resolve(REPO_ROOT, reviewRel);
      const reviewFm = parseFrontmatter(readFileSync(reviewAbs, 'utf-8'));
      const contractTarget = reviewFm.get('contract_target');
      // Extract the contract stem: specs/contracts/<stem>.md → <stem>.
      const stemMatch = basename(contractPath).match(/^([a-z0-9-]+)\.md$/);
      expect(stemMatch, `${contractPath}: filename does not match <stem>.md`).not.toBeNull();
      if (!stemMatch) continue;
      expect(
        contractTarget,
        `${contractPath}: codex_adversarial_review contract_target (${contractTarget}) does not match filename stem (${stemMatch[1]}).`,
      ).toBe(stemMatch[1]);
    }
  });
});

// CHALLENGER-I4 — fold-in discipline is explicit. Contract-review bodies must
// name at least one disposition verb (Incorporated / Scoped to v0.2 / Rejected
// / folded in / deferred). This is a disciplinary spot-check; full per-objection
// disposition parsing is tracked as v0.2 scope in the track.
describe('cross-model-challenger — CHALLENGER-I4 fold-in discipline (spot-check)', () => {
  const reviewFiles = listReviewFiles();

  it('every contract-review body contains at least one fold-in disposition token', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'contract') continue;
      const text = readFileSync(path, 'utf-8');
      const ok = FOLD_IN_DISPOSITION_TOKENS.some((re) => re.test(text));
      expect(
        ok,
        `${path}: body does not carry any fold-in disposition token (expected one of Incorporated / Scoped to v0.2 / Rejected / folded in / deferred). Silent ignores are rejected by CHALLENGER-I4.`,
      ).toBe(true);
    }
  });
});

// CHALLENGER-I1, I2, I6 — prose-documented. The track spec (prose) is the
// source of truth; the test asserts the track is present and declares the
// right identifier so removing or renaming it fails a named test.
describe('cross-model-challenger — track spec is present and well-identified', () => {
  it('specs/behavioral/cross-model-challenger.md exists', () => {
    expect(existsSync(TRACK_MD)).toBe(true);
  });

  it('track field declares cross-model-challenger', () => {
    const text = readFileSync(TRACK_MD, 'utf-8');
    expect(/^track:\s*cross-model-challenger\s*$/m.test(text)).toBe(true);
  });

  it('names the six invariants CHALLENGER-I1..I6', () => {
    const text = readFileSync(TRACK_MD, 'utf-8');
    for (let i = 1; i <= 6; i++) {
      expect(
        new RegExp(`CHALLENGER-I${i}\\b`).test(text),
        `Track spec missing invariant CHALLENGER-I${i}`,
      ).toBe(true);
    }
  });
});
