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

// Grandfathered-contract allowlist per Slice 24 fold-in of
// arc-phase-1-close HIGH #9 — restructured during the Slice 24 Codex
// challenger fold-in to bind contract *identity* (path + contract name +
// version + schema_source) rather than just basename, and to pin the
// resolvable source refs and scope-invariant ids. Codex HIGH #2 showed
// that basename-only binding lets a future edit keep the filename
// `step.md` while mutating `contract:`, `version:`, or `schema_source:`
// and still pass the allowlist. Codex MED #3 showed that
// `expires_on_contract_change: true` as a free-floating flag was
// declarative only; folding it into this record makes it operative by
// pinning `version: '0.1'` + the expected schema_source and failing the
// test the moment either mutates. Codex MED #4 + MED #5 add structured
// token parsing for `grandfathered_source_ref` + `grandfathered_scope_ids`
// so those fields resolve rather than sit as prose.
//
// Exit path (Codex MED #6 fold-in via the XOR rule below): a grandfathered
// contract leaves this allowlist by (a) landing a proper
// `specs/reviews/<stem>-md-v<version>-codex.md` review, (b) adding
// `codex_adversarial_review: <path>` frontmatter, and (c) removing the
// `codex_adversarial_review_grandfathered` field **and** its allowlist
// entry in the same slice. The XOR test forbids both fields coexisting.
type GrandfatheredRecord = {
  readonly path: string; // repo-relative path; exact-match key
  readonly contract: string;
  readonly version: string;
  readonly schema_source: string;
  // One or more `commit:<sha>` or `path:<relpath>` tokens. At least one
  // must appear in the contract's `grandfathered_source_ref` value and
  // each must resolve (`git cat-file -e <sha>^{commit}` for commits;
  // existsSync for paths). PROJECT_STATE.md prose references remain
  // allowed in the rationale body but are not counted as resolvable
  // source refs.
  readonly source_ref_tokens: readonly string[];
  // Invariant-id tokens that must appear in both the `grandfathered_scope_ids`
  // frontmatter field (exact set equality) AND as `**<id> —` headings in the
  // contract body (each token present).
  readonly scope_ids: readonly string[];
};

const GRANDFATHERED_CONTRACT_ALLOWLIST: readonly GrandfatheredRecord[] = [
  {
    path: 'specs/contracts/step.md',
    contract: 'step',
    version: '0.1',
    schema_source: 'src/schemas/step.ts',
    // commit:4b6688e is the Slice 2 commit that added the Gate.source
    // discriminated union to src/schemas/gate.ts and the STEP-I1..I7
    // invariants to specs/contracts/step.md. (The earlier Slice 21
    // frontmatter cited `commit f5a6241` in prose; that commit was
    // the Phase-0 close, not the MED-#7 closure. Slice 24 fold-in
    // corrects the anchor.)
    source_ref_tokens: ['commit:4b6688e'],
    scope_ids: ['STEP-I1', 'STEP-I2', 'STEP-I3', 'STEP-I4', 'STEP-I5', 'STEP-I6', 'STEP-I7'],
  },
  // workflow.md v0.1 grandfather exited in Slice 27 (workflow.md v0.2).
  // The v0.2 bump promoted WF-I1..I7 from static-anchor (via this
  // allowlist) to test-enforced via per-invariant titled negative tests
  // in tests/contracts/schema-parity.test.ts, added WF-I8 + WF-I9
  // (terminal reachability + no dead steps) for dogfood-run-0
  // structural safety, and bound the contract to the proper review
  // record at specs/reviews/workflow-md-v0.2-codex.md. The XOR test
  // below enforces that workflow.md now carries `codex_adversarial_review:`
  // and no longer carries `codex_adversarial_review_grandfathered:`.
];

const GRANDFATHERED_ALLOWLIST_BASENAMES = new Set<string>(
  GRANDFATHERED_CONTRACT_ALLOWLIST.map((record) => basename(record.path)),
);

