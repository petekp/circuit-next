import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

import { validateWorkflowKindPolicy } from '../../src/runtime/policy/workflow-kind-policy.js';
import { runDogfood } from '../../src/runtime/runner.js';

// Slice 43c (P2.5) — `explore` end-to-end fixture run. Closes Phase 2
// close criteria CC#P2-1 (one-workflow parity substrate) and CC#P2-2
// (real-agent dispatch transcript + artifact materialization)
// simultaneously per ADR-0007 §Decision.1 + §Amendment Slice 37.
//
// Structure mirrors the Slice 42 adapter smoke file: always-running
// static declarations (ratchet-floor contribution) + AGENT_SMOKE-gated
// real-subprocess end-to-end. Static tests bind the explore fixture
// shape, the normalization rule used to hash the final result artifact,
// and the `sha256Hex` helper format. The AGENT_SMOKE-gated branch runs
// the real explore fixture through `runDogfood` with the default
// `dispatchAgent` (spawns `claude -p` per Slice 42), asserts the
// five-event dispatch transcript lands twice (synthesize + review),
// normalizes + hashes `artifacts/explore-result.json` against the
// checked-in golden, and writes the `tests/fixtures/agent-smoke/
// last-run.json` fingerprint that audit Check 30 verifies at every
// run.

const EXPLORE_FIXTURE_PATH = resolve('.claude-plugin/skills/explore/circuit.json');
const GOLDEN_RESULT_SHA256_PATH = resolve('tests/fixtures/golden/explore/result.sha256');
const LAST_RUN_FINGERPRINT_PATH = resolve('tests/fixtures/agent-smoke/last-run.json');

const AGENT_SMOKE = process.env.AGENT_SMOKE === '1';
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';
// Slice 47a (Codex HIGH 4 fold-in) — fingerprint promotion is now
// gated separately from the AGENT_SMOKE invocation, mirroring
// UPDATE_CODEX_FINGERPRINT (Slice 45 MED 3 fold-in). A bare
// AGENT_SMOKE=1 run exercises the adapter end-to-end without
// mutating tests/fixtures/agent-smoke/last-run.json; explicit
// UPDATE_AGENT_FINGERPRINT=1 opt-in is required to refresh the
// recorded fingerprint that audit Check 30 binds against.
const UPDATE_AGENT_FINGERPRINT = process.env.UPDATE_AGENT_FINGERPRINT === '1';

// Slice 47a — adapter source paths the fingerprint binds against.
// Inlined here (rather than importing from scripts/audit.mjs) to keep
// the test stdlib-only and consistent with the codex-dispatch-roundtrip
// inlining; if the test's list ever drifts from the audit's list the
// drift detection itself surfaces the mismatch as yellow on first
// repromotion.
const AGENT_ADAPTER_SOURCE_PATHS = [
  'src/runtime/adapters/agent.ts',
  'src/runtime/adapters/shared.ts',
  'src/runtime/adapters/dispatch-materializer.ts',
  'src/runtime/runner.ts',
  'src/runtime/artifact-schemas.ts',
] as const;

function adapterSourceSha256(): string {
  const h = createHash('sha256');
  for (const p of AGENT_ADAPTER_SOURCE_PATHS) {
    const abs = resolve(p);
    h.update(`${abs}\n`);
    h.update(readFileSync(abs));
    h.update('\n');
  }
  return h.digest('hex');
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

// Normalize before hashing so deterministic sections stay stable across
// runs even when the run root changes. At v0 the close-step's artifact
// is a static JSON object (see src/runtime/runner.ts writeSynthesisArtifact)
// with no timestamps, receipt ids, run ids, or absolute paths — so the
// normalization is effectively a canonical JSON pretty-print with sorted
// keys. The three sentinel replacements stay in place so a future
// synthesis-writer that DOES emit timestamps / ids / paths doesn't
// silently drift the golden.
function normalizeExploreResult(raw: string): string {
  const parsed: unknown = JSON.parse(raw);
  const canonical = canonicalize(parsed);
  return `${JSON.stringify(canonical, null, 2)}\n`;
}

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canonicalize(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    if (ISO_TIMESTAMP_PATTERN.test(input)) return '<ISO_TIMESTAMP>';
    if (UUID_PATTERN.test(input)) return '<UUID>';
    if (input.startsWith('/')) return '<ABSOLUTE_PATH>';
    return input;
  }
  if (Array.isArray(input)) return input.map(canonicalize);
  if (typeof input === 'object') {
    const src = input as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      if (k === 'receipt_id' || k === 'run_id') {
        sorted[k] = '<ID>';
      } else if (k === 'recorded_at' || k === 'closed_at') {
        sorted[k] = '<ISO_TIMESTAMP>';
      } else {
        sorted[k] = canonicalize(src[k]);
      }
    }
    return sorted;
  }
  return input;
}

function loadExploreFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(EXPLORE_FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'explore workflow lacks end-to-end real-adapter proof of parity',
    acceptance_evidence:
      'runDogfood closes the explore fixture under real dispatchAgent with 2x five-event transcripts and a byte-shape golden on explore-result.json',
    alternate_framing:
      'defer end-to-end explore until P2.9 second-workflow slice; rejected because CC#P2-1 + CC#P2-2 are Phase 2 close criteria that bind on one-workflow-parity substrate, not two.',
  };
}

describe('Slice 43c — explore fixture static declarations (ratchet-floor contribution)', () => {
  it('explore fixture parses through the production Workflow schema', () => {
    const { workflow } = loadExploreFixture();
    expect(workflow.id).toBe('explore');
  });

  it('explore fixture satisfies validateWorkflowKindPolicy (canonical phases + omits)', () => {
    const { workflow } = loadExploreFixture();
    const policy = validateWorkflowKindPolicy(workflow);
    expect(policy.ok).toBe(true);
  });

  it('explore fixture declares 5 steps with the expected kind distribution', () => {
    const { workflow } = loadExploreFixture();
    expect(workflow.steps).toHaveLength(5);
    const synthesis = workflow.steps.filter((s) => s.kind === 'synthesis');
    const dispatch = workflow.steps.filter((s) => s.kind === 'dispatch');
    expect(synthesis).toHaveLength(3); // frame + analyze + close
    expect(dispatch).toHaveLength(2); // synthesize + review
  });

  it('explore close-step writes.artifact.path targets artifacts/explore-result.json', () => {
    const { workflow } = loadExploreFixture();
    const close = workflow.steps.find((s) => s.id === 'close-step');
    expect(close).toBeDefined();
    if (close?.kind !== 'synthesis') throw new Error('close-step must be synthesis');
    expect(close.writes.artifact.path).toBe('artifacts/explore-result.json');
  });

  it('explore synthesize-step + review-step declare role + gate.pass vocabulary', () => {
    const { workflow } = loadExploreFixture();
    const synthesize = workflow.steps.find((s) => s.id === 'synthesize-step');
    const review = workflow.steps.find((s) => s.id === 'review-step');
    if (synthesize?.kind !== 'dispatch' || review?.kind !== 'dispatch') {
      throw new Error('dispatch steps not found');
    }
    expect(synthesize.role).toBe('implementer');
    expect(review.role).toBe('reviewer');
    expect(synthesize.gate.pass).toEqual(['accept']);
    expect(review.gate.pass).toEqual(['accept', 'accept-with-fold-ins']);
  });

  it('sha256Hex over a known input is canonical 64-char lowercase hex', () => {
    const digest = sha256Hex('explore-parity');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash('sha256').update('explore-parity', 'utf8').digest('hex'));
  });

  it('normalizeExploreResult is pure — same input produces same output', () => {
    const raw = '{"summary":"<x>","verdict_snapshot":"<y>"}';
    const a = normalizeExploreResult(raw);
    const b = normalizeExploreResult(raw);
    expect(a).toBe(b);
  });

  it('normalizeExploreResult replaces ISO timestamps with the ISO_TIMESTAMP sentinel', () => {
    const raw = '{"recorded_at":"2026-04-22T00:00:00.000Z","note":"plain"}';
    const out = normalizeExploreResult(raw);
    expect(out).toContain('<ISO_TIMESTAMP>');
    expect(out).toContain('"note": "plain"');
  });

  it('normalizeExploreResult replaces UUID strings with the UUID sentinel', () => {
    const raw = '{"id":"11111111-1111-1111-1111-111111111111","other":"stay"}';
    const out = normalizeExploreResult(raw);
    expect(out).toContain('<UUID>');
    expect(out).toContain('"other": "stay"');
  });

  it('normalizeExploreResult replaces receipt_id + run_id keys with the ID sentinel', () => {
    const raw = '{"receipt_id":"anything","run_id":"anything","keep":"kept"}';
    const out = normalizeExploreResult(raw);
    expect(out).toContain('"receipt_id": "<ID>"');
    expect(out).toContain('"run_id": "<ID>"');
    expect(out).toContain('"keep": "kept"');
  });

  it('normalizeExploreResult sorts object keys alphabetically', () => {
    const raw = '{"z":1,"a":2,"m":3}';
    const out = normalizeExploreResult(raw);
    const lines = out.split('\n');
    const keyLines = lines.filter((l) => l.includes(':'));
    expect(keyLines[0]?.trim().startsWith('"a"')).toBe(true);
    expect(keyLines[1]?.trim().startsWith('"m"')).toBe(true);
    expect(keyLines[2]?.trim().startsWith('"z"')).toBe(true);
  });

  it('tests/fixtures/golden/explore/result.sha256 exists and is a single 64-char hex line', () => {
    expect(existsSync(GOLDEN_RESULT_SHA256_PATH)).toBe(true);
    const contents = readFileSync(GOLDEN_RESULT_SHA256_PATH, 'utf8').trim();
    expect(contents).toMatch(/^[0-9a-f]{64}$/);
  });

  it('golden sha256 is self-consistent with the writeSynthesisArtifact placeholder derivation (v0.3 placeholder-parity epoch; P2.10 re-binds to orchestrator-parity per ADR-0007 §Decision.1 Slice 44 amendment)', () => {
    // Slice 44 arc-close fold-in (convergent Claude+Codex HIGH 2): the
    // golden under test here is NOT a parity-vs-reference-Circuit assertion.
    // It's a self-consistency assertion over writeSynthesisArtifact's
    // placeholder-body derivation. Re-derive the placeholder body the runner
    // writes for the explore close-step and confirm the checked-in golden
    // matches its hash. This binds the golden to the runner's deterministic
    // output without requiring the AGENT_SMOKE-gated e2e path to run in CI.
    // P2.10 replaces writeSynthesisArtifact with real orchestrator output;
    // at that point this test must be regenerated (UPDATE_GOLDEN=1) and
    // renamed to make the orchestrator-parity claim explicit. Until P2.10,
    // CC#P2-1 is satisfied at placeholder-parity per ADR-0007 amendment.
    const { workflow } = loadExploreFixture();
    const close = workflow.steps.find((s) => s.id === 'close-step');
    if (close?.kind !== 'synthesis') throw new Error('close-step must be synthesis');
    const body: Record<string, string> = {};
    for (const section of close.gate.required) {
      body[section] = `<${close.id as unknown as string}-placeholder-${section}>`;
    }
    const raw = `${JSON.stringify(body, null, 2)}\n`;
    const normalized = normalizeExploreResult(raw);
    const digest = sha256Hex(normalized);
    const golden = readFileSync(GOLDEN_RESULT_SHA256_PATH, 'utf8').trim();
    expect(digest).toBe(golden);
  });
});

