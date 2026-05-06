import { describe, expect, it } from 'vitest';

import {
  buildClaudeCodeArgs as neutralBuildClaudeCodeArgs,
  CLAUDE_CODE_DISPATCH_FLAGS as neutralClaudeCodeDispatchFlags,
  CLAUDE_CODE_EXECUTABLE as neutralClaudeCodeExecutable,
  CLAUDE_CODE_SUPPORTED_EFFORTS as neutralClaudeCodeSupportedEfforts,
  parseClaudeCodeStdout as neutralParseClaudeCodeStdout,
  relayClaudeCode as neutralRelayClaudeCode,
} from '../../src/connectors/claude-code.js';
import {
  assertCodexSpawnArgvBoundary as neutralAssertCodexSpawnArgvBoundary,
  buildCodexArgs as neutralBuildCodexArgs,
  CODEX_EXECUTABLE as neutralCodexExecutable,
  CODEX_FORBIDDEN_ARGV_TOKENS as neutralCodexForbiddenArgvTokens,
  CODEX_NO_WRITE_FLAGS as neutralCodexNoWriteFlags,
  CODEX_REASONING_EFFORT_CONFIG_KEY as neutralCodexReasoningEffortConfigKey,
  CODEX_SUPPORTED_EFFORTS as neutralCodexSupportedEfforts,
  parseCodexStdout as neutralParseCodexStdout,
  relayCodex as neutralRelayCodex,
} from '../../src/connectors/codex.js';
import { relayCustom as neutralRelayCustom } from '../../src/connectors/custom.js';
import { materializeRelay as neutralMaterializeRelay } from '../../src/connectors/relay-materializer.js';
import {
  extractJsonObject as neutralExtractJsonObject,
  selectedModelForProvider as neutralSelectedModelForProvider,
  sha256Hex as neutralSha256Hex,
} from '../../src/connectors/shared.js';
import {
  buildClaudeCodeArgs as runtimeBuildClaudeCodeArgs,
  CLAUDE_CODE_DISPATCH_FLAGS as runtimeClaudeCodeDispatchFlags,
  CLAUDE_CODE_EXECUTABLE as runtimeClaudeCodeExecutable,
  CLAUDE_CODE_SUPPORTED_EFFORTS as runtimeClaudeCodeSupportedEfforts,
  parseClaudeCodeStdout as runtimeParseClaudeCodeStdout,
  relayClaudeCode as runtimeRelayClaudeCode,
} from '../../src/runtime/connectors/claude-code.js';
import {
  assertCodexSpawnArgvBoundary as runtimeAssertCodexSpawnArgvBoundary,
  buildCodexArgs as runtimeBuildCodexArgs,
  CODEX_EXECUTABLE as runtimeCodexExecutable,
  CODEX_FORBIDDEN_ARGV_TOKENS as runtimeCodexForbiddenArgvTokens,
  CODEX_NO_WRITE_FLAGS as runtimeCodexNoWriteFlags,
  CODEX_REASONING_EFFORT_CONFIG_KEY as runtimeCodexReasoningEffortConfigKey,
  CODEX_SUPPORTED_EFFORTS as runtimeCodexSupportedEfforts,
  parseCodexStdout as runtimeParseCodexStdout,
  relayCodex as runtimeRelayCodex,
} from '../../src/runtime/connectors/codex.js';
import { relayCustom as runtimeRelayCustom } from '../../src/runtime/connectors/custom.js';
import { materializeRelay as runtimeMaterializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
import {
  extractJsonObject as runtimeExtractJsonObject,
  selectedModelForProvider as runtimeSelectedModelForProvider,
  sha256Hex as runtimeSha256Hex,
} from '../../src/runtime/connectors/shared.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import {
  extractJsonObject as sharedExtractJsonObject,
  selectedModelForProvider as sharedSelectedModelForProvider,
} from '../../src/shared/connector-helpers.js';
import { sha256Hex as sharedSha256Hex } from '../../src/shared/connector-relay.js';

