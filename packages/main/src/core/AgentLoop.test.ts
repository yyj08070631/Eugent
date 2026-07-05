import { describe, it, expect } from 'vitest';
import { openDb } from '../db/connect.js';
import { SessionsRepo } from '../db/repo/SessionsRepo.js';
import { MessagesRepo } from '../db/repo/MessagesRepo.js';
import { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { SafeStorageLike } from '../infra/safeStorage.js';
import { ModelManager, type OpenAIClientLike, type ModelChunk } from './ModelManager.js';
import { ToolManager } from './ToolManager.js';
import { MemoryManager } from './MemoryManager.js';
import { ContextBuilder } from './ContextBuilder.js';
import { SkillEngine } from './SkillEngine.js';
import { AgentLoop } from './AgentLoop.js';
import type { AgentEvent, ToolSpec } from '@eugent/shared';

const fakeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (p) => Buffer.from(p),
  decryptString: (b) => b.toString('utf8'),
};

function scriptClient(scripts: ModelChunk[][]): (k: string) => OpenAIClientLike {
  let i = 0;
  return () => ({
    stream: async (): Promise<AsyncIterable<ModelChunk>> => {
      const s = scripts[i++] ?? [{ type: 'done' }];
      return (async function* () {
        for (const c of s) yield c;
      })();
    },
  });
}

const echoTool: ToolSpec = {
  name: 'echo_tool',
  description: 'echo',
  risk: 'read',
  parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
  run: async (args) => ({ ok: true, result: (args as { msg: string }).msg }),
};

function setup(scripts: ModelChunk[][]) {
  const db = openDb(':memory:');
  const settings = new SettingsRepo(db, fakeStorage);
  settings.setApiKey('sk');
  const model = new ModelManager(settings, scriptClient(scripts));
  const tools = new ToolManager();
  tools.register(echoTool);
  const memory = new MemoryManager(new SessionsRepo(db), new MessagesRepo(db));
  const context = new ContextBuilder(memory, tools);
  const skills = new SkillEngine(model);
  const loop = new AgentLoop({ model, tools, memory, context, skills, now: () => 1000 });
  const sid = memory.createSession(1).id;
  return { loop, memory, sid };
}

describe('AgentLoop', () => {
  it('single-turn done (no tool calls)', async () => {
    const { loop, memory, sid } = setup([
      [
        { type: 'token', delta: 'hi ' },
        { type: 'token', delta: 'there' },
        { type: 'done' },
      ],
    ]);
    const events: AgentEvent[] = [];
    for await (const e of loop.run(sid, '/default hi', 'r1', new AbortController().signal)) {
      events.push(e);
    }
    expect(events.at(-1)?.kind).toBe('done');
    expect(memory.getMessages(sid).at(-1)?.content).toBe('hi there');
  });

  it('one tool call round-trip', async () => {
    const { loop, sid } = setup([
      // turn 1: emits tool_call_delta
      [
        {
          type: 'tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'echo_tool',
          argsDelta: '{"msg":"hey"}',
        },
        { type: 'done' },
      ],
      // turn 2: done
      [
        { type: 'token', delta: 'done' },
        { type: 'done' },
      ],
    ]);
    const events: AgentEvent[] = [];
    for await (const e of loop.run(sid, '/default go', 'r2', new AbortController().signal)) {
      events.push(e);
    }
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('tool_call');
    expect(kinds).toContain('tool_result');
    expect(kinds.at(-1)).toBe('done');
  });

  it('does not emit tool_call until args JSON is valid', async () => {
    const { loop, sid } = setup([
      [
        // args arrive in fragments
        { type: 'tool_call_delta', index: 0, id: 'c1', name: 'echo_tool', argsDelta: '{"m' },
        { type: 'tool_call_delta', index: 0, argsDelta: 'sg":"h' },
        { type: 'tool_call_delta', index: 0, argsDelta: 'ey"}' },
        { type: 'done' },
      ],
      [
        { type: 'token', delta: 'done' },
        { type: 'done' },
      ],
    ]);
    const events: AgentEvent[] = [];
    for await (const e of loop.run(sid, '/default go', 'r', new AbortController().signal)) {
      events.push(e);
    }
    const callEvents = events.filter((e) => e.kind === 'tool_call');
    expect(callEvents).toHaveLength(1);
    expect((callEvents[0] as { args: { msg: string } }).args).toEqual({ msg: 'hey' });
  });

  it('respects MAX_TURNS and emits error', async () => {
    // Every turn returns a tool_call → never terminates
    const scripts: ModelChunk[][] = Array.from({ length: 25 }, () => [
      {
        type: 'tool_call_delta',
        index: 0,
        id: 'c1',
        name: 'echo_tool',
        argsDelta: '{"msg":"loop"}',
      },
      { type: 'done' },
    ]);
    const { loop, sid } = setup(scripts);
    const events: AgentEvent[] = [];
    for await (const e of loop.run(sid, '/default go', 'r', new AbortController().signal)) {
      events.push(e);
    }
    expect(events.at(-1)?.kind).toBe('error');
  });

  it('abort mid-stream marks message partial', async () => {
    const { loop, memory, sid } = setup([
      [
        { type: 'token', delta: 'part1' },
        { type: 'token', delta: 'part2' },
        { type: 'done' },
      ],
    ]);
    const ac = new AbortController();
    const events: AgentEvent[] = [];
    const iter = loop.run(sid, '/default go', 'r', ac.signal);
    for await (const e of iter) {
      events.push(e);
      if (e.kind === 'token' && (e as { delta: string }).delta === 'part1') ac.abort();
    }
    const asstMsgs = memory.getMessages(sid).filter((m) => m.role === 'assistant');
    expect(asstMsgs.at(-1)?.partial).toBe(true);
  });
});
