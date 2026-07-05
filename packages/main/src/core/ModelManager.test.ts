import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/connect.js';
import { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { SafeStorageLike } from '../infra/safeStorage.js';
import { ModelManager, type OpenAIClientLike, type ModelChunk } from './ModelManager.js';

const fakeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (p) => Buffer.from(`e:${p}`),
  decryptString: (b) => b.toString('utf8').replace(/^e:/, ''),
};

function fakeClientFactory(apiKey: string): OpenAIClientLike {
  return {
    stream: async (params): Promise<AsyncIterable<ModelChunk>> => {
      expect(params.model).toMatch(/^deepseek-v4-/);
      expect(params.thinking).toBe('off'); // grill 决策：默认关思考
      return (async function* () {
        yield { type: 'token', delta: 'hello ' } satisfies ModelChunk;
        yield { type: 'token', delta: apiKey } satisfies ModelChunk;
        yield { type: 'done' } satisfies ModelChunk;
      })();
    },
  };
}

describe('ModelManager', () => {
  let mm: ModelManager;
  let settings: SettingsRepo;

  beforeEach(() => {
    settings = new SettingsRepo(openDb(':memory:'), fakeStorage);
    mm = new ModelManager(settings, fakeClientFactory);
  });

  it('defaults selected model to deepseek-v4-pro', () => {
    expect(mm.getSelected()).toBe('deepseek-v4-pro');
  });

  it('setSelected persists to settings', () => {
    mm.setSelected('deepseek-v4-flash');
    expect(mm.getSelected()).toBe('deepseek-v4-flash');
    expect(settings.getModel()).toBe('deepseek-v4-flash');
  });

  it('chatStream throws without api key', async () => {
    const iter = mm.chatStream({ messages: [] });
    await expect(async () => {
      for await (const _ of iter) {
        void _;
      }
    }).rejects.toThrow(/no api key/i);
  });

  it('chatStream uses selected model by default', async () => {
    mm.setApiKey('sk-test');
    const chunks: ModelChunk[] = [];
    for await (const c of mm.chatStream({ messages: [] })) chunks.push(c);
    expect(chunks).toEqual([
      { type: 'token', delta: 'hello ' },
      { type: 'token', delta: 'sk-test' },
      { type: 'done' },
    ]);
  });

  it('chatStream honors explicit model override', async () => {
    mm.setApiKey('sk-test');
    const chunks: ModelChunk[] = [];
    for await (const c of mm.chatStream({ messages: [], model: 'deepseek-v4-flash' }))
      chunks.push(c);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
