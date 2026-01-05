/**
 * Rate limiting tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('rate limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('limits requests within a window and resets after the window', () => {
    const { RateLimiter } = require('../../../src/utils/rate-limit');
    const limiter = new RateLimiter();

    expect(limiter.check('k', 2, 1000).allowed).toBe(true);
    expect(limiter.check('k', 2, 1000).allowed).toBe(true);

    const denied = limiter.check('k', 2, 1000);
    expect(denied.allowed).toBe(false);
    expect(typeof denied.retryAfterMs).toBe('number');

    jest.setSystemTime(new Date('2026-01-05T00:00:01.001Z'));
    expect(limiter.check('k', 2, 1000).allowed).toBe(true);
  });

  it('sweeps old buckets', () => {
    const { RateLimiter } = require('../../../src/utils/rate-limit');
    const limiter = new RateLimiter();

    limiter.check('old', 1, 1000);
    jest.setSystemTime(new Date('2026-01-05T00:10:00.000Z'));
    limiter.sweep(0);

    // Should behave like new after sweep
    expect(limiter.check('old', 1, 1000).allowed).toBe(true);
  });
});

