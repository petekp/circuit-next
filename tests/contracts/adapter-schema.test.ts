// Adapter contract — ADAPTER-I1..I11 from
// docs/contracts/adapter.md v0.1, plus the Config + adapter registry
// parity checks.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import {
  AdapterName,
  AdapterRef,
  AdapterReference,
  BuiltInAdapter,
  Config,
  CustomAdapterDescriptor,
  DispatchConfig,
  DispatchResolutionSource,
  Event,
  RESERVED_ADAPTER_NAMES,
  ResolvedAdapter,
} from '../../src/index.js';
import { RUN_A } from '../helpers/runlog-builders.js';

describe('Config + adapter registry', () => {
  it('dispatch.default parses auto/builtin/registered-adapter-name', () => {
    const a = DispatchConfig.safeParse({ default: 'auto' });
    expect(a.success).toBe(true);
    const b = DispatchConfig.safeParse({ default: 'codex-isolated' });
    expect(b.success).toBe(true);
  });

  it('dispatch.default rejects unknown adapter name without registry entry', () => {
    const bad = DispatchConfig.safeParse({ default: 'gemini' });
    expect(bad.success).toBe(false);
  });

  it('dispatch.default resolves to registered named adapter', () => {
    const ok = DispatchConfig.safeParse({
      default: 'gemini',
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./docs/examples/gemini-dispatch.sh', '--model', 'gemini-2.5-pro'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });

  it('role adapter reference to unregistered named adapter fails', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini' } },
    });
    expect(bad.success).toBe(false);
  });

  it('Config with empty input applies all defaults', () => {
    const c = Config.safeParse({ schema_version: 1 });
    expect(c.success).toBe(true);
    if (c.success) {
      expect(c.data.dispatch.default).toBe('auto');
    }
  });
});
describe('BuiltInAdapter (ADAPTER-I1)', () => {
  it('accepts the 3 declared built-ins', () => {
    expect(BuiltInAdapter.safeParse('agent').success).toBe(true);
    expect(BuiltInAdapter.safeParse('codex').success).toBe(true);
    expect(BuiltInAdapter.safeParse('codex-isolated').success).toBe(true);
  });

  it('rejects unknown built-in names', () => {
    expect(BuiltInAdapter.safeParse('gemini').success).toBe(false);
    expect(BuiltInAdapter.safeParse('ollama').success).toBe(false);
    expect(BuiltInAdapter.safeParse('').success).toBe(false);
  });

  it('built-in enum is the frozen 3-tuple and ordering is stable', () => {
    expect(BuiltInAdapter.options).toEqual(['agent', 'codex', 'codex-isolated']);
  });
});

describe('AdapterName regex (ADAPTER-I2 syntax)', () => {
  it('accepts lowercase, digits-after-first, hyphens', () => {
    expect(AdapterName.safeParse('gemini').success).toBe(true);
    expect(AdapterName.safeParse('ollama-local').success).toBe(true);
    expect(AdapterName.safeParse('a1-b2-c3').success).toBe(true);
  });

  it('rejects uppercase, leading digit, whitespace, empty, underscores', () => {
    expect(AdapterName.safeParse('Gemini').success).toBe(false);
    expect(AdapterName.safeParse('1gemini').success).toBe(false);
    expect(AdapterName.safeParse('gem ini').success).toBe(false);
    expect(AdapterName.safeParse('').success).toBe(false);
    expect(AdapterName.safeParse('gem_ini').success).toBe(false);
    expect(AdapterName.safeParse('-gemini').success).toBe(false);
  });
});

describe('RESERVED_ADAPTER_NAMES (ADAPTER-I2 reservation set)', () => {
  it('contains every built-in plus the auto sentinel and nothing else', () => {
    expect(RESERVED_ADAPTER_NAMES).toEqual(['agent', 'codex', 'codex-isolated', 'auto']);
  });
});

describe('CustomAdapterDescriptor (ADAPTER-I3)', () => {
  const ok = {
    kind: 'custom' as const,
    name: 'gemini',
    command: ['./docs/examples/gemini-dispatch.sh', '--model', 'gemini-2.5-pro'],
  };

  it('parses a well-formed descriptor', () => {
    expect(CustomAdapterDescriptor.safeParse(ok).success).toBe(true);
  });

  it('rejects empty command vector', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: [] }).success).toBe(false);
  });

  it('rejects empty string element in command (ADAPTER-I3 element-level min)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: ['codex', ''] }).success).toBe(
      false,
    );
    expect(CustomAdapterDescriptor.safeParse({ ...ok, command: [''] }).success).toBe(false);
  });

  it('rejects surplus keys (ADAPTER-I9 transitive .strict() on the descriptor)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, env: { API_KEY: 'x' } }).success).toBe(false);
  });

  it('rejects wrong kind literal (ADAPTER-I4 discriminant)', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, kind: 'builtin' }).success).toBe(false);
  });

  it('rejects name that violates AdapterName regex', () => {
    expect(CustomAdapterDescriptor.safeParse({ ...ok, name: 'Gemini' }).success).toBe(false);
  });
});

