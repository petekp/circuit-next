import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CODEX_EXECUTABLE,
  CODEX_FORBIDDEN_ARGV_TOKENS,
  CODEX_NO_WRITE_FLAGS,
  CODEX_REASONING_EFFORT_CONFIG_KEY,
  CODEX_SUPPORTED_EFFORTS,
  type CodexDispatchResult,
  assertCodexSpawnArgvBoundary,
  buildCodexArgs,
  parseCodexStdout,
} from '../../src/runtime/adapters/codex.js';

const HAPPY_PATH_FIXTURE = resolve('tests/fixtures/codex-smoke/protocol/happy-path-ok.jsonl');
const TURN_FAILED_FIXTURE = resolve('tests/fixtures/codex-smoke/protocol/turn-failed.jsonl');

// P2.6 real codex adapter. Mirrors the agent-adapter agent-adapter
// contract test shape for the adapter shape + parser branches. Three
// concerns:
//   (A) `src/runtime/adapters/codex.ts` module shape + capability-
//       boundary argv-constant invariants.
//   (B) `parseCodexStdout` NDJSON parser branches (happy path + each
//       fail-closed assertion).
//   (C) Cross-adapter parity assertions — both adapters produce the same
//       `DispatchResult` shape so the materializer consumes them
//       interchangeably (the adapter-name discriminant on
//       `materializeDispatch` is what records identity, not the result
//       shape).
//
// Check 29 (import-level adapter discipline) coverage for `codex.ts` is
// exercised by the live-repo regression guard in the agent-adapter suite;
// adding a new adapter file cannot smuggle a forbidden SDK because the
// scan pattern walks the tree recursively.

// ---- (A) module shape + capability-boundary argv-constant invariants ---

