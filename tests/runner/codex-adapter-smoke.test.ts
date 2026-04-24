import { describe, expect, it } from 'vitest';

import { dispatchCodex } from '../../src/runtime/adapters/codex.js';
import { sha256Hex } from '../../src/runtime/adapters/shared.js';

// Slice 45 (P2.6) — codex adapter smoke test. Mirrors the Slice 42 agent
// smoke shape: a static branch (always runs, contributes to the contract-
// test ratchet regardless of env), plus a CODEX_SMOKE=1-gated end-to-end
// branch that spawns the real `codex exec` subprocess.
//
// CODEX_SMOKE=1 is opt-in for the same reason AGENT_SMOKE=1 is: the
// subprocess requires (1) the `codex` CLI on $PATH, (2) authenticated
// session or API key, (3) network access. CI and unauthenticated
// developer runs stay green without it.
//
// Slice 45 capability-boundary empirical proof: the argv-constant
// assertion in `CODEX_NO_WRITE_FLAGS` is module-load-bound; the OS-level
// `-s read-only` sandbox prevents repo writes at the process level
// regardless of model behavior. This smoke test is the positive
// end-to-end regression guard: if a future slice loosens
// `CODEX_NO_WRITE_FLAGS` (e.g., swapping `read-only` for
// `workspace-write`), the module-load assertion fires before the smoke
// test even starts.

const CODEX_SMOKE = process.env.CODEX_SMOKE === '1';

describe('Slice 45 (P2.6) — codex adapter smoke (ADR-0009 §1, capability boundary §2.v)', () => {
  it('static: dispatchCodex exports a function (ratchet-floor declaration)', () => {
    expect(typeof dispatchCodex).toBe('function');
    expect(dispatchCodex.length).toBeGreaterThanOrEqual(1);
  });

  (CODEX_SMOKE ? it : it.skip)(
    'end-to-end: dispatchCodex spawns codex exec and returns a result triple (CODEX_SMOKE=1)',
    async () => {
      const prompt = 'Respond with exactly the single word: OK';
      const result = await dispatchCodex({
        prompt,
        timeoutMs: 120_000,
        resolvedSelection: { effort: 'low', skills: [], invocation_options: {} },
      });

      expect(result.request_payload).toBe(prompt);
      expect(result.receipt_id.length).toBeGreaterThan(0);
      expect(result.receipt_id.trim().length).toBeGreaterThan(0);

      expect(typeof result.result_body).toBe('string');
      expect(result.result_body.length).toBeGreaterThan(0);
      expect(result.duration_ms).toBeGreaterThan(0);

      expect(sha256Hex(result.request_payload)).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256Hex(result.result_body)).toMatch(/^[0-9a-f]{64}$/);

      // cli_version captured via pre-invocation `codex --version`
      // shellout (Codex does not emit version in-band like `claude`'s
      // init event). Expected shape: "codex-cli X.Y.Z" (may vary).
      expect(result.cli_version).toMatch(/codex.*\d+\.\d+\.\d+/);
    },
    180_000,
  );
});
