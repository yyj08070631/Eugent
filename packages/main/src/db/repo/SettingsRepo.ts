import type { Database as DatabaseType } from 'better-sqlite3';
import type { ModelId } from '@eugent/shared';
import type { SafeStorageLike } from '../../infra/safeStorage.js';

type Row = { key: string; value: string };

export class SettingsRepo {
  constructor(
    private db: DatabaseType,
    private storage: SafeStorageLike,
  ) {}

  private get(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
      | Row
      | undefined;
    return row?.value ?? null;
  }

  private set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  private delete(key: string): void {
    this.db.prepare(`DELETE FROM settings WHERE key = ?`).run(key);
  }

  getModel(): ModelId {
    return (this.get('selected_model') as ModelId) ?? 'deepseek-v4-pro';
  }
  setModel(id: ModelId): void {
    this.set('selected_model', id);
  }

  getApiKey(): string | null {
    const b64 = this.get('api_key_enc');
    if (!b64) return null;
    return this.storage.decryptString(Buffer.from(b64, 'base64'));
  }
  setApiKey(raw: string): void {
    const cipher = this.storage.encryptString(raw);
    this.set('api_key_enc', cipher.toString('base64'));
  }
  hasApiKey(): boolean {
    return this.get('api_key_enc') !== null;
  }

  getTheme(): 'system' | 'light' | 'dark' {
    return (this.get('theme') as 'system' | 'light' | 'dark') ?? 'system';
  }
  setTheme(t: 'system' | 'light' | 'dark'): void {
    this.set('theme', t);
  }

  getWorkspaceDir(): string | null {
    return this.get('workspace_dir');
  }
  setWorkspaceDir(dir: string | null): void {
    if (dir === null) this.delete('workspace_dir');
    else this.set('workspace_dir', dir);
  }

  getSearchProvider(): 'tavily' | 'serper' | null {
    return this.get('search_provider') as 'tavily' | 'serper' | null;
  }
  getSearchApiKey(): string | null {
    return this.get('search_api_key');
  }
  setSearch(provider: 'tavily' | 'serper' | null, key?: string): void {
    if (!provider) {
      this.delete('search_provider');
      this.delete('search_api_key');
      return;
    }
    this.set('search_provider', provider);
    if (key !== undefined) this.set('search_api_key', key);
  }
}