// Canonical contract-review file pattern per specs/behavioral/cross-model-
// challenger.md §Planned test location (Slice 24 Codex HIGH #1 fold-in).
// Forward-link path must match this exactly; without it, a contract
// could point its `codex_adversarial_review` at any existing file —
// including the contract itself, an ADR review, or an arc review — and
// pass the linkage gate. Regex anchors on `specs/reviews/` prefix and
// the `<stem>-md-v<major>.<minor>-codex.md` canonical form.
const CONTRACT_REVIEW_PATH_PATTERN = /^specs\/reviews\/[a-z0-9-]+-md-v\d+\.\d+-codex\.md$/;

// Source-ref token pattern. Must be `commit:<7-40 hex>` or `path:<any non-
// whitespace>` — separated by whitespace in the frontmatter value. The
// `grandfathered_source_ref` parser below splits on whitespace and
// classifies tokens by prefix.
const SOURCE_REF_COMMIT_RE = /^commit:([0-9a-f]{7,40})$/;
const SOURCE_REF_PATH_RE = /^path:(\S+)$/;

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

// Base required keys on every classified review record (contract / ADR / arc)
// per Slice 20 ADR-review normalization. The earlier ADR "looser shape"
// (reviewer / date / opening_verdict / closing_verdict, no review_target) was
// the divergence arc-review MED #8 called out; Slice 20 folded the two ADR
// review files onto this unified base.
const REVIEW_BASE_REQUIRED_KEYS: string[] = [
  'reviewer_model',
  'review_kind',
  'review_date',
  'verdict',
  'authored_by',
];

// ADR-specific additional required keys layered on top of the base. ADR reviews
// document a verdict chain (opening + closing) in addition to the canonical
// `verdict` so the progression is inspectable; the `review_target` names the
// ADR being reviewed.
const ADR_REVIEW_ADDITIONAL_KEYS: string[] = [
  'review_target',
  'target_kind',
  'opening_verdict',
  'closing_verdict',
];

// Arc-review extras layered on top of the unified base. Arc reviews span
// multiple commits (a methodology-adherence retrospective over an
// implementation arc), so they carry both the unified base keys (including
// `verdict` for the canonical single-field form) and opening/closing
// verdicts for the multi-stage verdict chain. The `review_target` + `target_kind`
// keys align with the ADR-review shape per Slice 20 normalization.
//
// Slice 25 AR-M5 fold-in — arc reviews MUST also carry machine-readable
// scope disclosure: `commands_run` (list of shell commands/tools used),
// `opened_scope` (list of file paths/globs read end-to-end), and
// `skipped_scope` (list of paths/globs NOT opened this pass, with rationale
// or `none`). Frontmatter-level, not prose-only, so a follow-up pass can
// grep prior reviews for disclosed scope without re-parsing prose.
const ARC_REVIEW_ADDITIONAL_KEYS: string[] = [
  'review_target',
  'target_kind',
  'arc_target',
  'arc_version',
  'opening_verdict',
  'closing_verdict',
  'commands_run',
  'opened_scope',
  'skipped_scope',
];

// Slice 47-prep — phase-review extras. Phase comprehensive reviews are a
// fourth recognized review kind, distinct from contract / ADR / arc:
//   - Contract reviews are scoped to a single specs/contracts/<target>.md.
//   - ADR reviews are scoped to a single specs/adrs/ADR-NNNN-<slug>.md.
//   - Arc reviews are scoped to a sequence of slices forming an arc (3+ slices).
//   - Phase reviews are scoped to a phase or phase-to-date sweep (broader than
//     any arc; commission as a fresh-context audit independent of arc-close
//     ceremony, e.g. when an operator wants a comprehensive sweep before a
//     phase-close gate or to verify accumulated state has not drifted).
//
// First two phase-review records: phase-2-to-date-comprehensive-{claude,codex}.md
// landed in Slice 47-prep. Track v0.1 amended in same slice to recognize the
// new kind in §Planned test location.
//
// Carries the same machine-readable scope-disclosure discipline as arc reviews
// (commands_run / opened_scope / skipped_scope) — the AR-M5 reasoning applies
// equally: a phase comprehensive review that opens nothing is degraded.
const PHASE_REVIEW_ADDITIONAL_KEYS: string[] = [
  'review_target',
  'target_kind',
  'phase_target',
  'phase_version',
  'opening_verdict',
  'closing_verdict',
  'commands_run',
  'opened_scope',
  'skipped_scope',
];

