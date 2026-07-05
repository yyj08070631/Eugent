import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from './migrations.js';

export function openDb(path: string): DatabaseType {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}
