import { describe, expect, it } from 'vitest';

import { recoveryRouteForExecutableStep } from '../../src/core-v2/run/v1-compat.js';
import { RECOVERY_ROUTE_PRIORITY, recoveryRouteForStep } from '../../src/shared/recovery-route.js';

describe('recovery route selection', () => {
  it('uses the shared priority order for retained and core-v2 route selection', () => {
    const step = {
      routes: {
        revise: 'revise-step',
        retry: 'retry-step',
        escalate: '@escalate',
      },
    };

    expect(RECOVERY_ROUTE_PRIORITY).toEqual([
      'retry',
      'revise',
      'ask',
      'stop',
      'handoff',
      'escalate',
    ]);
    expect(recoveryRouteForStep(step)).toBe('retry');
    expect(
      recoveryRouteForExecutableStep(
        step as unknown as Parameters<typeof recoveryRouteForExecutableStep>[0],
      ),
    ).toBe('retry');
  });

  it('honors an allowed-route subset without changing the canonical order', () => {
    const step = {
      routes: {
        retry: 'retry-step',
        ask: 'ask-step',
        handoff: '@handoff',
      },
    };

    expect(recoveryRouteForStep(step, ['handoff', 'ask'])).toBe('ask');
    expect(recoveryRouteForStep(step, ['escalate'])).toBeUndefined();
  });
});