// Slice 25 Codex challenger HIGH 5 fold-in — placeholder blocklist. A value
// that matches any of these (case-insensitive, full-string after trim) is
// rejected as a degraded scope disclosure. `skipped_scope: none` is the
// exception: it is the canonical "I did open everything I intended to open"
// signal when an arc review genuinely has zero skipped scope. Enumerated
// separately (SKIPPED_SCOPE_EMPTY_TOKENS) rather than excluded from the
// blocklist by string overlap.
const SCOPE_PLACEHOLDER_BLOCKLIST = new Set<string>([
  'n/a',
  'na',
  'see body',
  'not recorded',
  'tbd',
  'pending',
]);

const SKIPPED_SCOPE_EMPTY_TOKENS = new Set<string>(['none']);

// Slice 25 Q4 council preload + Codex challenger MED 11 fold-in — optional
// normalized review-record fields. v0.1 recognizes the fields but does NOT
// make them required. Slice 32 promotes to required + backfills existing
// records. AR-L2 reopen-trigger watch is NOT retired by Slice 25; watch
// remains active until Slice 32 lands (MED 11 disposition).
const AUTHORSHIP_ROLE_ENUM = new Set<string>(['challenger', 'author', 'auditor', 'operator+agent']);
// Pattern rather than enum — model ids evolve faster than a committed allowlist
// can track. Literal ID-shape requirement: non-empty, no whitespace at edges.
const REVIEWER_MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._+\-: ]*[A-Za-z0-9]$/;

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

