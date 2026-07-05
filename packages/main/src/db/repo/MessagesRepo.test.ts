import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connect.js';
import { SessionsRepo } from './SessionsRepo.js';
import { MessagesRepo } from './MessagesRepo.js';

describe('MessagesRepo', () => {
  let sessions: SessionsRepo;
  let messages: MessagesRepo;
  let sid: string;

  beforeEach(() => {
    const db = openDb(':memory:');
    sessions = new SessionsRepo(db);
    messages = new MessagesRepo(db);
    sid = sessions.create('t', 1000).id;
  });

  it('appends and returns a message with generated id', () => {
    const m = messages.append({ sessionId: sid, role: 'user', content: 'hi' }, 2000);
    expect(m.id).toMatch(/[0-9a-f-]{36}/);
    expect(m.role).toBe('user');
    expect(m.content).toBe('hi');
    expect(m.partial).toBe(false);
    expect(m.createdAt).toBe(2000);
  });

  it('serializes toolCalls to JSON and back', () => {
    const calls = [{ id: 'c1', name: 'file_read', args: { path: '/tmp/x' } }];
    const m = messages.append(
      { sessionId: sid, role: 'assistant', content: null, toolCalls: calls },
      3000,
    );
    const [reloaded] = messages.listBySession(sid);
    expect(reloaded?.toolCalls).toEqual(calls);
    expect(m.toolCalls).toEqual(calls);
  });

  it('lists messages by session ordered by createdAt ASC', () => {
    messages.append({ sessionId: sid, role: 'user', content: 'a' }, 100);
    messages.append({ sessionId: sid, role: 'assistant', content: 'b' }, 200);
    messages.append({ sessionId: sid, role: 'user', content: 'c' }, 300);
    expect(messages.listBySession(sid).map((m) => m.content)).toEqual(['a', 'b', 'c']);
  });

  it('cascades on session delete', () => {
    messages.append({ sessionId: sid, role: 'user', content: 'x' }, 100);
    sessions.delete(sid);
    expect(messages.listBySession(sid)).toHaveLength(0);
  });

  it('respects partial=true', () => {
    const m = messages.append(
      { sessionId: sid, role: 'assistant', content: 'half', partial: true },
      100,
    );
    expect(m.partial).toBe(true);
    const [reloaded] = messages.listBySession(sid);
    expect(reloaded?.partial).toBe(true);
  });

  it('respects limit', () => {
    for (let i = 0; i < 5; i++)
      messages.append({ sessionId: sid, role: 'user', content: `m${i}` }, 100 + i);
    expect(messages.listBySession(sid, 2)).toHaveLength(2);
  });
});
