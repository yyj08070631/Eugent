import type { Session, Message } from '@eugent/shared';
import type { SessionsRepo } from '../db/repo/SessionsRepo.js';
import type { MessagesRepo, NewMessage } from '../db/repo/MessagesRepo.js';

export class MemoryManager {
  constructor(
    private sessions: SessionsRepo,
    private messages: MessagesRepo,
  ) {}

  createSession(now: number, title = '新会话'): Session {
    return this.sessions.create(title, now);
  }
  listSessions(): Session[] {
    return this.sessions.list();
  }
  renameSession(id: string, title: string, now: number): void {
    this.sessions.rename(id, title, now);
  }
  deleteSession(id: string): void {
    this.sessions.delete(id);
  }
  appendMessage(input: NewMessage, now: number): Message {
    const m = this.messages.append(input, now);
    this.sessions.touch(input.sessionId, now);
    return m;
  }
  getMessages(sessionId: string, limit?: number): Message[] {
    return this.messages.listBySession(sessionId, limit);
  }
}
