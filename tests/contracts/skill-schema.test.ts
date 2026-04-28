// SkillDescriptor schema contract — SKILL-I1..I6 from
// docs/contracts/skill.md v0.1.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { SkillDescriptor } from '../../src/index.js';

describe('SkillDescriptor — SKILL-I1..I6 from docs/contracts/skill.md v0.1', () => {
  const base = {
    id: 'tdd',
    title: 'Test-Driven Development',
    description: 'Red-green-refactor.',
    trigger: 'when the user asks to write tests first',
  };

  it('SKILL-I3 — parses with default domain', () => {
    const parsed = SkillDescriptor.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.domain).toBe('domain-general');
    }
  });

  it('SKILL-I1 — rejects invalid SkillId (uppercase)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: 'TDD' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I1 — rejects invalid SkillId (leading digit)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: '1tdd' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I1 — rejects SkillId with path separator', () => {
    const bad = SkillDescriptor.safeParse({ ...base, id: 'foo/bar' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty title', () => {
    const bad = SkillDescriptor.safeParse({ ...base, title: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty description', () => {
    const bad = SkillDescriptor.safeParse({ ...base, description: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I2 — rejects empty trigger', () => {
    const bad = SkillDescriptor.safeParse({ ...base, trigger: '' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I3 — rejects unknown domain', () => {
    const bad = SkillDescriptor.safeParse({ ...base, domain: 'marketing' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I3 — accepts each closed-enum domain', () => {
    for (const d of ['coding', 'design', 'research', 'ops', 'domain-general'] as const) {
      expect(SkillDescriptor.safeParse({ ...base, domain: d }).success).toBe(true);
    }
  });

  it('SKILL-I4 — capabilities optional: undefined is legal', () => {
    const parsed = SkillDescriptor.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('SKILL-I4 — rejects capabilities: []', () => {
    const bad = SkillDescriptor.safeParse({ ...base, capabilities: [] });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I4 — rejects empty-string element in capabilities', () => {
    const bad = SkillDescriptor.safeParse({ ...base, capabilities: ['red-green', ''] });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I4 — accepts non-empty capabilities', () => {
    const parsed = SkillDescriptor.safeParse({
      ...base,
      capabilities: ['red-green-refactor', 'property-based'],
    });
    expect(parsed.success).toBe(true);
  });

  it('SKILL-I5 — rejects surplus keys (strict)', () => {
    const bad = SkillDescriptor.safeParse({ ...base, version: '1.0.0' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I5 — rejects ad-hoc selection-override smuggle key', () => {
    const bad = SkillDescriptor.safeParse({ ...base, connector: 'agent' });
    expect(bad.success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited id via prototype chain', () => {
    const { id, ...rest } = base;
    const smuggled = Object.create({ id });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited title via prototype chain', () => {
    const { title, ...rest } = base;
    const smuggled = Object.create({ title });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited description via prototype chain', () => {
    const { description, ...rest } = base;
    const smuggled = Object.create({ description });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });

  it('SKILL-I6 — rejects inherited trigger via prototype chain', () => {
    const { trigger, ...rest } = base;
    const smuggled = Object.create({ trigger });
    Object.assign(smuggled, rest);
    expect(SkillDescriptor.safeParse(smuggled).success).toBe(false);
  });
});
