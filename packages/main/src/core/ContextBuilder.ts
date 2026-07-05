import { MAX_HISTORY_ROUNDS } from '@eugent/shared';
import type { Skill, Message } from '@eugent/shared';
import type { MemoryManager } from './MemoryManager.js';
import type { ToolManager } from './ToolManager.js';
import type { OpenAIMessage, OpenAITool } from './ModelManager.js';

const BASE_SYSTEM = 'You are Eugent, a helpful desktop AI agent.';

export class ContextBuilder {
  constructor(
    private memory: MemoryManager,
    private tools: ToolManager,
  ) {}

  build(sessionId: string, skill: Skill): { messages: OpenAIMessage[]; tools: OpenAITool[] } {
    // 过滤中断产生的半截 assistant 消息（partial=true）—— 避免半截文本带偏后续回答（grill 第 4 题 A）
    const history = this.memory
      .getMessages(sessionId)
      .filter((m) => !(m.role === 'assistant' && m.partial));
    const kept = takeLastRounds(history, MAX_HISTORY_ROUNDS);

    const systemMsg: OpenAIMessage = {
      role: 'system',
      content: `${BASE_SYSTEM}\n\n${skill.systemPrompt}`,
    };

    const messages: OpenAIMessage[] = [systemMsg, ...kept.map(toOpenAI)];

    const tools: OpenAITool[] = this.tools.list(skill.toolAllowlist).map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    return { messages, tools };
  }
}

function toOpenAI(m: Message): OpenAIMessage {
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
      })),
    };
  }
  if (m.role === 'tool') {
    return {
      role: 'tool',
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    };
  }
  return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
}

function takeLastRounds(msgs: Message[], rounds: number): Message[] {
  // A "round" = one user message + everything after it until the next user message.
  // Keep the last N rounds.
  const roundStarts: number[] = [];
  msgs.forEach((m, i) => {
    if (m.role === 'user') roundStarts.push(i);
  });
  if (roundStarts.length <= rounds) return msgs;
  const cutoff = roundStarts[roundStarts.length - rounds]!;
  return msgs.slice(cutoff);
}