describe('Codex adapter — src/runtime/adapters/codex.ts module shape', () => {
  it('exports CODEX_EXECUTABLE as "codex"', () => {
    expect(CODEX_EXECUTABLE).toBe('codex');
  });

  it('CODEX_NO_WRITE_FLAGS places "-s" immediately followed by "read-only"', () => {
    // The argv-constant assertion relies on `-s read-only` appearing as
    // a contiguous pair so Codex's argv parser receives them as a
    // single --sandbox policy declaration. A regression that separated
    // the two (e.g. flag reorder that shoved a different flag between)
    // would silently leave `-s` dangling and Codex might default to a
    // different policy.
    const flags = [...CODEX_NO_WRITE_FLAGS];
    const sIdx = flags.indexOf('-s');
    expect(sIdx).toBeGreaterThanOrEqual(0);
    expect(flags[sIdx + 1]).toBe('read-only');
  });

  it('CODEX_NO_WRITE_FLAGS includes --json, --ephemeral, --skip-git-repo-check', () => {
    expect(CODEX_NO_WRITE_FLAGS).toContain('--json');
    expect(CODEX_NO_WRITE_FLAGS).toContain('--ephemeral');
    expect(CODEX_NO_WRITE_FLAGS).toContain('--skip-git-repo-check');
  });

  it('CODEX_NO_WRITE_FLAGS contains exactly 6 tokens (pinned surface — additions require contract-test update)', () => {
    // Authoring note: an exact-length pin so that
    // adding ANY new token to CODEX_NO_WRITE_FLAGS — even an ostensibly
    // harmless one — forces a contract-test update alongside, which
    // forces reviewer attention on whether the new token widens the
    // capability surface. Without this pin, adding `--full-auto` would
    // pass all named negative checks but slip past this file.
    expect([...CODEX_NO_WRITE_FLAGS]).toHaveLength(6);
  });

  it('CODEX_NO_WRITE_FLAGS does NOT contain --dangerously-bypass-approvals-and-sandbox', () => {
    // ADR-0009 §2.v capability-boundary anchor. If this flag ever
    // enters the constant, the OS-level no-write sandbox is bypassed
    // and the adapter's capability-boundary claim collapses.
    expect([...CODEX_NO_WRITE_FLAGS]).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  });

  it('CODEX_NO_WRITE_FLAGS does NOT contain --full-auto or --add-dir (write-capable aliases)', () => {
    // `--full-auto` aliases to `--sandbox workspace-write`; `--add-dir`
    // extends writable directories. Both would undermine read-only.
    const flags = [...CODEX_NO_WRITE_FLAGS];
    expect(flags).not.toContain('--full-auto');
    expect(flags).not.toContain('--add-dir');
  });

  it('CODEX_NO_WRITE_FLAGS does NOT contain -o / --output-last-message (CLI-side write path)', () => {
    // Authoring note: Codex's `-o <FILE>` writes the
    // final message to a caller-chosen path. Unlike shell writes from
    // inside the model, `-o` is a CLI wrapper write that bypasses the
    // `-s read-only` model sandbox because it runs in the Codex CLI
    // process itself.
    const flags = [...CODEX_NO_WRITE_FLAGS];
    expect(flags).not.toContain('-o');
    expect(flags).not.toContain('--output-last-message');
  });

  it('CODEX_NO_WRITE_FLAGS does NOT contain -c / --config / -p / --profile (config-layer bypass)', () => {
    // Authoring note: `-c sandbox_mode="workspace-write"`
    // or a profile loaded via `-p name` can reintroduce write
    // capability at the config layer while `-s read-only` still appears
    // in argv. The forbidden-token set covers both surfaces.
    const flags = [...CODEX_NO_WRITE_FLAGS];
    expect(flags).not.toContain('-c');
    expect(flags).not.toContain('--config');
    expect(flags).not.toContain('-p');
    expect(flags).not.toContain('--profile');
  });

  it('CODEX_NO_WRITE_FLAGS starts with the "exec" subcommand', () => {
    // If `exec` drifts to a later position or disappears, the
    // subprocess is no longer running the non-interactive exec mode
    // and the `--json` stream semantics do not apply.
    expect([...CODEX_NO_WRITE_FLAGS][0]).toBe('exec');
  });

  it('CODEX_FORBIDDEN_ARGV_TOKENS enumerates the argv surfaces that bypass -s read-only', () => {
    // Authoring note: the exported forbidden-token set
    // is the module-load runtime assertion's deny-list. Every surface
    // listed here has been empirically (or documentary) shown to widen
    // the sandbox. A future regression that tries to smuggle one of
    // these into CODEX_NO_WRITE_FLAGS fires the module-load throw.
    const forbidden = [...CODEX_FORBIDDEN_ARGV_TOKENS];
    expect(forbidden).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(forbidden).toContain('--full-auto');
    expect(forbidden).toContain('--add-dir');
    expect(forbidden).toContain('-o');
    expect(forbidden).toContain('--output-last-message');
    expect(forbidden).toContain('-c');
    expect(forbidden).toContain('--config');
    expect(forbidden).toContain('-p');
    expect(forbidden).toContain('--profile');
    expect(forbidden).toContain('--sandbox');
    expect(forbidden.length).toBeGreaterThanOrEqual(10);
  });

  it('buildCodexArgs passes openai model and reasoning effort through the allowlisted config key', () => {
    const args = buildCodexArgs({
      prompt: 'hello',
      resolvedSelection: {
        model: { provider: 'openai', model: 'gpt-5.4' },
        effort: 'xhigh',
        skills: [],
        invocation_options: {},
      },
    });

    expect(args.slice(-5)).toEqual([
      '-m',
      'gpt-5.4',
      '-c',
      `${CODEX_REASONING_EFFORT_CONFIG_KEY}="xhigh"`,
      'hello',
    ]);
  });

  it('buildCodexArgs rejects non-openai model providers instead of silently ignoring them', () => {
    expect(() =>
      buildCodexArgs({
        prompt: 'hello',
        resolvedSelection: {
          model: { provider: 'anthropic', model: 'claude-opus-4-7' },
          skills: [],
          invocation_options: {},
        },
      }),
    ).toThrow(/codex adapter cannot honor model provider 'anthropic'/);
  });

  it('buildCodexArgs only emits the model_reasoning_effort config override', () => {
    const args = buildCodexArgs({
      prompt: 'hello',
      resolvedSelection: {
        effort: 'high',
        skills: [],
        invocation_options: {},
      },
    });
    const configIndex = args.indexOf('-c');
    expect(configIndex).toBeGreaterThanOrEqual(0);
    expect(args[configIndex + 1]).toBe(`${CODEX_REASONING_EFFORT_CONFIG_KEY}="high"`);
    expect(args[configIndex + 1]).not.toMatch(/sandbox|approval|profile|permissions/);
  });

  it('buildCodexArgs rejects effort tiers the Codex CLI cannot honor before spawn', () => {
    expect([...CODEX_SUPPORTED_EFFORTS]).toEqual(['low', 'medium', 'high', 'xhigh']);
    for (const effort of ['none', 'minimal'] as const) {
      expect(() =>
        buildCodexArgs({
          prompt: 'hello',
          resolvedSelection: {
            effort,
            skills: [],
            invocation_options: {},
          },
        }),
      ).toThrow(new RegExp(`codex adapter cannot honor effort '${effort}'`));
    }
  });

  it('assertCodexSpawnArgvBoundary allows only one model_reasoning_effort -c override', () => {
    const safeArgs = [
      ...CODEX_NO_WRITE_FLAGS,
      '-c',
      `${CODEX_REASONING_EFFORT_CONFIG_KEY}="high"`,
      'hello',
    ];
    expect(() => assertCodexSpawnArgvBoundary(safeArgs)).not.toThrow();
    expect(() =>
      assertCodexSpawnArgvBoundary([
        ...CODEX_NO_WRITE_FLAGS,
        '-c',
        `${CODEX_REASONING_EFFORT_CONFIG_KEY}="high"`,
        '-c',
        `${CODEX_REASONING_EFFORT_CONFIG_KEY}="low"`,
        'hello',
      ]),
    ).toThrow(/at most one allowlisted -c override/);
    expect(() =>
      assertCodexSpawnArgvBoundary([
        ...CODEX_NO_WRITE_FLAGS,
        '-c',
        'sandbox_mode="workspace-write"',
        'hello',
      ]),
    ).toThrow(/only model_reasoning_effort/);
  });

  it('assertCodexSpawnArgvBoundary rejects config/profile/sandbox rewidening tokens in final argv', () => {
    expect(() =>
      assertCodexSpawnArgvBoundary([
        ...CODEX_NO_WRITE_FLAGS,
        '--config=sandbox_mode="workspace-write"',
        'hello',
      ]),
    ).toThrow(/forbidden argv token "--config=sandbox_mode/);
    expect(() =>
      assertCodexSpawnArgvBoundary([
        ...CODEX_NO_WRITE_FLAGS,
        '--profile',
        'write-enabled',
        'hello',
      ]),
    ).toThrow(/forbidden argv token "--profile"/);
    expect(() =>
      assertCodexSpawnArgvBoundary([...CODEX_NO_WRITE_FLAGS, '--sandbox=workspace-write', 'hello']),
    ).toThrow(/forbidden argv token "--sandbox=workspace-write"/);
    expect(() =>
      assertCodexSpawnArgvBoundary([...CODEX_NO_WRITE_FLAGS, '-s', 'workspace-write', 'hello']),
    ).toThrow(/exactly one "-s read-only"/);
  });
});

// ---- (B) parseCodexStdout parser branches -------------------------------

describe('Codex adapter — parseCodexStdout NDJSON parser branches', () => {
  // Helper: build a well-formed codex `--json` stdout capturing a
  // single-turn dispatch. Caller can override any top-level field set.
  const ndjson = (overrides?: {
    threadId?: string;
    items?: Array<{ type: string; text?: string; id?: string }>;
    omitThreadStarted?: boolean;
    omitTurnCompleted?: boolean;
  }) => {
    const parts: string[] = [];
    if (!overrides?.omitThreadStarted) {
      parts.push(
        JSON.stringify({
          type: 'thread.started',
          thread_id: overrides?.threadId ?? 'thread-abc-123',
        }),
      );
    }
    parts.push(JSON.stringify({ type: 'turn.started' }));
    const items = overrides?.items ?? [
      { type: 'agent_message', id: 'item_0', text: 'final response body' },
    ];
    for (const [idx, it] of items.entries()) {
      parts.push(
        JSON.stringify({
          type: 'item.completed',
          item: { id: it.id ?? `item_${idx}`, type: it.type, text: it.text },
        }),
      );
    }
    if (!overrides?.omitTurnCompleted) {
      parts.push(
        JSON.stringify({
          type: 'turn.completed',
          usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20 },
        }),
      );
    }
    return `${parts.join('\n')}\n`;
  };

  it('extracts receipt_id from thread.started, result_body from terminal agent_message, plumbs cli_version', () => {
    const stdout = ndjson();
    const parsed: CodexDispatchResult = parseCodexStdout(
      stdout,
      'the prompt',
      42,
      'codex-cli 0.118.0',
    );
    expect(parsed.request_payload).toBe('the prompt');
    expect(parsed.receipt_id).toBe('thread-abc-123');
    expect(parsed.result_body).toBe('final response body');
    expect(parsed.duration_ms).toBe(42);
    expect(parsed.cli_version).toBe('codex-cli 0.118.0');
  });

  it('takes the LAST agent_message item when multiple are present (terminal semantics)', () => {
    const stdout = ndjson({
      items: [
        { type: 'agent_message', id: 'item_0', text: 'first' },
        { type: 'reasoning', id: 'item_1', text: 'thinking' },
        { type: 'agent_message', id: 'item_2', text: 'terminal' },
      ],
    });
    const parsed = parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0');
    expect(parsed.result_body).toBe('terminal');
  });

  it('accepts reasoning items alongside agent_message (known-type allowlist)', () => {
    const stdout = ndjson({
      items: [
        { type: 'reasoning', id: 'item_0', text: 'thought' },
        { type: 'agent_message', id: 'item_1', text: 'response' },
      ],
    });
    const parsed = parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0');
    expect(parsed.result_body).toBe('response');
  });

  it('throws on empty stdout', () => {
    expect(() => parseCodexStdout('', 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /codex --json stdout is empty/,
    );
  });

  it('throws on malformed NDJSON line', () => {
    const stdout = `not-json\n${JSON.stringify({ type: 'turn.completed' })}\n`;
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /is not valid JSON/,
    );
  });

  it('throws when thread.started is missing', () => {
    const stdout = ndjson({ omitThreadStarted: true });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /thread\.started event missing/,
    );
  });

  it('throws when thread.started.thread_id is empty', () => {
    const stdout = ndjson({ threadId: '' });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /thread_id missing or empty/,
    );
  });

  it('throws when turn.completed is missing', () => {
    const stdout = ndjson({ omitTurnCompleted: true });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /turn\.completed event missing/,
    );
  });

  it('throws when no agent_message item is present', () => {
    const stdout = ndjson({
      items: [{ type: 'reasoning', id: 'item_0', text: 'only thinking' }],
    });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /no item\.completed\/agent_message event found/,
    );
  });

  it('throws on unknown item.type — capability-boundary allowlist', () => {
    const stdout = ndjson({
      items: [
        { type: 'agent_message', id: 'item_0', text: 'ok' },
        { type: 'apply_patch', id: 'item_1' },
      ],
    });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /capability-boundary violation.*apply_patch.*not in the known-types allowlist/,
    );
  });

  it('throws when agent_message item.text is missing', () => {
    const stdout = ndjson({
      items: [{ type: 'agent_message', id: 'item_0' }],
    });
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /agent_message item\.text missing/,
    );
  });
});

