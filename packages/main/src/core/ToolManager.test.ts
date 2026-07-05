import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from './ToolManager.js';
import type { ToolSpec, ToolCtx, ApprovalReply } from '@eugent/shared';

const echoRead: ToolSpec = {
  name: 'echo_read',
  description: 'echo (read)',
  risk: 'read',
  parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
  run: async (args) => ({ ok: true, result: (args as { msg: string }).msg }),
};

const echoWrite: ToolSpec = {
  ...echoRead,
  name: 'echo_write',
  risk: 'write',
};

function makeCtx(overrides: Partial<ToolCtx> = {}): ToolCtx {
  return {
    sessionId: 's1',
    workspaceDir: '/tmp',
    signal: new AbortController().signal,
    requestApproval: async (): Promise<ApprovalReply> => ({
      callId: 'x',
      allow: true,
      remember: false,
    }),
    ...overrides,
  };
}

describe('ToolManager', () => {
  let tm: ToolManager;
  beforeEach(() => {
    tm = new ToolManager();
    tm.register(echoRead);
    tm.register(echoWrite);
  });

  it('list without allowlist returns all', () => {
    expect(
      tm
        .list()
        .map((t) => t.name)
        .sort(),
    ).toEqual(['echo_read', 'echo_write']);
  });
  it('list with allowlist filters', () => {
    expect(tm.list(['echo_read']).map((t) => t.name)).toEqual(['echo_read']);
  });
  it('invoke unknown tool returns tool_not_found', async () => {
    const r = await tm.invoke('nope', {}, makeCtx());
    expect(r).toEqual({ ok: false, error: 'tool_not_found' });
  });
  it('read tool runs without approval', async () => {
    const requestApproval = vi.fn();
    const r = await tm.invoke('echo_read', { msg: 'hi' }, makeCtx({ requestApproval }));
    expect(r).toEqual({ ok: true, result: 'hi' });
    expect(requestApproval).not.toHaveBeenCalled();
  });
  it('write tool requests approval; denied returns user_denied', async () => {
    const requestApproval = vi.fn(async () => ({ callId: 'x', allow: false, remember: false }));
    const r = await tm.invoke('echo_write', { msg: 'hi' }, makeCtx({ requestApproval }));
    expect(requestApproval).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: false, error: 'user_denied' });
  });
  it('write tool remember=true skips subsequent approvals in same session', async () => {
    const requestApproval = vi.fn(async () => ({ callId: 'x', allow: true, remember: true }));
    await tm.invoke('echo_write', { msg: 'a' }, makeCtx({ requestApproval }));
    await tm.invoke('echo_write', { msg: 'b' }, makeCtx({ requestApproval }));
    expect(requestApproval).toHaveBeenCalledOnce();
  });
  it('remember scope is per-session', async () => {
    const requestApproval = vi.fn(async () => ({ callId: 'x', allow: true, remember: true }));
    await tm.invoke('echo_write', { msg: 'a' }, makeCtx({ sessionId: 's1', requestApproval }));
    await tm.invoke('echo_write', { msg: 'b' }, makeCtx({ sessionId: 's2', requestApproval }));
    expect(requestApproval).toHaveBeenCalledTimes(2);
  });
  it('invalid args returns invalid_args', async () => {
    const r = await tm.invoke('echo_read', { wrong: 1 }, makeCtx());
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid_args');
  });
  it('resetApprovals clears memory for a session', async () => {
    const requestApproval = vi.fn(async () => ({ callId: 'x', allow: true, remember: true }));
    await tm.invoke('echo_write', { msg: 'a' }, makeCtx({ requestApproval }));
    tm.resetApprovals('s1');
    await tm.invoke('echo_write', { msg: 'b' }, makeCtx({ requestApproval }));
    expect(requestApproval).toHaveBeenCalledTimes(2);
  });
});
