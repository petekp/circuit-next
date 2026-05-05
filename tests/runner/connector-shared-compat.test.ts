import { describe, expect, it } from 'vitest';

import {
  extractJsonObject as runtimeExtractJsonObject,
  selectedModelForProvider as runtimeSelectedModelForProvider,
} from '../../src/runtime/connectors/shared.js';
import { sha256Hex as runtimeSha256Hex } from '../../src/runtime/connectors/shared.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import {
  extractJsonObject as sharedExtractJsonObject,
  selectedModelForProvider as sharedSelectedModelForProvider,
} from '../../src/shared/connector-helpers.js';
import { sha256Hex as sharedSha256Hex } from '../../src/shared/connector-relay.js';

describe('connector shared compatibility wrapper', () => {
  it('keeps sha256Hex identical through the shared and runtime paths', () => {
    const payload = 'circuit-next connector relay payload';

    expect(sharedSha256Hex(payload)).toBe(runtimeSha256Hex(payload));
    expect(sharedSha256Hex(payload)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps extractJsonObject identical through the shared and runtime paths', () => {
    const payload = 'Status: done.\n{"verdict":"ok","note":"contains } and { braces"}\nDone.';

    expect(sharedExtractJsonObject(payload)).toBe(runtimeExtractJsonObject(payload));
    expect(sharedExtractJsonObject(payload)).toBe(
      '{"verdict":"ok","note":"contains } and { braces"}',
    );
  });

  it('keeps selectedModelForProvider identical through the shared and runtime paths', () => {
    const selection: ResolvedSelection = {
      model: { provider: 'openai', model: 'gpt-5.4' },
      effort: 'low',
      skills: [],
      invocation_options: {},
    };

    expect(sharedSelectedModelForProvider('codex', selection, 'openai')).toBe(
      runtimeSelectedModelForProvider('codex', selection, 'openai'),
    );
    expect(() => sharedSelectedModelForProvider('codex', selection, 'anthropic')).toThrow(
      /cannot honor model provider/,
    );
    expect(() => runtimeSelectedModelForProvider('codex', selection, 'anthropic')).toThrow(
      /cannot honor model provider/,
    );
  });
});
