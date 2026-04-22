import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_ADAPTER_SDK_DEPS,
  checkAdapterImportDiscipline,
  extractImportSpecifiers,
} from '../../scripts/audit.mjs';
import {
  AGENT_CLAUDE_EXECUTABLE,
  AGENT_NO_WRITE_FLAGS,
  type AgentDispatchResult,
  parseAgentStdout,
  sha256Hex,
} from '../../src/runtime/adapters/agent.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// These tests exercise Slice 42 (P2.4 — real agent adapter). Three concerns:
//   (A) src/runtime/adapters/agent.ts shape + stdout parser.
//   (B) Check 29 import-level scan over src/runtime/adapters/** — the
//       complement to Check 28 dep-level guardrail per ADR-0009 §4 Slice 42
//       binding (Codex Slice 41 HIGH 2 fold-in).
//   (C) Capability-boundary flag combo — empirical mechanism enforcing the
//       no-repo-write boundary (Slice 40 HIGH 3 + ADR-0009 §2.v + Slice 41
//       Codex HIGH 4).

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-slice-42-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

// ---- (A) adapter module shape ------------------------------------------

describe('Slice 42 (A) — src/runtime/adapters/agent.ts module shape', () => {
  it('exports AGENT_CLAUDE_EXECUTABLE as "claude"', () => {
    expect(AGENT_CLAUDE_EXECUTABLE).toBe('claude');
  });

  it('AGENT_NO_WRITE_FLAGS contains the five load-bearing capability-boundary flags', () => {
    // These flags together are the subprocess-level mechanism per
    // ADR-0009 §2.v. If any one is removed, the capability-boundary
    // claim weakens and ADR-0009 §6 reopen trigger 5 potentially fires.
    //   --tools "" : zeroes built-in tools.
    //   --strict-mcp-config : no MCP tool paths.
    //   --disable-slash-commands : no skills can re-introduce tools.
    //   --setting-sources "" : no user/project/local settings (no hooks).
    //   --settings "{}" : explicit empty inline settings override.
    expect(AGENT_NO_WRITE_FLAGS).toContain('--tools');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--strict-mcp-config');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--disable-slash-commands');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--setting-sources');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--settings');
    // --tools and --setting-sources both take an empty-string argument;
    // --settings takes a '{}' argument. These bind the semantics.
    const flags = [...AGENT_NO_WRITE_FLAGS];
    expect(flags[flags.indexOf('--tools') + 1]).toBe('');
    expect(flags[flags.indexOf('--setting-sources') + 1]).toBe('');
    expect(flags[flags.indexOf('--settings') + 1]).toBe('{}');
  });

  it('AGENT_NO_WRITE_FLAGS uses -p (headless print mode) + stream-json output + --verbose', () => {
    // Codex Slice 42 HIGH 1 fold-in: `--output-format json` is documented
    // as "single result" in the CLI help; `stream-json` is the explicit
    // streaming protocol (NDJSON), more robust against shape drift, and
    // the format parseAgentStdout() expects. `--verbose` is required by
    // `stream-json`.
    expect(AGENT_NO_WRITE_FLAGS).toContain('-p');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--output-format');
    expect(AGENT_NO_WRITE_FLAGS).toContain('stream-json');
    expect(AGENT_NO_WRITE_FLAGS).toContain('--verbose');
  });

  it('sha256Hex returns a 64-character lowercase hex digest', () => {
    const hex = sha256Hex('hello');
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(hex).toBe(createHash('sha256').update('hello', 'utf8').digest('hex'));
  });

  // Helper: build a well-formed NDJSON stream-json stdout with an init
  // event + one assistant + one result event. Caller can override init
  // fields (e.g. to make tools non-empty for the capability assertion).
  const ndjson = (init: Record<string, unknown>, result: Record<string, unknown>) => {
    const initEvent = {
      type: 'system',
      subtype: 'init',
      session_id: 'sess-abc-123',
      tools: [],
      mcp_servers: [],
      slash_commands: [],
      claude_code_version: '2.1.117',
      ...init,
    };
    const assistantEvent = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'partial' }] },
    };
    const resultEvent = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'final response body',
      ...result,
    };
    return `${JSON.stringify(initEvent)}\n${JSON.stringify(assistantEvent)}\n${JSON.stringify(resultEvent)}\n`;
  };

  it('parseAgentStdout (stream-json NDJSON) extracts receipt_id + result_body + cli_version', () => {
    const stdout = ndjson({}, {});
    const parsed: AgentDispatchResult = parseAgentStdout(stdout, 'the prompt', 42);
    expect(parsed.request_payload).toBe('the prompt');
    expect(parsed.receipt_id).toBe('sess-abc-123');
    expect(parsed.result_body).toBe('final response body');
    expect(parsed.duration_ms).toBe(42);
    expect(parsed.cli_version).toBe('2.1.117');
  });

  it('parseAgentStdout takes the LAST result event (terminal semantics, MED 4 fold-in)', () => {
    const stdout =
      `${JSON.stringify({ type: 'system', subtype: 'init', session_id: 's', tools: [], mcp_servers: [], slash_commands: [], claude_code_version: '2.1.117' })}\n` +
      `${JSON.stringify({ type: 'result', is_error: false, result: 'first' })}\n` +
      `${JSON.stringify({ type: 'result', is_error: false, result: 'terminal' })}\n`;
    const parsed = parseAgentStdout(stdout, 'p', 0);
    expect(parsed.result_body).toBe('terminal');
  });

  it('parseAgentStdout requires subtype===init (MED 4 fold-in)', () => {
    // A system event with a different subtype should not be accepted as
    // the init event — only subtype==='init' carries the capability
    // surface enumeration we gate on.
    const stdout =
      `${JSON.stringify({ type: 'system', subtype: 'reminder', session_id: 's', tools: [], mcp_servers: [], slash_commands: [], claude_code_version: '2.1.117' })}\n` +
      `${JSON.stringify({ type: 'result', is_error: false, result: 'x' })}\n`;
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/system\/init event missing/);
  });

  it('parseAgentStdout throws when init event is missing', () => {
    const stdout = `${JSON.stringify({ type: 'result', is_error: false, result: 'x' })}\n`;
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/init event missing/);
  });

  it('parseAgentStdout throws when result event is missing', () => {
    const stdout = `${JSON.stringify({ type: 'system', subtype: 'init', session_id: 's', tools: [], mcp_servers: [], slash_commands: [], claude_code_version: '2.1.117' })}\n`;
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/result event missing/);
  });

  it('parseAgentStdout throws when is_error is true', () => {
    const stdout = ndjson({}, { is_error: true, result: 'Not logged in' });
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/is_error.*Not logged in/);
  });

  it('parseAgentStdout throws when session_id is empty', () => {
    const stdout = ndjson({ session_id: '' }, {});
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/session_id missing or empty/);
  });

  it('parseAgentStdout throws on malformed NDJSON line', () => {
    const stdout = `not-json-at-all\n${JSON.stringify({ type: 'result' })}\n`;
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/is not valid JSON/);
  });

  it('parseAgentStdout throws on empty stdout', () => {
    expect(() => parseAgentStdout('', 'p', 0)).toThrow(/stream-json stdout is empty/);
  });

  // --- Capability-boundary runtime assertion (HIGH 2 fold-in) -------------

  it('parseAgentStdout fails closed when init.tools is non-empty (HIGH 2 runtime binding)', () => {
    const stdout = ndjson({ tools: ['Write'] }, {});
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(
      /capability-boundary violation: init\.tools must be \[\]/,
    );
  });

  it('parseAgentStdout fails closed when init.mcp_servers is non-empty', () => {
    const stdout = ndjson({ mcp_servers: [{ name: 'fake' }] }, {});
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(
      /capability-boundary violation: init\.mcp_servers must be \[\]/,
    );
  });

  it('parseAgentStdout fails closed when init.slash_commands is non-empty', () => {
    const stdout = ndjson({ slash_commands: ['some-skill'] }, {});
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(
      /capability-boundary violation: init\.slash_commands must be \[\]/,
    );
  });

  it('parseAgentStdout fails closed when cli_version is missing', () => {
    const stdout = ndjson({ claude_code_version: '' }, {});
    expect(() => parseAgentStdout(stdout, 'p', 0)).toThrow(/claude_code_version missing or empty/);
  });
});