describe('AdapterRef discriminated union (ADAPTER-I4)', () => {
  it('accepts builtin variant', () => {
    const ok = AdapterRef.safeParse({ kind: 'builtin', name: 'codex-isolated' });
    expect(ok.success).toBe(true);
  });

  it('accepts named variant', () => {
    const ok = AdapterRef.safeParse({ kind: 'named', name: 'gemini' });
    expect(ok.success).toBe(true);
  });

  it('accepts inline custom variant (distinct from AdapterReference — ADAPTER-I5)', () => {
    const ok = AdapterRef.safeParse({
      kind: 'custom',
      name: 'gemini',
      command: ['./bin/gemini-dispatch'],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown kind discriminant', () => {
    const bad = AdapterRef.safeParse({ kind: 'mystery', name: 'x' });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key on builtin variant (ADAPTER-I9 transitive strict)', () => {
    const bad = AdapterRef.safeParse({ kind: 'builtin', name: 'codex', hint: 'x' });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus key on named variant', () => {
    const bad = AdapterRef.safeParse({ kind: 'named', name: 'gemini', alias: 'g' });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchConfig reserved-name disjointness (ADAPTER-I2)', () => {
  it('rejects a custom adapter keyed under a BuiltInAdapter value', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        codex: {
          kind: 'custom',
          name: 'codex',
          command: ['./bin/shadow-codex'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a custom adapter keyed under the `auto` sentinel', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        auto: {
          kind: 'custom',
          name: 'auto',
          command: ['./bin/pick-for-me'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('accepts non-reserved custom adapter names', () => {
    const ok = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchConfig strict surface (ADAPTER-I9)', () => {
  it('rejects surplus top-level key (`dispatch.adpaters` typo transposition)', () => {
    const bad = DispatchConfig.safeParse({
      adpaters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference (registry-layer) with inline custom kind — ADAPTER-I5', () => {
    const bad = DispatchConfig.safeParse({
      roles: {
        researcher: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference surplus keys (typo smuggle)', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini', alias: 'g' } },
      adapters: {
        gemini: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects AdapterReference with unknown kind discriminant', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'inline', name: 'gemini' } },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects DispatchRole key outside the closed enum (ADAPTER-I6 — orchestrator not a role)', () => {
    const bad = DispatchConfig.safeParse({
      roles: { orchestrator: { kind: 'builtin', name: 'codex' } },
    });
    expect(bad.success).toBe(false);
  });
});

describe('DispatchResolutionSource (ADAPTER-I7)', () => {
  it('accepts the 5 category variants with correct disambiguators', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'explicit' }).success).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'role', role: 'researcher' }).success).toBe(
      true,
    );
    expect(
      DispatchResolutionSource.safeParse({ source: 'circuit', workflow_id: 'explore' }).success,
    ).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'default' }).success).toBe(true);
    expect(DispatchResolutionSource.safeParse({ source: 'auto' }).success).toBe(true);
  });

  it('rejects role variant missing the role disambiguator', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'role' }).success).toBe(false);
  });

  it('rejects circuit variant missing the workflow_id disambiguator', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'circuit' }).success).toBe(false);
  });

  it('rejects role with a disambiguator for a different category (cross-variant smuggle)', () => {
    const bad = DispatchResolutionSource.safeParse({
      source: 'role',
      workflow_id: 'explore',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects unknown source category', () => {
    expect(DispatchResolutionSource.safeParse({ source: 'heuristic' }).success).toBe(false);
  });

  it('rejects surplus keys on every variant (ADAPTER-I9)', () => {
    expect(
      DispatchResolutionSource.safeParse({ source: 'explicit', flag: '--adapter' }).success,
    ).toBe(false);
    expect(
      DispatchResolutionSource.safeParse({
        source: 'role',
        role: 'researcher',
        fallback: 'default',
      }).success,
    ).toBe(false);
    expect(
      DispatchResolutionSource.safeParse({
        source: 'circuit',
        workflow_id: 'explore',
        smuggled: 'x',
      }).success,
    ).toBe(false);
    expect(DispatchResolutionSource.safeParse({ source: 'default', hint: 'x' }).success).toBe(
      false,
    );
    expect(DispatchResolutionSource.safeParse({ source: 'auto', reason: 'x' }).success).toBe(false);
  });

  it('rejects role variant with an invalid DispatchRole value (closed-enum parity)', () => {
    expect(
      DispatchResolutionSource.safeParse({ source: 'role', role: 'orchestrator' }).success,
    ).toBe(false);
  });
});

