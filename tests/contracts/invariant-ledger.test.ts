import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Slice 25 — Contract and Review Trace Ledger. Closes AR-M2 per
// specs/reviews/arc-progress-codex.md: invariant ids must be machine-
// discoverable AND non-prose-only ids must appear in at least one binding
// test or audit reference. The ledger lives at specs/invariants.json; this
// test enforces three set-equality directions (body heading ↔ frontmatter
// ↔ ledger) plus per-entry binding-anchor presence.
//
// Codex challenger fold-ins (Slice 25):
// - HIGH 1: binding_refs are structured {path, kind}. For test-enforced,
//   the id must appear verbatim in every binding_ref path. For static-anchor,
//   binding_refs must name at least one schema file AND at least one test
//   file where the id appears (the grandfathered-allowlist scope_ids entry
//   in cross-model-challenger.test.ts counts for STEP/WF).
// - HIGH 2: eligibility rules. A contract invariant cannot be `prose-only`;
//   prose-only is reserved for behavioral-track meta-invariants with a
//   `rationale` field. phase2-property entries require `target_slice` and
//   `reopen_condition`.
// - HIGH 3: exact set equality in three directions catches silent drift
//   between body heading ↔ frontmatter invariant_ids ↔ ledger.
// - MED 7: set equality is enforced both directions.
// - MED 8: phase2-property shape required.
// - LOW 12: canonical heading grammar `- **<ID> —`; alternate shapes
//   trigger drift alerts.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CONTRACTS_DIR = resolve(REPO_ROOT, 'specs/contracts');
const BEHAVIORAL_DIR = resolve(REPO_ROOT, 'specs/behavioral');
const LEDGER_PATH = resolve(REPO_ROOT, 'specs/invariants.json');

const VALID_ENFORCEMENT_STATES = new Set([
  'test-enforced',
  'audit-only',
  'static-anchor',
  'prose-only',
  'phase2-property',
]);

const VALID_SURFACE_TYPES = new Set(['contract', 'behavioral']);

const VALID_BINDING_KINDS = new Set([
  'test_title',
  'assertion_message',
  'schema_export',
  'audit_dimension',
  'static_regex',
]);

type LedgerEntry = {
  id: string;
  contract: string;
  surface_type?: string;
  enforcement_state: string;
  source_anchor?: string;
  binding_refs?: Array<{ path: string; kind: string }>;
  rationale?: string;
  target_slice?: number;
  reopen_condition?: string;
};

type Ledger = {
  version: number;
  description: string;
  enforcement_state_semantics: Record<string, string>;
  invariants: LedgerEntry[];
  properties: LedgerEntry[];
};

function loadLedger(): Ledger {
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf-8')) as Ledger;
}

type Frontmatter = {
  invariant_ids?: string[];
  property_ids?: string[];
  contract?: string;
  track?: string;
};

