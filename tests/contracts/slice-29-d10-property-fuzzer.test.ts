import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkAdversarialYieldLedger } from '../../scripts/audit.mjs';

// Slice 29 — D10 property-based non-LLM evidence artifact for
// Phase 1.5 Alpha Proof Close Criterion #13.
//
// Structurally-different mode (D10 clause 2): property-fuzzer. RNG generates
// ledger states across a wider input space than the 14 one-shot
// LLM-authored cases in slice-dog-1-d10-operationalization.test.ts.
// Each `it` block runs N iterations with a fixed seed, so regressions
// in scripts/audit.mjs surface across the invariant's full input space.

const PROP_SEED = 0xc1a51c29;
const SEED_RIGOR_LITE = 0xa001;
const SEED_RIGOR_STANDARD = 0xa002;
const SEED_RIGOR_UNKNOWN = 0xa003;
const SEED_GF_VALID = 0xb001;
const SEED_GF_INVALID = 0xb002;
const SEED_WHY_SHORT = 0xc001;
const SEED_WHY_LONG = 0xc002;
const SEED_SHA_NA = 0xd001;
const SEED_SHA_FAKE = 0xd002;
const SEED_SHA_MALFORMED = 0xd003;
const SEED_MODE_CYCLE = 0xe001;
const SEED_MODE_TWO = 0xe002;
const SEED_TOURN_ALL_LLM = 0xf001;
const SEED_TOURN_NON_LLM = 0xf002;
const SEED_STR_CLASS = 0xab01;
const SEED_STR_PASS = 0xab02;

