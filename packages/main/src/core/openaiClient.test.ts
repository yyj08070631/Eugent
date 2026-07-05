import { describe, it, expect } from 'vitest';
import { makeDeepSeekClient } from './openaiClient.js';

describe('makeDeepSeekClient', () => {
  it('returns a client with stream(params) method', () => {
    const client = makeDeepSeekClient('sk-fake');
    expect(typeof client.stream).toBe('function');
  });
});
