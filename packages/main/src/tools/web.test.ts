import { describe, it, expect } from 'vitest';
import { openDb } from '../db/connect.js';
import { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { SafeStorageLike } from '../infra/safeStorage.js';
import { makeWebSearch } from './web_search.js';
import { webFetch } from './web_fetch.js';
import type { ToolCtx } from '@eugent/shared';

const fakeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (p) => Buffer.from(p),
  decryptString: (b) => b.toString('utf8'),
};

const ctx: ToolCtx = {
  sessionId: 's',
  workspaceDir: null,
  signal: new AbortController().signal,
  requestApproval: async () => ({ callId: 'x', allow: true, remember: false }),
};

describe('web tools', () => {
  it('web_search returns search_not_configured when no provider', async () => {
    const settings = new SettingsRepo(openDb(':memory:'), fakeStorage);
    const tool = makeWebSearch(settings);
    const r = await tool.run({ q: 'test' }, ctx);
    expect(r).toEqual({ ok: false, error: 'search_not_configured' });
  });
  it('webFetch is registered with correct name and risk', () => {
    expect(webFetch.name).toBe('web_fetch');
    expect(webFetch.risk).toBe('read');
  });
});
