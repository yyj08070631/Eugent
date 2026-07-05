import { describe, it, expect } from 'vitest';
import { openDb } from './connect.js';
import { runMigrations } from './migrations.js';

describe('migrations', () => {
  it('creates all three tables on a fresh :memory: db', () => {
    const db = openDb(':memory:');
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('sessions');
    expect(names).toContain('messages');
    expect(names).toContain('settings');
    expect(names).toContain('schema_version');
  });

  it('is idempotent — re-running migrations on already-migrated db does not error', () => {
    const db = openDb(':memory:'); // fresh
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('records schema version = 1', () => {
    const db = openDb(':memory:');
    const row = db.prepare(`SELECT version FROM schema_version`).get() as { version: number };
    expect(row.version).toBe(1);
  });
});
