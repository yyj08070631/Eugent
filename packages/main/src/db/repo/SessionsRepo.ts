import type { Database as DatabaseType } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Session } from '@eugent/shared';

interface Row {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

const toDomain = (r: Row): Session => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SessionsRepo {
  constructor(private db: DatabaseType) {}

  create(title: string, now: number): Session {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      )
      .run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now };
  }

  list(): Session[] {
    const rows = this.db
      .prepare(`SELECT * FROM sessions ORDER BY updated_at DESC`)
      .all() as Row[];
    return rows.map(toDomain);
  }

  rename(id: string, title: string, now: number): void {
    this.db
      .prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, now, id);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  }

  touch(id: string, now: number): void {
    this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(now, id);
  }
}