function classifyReview(file: string): 'contract' | 'adr' | 'arc' | 'phase' | 'unknown' {
  const base = basename(file);
  if (/^adr-/.test(base)) return 'adr';
  if (/^(?:behavioral-arc|arc)-/.test(base)) return 'arc';
  // Contract-review pattern is checked BEFORE the `phase-` prefix so that the
  // existing `specs/reviews/phase-md-v0.1-codex.md` (the contract review for
  // `specs/contracts/phase.md`) classifies as 'contract' rather than 'phase'.
  // Per Slice 47-prep META fold-in: phase comprehensive reviews carry no
  // `-md-v<X.Y>-codex.md` suffix, so the order is unambiguous.
  if (/-v\d+\.\d+-codex\.md$/.test(base)) return 'contract';
  if (/^phase-/.test(base)) return 'phase';
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

  // Slice 20 fold-in of arc-review MED #8 — ADR review frontmatter was
  // normalized to the unified base shape plus ADR-specific extras
  // (review_target + target_kind + opening_verdict + closing_verdict).
  // The earlier per-file divergence (adr-0004 used doc/subject/reviewer/date;
  // adr-0005 used review/reviewer/date/status) was consolidated in this
  // slice. Contract reviews retain their contract_target/contract_version
  // fields because those are dimensionally different (the contract-kind
  // review does not carry opening/closing verdict chains in the
  // frontmatter).
  it('every classified review carries the unified base frontmatter keys', () => {
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of REVIEW_BASE_REQUIRED_KEYS) {
        expect(fm.has(key), `${path}: base review key "${key}" missing (kind=${kind}).`).toBe(true);
      }
    }
  });

  it('every ADR-review record carries base + ADR-specific keys with target_kind=adr', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'adr') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of ADR_REVIEW_ADDITIONAL_KEYS) {
        expect(fm.has(key), `${path}: ADR review missing "${key}" (Slice 20 unified shape).`).toBe(
          true,
        );
      }
      expect(
        fm.get('target_kind'),
        `${path}: ADR review target_kind must equal 'adr' (got "${fm.get('target_kind')}").`,
      ).toBe('adr');
    }
  });

  it('every arc-review record carries base + arc-specific keys with target_kind=arc', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'arc') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of ARC_REVIEW_ADDITIONAL_KEYS) {
        expect(fm.has(key), `${path}: arc review missing "${key}".`).toBe(true);
      }
      expect(
        fm.get('target_kind'),
        `${path}: arc review target_kind must equal 'arc' (got "${fm.get('target_kind')}").`,
      ).toBe('arc');
    }
  });

  // Slice 47-prep — phase comprehensive reviews carry the unified base
  // shape plus phase-specific extras (phase_target / phase_version) and
  // the same machine-readable scope-disclosure discipline as arc reviews
  // (commands_run / opened_scope / skipped_scope per AR-M5 reasoning).
  it('every phase-review record carries base + phase-specific keys with target_kind=phase', () => {
    for (const path of reviewFiles) {
      if (classifyReview(path) !== 'phase') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of PHASE_REVIEW_ADDITIONAL_KEYS) {
        expect(fm.has(key), `${path}: phase review missing "${key}".`).toBe(true);
      }
      expect(
        fm.get('target_kind'),
        `${path}: phase review target_kind must equal 'phase' (got "${fm.get('target_kind')}").`,
      ).toBe('phase');
    }
  });

  // Slice 25 AR-M5 + Codex challenger HIGH 5 fold-in — scope-disclosure
  // fields must be non-empty AND must not be placeholder prose. A degraded
  // `commands_run: see body` defeats the point of promoting scope to
  // frontmatter. Slice 47-prep extends this discipline to phase reviews —
  // a phase comprehensive review that opens nothing is equally degraded.
  it('arc-review and phase-review commands_run and opened_scope are non-placeholder, list-shaped', () => {
    const violations: string[] = [];
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind !== 'arc' && kind !== 'phase') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      for (const key of ['commands_run', 'opened_scope'] as const) {
        const raw = (fm.get(key) ?? '').trim();
        if (!raw) {
          violations.push(`${path}: ${key} is empty`);
          continue;
        }
        if (SCOPE_PLACEHOLDER_BLOCKLIST.has(raw.toLowerCase())) {
          violations.push(`${path}: ${key} is placeholder "${raw}"`);
          continue;
        }
        // Require list-shape: parseFrontmatter concatenates YAML list items
        // into `- item1 - item2`. Require at least one `- ` separator after
        // a leading dash, OR at minimum that the value begins with `-`.
        if (!/^-\s+\S/.test(raw)) {
          violations.push(
            `${path}: ${key} does not parse as a YAML list (expected \`${key}:\\n  - item\\n  - item\` form, got "${raw.slice(0, 60)}")`,
          );
        }
      }
    }
    expect(violations, `AR-M5 scope disclosure violations:\n${violations.join('\n')}`).toEqual([]);
  });

  // skipped_scope allows the literal "none" sentinel for genuine zero-skip
  // reviews (accepted exception to the placeholder blocklist). All other
  // values follow the same list-shape + non-placeholder rule. Slice 47-prep
  // extends to phase reviews — same scope-disclosure discipline applies.
  it('arc-review and phase-review skipped_scope is list-shaped OR the "none" sentinel', () => {
    const violations: string[] = [];
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind !== 'arc' && kind !== 'phase') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const raw = (fm.get('skipped_scope') ?? '').trim();
      if (!raw) {
        violations.push(`${path}: skipped_scope is empty`);
        continue;
      }
      const normalized = raw.toLowerCase();
      // "none" sentinel accepted in two forms: bare `skipped_scope: none` OR
      // single-item list `- none`.
      if (SKIPPED_SCOPE_EMPTY_TOKENS.has(normalized) || /^-\s+none\s*$/i.test(raw)) continue;
      // List shape required.
      if (!/^-\s+\S/.test(raw)) {
        violations.push(
          `${path}: skipped_scope does not parse as a list or "none" sentinel (got "${raw.slice(0, 60)}")`,
        );
      }
      // Explicit placeholder rejection (defense in depth; the list-shape
      // check mostly catches these already).
      if (
        SCOPE_PLACEHOLDER_BLOCKLIST.has(normalized) ||
        SCOPE_PLACEHOLDER_BLOCKLIST.has(normalized.replace(/^-\s+/, ''))
      ) {
        violations.push(`${path}: skipped_scope is placeholder "${raw}"`);
      }
    }
    expect(violations, `AR-M5 skipped_scope violations:\n${violations.join('\n')}`).toEqual([]);
  });

  // Slice 25 Q4 council preload + MED 11 fold-in — optional review-record
  // fields. Presence is NOT required (Slice 32 makes them required); BUT
  // when present, the values are validated: authorship_role against a closed
  // enum, reviewer_model_id against a non-empty pattern. AR-L2 reopen-trigger
  // watch remains active.
  it('optional reviewer_model_id (when present) matches the pattern', () => {
    const violations: string[] = [];
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const raw = fm.get('reviewer_model_id');
      if (raw === undefined) continue;
      if (!REVIEWER_MODEL_ID_RE.test(raw.trim())) {
        violations.push(
          `${path}: reviewer_model_id "${raw}" does not match ${REVIEWER_MODEL_ID_RE}`,
        );
      }
    }
    expect(violations, `reviewer_model_id violations:\n${violations.join('\n')}`).toEqual([]);
  });

  it('optional authorship_role (when present) is one of the enum values', () => {
    const violations: string[] = [];
    for (const path of reviewFiles) {
      const kind = classifyReview(path);
      if (kind === 'unknown') continue;
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      const raw = fm.get('authorship_role');
      if (raw === undefined) continue;
      if (!AUTHORSHIP_ROLE_ENUM.has(raw.trim())) {
        violations.push(
          `${path}: authorship_role "${raw}" is not one of ${[...AUTHORSHIP_ROLE_ENUM].join(' / ')}`,
        );
      }
    }
    expect(violations, `authorship_role violations:\n${violations.join('\n')}`).toEqual([]);
  });
});