function parseFrontmatter(markdown: string): Frontmatter {
  const result: Frontmatter = {};
  if (!markdown.startsWith('---')) return result;
  const closeIdx = markdown.indexOf('\n---', 3);
  if (closeIdx < 0) return result;
  const fm = markdown.slice(3, closeIdx);
  let currentListKey: 'invariant_ids' | 'property_ids' | null = null;
  for (const line of fm.split('\n')) {
    if (!line.trim()) {
      currentListKey = null;
      continue;
    }
    const listItem = line.match(/^\s*-\s+(.+?)\s*$/);
    if (listItem && currentListKey && listItem[1]) {
      const existing = result[currentListKey] ?? [];
      existing.push(listItem[1]);
      result[currentListKey] = existing;
      continue;
    }
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = (kv[2] ?? '').trim();
    if (key === 'invariant_ids' || key === 'property_ids') {
      const bracket = value.match(/^\[(.*)\]$/);
      if (bracket?.[1] !== undefined) {
        result[key] = bracket[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        currentListKey = null;
      } else if (value === '') {
        result[key] = [];
        currentListKey = key;
      } else {
        currentListKey = null;
      }
    } else if (key === 'contract' || key === 'track') {
      result[key] = value;
      currentListKey = null;
    } else {
      currentListKey = null;
    }
  }
  return result;
}

// Canonical invariant declaration heading shape (LOW 12 fold-in). Only this
// form declares an invariant; other shapes (`### <ID>`, `<ID>:`, bare
// prose mentions) are treated as cross-references, not declarations.
// Accepts both em-dash (—) and regular dash (-) after the id + ws.
const INVARIANT_HEADING_RE = /^-\s+\*\*([A-Z][A-Z-]+-I\d+)\s+[—-]/gm;
const PROPERTY_REFERENCE_RE = /\b([a-z-]+\.prop\.[a-z_]+)\b/g;

function listFiles(dir: string): string[] {
  const out = execSync(`ls ${dir}`, { encoding: 'utf-8' });
  return out
    .split('\n')
    .filter((name) => name.endsWith('.md'))
    .map((name) => resolve(dir, name));
}

function declaredInvariantIds(body: string): string[] {
  const ids: string[] = [];
  for (const m of body.matchAll(INVARIANT_HEADING_RE)) {
    if (m[1]) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

function declaredPropertyIds(body: string, contractName: string): string[] {
  // A property declaration is a heading of the form
  //   `- **<contract>.prop.<name> —`
  // in the contract's own body. Cross-references to another contract's
  // property in prose are not declarations.
  const ids = new Set<string>();
  const headingRe = new RegExp(`^-\\s+\\*\\*(${contractName}\\.prop\\.[a-z_]+)\\s+[—-]`, 'gm');
  for (const m of body.matchAll(headingRe)) {
    if (m[1]) ids.add(m[1]);
  }
  // Also scan for property IDs used in "See also" / "property id" lines,
  // keyed to the contract's own namespace. A property can be named in prose
  // without a heading (e.g. run.md embeds property IDs in RUN-I2's scope-
  // caveat body prose). Include any namespace-matching ID.
  for (const m of body.matchAll(PROPERTY_REFERENCE_RE)) {
    const id = m[1];
    if (id?.startsWith(`${contractName}.prop.`)) ids.add(id);
  }
  return [...ids];
}

describe('invariant-ledger — schema validity (Slice 25 Codex challenger HIGH 2 + MED 8 fold-in)', () => {
  const ledger = loadLedger();

  it('ledger parses as versioned JSON', () => {
    expect(ledger.version).toBe(1);
    expect(Array.isArray(ledger.invariants)).toBe(true);
    expect(Array.isArray(ledger.properties)).toBe(true);
  });

  it('every invariant entry has a valid enforcement_state', () => {
    for (const entry of ledger.invariants) {
      expect(
        VALID_ENFORCEMENT_STATES.has(entry.enforcement_state),
        `${entry.id}: enforcement_state "${entry.enforcement_state}" is not one of ${[...VALID_ENFORCEMENT_STATES].join(', ')}`,
      ).toBe(true);
    }
  });

  it('every invariant has a valid surface_type', () => {
    for (const entry of ledger.invariants) {
      expect(
        VALID_SURFACE_TYPES.has(entry.surface_type ?? ''),
        `${entry.id}: surface_type "${entry.surface_type}" is not one of ${[...VALID_SURFACE_TYPES].join(', ')}`,
      ).toBe(true);
    }
  });

  // HIGH 2 fold-in — contract invariants cannot be prose-only.
  // Eligibility: prose-only is reserved for behavioral-track meta-invariants.
  it('contract-surface invariants cannot be prose-only (HIGH 2 eligibility)', () => {
    const violations: string[] = [];
    for (const entry of ledger.invariants) {
      if (entry.surface_type === 'contract' && entry.enforcement_state === 'prose-only') {
        violations.push(`${entry.id} (contract=${entry.contract})`);
      }
    }
    expect(
      violations,
      `Contract invariants classified prose-only (eligibility violation per Slice 25 challenger HIGH 2):\n${violations.join('\n')}\n\nprose-only is reserved for behavioral-track meta-invariants; a contract "MUST reject" invariant is not eligible.`,
    ).toEqual([]);
  });

  it('prose-only entries carry a rationale field', () => {
    const violations: string[] = [];
    for (const entry of ledger.invariants) {
      if (entry.enforcement_state === 'prose-only') {
        if (!entry.rationale || entry.rationale.trim().length < 20) {
          violations.push(`${entry.id}: rationale missing or too short`);
        }
      }
    }
    expect(violations, `prose-only entries missing rationale:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });

  // MED 8 fold-in — phase2-property requires target_slice + reopen_condition
  // so the deferral does not rot past the target.
  it('every phase2-property entry has target_slice + reopen_condition', () => {
    const violations: string[] = [];
    for (const entry of [...ledger.invariants, ...ledger.properties]) {
      if (entry.enforcement_state !== 'phase2-property') continue;
      if (typeof entry.target_slice !== 'number') {
        violations.push(`${entry.id}: target_slice missing or not a number`);
      }
      if (!entry.reopen_condition || entry.reopen_condition.trim().length === 0) {
        violations.push(`${entry.id}: reopen_condition missing`);
      }
    }
    expect(
      violations,
      `phase2-property entries missing deferral shape (MED 8):\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('every test-enforced / audit-only / static-anchor entry carries binding_refs', () => {
    const violations: string[] = [];
    for (const entry of ledger.invariants) {
      if (!['test-enforced', 'audit-only', 'static-anchor'].includes(entry.enforcement_state)) {
        continue;
      }
      if (!Array.isArray(entry.binding_refs) || entry.binding_refs.length === 0) {
        violations.push(`${entry.id}: binding_refs missing or empty`);
        continue;
      }
      for (const ref of entry.binding_refs) {
        if (!ref.path || !VALID_BINDING_KINDS.has(ref.kind)) {
          violations.push(
            `${entry.id}: binding_ref has invalid path/kind — ${JSON.stringify(ref)}`,
          );
        }
        if (!existsSync(resolve(REPO_ROOT, ref.path))) {
          violations.push(`${entry.id}: binding_ref path "${ref.path}" does not resolve`);
        }
      }
    }
    expect(violations, `binding_refs violations:\n${violations.join('\n')}`).toEqual([]);
  });

  it('no duplicate invariant ids across the ledger', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of ledger.invariants) {
      if (seen.has(entry.id)) dupes.push(entry.id);
      seen.add(entry.id);
    }
    expect(dupes, `Duplicate invariant ids:\n${dupes.join('\n')}`).toEqual([]);
  });

  it('no duplicate property ids across the ledger', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of ledger.properties) {
      if (seen.has(entry.id)) dupes.push(entry.id);
      seen.add(entry.id);
    }
    expect(dupes, `Duplicate property ids:\n${dupes.join('\n')}`).toEqual([]);
  });
});

describe('invariant-ledger — binding anchor enforcement (Slice 25 Codex challenger HIGH 1 fold-in)', () => {
  const ledger = loadLedger();

  // HIGH 1 fold-in — the id must appear verbatim in every binding_ref path
  // whose kind is test_title / assertion_message / audit_dimension. A comment
  // or a placeholder describe('') does not satisfy the binding; the id must
  // be a substring of the file text AND at least one test_title / it()-level
  // occurrence must exist when kind is test_title. For static-anchor, we
  // require the id as a substring of at least one binding_ref path (the
  // scope_ids literal in cross-model-challenger.test.ts counts).
  it('every test-enforced / audit-only / static-anchor id appears in every declared binding_ref path', () => {
    const violations: string[] = [];
    for (const entry of ledger.invariants) {
      if (!['test-enforced', 'audit-only', 'static-anchor'].includes(entry.enforcement_state)) {
        continue;
      }
      if (!entry.binding_refs) continue;
      for (const ref of entry.binding_refs) {
        const abs = resolve(REPO_ROOT, ref.path);
        if (!existsSync(abs)) continue; // already reported above
        const text = readFileSync(abs, 'utf-8');
        if (!text.includes(entry.id)) {
          violations.push(
            `${entry.id}: declared binding_ref ${ref.path} does not contain the id string`,
          );
        }
      }
    }
    expect(
      violations,
      `HIGH 1 binding-anchor failures (id must appear verbatim in each declared binding_ref path):\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  // HIGH 1 fold-in (strengthened) — for kind=test_title, the id must appear
  // inside a describe(...) or it(...) string literal, not merely in a comment.
  // This catches the failure mode where someone drops a `// RUN-I1 — see
  // above` comment into a test file and claims the binding is satisfied.
  it('test_title binding_refs contain the id inside a describe/it literal', () => {
    const violations: string[] = [];
    for (const entry of ledger.invariants) {
      if (!entry.binding_refs) continue;
      for (const ref of entry.binding_refs) {
        if (ref.kind !== 'test_title') continue;
        const abs = resolve(REPO_ROOT, ref.path);
        if (!existsSync(abs)) continue;
        const text = readFileSync(abs, 'utf-8');
        // Match: describe(... or it(... where the ID appears somewhere after
        // the opening paren and before the opening brace `{` of the arrow.
        // Per-line scan handles nested quotes (e.g. `it('rejects "X" — STEP-I4',`
        // has single-quote outer, double-quote inner). Slice 25 Codex HIGH 1
        // fold-in requires the id appears *inside* the call — scanning a
        // single line catches the common describe/it-on-one-line idiom and
        // avoids comment-only matches (comments don't contain `describe(` or
        // `it(` call syntax).
        const escaped = entry.id.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
        const re = new RegExp(`^\\s*(?:describe|it)\\([^)]*${escaped}[^)]*`, 'm');
        if (!re.test(text)) {
          violations.push(
            `${entry.id}: binding_ref ${ref.path} kind=test_title but id does not appear inside any describe/it string literal`,
          );
        }
      }
    }
    expect(violations, `HIGH 1 test_title-binding failures:\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('invariant-ledger — body/frontmatter/ledger set equality (HIGH 3 + MED 7 fold-in)', () => {
  const ledger = loadLedger();
  const contractFiles = listFiles(CONTRACTS_DIR);
  const behavioralFiles = listFiles(BEHAVIORAL_DIR);
  const allFiles = [...contractFiles, ...behavioralFiles];

  const ledgerByContract = new Map<string, Set<string>>();
  for (const entry of ledger.invariants) {
    const set = ledgerByContract.get(entry.contract) ?? new Set<string>();
    set.add(entry.id);
    ledgerByContract.set(entry.contract, set);
  }
  const ledgerPropsByContract = new Map<string, Set<string>>();
  for (const entry of ledger.properties) {
    const set = ledgerPropsByContract.get(entry.contract) ?? new Set<string>();
    set.add(entry.id);
    ledgerPropsByContract.set(entry.contract, set);
  }

  // MED 7 / HIGH 3 — three-direction set equality for invariants:
  //   body headings === frontmatter invariant_ids === ledger set for that contract.
  it('body headings ≡ frontmatter invariant_ids ≡ ledger set per contract', () => {
    const violations: string[] = [];
    for (const path of allFiles) {
      const body = readFileSync(path, 'utf-8');
      const fm = parseFrontmatter(body);
      const contractName = fm.contract || fm.track;
      if (!contractName) continue;
      const bodySet = new Set(declaredInvariantIds(body));
      const frontmatterSet = new Set(fm.invariant_ids ?? []);
      const ledgerSet = ledgerByContract.get(contractName) ?? new Set();

      const only = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));
      const bodyOnly = only(bodySet, frontmatterSet);
      const fmOnly = only(frontmatterSet, bodySet);
      const bodyNotLedger = only(bodySet, ledgerSet);
      const ledgerNotBody = only(ledgerSet, bodySet);

      if (bodyOnly.length || fmOnly.length || bodyNotLedger.length || ledgerNotBody.length) {
        violations.push(
          `${basename(path)}:\n  body only: [${bodyOnly.join(', ')}]\n  frontmatter only: [${fmOnly.join(', ')}]\n  body not in ledger: [${bodyNotLedger.join(', ')}]\n  ledger not in body: [${ledgerNotBody.join(', ')}]`,
        );
      }
    }
    expect(
      violations,
      `Invariant set-equality violations (body ↔ frontmatter ↔ ledger):\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('body property references ≡ frontmatter property_ids ≡ ledger properties per contract', () => {
    const violations: string[] = [];
    for (const path of contractFiles) {
      const body = readFileSync(path, 'utf-8');
      const fm = parseFrontmatter(body);
      const contractName = fm.contract;
      if (!contractName) continue;
      const bodySet = new Set(declaredPropertyIds(body, contractName));
      const frontmatterSet = new Set(fm.property_ids ?? []);
      const ledgerSet = ledgerPropsByContract.get(contractName) ?? new Set();

      const only = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));
      const fmOnly = only(frontmatterSet, bodySet);
      const bodyNotLedger = only(bodySet, ledgerSet);
      const ledgerNotBody = only(ledgerSet, bodySet);

      if (fmOnly.length || bodyNotLedger.length || ledgerNotBody.length) {
        violations.push(
          `${basename(path)}:\n  frontmatter only: [${fmOnly.join(', ')}]\n  body not in ledger: [${bodyNotLedger.join(', ')}]\n  ledger not in body: [${ledgerNotBody.join(', ')}]`,
        );
      }
    }
    expect(
      violations,
      `Property set-equality violations (body ↔ frontmatter ↔ ledger):\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

describe('invariant-ledger — frontmatter presence (Slice 25 ratchet)', () => {
  const contractFiles = listFiles(CONTRACTS_DIR);
  const behavioralFiles = listFiles(BEHAVIORAL_DIR);

  it('every specs/contracts/*.md frontmatter carries invariant_ids', () => {
    const missing: string[] = [];
    for (const path of contractFiles) {
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      if (!Array.isArray(fm.invariant_ids)) missing.push(basename(path));
    }
    expect(missing, `contracts missing invariant_ids:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every specs/behavioral/*.md frontmatter carries invariant_ids', () => {
    const missing: string[] = [];
    for (const path of behavioralFiles) {
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      if (!Array.isArray(fm.invariant_ids)) missing.push(basename(path));
    }
    expect(missing, `behavioral tracks missing invariant_ids:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every specs/contracts/*.md frontmatter carries property_ids (empty list ok)', () => {
    const missing: string[] = [];
    for (const path of contractFiles) {
      const fm = parseFrontmatter(readFileSync(path, 'utf-8'));
      if (!Array.isArray(fm.property_ids)) missing.push(basename(path));
    }
    expect(missing, `contracts missing property_ids:\n${missing.join('\n')}`).toEqual([]);
  });
});
