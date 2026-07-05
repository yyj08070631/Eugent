import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connect.js';
import { SettingsRepo } from './SettingsRepo.js';
import type { SafeStorageLike } from '../../infra/safeStorage.js';

const fakeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (p) => Buffer.from(`enc:${p}`),
  decryptString: (b) => b.toString('utf8').replace(/^enc:/, ''),
};

describe('SettingsRepo', () => {
  let repo: SettingsRepo;
  beforeEach(() => {
    repo = new SettingsRepo(openDb(':memory:'), fakeStorage);
  });

  it('defaults model to deepseek-v4-pro', () => {
    expect(repo.getModel()).toBe('deepseek-v4-pro');
  });

  it('sets and reads back model', () => {
    repo.setModel('deepseek-v4-flash');
    expect(repo.getModel()).toBe('deepseek-v4-flash');
  });

  it('encrypts API key and decrypts on read', () => {
    repo.setApiKey('sk-abc');
    expect(repo.hasApiKey()).toBe(true);
    expect(repo.getApiKey()).toBe('sk-abc');
  });

  it('returns null when no API key set', () => {
    expect(repo.getApiKey()).toBeNull();
    expect(repo.hasApiKey()).toBe(false);
  });

  it('defaults theme to system', () => {
    expect(repo.getTheme()).toBe('system');
  });

  it('workspaceDir starts null and roundtrips', () => {
    expect(repo.getWorkspaceDir()).toBeNull();
    repo.setWorkspaceDir('/Users/e/Workspace');
    expect(repo.getWorkspaceDir()).toBe('/Users/e/Workspace');
  });

  it('search settings roundtrip', () => {
    expect(repo.getSearchProvider()).toBeNull();
    repo.setSearch('tavily', 'tvly-xxx');
    expect(repo.getSearchProvider()).toBe('tavily');
    expect(repo.getSearchApiKey()).toBe('tvly-xxx');
  });
});
