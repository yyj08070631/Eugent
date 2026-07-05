import { describe, it, expect } from 'vitest';
import { codeExec } from './code_exec.js';
import type { ToolCtx } from '@eugent/shared';

const ctx: ToolCtx = {
  sessionId: 's',
  workspaceDir: null,
  signal: new AbortController().signal,
  requestApproval: async () => ({ callId: 'x', allow: true, remember: false }),
};

describe('code_exec', () => {
  it('evaluates a simple expression', async () => {
    const r = await codeExec.run({ code: '1 + 2' }, ctx);
    expect(r).toEqual({ ok: true, result: 3 });
  });
  it('returns the last expression value', async () => {
    const r = await codeExec.run({ code: '[1,2,3].map(x => x * 2)' }, ctx);
    expect(r).toEqual({ ok: true, result: [2, 4, 6] });
  });
  it('has no fs access', async () => {
    const r = await codeExec.run({ code: "typeof require === 'undefined'" }, ctx);
    expect(r).toEqual({ ok: true, result: true });
  });
  it('times out on infinite loop', async () => {
    const r = await codeExec.run({ code: 'while(true){}', timeoutMs: 100 }, ctx);
    expect(r).toEqual({ ok: false, error: 'timeout' });
  });
  it('reports syntax errors', async () => {
    const r = await codeExec.run({ code: '(((' }, ctx);
    expect(r.ok).toBe(false);
  });
  it('aborts immediately when signal fires (does not wait for timeout)', async () => {
    const ac = new AbortController();
    const start = Date.now();
    const p = codeExec.run(
      { code: 'while(true){}', timeoutMs: 10_000 },
      { ...ctx, signal: ac.signal },
    );
    setTimeout(() => ac.abort(), 50);
    const r = await p;
    const elapsed = Date.now() - start;
    expect(r).toEqual({ ok: false, error: 'aborted' });
    expect(elapsed).toBeLessThan(1_000);
  });
});