// ---- (B2) real Codex 0.118 JSONL fixtures (HIGH 5 fold-in) -------------

describe('Codex adapter — parseCodexStdout against real Codex 0.118 JSONL fixtures', () => {
  it('parses the real happy-path-ok.jsonl fixture from codex CLI 0.118.0', () => {
    // Fixture source: captured via `codex exec --json -s read-only
    // --ephemeral --skip-git-repo-check "Respond with exactly the
    // single word: OK"` at codex-cli 0.118.0, commit e693441. The
    // fixture is the exact stdout bytes the real subprocess produced
    // — no synthesis, no normalization. Authoring note.
    const stdout = readFileSync(HAPPY_PATH_FIXTURE, 'utf-8');
    const parsed = parseCodexStdout(stdout, 'any prompt', 1234, 'codex-cli 0.118.0');
    expect(parsed.receipt_id).toMatch(/^[0-9a-f-]{30,}$/); // uuid-like thread id
    expect(parsed.result_body).toBe('OK');
    expect(parsed.cli_version).toBe('codex-cli 0.118.0');
  });

  it('rejects the turn-failed.jsonl fixture with a named "codex reported turn.failed" error', () => {
    // Failure-shape fixture modeled on the challenger's observed
    // no-network probe output (no-network probe shape): top-level
    // `error` and `turn.failed` events. Rejected with a named message
    // so dispatch callers see a legible cause rather than "missing
    // turn.completed" and guessing.
    const stdout = readFileSync(TURN_FAILED_FIXTURE, 'utf-8');
    expect(() => parseCodexStdout(stdout, 'any prompt', 0, 'codex-cli 0.118.0')).toThrow(
      /codex reported (error|turn\.failed)/,
    );
  });

  it('rejects an unknown top-level event type (adapter-level capability-boundary allowlist)', () => {
    // Synthesized: a future Codex CLI version might emit a novel
    // top-level event we have not reviewed. The adapter refuses to
    // admit it rather than silently forward it.
    const stdout =
      `${JSON.stringify({ type: 'thread.started', thread_id: 't' })}\n` +
      `${JSON.stringify({ type: 'novel.future.event', foo: 'bar' })}\n` +
      `${JSON.stringify({ type: 'turn.completed' })}\n`;
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /unknown top-level event type 'novel\.future\.event'/,
    );
  });

  it('rejects an event without a string type field', () => {
    const stdout =
      `${JSON.stringify({ type: 'thread.started', thread_id: 't' })}\n` +
      `${JSON.stringify({ kind: 'malformed' })}\n`;
    expect(() => parseCodexStdout(stdout, 'p', 0, 'codex-cli 0.118.0')).toThrow(
      /event has no string 'type' field/,
    );
  });
});

// ---- (C) cross-adapter shape parity ------------------------------------

describe('Codex adapter — cross-adapter shape parity (DispatchResult uniformity)', () => {
  it('CodexDispatchResult has the same field set as the shared DispatchResult', async () => {
    // Structural assertion: both adapters' result types alias the shared
    // `DispatchResult` from `./shared.js`, so the materializer at
    // `dispatch-materializer.ts` can consume them without branching on
    // adapter name. The field set is fixed at 5 fields:
    //   request_payload, receipt_id, result_body, duration_ms, cli_version.
    // If a future slice adds a field to one adapter only, this test
    // becomes the forcing function to either (a) extend the shared shape,
    // (b) keep the field adapter-private.
    const stdout = `${JSON.stringify({ type: 'thread.started', thread_id: 't' })}\n${JSON.stringify({ type: 'item.completed', item: { id: 'i', type: 'agent_message', text: 'x' } })}\n${JSON.stringify({ type: 'turn.completed' })}\n`;
    const result = parseCodexStdout(stdout, 'p', 1, 'codex-cli 0.0.0');
    expect(Object.keys(result).sort()).toEqual(
      ['cli_version', 'duration_ms', 'receipt_id', 'request_payload', 'result_body'].sort(),
    );
  });
});
