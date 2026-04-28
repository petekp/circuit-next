import { describe, expect, it } from 'vitest';
import { Depth } from '../../src/index.js';

describe('smoke', () => {
  it('vitest runs and schemas import cleanly', () => {
    expect(Depth.options).toContain('deep');
  });
});
