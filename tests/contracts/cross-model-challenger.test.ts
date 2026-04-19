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
// is tracked as v0.2 scope in specs/behavioral/cross-model-challenger.md §Evolution
// and as Slice 20 of the behavioral-arc-slices-14-16-codex.md fold-in schedule.
const ADR_REVIEW_MINIMAL_KEYS: string[] = ['reviewer', 'date'];
const ADR_REVIEW_VERDICT_KEYS: string[] = ['opening_verdict', 'closing_verdict'];

// Arc reviews (behavioral-arc-slices-14-16-codex.md, etc.) span multiple commits
// rather than a single contract or ADR. Minimal shape mirrors the ADR pair with
// arc-specific target/version fields. Established in Slice 17 alongside
// specs/reviews/behavioral-arc-slices-14-16-codex.md.
const ARC_REVIEW_REQUIRED_KEYS: string[] = [
  'arc_target',
  'arc_version',
  'reviewer_model',
  'review_kind',
  'review_date',
  'opening_verdict',
  'closing_verdict',
  'authored_by',
];

// Accepted canonical verdicts in contract-review records. Exact set
// membership with optional parenthetical suffix — the older `startsWith`
// check (Slice 16) admitted "ACCEPTANCE CERTIFIED" / "ACCEPTED_BY_CODEX"
// because "ACCEPT" was a prefix. Tightened per arc-review HIGH #3
// (Slice 18 fold-in). Observed parenthetical suffixes: "(after fold-in)",
// "(after fold-in + v0.2 scoping)", "(all objections folded into v0.1)".
const CONTRACT_VERDICT_CANONICALS = new Set<string>([
  'ACCEPT',
  'REJECT → incorporated → ACCEPT',
  'NEEDS ADJUSTMENT → incorporated → ACCEPT',
  'REJECT pending HIGH fold-ins',
  'ACCEPT-with-deferrals',
]);

// Optional parenthetical-suffix pattern, anchored to end of string after the
// canonical verdict. The suffix is a flat parenthesized note; nested parens
// are not permitted.
const VERDICT_SUFFIX_RE = /\s*\([^()]+\)\s*$/;

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

// Per-objection disposition parser (Slice 19 fold-in of arc-review HIGH #4).
// Joined regex so we can quickly test whether a body scope contains ANY
// disposition token; used in the inline path.
const ANY_DISPOSITION_RE =
  /\b(Incorporated|Scoped to v0\.2|Deferred to v0\.2|Rejected|FOLD IN|Fold-?in|folded (?:in|into)|deferred|Disposition:)\b/i;

// Dispositions-section heading patterns (observed across the committed review
// corpus):
//   `## Fold-in discipline`
//   `## Operator response (incorporated vs deferred)`
//   `## Operator response (incorporated / scoped / rejected)`
//   `## Objections and disposition`
//   `## Objection list + fold-in outcomes`
// The section scope is from the heading to the next `## ` heading or EOF.
const DISPOSITION_SECTION_HEADING_RE =
  /^##\s+(?:Fold-?in discipline|Operator response\b|Objections? and disposition|Objection list \+ fold-?in outcomes)/im;

