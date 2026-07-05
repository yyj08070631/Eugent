import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/connect.js';
import { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { SafeStorageLike } from '../infra/safeStorage.js';
import { ModelManager, type OpenAIClientLike, type ModelChunk } from './ModelManager.js';
import { SkillEngine } from './SkillEngine.js';

const fakeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (p) => Buffer.from(p),
  decryptString: (b) => b.toString('utf8'),
};

function classifierClient(returned: string): (k: string) => OpenAIClientLike {
  return () => ({
    async *stream(): AsyncIterable<ModelChunk> {
      yield { type: 'token', delta: returned };
      yield { type: 'done' };
    },
  });
}

describe('SkillEngine', () => {
  let se: SkillEngine;
  let model: ModelManager;

  beforeEach(() => {
    const settings = new SettingsRepo(openDb(':memory:'), fakeStorage);
    settings.setApiKey('sk');
    model = new ModelManager(settings, classifierClient('{"skill":"research"}'));
    se = new SkillEngine(model);
  });

  it('parses /research prefix', async () => {
    const r = await se.select('/research find Rust async runtimes');
    expect(r.skill.id).toBe('research');
    expect(r.cleanedInput).toBe('find Rust async runtimes');
    expect(r.source).toBe('slash');
  });
  it('parses /code prefix', async () => {
    const r = await se.select('/code fix useEffect loop');
    expect(r.skill.id).toBe('code');
    expect(r.source).toBe('slash');
  });
  it('parses /default prefix', async () => {
    const r = await se.select('/default hi');
    expect(r.skill.id).toBe('default');
    expect(r.source).toBe('slash');
  });
  it('unknown slash falls through to classifier', async () => {
    const r = await se.select('/foo bar');
    expect(r.source).toBe('classifier');
    expect(r.cleanedInput).toBe('/foo bar');
    expect(r.skill.id).toBe('research');
  });
  it('classifier picks skill for plain input', async () => {
    const r = await se.select('help me summarize this article');
    expect(r.skill.id).toBe('research');
    expect(r.source).toBe('classifier');
  });
  it('falls back to default on unparsable classifier output', async () => {
    const settings2 = new SettingsRepo(openDb(':memory:'), fakeStorage);
    settings2.setApiKey('sk');
    const m2 = new ModelManager(settings2, classifierClient('utter nonsense'));
    const se2 = new SkillEngine(m2);
    const r = await se2.select('foo');
    expect(r.skill.id).toBe('default');
    expect(r.source).toBe('fallback');
  });
});