const ITER_LIGHT = 40;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-s29-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function makeExecCommit(): { root: string; sha: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-s29-git-'));
  execSync(`git -C "${root}" init --quiet`);
  execSync(`git -C "${root}" config user.email "test@example.com"`);
  execSync(`git -C "${root}" config user.name "Test"`);
  writeFileSync(join(root, 'src-fake.ts'), 'export const x = 1;\n');
  execSync(`git -C "${root}" add src-fake.ts`);
  execSync(`git -C "${root}" commit --quiet -m "exec commit"`);
  const sha = execSync(`git -C "${root}" rev-parse HEAD`, { encoding: 'utf-8' }).trim();
  return { root, sha, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

const LEDGER_HEADER = `---
name: adversarial-yield-ledger
description: Test fixture.
type: ledger
date: 2026-04-20
---

# Fixture

| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap | rigor_profile | why_continue_failure_class | prior_execution_commit_sha |
|---|---|---|---:|---|---|---:|---:|---:|---|---|---|---|---|
`;

function ledger(rows: string[]): string {
  return `${LEDGER_HEADER}${rows.join('\n')}\n`;
}

type Row = {
  passDate: string;
  artifactPath: string;
  artifactClass: string;
  passNumber: number;
  reviewerId: string;
  mode: string;
  high: number;
  med: number;
  low: number;
  verdict: string;
  justification: string;
  rigor: string;
  whyContinue: string;
  priorExecSha: string;
};

function rowToMd(r: Row): string {
  return `| ${r.passDate} | \`${r.artifactPath}\` | ${r.artifactClass} | ${r.passNumber} | ${r.reviewerId} | ${r.mode} | ${r.high} | ${r.med} | ${r.low} | ${r.verdict} | ${r.justification} | ${r.rigor} | ${r.whyContinue} | ${r.priorExecSha} |`;
}

const SUBSTANTIVE_WHY =
  'reducer callback-shape drift masked by prior pass LLM echo — hunted by replaying with alternative goal';

const WHY_PLACEHOLDERS = [
  'n/a',
  'N/A',
  'none',
  'tbd',
  'more review',
  'various',
  'general',
  'see body',
  '-',
  '—',
  '.',
];

const ARTIFACT_CLASSES = ['reversible', 'governance', 'irreversible'] as const;
const LLM_MODES = ['llm-review', 'llm-cold-read', 'llm-critique'];
const NON_LLM_MODES = ['human-cold-read', 'property-fuzzer', 'runtime-probe', 'fuzzer'];

function baselineRow(overrides: Partial<Row> = {}): Row {
  return {
    passDate: '2026-04-20',
    artifactPath: 'artifact.md',
    artifactClass: 'reversible',
    passNumber: 1,
    reviewerId: 'gpt-5-codex',
    mode: 'llm-review',
    high: 0,
    med: 0,
    low: 0,
    verdict: 'ACCEPT',
    justification: 'n/a',
    rigor: 'pre-dog-1-grandfather',
    whyContinue: 'n/a',
    priorExecSha: 'n/a',
    ...overrides,
  };
}

describe('Slice 29 fuzzer — rigor-budget rule', () => {
  it(`lite rigor reds on pass ≥ 1 (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_RIGOR_LITE);
    for (let i = 0; i < ITER_LIGHT; i++) {
      const passNumber = randInt(rng, 1, 4);
      const artifactClass = pick(rng, ARTIFACT_CLASSES);
      const row = baselineRow({
        passDate: '2026-05-01',
        artifactClass,
        passNumber,
        rigor: 'lite',
        whyContinue: passNumber >= 2 ? SUBSTANTIVE_WHY : 'n/a',
      });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/lite.*budget 0/);
      });
    }
  });

  it(`standard pass ≥ 2 reds without substantive justification (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_RIGOR_STANDARD);
    for (let i = 0; i < ITER_LIGHT; i++) {
      const passNumber = randInt(rng, 2, 3);
      const rows: Row[] = [];
      for (let p = 1; p < passNumber; p++) {
        rows.push(
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: p,
            rigor: 'standard',
            whyContinue: p >= 2 ? SUBSTANTIVE_WHY : 'n/a',
          }),
        );
      }
      rows.push(
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber,
          rigor: 'standard',
          whyContinue: SUBSTANTIVE_WHY,
        }),
      );
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/exceeds rigor "standard" budget 1/);
      });
    }
  });

  it(`unknown rigor value reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_RIGOR_UNKNOWN);
    const fakeRigors = ['ultra', 'hyper', 'moderate', 'extreme', 'mega', 'normie', 'xxx'];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const badRigor = pick(rng, fakeRigors);
      const row = baselineRow({ passDate: '2026-05-01', rigor: badRigor });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
      });
    }
  });
});

describe('Slice 29 fuzzer — grandfather cutoff', () => {
  it(`grandfather ≤ 2026-04-20 is green (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_GF_VALID);
    const validDates = ['2026-04-20', '2026-04-19', '2026-03-01', '2025-12-31', '2024-06-15'];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const row = baselineRow({
        passDate: pick(rng, validDates),
        artifactClass: pick(rng, ARTIFACT_CLASSES),
      });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('green');
      });
    }
  });

  it(`grandfather strictly after cutoff reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_GF_INVALID);
    const invalidDates = [
      '2026-04-21',
      '2026-04-22',
      '2026-05-01',
      '2026-06-15',
      '2027-01-01',
      '2030-12-31',
    ];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const row = baselineRow({ passDate: pick(rng, invalidDates) });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/grandfather.*not permitted/);
      });
    }
  });
});

describe('Slice 29 fuzzer — why_continue checkpoint', () => {
  it('why_continue placeholder reds on deep pass 2', () => {
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (const placeholder of WHY_PLACEHOLDERS) {
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'deep',
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'deep',
            whyContinue: placeholder,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/why_continue_failure_class|specific failure class/);
      }
    } finally {
      cleanup();
    }
  });

  it(`why_continue shorter than 30 chars reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_WHY_SHORT);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const len = randInt(rng, 1, 29);
        const shortWhy = 'x'.repeat(len);
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'deep',
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'deep',
            whyContinue: shortWhy,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/specific failure class|why_continue/);
      }
    } finally {
      cleanup();
    }
  });

  it(`substantive why_continue + valid SHA → green on deep pass 2 (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_WHY_LONG);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const extra = randInt(rng, 0, 40);
        const why = `${SUBSTANTIVE_WHY} ${'x'.repeat(extra)}`.slice(0, 200);
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'deep',
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'deep',
            whyContinue: why,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('green');
      }
    } finally {
      cleanup();
    }
  });
});

describe('Slice 29 fuzzer — review-execution alternation', () => {
  it(`deep/tournament pass ≥ 2 with n/a priorExecSha reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_SHA_NA);
    const naVariants = ['n/a', 'N/A', 'NA', '-', '—'];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const rigor = pick(rng, ['deep', 'tournament'] as const);
      const na = pick(rng, naVariants);
      const rows: Row[] = [
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 1,
          rigor,
        }),
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 2,
          rigor,
          whyContinue: SUBSTANTIVE_WHY,
          priorExecSha: na,
        }),
      ];
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/prior_execution_commit_sha required/);
      });
    }
  });

  it(`unresolvable (but hex-shaped) SHA reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_SHA_FAKE);
    for (let i = 0; i < ITER_LIGHT; i++) {
      let fake = '';
      while (fake.length < 40) fake += Math.floor(rng() * 16).toString(16);
      const rows: Row[] = [
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 1,
          rigor: 'deep',
        }),
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 2,
          rigor: 'deep',
          whyContinue: SUBSTANTIVE_WHY,
          priorExecSha: fake,
        }),
      ];
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
      });
    }
  });

  it(`malformed (non-hex) SHA reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_SHA_MALFORMED);
    const malformed = ['not-a-sha', 'zzzzzzz', '1234', 'hello world', 'g'.repeat(40)];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const bad = pick(rng, malformed);
      const rows: Row[] = [
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 1,
          rigor: 'deep',
        }),
        baselineRow({
          passDate: '2026-05-01',
          artifactClass: 'governance',
          passNumber: 2,
          rigor: 'deep',
          whyContinue: SUBSTANTIVE_WHY,
          priorExecSha: bad,
        }),
      ];
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
      });
    }
  });
});