// Objection-heading regex, covering both observed styles:
//   Contract reviews: `**1. HIGH — ...` (number before severity)
//   ADR reviews:      `**HIGH #1 — ...` (severity before number)
// Captured groups: [1] = contract number (or undef), [2] = severity (either
// style), [3] = ADR number (or undef).
const OBJECTION_HEADING_RE = /^\*\*(?:(\d+)\.\s+(HIGH|MED|LOW)\b|(HIGH|MED|LOW)\s+#(\d+)\b)/gm;

type Objection = { number: number; severity: 'HIGH' | 'MED' | 'LOW'; headingIndex: number };

function parseObjections(text: string): Objection[] {
  const objections: Objection[] = [];
  for (const m of text.matchAll(OBJECTION_HEADING_RE)) {
    const headingIndex = m.index ?? 0;
    if (m[1] && m[2]) {
      // Contract-style heading: **N. SEVERITY —
      objections.push({
        number: Number(m[1]),
        severity: m[2] as Objection['severity'],
        headingIndex,
      });
    } else if (m[3] && m[4]) {
      // ADR-style heading: **SEVERITY #N —
      objections.push({
        number: Number(m[4]),
        severity: m[3] as Objection['severity'],
        headingIndex,
      });
    }
  }
  return objections;
}

function findDispositionSection(text: string): string | null {
  const match = DISPOSITION_SECTION_HEADING_RE.exec(text);
  if (!match) return null;
  const start = match.index ?? 0;
  // Find the next top-level heading after this one.
  const rest = text.slice(start + (match[0]?.length ?? 0));
  const nextHeadingRel = rest.search(/^##\s+/m);
  const end = nextHeadingRel < 0 ? text.length : start + (match[0]?.length ?? 0) + nextHeadingRel;
  return text.slice(start, end);
}

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

function classifyReview(file: string): 'contract' | 'adr' | 'arc' | 'unknown' {
  const base = basename(file);
  if (/^adr-/.test(base)) return 'adr';
  if (/^(?:behavioral-arc|arc)-/.test(base)) return 'arc';
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
    // Broadened per arc-review MED #10: a well-meaning future edit could
    // rephrase "Never use" as "Do not use", "Avoid", "Must not use",
    // "is banned", "is forbidden", "is prohibited", "is not allowed". The
    // check splits on sentence boundaries and requires a sentence containing
    // both `codex:rescue` AND any explicit negation word.
    const singleLined = text.replace(/\s+/g, ' ');
    const sentences = singleLined.split(/[.!?]/);
    const NEGATION_RE = /\b(?:never|not|avoid|banned|forbidden|prohibited)\b/i;
    const negatedSentence = sentences.some((s) => /codex:rescue/i.test(s) && NEGATION_RE.test(s));
    expect(
      negatedSentence,
      'CLAUDE.md must explicitly tell agents not to use the codex:rescue subagent. Accepted negation words near `codex:rescue`: never, not, avoid, banned, forbidden, prohibited.',
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

  it('every review file is classifiable as contract-, ADR-, or arc-review', () => {
    for (const path of reviewFiles) {
      expect(
        classifyReview(path),
        `${path}: filename does not match contract-review, ADR-review, or arc-review pattern.`,
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

  // Arc-review LOW #11 fold-in — key presence is not enough; values must be
  // non-empty and `review_date` must parse as ISO (YYYY-MM-DD). Empty
  // `authored_by:` or a free-form "sometime in April" date field was
  // previously admissible; no longer.
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  it('every review frontmatter key has a non-empty value', () => {
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const [key, value] of fm.entries()) {
        expect(
          value.length > 0,
          `${path}: frontmatter key "${key}" is empty. Empty frontmatter values admit degraded reviews.`,
        ).toBe(true);
      }
    }
  });

  it('every review_date / date value matches ISO YYYY-MM-DD', () => {
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const dateValue = fm.get('review_date') ?? fm.get('date');
      if (!dateValue) continue;
      expect(
        ISO_DATE_RE.test(dateValue),
        `${path}: date value "${dateValue}" is not ISO (YYYY-MM-DD).`,
      ).toBe(true);
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

  it('every contract-review verdict is an exact canonical value (plus optional parenthetical suffix)', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'contract') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const verdict = fm.get('verdict') ?? '';
      const stripped = verdict.replace(VERDICT_SUFFIX_RE, '').trim();
      const ok = CONTRACT_VERDICT_CANONICALS.has(stripped);
      const canonicalsList = [...CONTRACT_VERDICT_CANONICALS].join('\n  ');
      expect(
        ok,
        `${path}: verdict "${verdict}" is not a canonical value.\nPermitted canonicals (with optional " (suffix)"):\n  ${canonicalsList}\nExact match on the canonical is required; the parenthetical suffix may annotate (e.g. "(after fold-in)") but cannot alter the verdict itself.`,
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

  it('every arc-review record carries the eight required frontmatter keys', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'arc') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of ARC_REVIEW_REQUIRED_KEYS) {
        expect(fm.has(key), `${path}: arc review missing "${key}".`).toBe(true);
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
// / folded in / deferred). Retained from Slice 16 as a file-level coarse
// guard; Slice 19 fold-in of arc-review HIGH #4 adds a second, per-objection
// guard below.
describe('cross-model-challenger — CHALLENGER-I4 fold-in discipline (file-level coarse)', () => {
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

// CHALLENGER-I4 per-objection parser (Slice 19 fold-in of arc-review HIGH #4).
// The file-level coarse check admitted a review with five HIGH objections and
// one unrelated "incorporated lessons" line. This block closes that gap by
// requiring, for every objection heading in a contract / ADR / arc review,
// a detected disposition either (a) inline in the objection body range or
// (b) in a dedicated disposition section that references the objection's
// number. Detection is pragmatic — the corpus is regular enough today that
// a stricter grammar can land at v0.2 alongside any further refactor of
// review-record conventions.
describe('cross-model-challenger — CHALLENGER-I4 per-objection disposition (arc fold-in HIGH #4)', () => {
  const reviewFiles = listReviewFiles();

  it('every objection in every review has a detected disposition', () => {
    const missing: Array<{ path: string; severity: string; number: number }> = [];
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const text = readFileSync(path, 'utf-8');
      const objections = parseObjections(text);
      if (objections.length === 0) continue;
      const dispositionSection = findDispositionSection(text);
      for (let i = 0; i < objections.length; i++) {
        const o = objections[i];
        if (!o) continue;
        // Scope for inline dispositions: from heading to next heading OR EOF.
        const next = objections[i + 1];
        const scopeEnd = next ? next.headingIndex : text.length;
        const scope = text.slice(o.headingIndex, scopeEnd);
        const inlineOk = ANY_DISPOSITION_RE.test(scope);
        if (inlineOk) continue;
        // Fall back to dispositions-section reference.
        if (dispositionSection) {
          const refRe = new RegExp(`(?<![0-9])#${o.number}(?![0-9])`);
          const sectionHasToken = ANY_DISPOSITION_RE.test(dispositionSection);
          const sectionMentionsNumber = refRe.test(dispositionSection);
          if (sectionHasToken && sectionMentionsNumber) continue;
        }
        missing.push({ path, severity: o.severity, number: o.number });
      }
    }
    const missingList = missing.map((m) => `  ${m.path}: ${m.severity} #${m.number}`).join('\n');
    expect(
      missing,
      `Objections without a detected disposition (CHALLENGER-I4 silent-ignore guard):\n${missingList}\n\nEach objection must either (a) carry an inline disposition (Incorporated / Scoped to v0.2 / Rejected / FOLD IN / deferred / Disposition:) within its heading-to-next-heading body, OR (b) be referenced by its number (#N) from within a dedicated disposition section (## Fold-in discipline / ## Operator response / ## Objections and disposition / ## Objection list + fold-in outcomes).`,
    ).toEqual([]);
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