// ---- (B) Check 29 — import-level scan ----------------------------------

describe('Slice 42 (B) — Check 29 adapter import discipline (ADR-0009 §4)', () => {
  it('passes green on the live repo src/runtime/adapters/** (regression guard)', () => {
    const result = checkAdapterImportDiscipline(REPO_ROOT);
    expect(result.level).toBe('green');
    expect(result.detail).toMatch(/adapter source file.*scanned/);
    expect(result.detail).toMatch(/0 forbidden imports/);
  });

  it('passes green when adapters directory does not exist (pre-adapter-code vacuity disclosure)', () => {
    withTempRepo((root) => {
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/does not exist/);
    });
  });

  it('fires red on exact-match import of @anthropic-ai/sdk', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/evil.ts',
        "import Anthropic from '@anthropic-ai/sdk';\nconsole.log(Anthropic);\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/@anthropic-ai\/sdk/);
      expect(result.detail).toMatch(/ADR-0009/);
    });
  });

  it('fires red on sub-path import (@anthropic-ai/sdk/resources/messages)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/subpath.ts',
        "import { Messages } from '@anthropic-ai/sdk/resources/messages';\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/@anthropic-ai\/sdk\/resources\/messages/);
    });
  });

  it('fires red on openai import', () => {
    withTempRepo((root) => {
      writeRel(root, 'src/runtime/adapters/openai-attempt.ts', "import OpenAI from 'openai';\n");
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/openai/);
    });
  });

  it('fires red on wrapper-SDK import (ai / Vercel AI SDK)', () => {
    // Codex Slice 41 HIGH 2 bypass hardening — the wrapper/provider SDKs must
    // be caught by the import-level scan, not just Check 28's dep-level scan.
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/vercel-ai-bypass.ts',
        "import { generateText } from 'ai';\nimport { anthropic } from '@ai-sdk/anthropic';\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/'ai'/);
      expect(result.detail).toMatch(/@ai-sdk\/anthropic/);
    });
  });

  it('fires red on langchain binding import', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/langchain.ts',
        "import { ChatAnthropic } from '@langchain/anthropic';\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/@langchain\/anthropic/);
    });
  });

  it('fires red on dynamic import() of a forbidden SDK', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/dyn.ts',
        "export async function load() { return await import('openai'); }\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/openai/);
    });
  });

  it('fires red on CJS require() of a forbidden SDK', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/cjs.ts',
        "const anthropic = require('@anthropic-ai/sdk');\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/@anthropic-ai\/sdk/);
    });
  });

  it('fires red on re-export from a forbidden SDK', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/reexport.ts',
        "export { default } from '@google/genai';\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/@google\/genai/);
    });
  });

  it('fires red on side-effect import of a forbidden SDK', () => {
    withTempRepo((root) => {
      writeRel(root, 'src/runtime/adapters/sidefx.ts', "import 'openai';\n");
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/openai/);
    });
  });

  it('passes green on a permitted node stdlib import', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/stdlib.ts',
        "import { spawn } from 'node:child_process';\nimport { createHash } from 'node:crypto';\nexport { spawn, createHash };\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/0 forbidden imports/);
    });
  });

  it('skips .d.ts declaration files (types, not runtime imports)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/types.d.ts',
        "// type-only module; declarations do not execute\nimport type { Foo } from 'openai';\nexport type { Foo };\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('green');
    });
  });

  it('fires red on synthetic-forbidden-entry override (vacuity guard)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/custom.ts',
        "import { x } from 'some-adapter-wrapper';\n",
      );
      const result = checkAdapterImportDiscipline(root, {
        forbiddenDeps: ['some-adapter-wrapper'],
      });
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/some-adapter-wrapper/);
    });
  });

  it('fires red on empty forbidden list (vacuity guard)', () => {
    const result = checkAdapterImportDiscipline(REPO_ROOT, { forbiddenDeps: [] });
    expect(result.level).toBe('red');
    expect(result.detail).toMatch(/empty/);
  });

  // --- Codex Slice 42 MED 1 fold-in: comment & bypass hardening --------

  it('does NOT false-positive on a forbidden id mentioned inside a // line comment', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/docstring.ts',
        "// This adapter does NOT import from 'openai'; it spawns the CLI.\nexport const x = 1;\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('green');
    });
  });

  it('does NOT false-positive on a forbidden id inside a /* block comment */', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/blockdoc.ts',
        "/* Prior art used `import Anthropic from '@anthropic-ai/sdk'`; this\n   adapter replaces it with a subprocess per ADR-0009. */\nexport const x = 2;\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('green');
    });
  });

  it('fires red on inline createRequire()(<forbidden>) bypass (MED 1 fold-in)', () => {
    // Inline `createRequire(import.meta.url)('openai')` is the regex-
    // catchable form of the bypass. The aliased form — `const r =
    // createRequire(...); r('openai')` — is NOT detectable without flow
    // analysis and is documented as a known trade-off of the regex-based
    // scan. A future AST-based upgrade would close that gap.
    withTempRepo((root) => {
      writeRel(
        root,
        'src/runtime/adapters/createrequire-bypass.ts',
        "import { createRequire } from 'node:module';\nconst openai = createRequire(import.meta.url)('openai');\n",
      );
      const result = checkAdapterImportDiscipline(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/openai/);
    });
  });
});

