import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { dispatchAgent, sha256Hex } from '../../src/runtime/adapters/agent.js';

// Slice 42 (P2.4) — agent adapter smoke test.
//
// This test lives in tests/runner/ because it exercises the real subprocess
// path end-to-end (spawns a `claude -p` child process with the Slice 42
// capability-boundary flag combo). That path requires:
//   (1) the `claude` CLI on $PATH,
//   (2) an authenticated session (OAuth via operator's Claude Code
//       subscription, or ANTHROPIC_API_KEY for API users),
//   (3) network access.
//
// CI may not have any of those. To avoid flaking CI on missing auth, the
// end-to-end invocation runs ONLY when `AGENT_SMOKE=1` is set in the env.
// A static test (no subprocess) always runs so the contract-test ratchet
// sees a consistent static declaration count regardless of the env var.
//
// Slice 41 Codex HIGH 4 empirical proof: the capability-boundary proof
// artifact is archived in the P2.4 Codex challenger review
// (specs/reviews/arc-slice-42-real-agent-adapter-codex.md §Capability-
// boundary empirical proof). This smoke test IS the end-to-end regression
// guard: if a future slice adds a write-capable tool to the flag combo,
// the AGENT_SMOKE run would surface the capability regression at the
// subprocess-tool-surface level (the subprocess's init event enumerates
// the available tools).

const AGENT_SMOKE = process.env.AGENT_SMOKE === '1';

describe('Slice 42 (P2.4) — agent adapter smoke (ADR-0009 §1, capability boundary §2.v)', () => {
  it('static: dispatchAgent exports a function (ratchet-floor declaration)', () => {
    expect(typeof dispatchAgent).toBe('function');
    expect(dispatchAgent.length).toBeGreaterThanOrEqual(1);
  });

  it('static: sha256Hex produces a canonical hex digest of a known input', () => {
    // This binds the hash format used by dispatch transcript events
    // (DispatchRequestEvent.request_payload_hash +
    // DispatchResultEvent.result_artifact_hash — both ContentHash HEX64
    // per src/schemas/event.ts). A regression in the hash shape would
    // silently produce events that fail to round-trip through
    // Event.parse() at write time.
    const digest = sha256Hex('circuit-next');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash('sha256').update('circuit-next', 'utf8').digest('hex'));
  });

  // AGENT_SMOKE-gated real-subprocess path. Skipped when the env var is
  // not set so CI (and developer-local runs without auth) stay green.
  (AGENT_SMOKE ? it : it.skip)(
    'end-to-end: dispatchAgent spawns claude -p and returns a result triple (AGENT_SMOKE=1)',
    async () => {
      const prompt = 'Respond with exactly the single word: OK';
      const result = await dispatchAgent({ prompt, timeoutMs: 120_000 });

      // request_payload is echoed verbatim (the bytes hashed into
      // dispatch.request.request_payload_hash per Slice 37 event schema).
      expect(result.request_payload).toBe(prompt);

      // receipt_id is the Claude-side session UUID. The exact format is
      // adapter-owned (ADR-0007 §Amendment Slice 37 kept receipt_id as
      // z.string().min(1) pending real adapter evidence); we assert
      // non-empty + non-whitespace per DispatchReceiptEvent's refinement.
      expect(result.receipt_id.length).toBeGreaterThan(0);
      expect(result.receipt_id.trim().length).toBeGreaterThan(0);

      // result_body is the text response bytes. We don't assert on the
      // exact text (the model's response varies) — only that the subprocess
      // produced non-empty output and the duration was measured.
      expect(typeof result.result_body).toBe('string');
      expect(result.result_body.length).toBeGreaterThan(0);
      expect(result.duration_ms).toBeGreaterThan(0);

      // Hash the request + result bytes; assert digests are canonical hex
      // — these are the values that would populate the two ContentHash
      // fields on DispatchRequestEvent + DispatchResultEvent.
      expect(sha256Hex(result.request_payload)).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256Hex(result.result_body)).toMatch(/^[0-9a-f]{64}$/);

      // CLI version is captured from the subprocess init event per Codex
      // Slice 42 MED 2 fold-in — transcript evidence is version-pinned.
      // Regex: semver-ish (e.g. "2.1.117" or "2.1.117-beta.1").
      expect(result.cli_version).toMatch(/^\d+\.\d+\.\d+/);
    },
    180_000,
  );
});
