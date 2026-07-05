import { describe, it, expect } from 'vitest';
import { openDb } from '../db/connect.js';
import { SessionsRepo } from '../db/repo/SessionsRepo.js';
import { MessagesRepo } from '../db/repo/MessagesRepo.js';
import { MemoryManager } from './MemoryManager.js';
import { ContextBuilder } from './ContextBuilder.js';
import { ToolManager } from './ToolManager.js';
import { SKILLS } from '../skills/index.js';
import { fileRead } from '../tools/file_read.js';

function make() {
  const db = openDb(':memory:');
  const memory = new MemoryManager(new SessionsRepo(db), new MessagesRepo(db));
  const tools = new ToolManager();
  tools.register(fileRead);
  return { memory, tools, cb: new ContextBuilder(memory, tools) };
}

describe('ContextBuilder', () => {
  it('includes system prompt with base + skill overlay', () => {
    const { memory, cb } = make();
    const s = memory.createSession(1000);
    const { messages } = cb.build(s.id, SKILLS.default);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('Eugent');
    expect(messages[0]?.content).toContain(SKILLS.default.systemPrompt.slice(0, 20));
  });

  it('filters tools to allowlist', () => {
    const { memory, cb } = make();
    const s = memory.createSession(1000);
    const { tools } = cb.build(s.id, {
      id: 'default',
      systemPrompt: '',
      toolAllowlist: ['file_read'],
    });
    expect(tools.map((t) => t.function.name)).toEqual(['file_read']);
  });

  it('maps assistant with tool_calls', () => {
    const { memory, cb } = make();
    const s = memory.createSession(1000);
    memory.appendMessage({ sessionId: s.id, role: 'user', content: 'do it' }, 100);
    memory.appendMessage(
      {
        sessionId: s.id,
        role: 'assistant',
        content: null,
        toolCalls: [{ id: 'c1', name: 'file_read', args: { path: 'x' } }],
      },
      101,
    );
    const { messages } = cb.build(s.id, SKILLS.default);
    const asst = messages.find((m) => m.role === 'assistant');
    expect(asst?.tool_calls?.[0]?.function.arguments).toBe(JSON.stringify({ path: 'x' }));
  });

  it('keeps only last N rounds', () => {
    const { memory, cb } = make();
    const s = memory.createSession(1000);
    for (let i = 0; i < 25; i++) {
      memory.appendMessage({ sessionId: s.id, role: 'user', content: `u${i}` }, 100 + i * 2);
      memory.appendMessage({ sessionId: s.id, role: 'assistant', content: `a${i}` }, 101 + i * 2);
    }
    const { messages } = cb.build(s.id, SKILLS.default);
    const userMsgs = messages.filter((m) => m.role === 'user');
    expect(userMsgs.length).toBeLessThanOrEqual(20);
  });

  it('excludes partial assistant messages from context (grill 第 4 题 A)', () => {
    const { memory, cb } = make();
    const s = memory.createSession(1000);
    memory.appendMessage({ sessionId: s.id, role: 'user', content: 'hi' }, 100);
    memory.appendMessage(
      { sessionId: s.id, role: 'assistant', content: '半截文本', partial: true },
      101,
    );
    const { messages } = cb.build(s.id, SKILLS.default);
    const asstMsgs = messages.filter((m) => m.role === 'assistant');
    expect(asstMsgs).toEqual([]); // partial 被过滤
  });
});
