import type { Database } from 'better-sqlite3';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

  CREATE TABLE messages (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
    content       TEXT,
    tool_calls    TEXT,
    tool_call_id  TEXT,
    skill_id      TEXT,
    partial       INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_messages_session ON messages(session_id, created_at);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function runMigrations(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`);
  const row = db.prepare(`SELECT version FROM schema_version LIMIT 1`).get() as
    | { version: number }
    | undefined;
  const current = row?.version ?? 0;

  const txn = db.transaction(() => {
    for (let i = current; i < MIGRATIONS.length; i++) {
      db.exec(MIGRATIONS[i]!);
    }
    if (row) {
      db.prepare(`UPDATE schema_version SET version = ?`).run(MIGRATIONS.length);
    } else {
      db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(MIGRATIONS.length);
    }
  });
  txn();
}
