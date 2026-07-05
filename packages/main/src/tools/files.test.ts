import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileRead } from './file_read.js';
import { fileList } from './file_list.js';
import { fileWrite } from './file_write.js';
import type { ToolCtx } from '@eugent/shared';

function makeCtx(workspace: string): ToolCtx {
  return {
    sessionId: 's',
    workspaceDir: workspace,
    signal: new AbortController().signal,
    requestApproval: async () => ({ callId: 'x', allow: true, remember: false }),
  };
}

describe('file tools', () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), 'eugent-'));
    writeFileSync(join(ws, 'a.txt'), 'hello');
    mkdirSync(join(ws, 'sub'));
    writeFileSync(join(ws, 'sub/b.txt'), 'world');
  });

  it('file_read reads a file', async () => {
    const r = await fileRead.run({ path: 'a.txt' }, makeCtx(ws));
    expect(r.ok).toBe(true);
    expect(r.result).toBe('hello');
  });

  it('file_read rejects outside workspace', async () => {
    const r = await fileRead.run({ path: '../etc/passwd' }, makeCtx(ws));
    expect(r.ok).toBe(false);
    expect(r.error).toBe('path_outside_workspace');
  });

  it('file_list lists direct children', async () => {
    const r = await fileList.run({ path: '.' }, makeCtx(ws));
    expect(r.ok).toBe(true);
    const entries = r.result as Array<{ name: string; type: string }>;
    expect(entries.map((e) => e.name).sort()).toEqual(['a.txt', 'sub']);
  });

  it('file_write creates a file', async () => {
    const r = await fileWrite.run({ path: 'new.txt', content: 'xyz' }, makeCtx(ws));
    expect(r.ok).toBe(true);
    const read = await fileRead.run({ path: 'new.txt' }, makeCtx(ws));
    expect(read.result).toBe('xyz');
  });
});