// ---- (C) capability-boundary flag combo binding -------------------------

describe('Slice 42 (C) — capability-boundary flag binding (ADR-0009 §2.v)', () => {
  it('AGENT_NO_WRITE_FLAGS begins with -p and places --tools + empty arg contiguously', () => {
    // Compile-time check via `as const`; runtime mutation would violate
    // the capability-boundary claim. The array is passed by spread, so a
    // runtime mutation of the module constant would re-route every future
    // subprocess invocation — we assert the declaration is `as const`
    // by confirming it is a plain array with the expected element order.
    const flags = [...AGENT_NO_WRITE_FLAGS];
    expect(flags[0]).toBe('-p');
    const toolsIdx = flags.indexOf('--tools');
    expect(flags[toolsIdx + 1]).toBe('');
  });

  it('FORBIDDEN_ADAPTER_SDK_DEPS contains 15 entries and all are caught by extractImportSpecifiers', () => {
    // Each forbidden identifier is recognized by the import-scan regex in
    // its most common ESM form. This binds the dep-level (Check 28) and
    // import-level (Check 29) guardrails to the same identifier set.
    expect(FORBIDDEN_ADAPTER_SDK_DEPS).toHaveLength(15);
    for (const id of FORBIDDEN_ADAPTER_SDK_DEPS) {
      const src = `import x from '${id}';\n`;
      const specs = extractImportSpecifiers(src);
      expect(specs).toContain(id);
    }
  });
});
