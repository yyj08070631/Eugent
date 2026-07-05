import { describe, it, expect } from 'vitest';
import { MAX_TURNS, MAX_HISTORY_ROUNDS, MODEL_IDS, DEEPSEEK_BASE_URL, IPC } from './index.js';

describe('shared constants', () => {
  it('locks MAX_TURNS at 20', () => {
    expect(MAX_TURNS).toBe(20);
  });
  it('locks MAX_HISTORY_ROUNDS at 20', () => {
    expect(MAX_HISTORY_ROUNDS).toBe(20);
  });
  it('exposes exactly two model ids', () => {
    expect(MODEL_IDS).toEqual(['deepseek-v4-pro', 'deepseek-v4-flash']);
  });
  it('locks DeepSeek base URL', () => {
    expect(DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com');
  });
  it('exposes dialog.pickDir channel (grill 第 B1 项)', () => {
    expect(IPC.dialog.pickDir).toBe('dialog:pickDir');
  });
});
