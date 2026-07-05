import { describe, it, expect } from 'vitest';
import { shell } from './shell.js';
import type { ToolCtx } from '@eugent/shared';

const ctx: ToolCtx = {
  sessionId: 's',
  workspaceDir: '/tmp',
  signal: new AbortController().signal,
  requestApproval: async () => ({ callId: 'x', allow: true, remember: false }),
};

describe('shell tool', () => {
  it('runs echo and captures stdout', async () => {
    const r = await shell.run({ command: 'echo hello' }, ctx);
    expect(r.ok).toBe(true);
    const out = r.result as { stdout: string; exitCode: number };
    expect(out.stdout.trim()).toBe('hello');
    expect(out.exitCode).toBe(0);
  });
  it('reports non-zero exit', async () => {
    const r = await shell.run({ command: 'false' }, ctx);
    expect(r.ok).toBe(true);
    expect((r.result as { exitCode: number }).exitCode).not.toBe(0);
  });
  it('respects timeoutMs', async () => {
    const r = await shell.run({ command: 'sleep 5', timeoutMs: 100 }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
  });
  it('respects abort signal', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    const r = await shell.run({ command: 'sleep 5' }, { ...ctx, signal: ac.signal });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('aborted');
  });
});