describe('DispatchStartedEvent.resolved_from consumes DispatchResolutionSource (ADAPTER-I7 × event)', () => {
  const base = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    adapter: { kind: 'builtin' as const, name: 'codex' as const },
    role: 'researcher' as const,
    resolved_selection: { skills: [] },
  };

  it('accepts role-sourced dispatch with role disambiguator', () => {
    const ok = Event.safeParse({
      ...base,
      resolved_from: { source: 'role', role: 'researcher' },
    });
    expect(ok.success).toBe(true);
  });

  it('accepts circuit-sourced dispatch with workflow_id disambiguator', () => {
    const ok = Event.safeParse({
      ...base,
      resolved_from: { source: 'circuit', workflow_id: 'explore' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects pre-ADAPTER-I7 flat-enum shape (migration guard)', () => {
    const bad = Event.safeParse({
      ...base,
      resolved_from: 'role',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects role-sourced dispatch missing the role disambiguator', () => {
    const bad = Event.safeParse({
      ...base,
      resolved_from: { source: 'role' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('ADAPTER-I10 — ResolvedAdapter rejects pre-resolution named references', () => {
  it('accepts built-in variant', () => {
    expect(ResolvedAdapter.safeParse({ kind: 'builtin', name: 'codex-isolated' }).success).toBe(
      true,
    );
  });

  it('accepts inline custom descriptor variant', () => {
    expect(
      ResolvedAdapter.safeParse({
        kind: 'custom',
        name: 'gemini',
        command: ['./bin/g'],
      }).success,
    ).toBe(true);
  });

  it('rejects named reference — resolver must dereference before event emission', () => {
    expect(ResolvedAdapter.safeParse({ kind: 'named', name: 'gemini' }).success).toBe(false);
  });
});

describe('ADAPTER-I10 — DispatchStartedEvent.adapter rejects named references via event', () => {
  const baseEv = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    role: 'researcher' as const,
    resolved_selection: { skills: [] },
    resolved_from: { source: 'explicit' as const },
  };

  it('parses with a fully-resolved built-in adapter', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'builtin', name: 'codex' },
      }).success,
    ).toBe(true);
  });

  it('parses with a fully-resolved custom descriptor', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      }).success,
    ).toBe(true);
  });

  it('rejects a pre-resolution named reference in event.adapter', () => {
    expect(
      Event.safeParse({
        ...baseEv,
        adapter: { kind: 'named', name: 'gemini' },
      }).success,
    ).toBe(false);
  });
});

describe('DispatchConfig registry-key/descriptor-name parity (ADAPTER-I11)', () => {
  it('ADAPTER-I11 — rejects a descriptor whose `name` does not equal its registry key', () => {
    const bad = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'ollama',
          command: ['./bin/ollama'],
        },
      },
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I11 — accepts matching registry key and descriptor name', () => {
    const ok = DispatchConfig.safeParse({
      adapters: {
        gemini: {
          kind: 'custom',
          name: 'gemini',
          command: ['./bin/gemini'],
        },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchConfig closure via own-property check (ADAPTER-I8)', () => {
  it('ADAPTER-I8 — rejects a role reference to `constructor` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'constructor' } },
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — rejects a circuit reference to `toString` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      circuits: { explore: { kind: 'named', name: 'toString' } },
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — rejects dispatch.default = `hasOwnProperty` when no own registry entry exists', () => {
    const bad = DispatchConfig.safeParse({
      default: 'hasOwnProperty',
      adapters: {},
    });
    expect(bad.success).toBe(false);
  });

  it('ADAPTER-I8 — accepts a role reference to a name that IS registered as an own key', () => {
    const ok = DispatchConfig.safeParse({
      roles: { researcher: { kind: 'named', name: 'gemini' } },
      adapters: {
        gemini: { kind: 'custom', name: 'gemini', command: ['./bin/g'] },
      },
    });
    expect(ok.success).toBe(true);
  });
});

describe('DispatchStartedEvent role ↔ resolved_from.role binding', () => {
  const baseEv = {
    schema_version: 1 as const,
    sequence: 0,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: RUN_A,
    kind: 'dispatch.started' as const,
    step_id: 'frame',
    attempt: 1,
    adapter: { kind: 'builtin' as const, name: 'codex' as const },
    resolved_selection: { skills: [] },
  };

  it('accepts event when role matches resolved_from.role', () => {
    const ok = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'role', role: 'researcher' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects event when role disagrees with resolved_from.role', () => {
    const bad = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'role', role: 'reviewer' },
    });
    expect(bad.success).toBe(false);
  });

  it('binding only applies when resolved_from.source === "role"', () => {
    const ok = Event.safeParse({
      ...baseEv,
      role: 'researcher',
      resolved_from: { source: 'default' },
    });
    expect(ok.success).toBe(true);
  });
});

describe('AdapterReference registry-layer refusal — exported surface', () => {
  it('accepts builtin variant', () => {
    expect(AdapterReference.safeParse({ kind: 'builtin', name: 'codex' }).success).toBe(true);
  });

  it('accepts named variant', () => {
    expect(AdapterReference.safeParse({ kind: 'named', name: 'gemini' }).success).toBe(true);
  });

  it('rejects inline custom variant (ADAPTER-I5 — registry references by name only)', () => {
    const bad = AdapterReference.safeParse({
      kind: 'custom',
      name: 'gemini',
      command: ['./bin/g'],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects surplus keys (per-variant strict)', () => {
    expect(AdapterReference.safeParse({ kind: 'named', name: 'gemini', alias: 'g' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Config contract — CONFIG-I1 through CONFIG-I7.
// ---------------------------------------------------------------------------