describe('Slice 29 fuzzer — mode-cycle K=2', () => {
  it(`three consecutive same-mode rows on same artifact reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_MODE_CYCLE);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const mode = pick(rng, LLM_MODES);
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'tournament',
            mode,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'tournament',
            mode,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 3,
            rigor: 'tournament',
            mode,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/mode-cycle violation/);
      }
    } finally {
      cleanup();
    }
  });

  it(`two same-mode rows do not trigger mode-cycle (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_MODE_TWO);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const mode = pick(rng, LLM_MODES);
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'deep',
            mode,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'deep',
            mode,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('green');
        expect(result.detail).not.toMatch(/mode-cycle violation/);
      }
    } finally {
      cleanup();
    }
  });
});

describe('Slice 29 fuzzer — tournament pass-3 non-LLM gate', () => {
  it(`tournament pass 3 with all-llm priors reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_TOURN_ALL_LLM);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const m1 = pick(rng, LLM_MODES);
        const m2 = LLM_MODES.find((m) => m !== m1) as string;
        const m3 = LLM_MODES.find((m) => m !== m2) as string;
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'tournament',
            mode: m1,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'tournament',
            mode: m2,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 3,
            rigor: 'tournament',
            mode: m3,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
        expect(result.detail).toMatch(/non-LLM mode required before pass 3/);
      }
    } finally {
      cleanup();
    }
  });

  it(`tournament pass 3 with ≥1 non-LLM prior → green (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_TOURN_NON_LLM);
    const { root, sha, cleanup } = makeExecCommit();
    try {
      for (let i = 0; i < ITER_LIGHT; i++) {
        const nonLlmMode = pick(rng, NON_LLM_MODES);
        const m3 = pick(rng, LLM_MODES);
        const rows: Row[] = [
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 1,
            rigor: 'tournament',
            mode: 'llm-review',
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 2,
            rigor: 'tournament',
            mode: nonLlmMode,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
          baselineRow({
            passDate: '2026-05-01',
            artifactClass: 'governance',
            passNumber: 3,
            rigor: 'tournament',
            mode: m3,
            whyContinue: SUBSTANTIVE_WHY,
            priorExecSha: sha,
          }),
        ];
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows.map(rowToMd)));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('green');
      }
    } finally {
      cleanup();
    }
  });
});

describe('Slice 29 fuzzer — structural reds', () => {
  it(`invalid artifact_class reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_STR_CLASS);
    const bad = ['unknown', 'mutable', 'critical', 'core', 'tainted'];
    for (let i = 0; i < ITER_LIGHT; i++) {
      const row = baselineRow({ artifactClass: pick(rng, bad) });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
      });
    }
  });

  it(`non-positive pass_number reds (${ITER_LIGHT} iters)`, () => {
    const rng = mulberry32(PROP_SEED ^ SEED_STR_PASS);
    for (let i = 0; i < ITER_LIGHT; i++) {
      const bad = randInt(rng, -5, 0);
      const row = baselineRow({ passNumber: bad });
      withTempRepo((root) => {
        writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([rowToMd(row)]));
        const result = checkAdversarialYieldLedger(root);
        expect(result.level).toBe('red');
      });
    }
  });
});

// Oracle pin — the committed ledger must remain green under the same entry
// point the fuzzer uses. Fires before any other test if a hand-edit breaks it.
describe('Slice 29 fuzzer — committed ledger oracle', () => {
  it('committed adversarial-yield-ledger.md is green from repo root', () => {
    const result = checkAdversarialYieldLedger();
    expect(result.level).toBe('green');
  });
});
