import type { Database as DatabaseType } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Message, MessageRole, ToolCallRecord, SkillId } from '@eugent/shared';

export interface NewMessage {
  sessionId: string;
  role: MessageRole;
  content: string | null;
  toolCalls?: ToolCallRecord[] | null;
  toolCallId?: string | null;
  skillId?: SkillId | null;
  partial?: boolean;
}

interface Row {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  skill_id: SkillId | null;
  partial: number;
  created_at: number;
}

const toDomain = (r: Row): Message => ({
  id: r.id,
  sessionId: r.session_id,
  role: r.role,
  content: r.content,
  toolCalls: r.tool_calls ? (JSON.parse(r.tool_calls) as ToolCallRecord[]) : null,
  toolCallId: r.tool_call_id,
  skillId: r.skill_id,
  partial: r.partial === 1,
  createdAt: r.created_at,
});

export class MessagesRepo {
  constructor(private db: DatabaseType) {}

  append(input: NewMessage, now: number): Message {
    const id = randomUUID();
    const toolCallsJson = input.toolCalls ? JSON.stringify(input.toolCalls) : null;
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, skill_id, partial, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sessionId,
        input.role,
        input.content,
        toolCallsJson,
        input.toolCallId ?? null,
        input.skillId ?? null,
        input.partial ? 1 : 0,
        now,
      );
    return {
      id,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls ?? null,
      toolCallId: input.toolCallId ?? null,
      skillId: input.skillId ?? null,
      partial: input.partial ?? false,
      createdAt: now,
    };
  }

  listBySession(sessionId: string, limit?: number): Message[] {
    const sql = limit
      ? `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`
      : `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`;
    const rows = (
      limit ? this.db.prepare(sql).all(sessionId, limit) : this.db.prepare(sql).all(sessionId)
    ) as Row[];
    return rows.map(toDomain);
  }
}