// AGENT_SMOKE-gated real-subprocess end-to-end. Runs ONLY when the
// operator explicitly opts in via AGENT_SMOKE=1 so CI (and developer-
// local runs without auth) stay green. Test body is written so a rerun
// against the golden locks byte-shape parity forever after; write-side
// effects update `tests/fixtures/agent-smoke/last-run.json` so the
// commit-ancestor audit (Check 30) can bind the fingerprint to the
// committing slice.
(AGENT_SMOKE ? describe : describe.skip)(
  'Slice 43c — explore fixture AGENT_SMOKE end-to-end (CC#P2-1 + CC#P2-2 simultaneous close)',
  () => {
    let runRootBase: string;

    beforeEach(() => {
      runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-43c-'));
    });

    afterEach(() => {
      rmSync(runRootBase, { recursive: true, force: true });
    });

    it(
      'closes the explore run end-to-end through the real dispatchAgent + 2x five-event transcript + byte-shape golden parity',
      async () => {
        const { workflow, bytes } = loadExploreFixture();
        const runRoot = join(runRootBase, 'explore-e2e');
        const outcome = await runDogfood({
          runRoot,
          workflow,
          workflowBytes: bytes,
          runId: RunId.parse('33333333-3333-3333-3333-333333333333'),
          goal: 'explore: AGENT_SMOKE end-to-end parity run',
          rigor: 'standard',
          lane: lane(),
          now: () => new Date(),
        });

        expect(outcome.result.outcome).toBe('complete');

        // Close-step's explore-result.json landed at the expected path.
        const exploreResultPath = join(runRoot, 'artifacts', 'explore-result.json');
        expect(existsSync(exploreResultPath)).toBe(true);

        // Hash the normalized close-step artifact against the golden.
        const normalized = normalizeExploreResult(readFileSync(exploreResultPath, 'utf8'));
        const digest = sha256Hex(normalized);
        if (UPDATE_GOLDEN) {
          mkdirSync(dirname(GOLDEN_RESULT_SHA256_PATH), { recursive: true });
          writeFileSync(GOLDEN_RESULT_SHA256_PATH, `${digest}\n`);
        }
        const golden = readFileSync(GOLDEN_RESULT_SHA256_PATH, 'utf8').trim();
        expect(digest).toBe(golden);

        // Two dispatch transcripts landed; each carries the Slice 37
        // five-event sequence on its own (step_id, attempt) pair.
        const dispatchSteps = ['synthesize-step', 'review-step'];
        for (const stepId of dispatchSteps) {
          const kindsForStep = outcome.events
            .filter((e) => 'step_id' in e && e.step_id === stepId)
            .map((e) => e.kind);
          expect(kindsForStep).toContain('dispatch.started');
          expect(kindsForStep).toContain('dispatch.request');
          expect(kindsForStep).toContain('dispatch.receipt');
          expect(kindsForStep).toContain('dispatch.result');
          expect(kindsForStep).toContain('dispatch.completed');
        }

        // Slice 47a (Codex HIGH 4 fold-in) — fingerprint promotion
        // is gated on UPDATE_AGENT_FINGERPRINT=1 and writes the
        // schema_version 2 shape with adapter_source_sha256 +
        // cli_version, mirroring the codex-dispatch-roundtrip
        // promotion path. A bare AGENT_SMOKE=1 run exercises the
        // adapter end-to-end without mutating tracked state. The
        // first-run dispatch result on the explore fixture is the
        // one whose result_sha256 is recorded (matching prior shape).
        if (UPDATE_AGENT_FINGERPRINT) {
          const commitSha = currentHeadSha();
          // Slice 47a Codex HIGH 2 fold-in — bind cli_version to the
          // actual subprocess init event via DogfoodRunResult.dispatchResults
          // (populated by runDogfood; sourced from each dispatcher's
          // DispatchResult.cli_version, which agent.ts reads from
          // init.claude_code_version). The earlier env-var side-channel
          // (process.env.AGENT_CLI_VERSION ?? 'claude (unknown)') let
          // a missing/unknown cli_version through; the audit now also
          // rejects fingerprints with empty/unknown cli_version on v2,
          // so this binding fails closed at promotion time.
          const firstAgentDispatch = outcome.dispatchResults.find((d) => d.adapterName === 'agent');
          if (firstAgentDispatch === undefined) {
            throw new Error(
              'AGENT_SMOKE fingerprint promotion: no agent-dispatch result captured (DogfoodRunResult.dispatchResults empty for adapter=agent)',
            );
          }
          const cliVersion = firstAgentDispatch.cli_version;
          if (cliVersion.length === 0 || /\(unknown\)/.test(cliVersion)) {
            throw new Error(
              `AGENT_SMOKE fingerprint promotion: cli_version "${cliVersion}" is empty or sentinel; refusing to write a fingerprint that audit Check 30 will reject`,
            );
          }
          const fingerprint = {
            schema_version: 2,
            commit_sha: commitSha,
            result_sha256: digest,
            adapter_source_sha256: adapterSourceSha256(),
            cli_version: cliVersion,
            recorded_at: new Date().toISOString(),
          };
          mkdirSync(dirname(LAST_RUN_FINGERPRINT_PATH), { recursive: true });
          writeFileSync(LAST_RUN_FINGERPRINT_PATH, `${JSON.stringify(fingerprint, null, 2)}\n`);
        }
      },
      5 * 60 * 1000,
    );
  },
);

function currentHeadSha(): string {
  // Shelling to git keeps the test stdlib-only w.r.t. npm deps; the
  // fingerprint writer runs only under AGENT_SMOKE=1 so the child-process
  // dep is gated behind the opt-in.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}