// CHALLENGER-I3 (contract side) — every contract file that carries a
// `codex_adversarial_review: <path>` frontmatter resolves to an existing
// review file, and that review file's contract_target matches. Slice 21
// fold-in of arc-review HIGH #2 strengthens this: every contract MUST
// carry EITHER the forward linkage OR an explicit
// `codex_adversarial_review_grandfathered: <rationale>` declaration.
// The grandfathered path exists for contracts authored before the
// specs/reviews/ convention (step.md in Slice 2, workflow.md as skeleton);
// a bare contract without either field now fails.
describe('cross-model-challenger — CHALLENGER-I3 contract → review linkage (HIGH #2 fold-in)', () => {
  const contractFiles = listContractFiles();
  // Contract files the test should skip: domain glossary, artifacts index,
  // and any non-contract auxiliary file that happens to live here.
  const CONTRACT_LINKAGE_EXEMPT = new Set<string>([]);

  it('every contract either links a review or declares a grandfathered rationale', () => {
    const missing: Array<{ contractPath: string }> = [];
    for (const contractPath of contractFiles) {
      const base = basename(contractPath);
      if (CONTRACT_LINKAGE_EXEMPT.has(base)) continue;
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const hasLink = fm.has('codex_adversarial_review');
      const hasGrandfathered = fm.has('codex_adversarial_review_grandfathered');
      if (!hasLink && !hasGrandfathered) missing.push({ contractPath });
    }
    expect(
      missing,
      `Contracts missing both codex_adversarial_review and codex_adversarial_review_grandfathered:\n${missing
        .map((m) => `  ${m.contractPath}`)
        .join(
          '\n',
        )}\n\nEvery contract must either link a specs/reviews/<target>-v<version>-codex.md file OR declare an explicit grandfathered rationale (for contracts authored before the specs/reviews/ convention).`,
    ).toEqual([]);
  });

  it('every grandfathered rationale is a non-empty prose string', () => {
    for (const contractPath of contractFiles) {
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const rationale = fm.get('codex_adversarial_review_grandfathered');
      if (rationale === undefined) continue;
      expect(
        rationale.trim().length,
        `${contractPath}: codex_adversarial_review_grandfathered must be a non-empty prose rationale.`,
      ).toBeGreaterThan(20);
    }
  });

  // Slice 24 HIGH #9 fold-in + Slice 24 Codex-fold-in (HIGH #2 + MED #3 + MED #4 +
  // MED #5 + MED #6 + MED #8) — allowlist is a typed record, grandfathered
  // identity is bound to contract/version/schema_source exactness, source refs
  // must resolve, scope ids must match the allowlist and appear in the body,
  // and forward-link + grandfathered cannot coexist.

  it('only contracts in GRANDFATHERED_CONTRACT_ALLOWLIST may carry codex_adversarial_review_grandfathered (basename gate)', () => {
    const offenders: Array<{ contractPath: string; base: string }> = [];
    for (const contractPath of contractFiles) {
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      if (!fm.has('codex_adversarial_review_grandfathered')) continue;
      const base = basename(contractPath);
      if (!GRANDFATHERED_ALLOWLIST_BASENAMES.has(base)) offenders.push({ contractPath, base });
    }
    expect(
      offenders,
      `Contracts carrying codex_adversarial_review_grandfathered outside the allowlist:\n${offenders
        .map((o) => `  ${o.contractPath} (base: ${o.base})`)
        .join(
          '\n',
        )}\n\nAllowlist basenames are exactly {${[...GRANDFATHERED_ALLOWLIST_BASENAMES].join(', ')}}. New contracts must use the codex_adversarial_review forward link to a specs/reviews/<stem>-md-v<version>-codex.md file. Per arc-phase-1-close-codex.md §HIGH-9 (Slice 24 + Slice 24 Codex HIGH #2 fold-in).`,
    ).toEqual([]);
  });

  it('grandfathered contracts bind to their allowlist record by contract + version + schema_source (identity gate, HIGH #2)', () => {
    const mismatches: Array<{ contractPath: string; expected: string; actual: string }> = [];
    for (const record of GRANDFATHERED_CONTRACT_ALLOWLIST) {
      const abs = resolve(REPO_ROOT, record.path);
      if (!existsSync(abs)) {
        mismatches.push({
          contractPath: record.path,
          expected: 'file exists',
          actual: 'file missing',
        });
        continue;
      }
      const fm = parseFrontmatter(readFileSync(abs, 'utf-8'));
      for (const key of ['contract', 'version', 'schema_source'] as const) {
        const actual = fm.get(key)?.trim() ?? '<missing>';
        const expected = record[key];
        if (actual !== expected) {
          mismatches.push({
            contractPath: record.path,
            expected: `${key}=${expected}`,
            actual: `${key}=${actual}`,
          });
        }
      }
    }
    expect(
      mismatches,
      `Grandfathered contract identity mismatches:\n${mismatches
        .map((m) => `  ${m.contractPath}: expected ${m.expected}, got ${m.actual}`)
        .join(
          '\n',
        )}\n\nThe allowlist binds contract identity, not just filename. Any change to contract/version/schema_source re-opens the grandfather and requires a proper specs/reviews/<stem>-md-v<version>-codex.md record. Per Slice 24 Codex HIGH #2 + MED #3 fold-in.`,
    ).toEqual([]);
  });

  it('grandfathered source_ref carries every allowlist token and each token resolves (source gate, MED #4)', () => {
    const problems: Array<{ contractPath: string; detail: string }> = [];
    for (const record of GRANDFATHERED_CONTRACT_ALLOWLIST) {
      const abs = resolve(REPO_ROOT, record.path);
      if (!existsSync(abs)) continue; // reported by the identity test above
      const fm = parseFrontmatter(readFileSync(abs, 'utf-8'));
      const rawValue = fm.get('grandfathered_source_ref');
      if (rawValue === undefined) {
        problems.push({ contractPath: record.path, detail: 'grandfathered_source_ref missing' });
        continue;
      }
      const presentTokens = rawValue.split(/\s+/).filter(Boolean);
      for (const expected of record.source_ref_tokens) {
        if (!presentTokens.includes(expected)) {
          problems.push({
            contractPath: record.path,
            detail: `expected source_ref token "${expected}" not present in value "${rawValue.trim()}"`,
          });
        }
      }
      for (const token of presentTokens) {
        const commitMatch = SOURCE_REF_COMMIT_RE.exec(token);
        if (commitMatch) {
          const sha = commitMatch[1];
          try {
            execSync(`git cat-file -e ${sha}^{commit}`, { cwd: REPO_ROOT, stdio: 'ignore' });
          } catch {
            problems.push({
              contractPath: record.path,
              detail: `source_ref token "${token}" does not resolve to a reachable commit`,
            });
          }
          continue;
        }
        const pathMatch = SOURCE_REF_PATH_RE.exec(token);
        if (pathMatch) {
          const relPath = pathMatch[1];
          if (relPath === undefined || !existsSync(resolve(REPO_ROOT, relPath))) {
            problems.push({
              contractPath: record.path,
              detail: `source_ref token "${token}" does not resolve to an existing path`,
            });
          }
        }
        // Tokens that are neither commit: nor path: are ignored as free-form
        // prose rationale (e.g., PROJECT_STATE.md references). This is
        // intentional — Codex MED #4 permitted supplemental non-resolvable
        // notes so long as at least one resolvable token was pinned.
      }
    }
    expect(
      problems,
      `Grandfathered source_ref problems:\n${problems
        .map((p) => `  ${p.contractPath}: ${p.detail}`)
        .join(
          '\n',
        )}\n\nEvery allowlist-required source_ref token (commit:<sha> or path:<relpath>) must appear in the frontmatter value and must resolve. Per Slice 24 Codex MED #4 fold-in.`,
    ).toEqual([]);
  });

  it('grandfathered_scope_ids match the allowlist set and each id appears as a body heading (scope gate, MED #5)', () => {
    const problems: Array<{ contractPath: string; detail: string }> = [];
    for (const record of GRANDFATHERED_CONTRACT_ALLOWLIST) {
      const abs = resolve(REPO_ROOT, record.path);
      if (!existsSync(abs)) continue;
      const body = readFileSync(abs, 'utf-8');
      const fm = parseFrontmatter(body);
      const rawIds = fm.get('grandfathered_scope_ids');
      if (rawIds === undefined) {
        problems.push({ contractPath: record.path, detail: 'grandfathered_scope_ids missing' });
        continue;
      }
      const declared = rawIds.split(/\s+/).filter(Boolean);
      const expected = [...record.scope_ids];
      const declaredSet = new Set(declared);
      const expectedSet = new Set(expected);
      if (
        declared.length !== expected.length ||
        [...expectedSet].some((id) => !declaredSet.has(id)) ||
        [...declaredSet].some((id) => !expectedSet.has(id))
      ) {
        problems.push({
          contractPath: record.path,
          detail: `scope_ids set mismatch — expected {${expected.join(', ')}}, got {${declared.join(', ')}}`,
        });
      }
      // Each scope id must appear as a numbered invariant heading in the contract body.
      // Pattern: `- **<ID> —` (after the frontmatter block). Tolerate either the em-dash
      // or a regular dash; the committed contracts use em-dash.
      for (const id of declared) {
        const re = new RegExp(`^-\\s+\\*\\*${id.replace(/-/g, '\\-')}\\s+[—-]`, 'm');
        if (!re.test(body)) {
          problems.push({
            contractPath: record.path,
            detail: `scope id "${id}" declared but not present as a `.concat(
              '`- **',
              id,
              ' —` heading in contract body',
            ),
          });
        }
      }
    }
    expect(
      problems,
      `Grandfathered scope_ids problems:\n${problems
        .map((p) => `  ${p.contractPath}: ${p.detail}`)
        .join(
          '\n',
        )}\n\nscope_ids must (a) equal the allowlist set exactly and (b) each appear as a numbered invariant heading in the contract body. Per Slice 24 Codex MED #5 fold-in.`,
    ).toEqual([]);
  });

  it('every grandfathered contract declares expires_on_contract_change: true (literal)', () => {
    const violations: Array<{ contractPath: string; detail: string }> = [];
    for (const record of GRANDFATHERED_CONTRACT_ALLOWLIST) {
      const abs = resolve(REPO_ROOT, record.path);
      if (!existsSync(abs)) continue;
      const fm = parseFrontmatter(readFileSync(abs, 'utf-8'));
      const raw = fm.get('expires_on_contract_change');
      if (raw === undefined) {
        violations.push({ contractPath: record.path, detail: 'missing' });
      } else if (raw.trim() !== 'true') {
        violations.push({
          contractPath: record.path,
          detail: `expected literal "true", got "${raw.trim()}"`,
        });
      }
    }
    expect(
      violations,
      `expires_on_contract_change violations:\n${violations
        .map((v) => `  ${v.contractPath}: ${v.detail}`)
        .join(
          '\n',
        )}\n\nThe literal string "true" is the tripwire. With the HIGH #2 identity gate above also active, any contract-version or schema_source change re-opens the grandfather — making this field operative, not declarative. Per Slice 24 Codex MED #3 fold-in.`,
    ).toEqual([]);
  });

  it('no contract carries both codex_adversarial_review and codex_adversarial_review_grandfathered (XOR, MED #6)', () => {
    const dualDeclarers: Array<{ contractPath: string }> = [];
    for (const contractPath of contractFiles) {
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const hasLink = fm.has('codex_adversarial_review');
      const hasGrandfathered = fm.has('codex_adversarial_review_grandfathered');
      if (hasLink && hasGrandfathered) dualDeclarers.push({ contractPath });
    }
    expect(
      dualDeclarers,
      `Contracts carrying BOTH codex_adversarial_review and codex_adversarial_review_grandfathered:\n${dualDeclarers
        .map((d) => `  ${d.contractPath}`)
        .join(
          '\n',
        )}\n\nExactly one of the two forms is allowed. Exit path from grandfathering is: land a proper review, add codex_adversarial_review, remove codex_adversarial_review_grandfathered AND the allowlist record in the same slice. Per Slice 24 Codex MED #6 fold-in.`,
    ).toEqual([]);
  });

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

  // Slice 24 Codex HIGH #1 fold-in — forward-link path MUST match the
  // canonical contract-review filename pattern. Without this, the link
  // could point at the contract itself, an arc review, an ADR review, or
  // any other existing file and pass both the existence and contract_target
  // tests below. Anchoring on `specs/reviews/<stem>-md-v<major>.<minor>-codex.md`
  // is the same shape the track spec enumerates at
  // specs/behavioral/cross-model-challenger.md §Planned test location.
  it('every codex_adversarial_review path matches the canonical contract-review filename pattern (HIGH #1)', () => {
    const offenders: Array<{ contractPath: string; reviewPath: string }> = [];
    for (const contractPath of contractFiles) {
      const fm = parseFrontmatter(readFileSync(contractPath, 'utf-8'));
      const reviewPath = fm.get('codex_adversarial_review');
      if (!reviewPath) continue;
      if (!CONTRACT_REVIEW_PATH_PATTERN.test(reviewPath)) {
        offenders.push({ contractPath, reviewPath });
      }
    }
    expect(
      offenders,
      `Contracts with codex_adversarial_review pointing outside the canonical path shape:\n${offenders
        .map((o) => `  ${o.contractPath} → ${o.reviewPath}`)
        .join(
          '\n',
        )}\n\nPath must match ${CONTRACT_REVIEW_PATH_PATTERN} — i.e., specs/reviews/<stem>-md-v<major>.<minor>-codex.md. Per Slice 24 Codex HIGH #1 fold-in.`,
    ).toEqual([]);
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

  // Reverse linkage per arc-review HIGH #2 — every contract-review file's
  // `contract_target` must point at an existing specs/contracts/<target>.md
  // file. Orphan review files (review committed without the companion
  // contract) now fail.
  it('every contract-review file resolves back to an existing contract', () => {
    const reviewFiles = listReviewFiles();
    for (const reviewPath of reviewFiles) {
      if (classifyReview(reviewPath) !== 'contract') continue;
      const fm = parseFrontmatter(readFileSync(reviewPath, 'utf-8'));
      const target = fm.get('contract_target');
      if (!target) continue;
      const expectedContract = resolve(CONTRACTS_DIR, `${target}.md`);
      expect(
        existsSync(expectedContract),
        `${reviewPath}: contract_target "${target}" does not resolve to ${expectedContract}.`,
      ).toBe(true);
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