describe('connector shared compatibility wrapper', () => {
  it('keeps sha256Hex identical through the shared, neutral, and runtime paths', () => {
    const payload = 'circuit-next connector relay payload';

    expect(sharedSha256Hex(payload)).toBe(neutralSha256Hex(payload));
    expect(sharedSha256Hex(payload)).toBe(runtimeSha256Hex(payload));
    expect(sharedSha256Hex(payload)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps extractJsonObject identical through the shared, neutral, and runtime paths', () => {
    const payload = 'Status: done.\n{"verdict":"ok","note":"contains } and { braces"}\nDone.';

    expect(sharedExtractJsonObject(payload)).toBe(neutralExtractJsonObject(payload));
    expect(sharedExtractJsonObject(payload)).toBe(runtimeExtractJsonObject(payload));
    expect(sharedExtractJsonObject(payload)).toBe(
      '{"verdict":"ok","note":"contains } and { braces"}',
    );
  });

  it('keeps selectedModelForProvider identical through the shared, neutral, and runtime paths', () => {
    const selection: ResolvedSelection = {
      model: { provider: 'openai', model: 'gpt-5.4' },
      effort: 'low',
      skills: [],
      invocation_options: {},
    };

    expect(sharedSelectedModelForProvider('codex', selection, 'openai')).toBe(
      neutralSelectedModelForProvider('codex', selection, 'openai'),
    );
    expect(sharedSelectedModelForProvider('codex', selection, 'openai')).toBe(
      runtimeSelectedModelForProvider('codex', selection, 'openai'),
    );
    expect(() => sharedSelectedModelForProvider('codex', selection, 'anthropic')).toThrow(
      /cannot honor model provider/,
    );
    expect(() => neutralSelectedModelForProvider('codex', selection, 'anthropic')).toThrow(
      /cannot honor model provider/,
    );
    expect(() => runtimeSelectedModelForProvider('codex', selection, 'anthropic')).toThrow(
      /cannot honor model provider/,
    );
  });

  it('keeps old runtime connector paths as re-exports of the neutral implementations', () => {
    expect(runtimeRelayClaudeCode).toBe(neutralRelayClaudeCode);
    expect(runtimeParseClaudeCodeStdout).toBe(neutralParseClaudeCodeStdout);
    expect(runtimeBuildClaudeCodeArgs).toBe(neutralBuildClaudeCodeArgs);
    expect(runtimeClaudeCodeDispatchFlags).toBe(neutralClaudeCodeDispatchFlags);
    expect(runtimeClaudeCodeExecutable).toBe(neutralClaudeCodeExecutable);
    expect(runtimeClaudeCodeSupportedEfforts).toBe(neutralClaudeCodeSupportedEfforts);

    expect(runtimeRelayCodex).toBe(neutralRelayCodex);
    expect(runtimeParseCodexStdout).toBe(neutralParseCodexStdout);
    expect(runtimeBuildCodexArgs).toBe(neutralBuildCodexArgs);
    expect(runtimeAssertCodexSpawnArgvBoundary).toBe(neutralAssertCodexSpawnArgvBoundary);
    expect(runtimeCodexNoWriteFlags).toBe(neutralCodexNoWriteFlags);
    expect(runtimeCodexForbiddenArgvTokens).toBe(neutralCodexForbiddenArgvTokens);
    expect(runtimeCodexExecutable).toBe(neutralCodexExecutable);
    expect(runtimeCodexReasoningEffortConfigKey).toBe(neutralCodexReasoningEffortConfigKey);
    expect(runtimeCodexSupportedEfforts).toBe(neutralCodexSupportedEfforts);

    expect(runtimeRelayCustom).toBe(neutralRelayCustom);
    expect(runtimeMaterializeRelay).toBe(neutralMaterializeRelay);
  });
});
