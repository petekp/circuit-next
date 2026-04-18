import { describe, expect, it } from 'vitest';
import { Rigor } from '../../src/index.js';

describe('smoke', () => {
  it('vitest runs and schemas import cleanly', () => {
    expect(Rigor.options).toContain('deep');
  });
});
