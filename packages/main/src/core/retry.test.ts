import { describe, it, expect, vi } from 'vitest';
import { classifyError, withBackoff } from './retry.js';

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

describe('classifyError', () => {
  it('classifies 401 as auth non-retryable', () => {
    expect(classifyError(new HttpError(401))).toEqual({ kind: 'auth', retryable: false });
  });
  it('classifies 429 as rate_limit retryable', () => {
    expect(classifyError(new HttpError(429))).toEqual({ kind: 'rate_limit', retryable: true });
  });
  it('classifies 5xx as server retryable', () => {
    expect(classifyError(new HttpError(503))).toEqual({ kind: 'server', retryable: true });
  });
  it('classifies ENOTFOUND as network retryable', () => {
    expect(classifyError(new Error('getaddrinfo ENOTFOUND api'))).toEqual({
      kind: 'network',
      retryable: true,
    });
  });
});

describe('withBackoff', () => {
  it('returns value on first success', async () => {
    const r = await withBackoff(async () => 42);
    expect(r).toBe(42);
  });
  it('retries retryable errors up to 3 times', async () => {
    let calls = 0;
    const onAttempt = vi.fn();
    const r = await withBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new HttpError(503);
        return 'ok';
      },
      { onAttempt, backoffMs: () => 0 },
    );
    expect(r).toBe('ok');
    expect(calls).toBe(3);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });
  it('gives up after 3 retries', async () => {
    await expect(
      withBackoff(
        async () => {
          throw new HttpError(503);
        },
        { backoffMs: () => 0 },
      ),
    ).rejects.toThrow(/HTTP 503/);
  });
  it('does not retry auth errors', async () => {
    let calls = 0;
    await expect(
      withBackoff(
        async () => {
          calls++;
          throw new HttpError(401);
        },
        { backoffMs: () => 0 },
      ),
    ).rejects.toThrow(/HTTP 401/);
    expect(calls).toBe(1);
  });
});
