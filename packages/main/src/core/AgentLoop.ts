import { MAX_TURNS } from '@eugent/shared';
import type {
  AgentEvent,
  ToolCallRecord,
  ToolCtx,
  ApprovalRequest,
  ApprovalReply,
} from '@eugent/shared';
import type { ModelManager, ModelChunk, OpenAIMessage } from './ModelManager.js';
import type { ToolManager } from './ToolManager.js';
import type { MemoryManager } from './MemoryManager.js';
import type { ContextBuilder } from './ContextBuilder.js';
import type { SkillEngine } from './SkillEngine.js';

export interface AgentLoopDeps {
  model: ModelManager;
  tools: ToolManager;
  memory: MemoryManager;
  context: ContextBuilder;
  skills: SkillEngine;
  now: () => number;
  onApprovalRequest?: (sessionId: string, req: ApprovalRequest) => Promise<ApprovalReply>;
  getWorkspaceDir?: () => string | null;
}

interface AccumulatedCall {
  id: string;
  name: string;
  argsBuf: string;
}

export class AgentLoop {
  constructor(private deps: AgentLoopDeps) {}

  setApprovalBridge(fn: NonNullable<AgentLoopDeps['onApprovalRequest']>): void {
    this.deps.onApprovalRequest = fn;
  }

  async *run(
    sessionId: string,
    userInput: string,
    runId: string,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const meta = { runId, sessionId };
    const { skill, cleanedInput } = await this.deps.skills.select(userInput);

    this.deps.memory.appendMessage(
      { sessionId, role: 'user', content: cleanedInput, skillId: skill.id },
      this.deps.now(),
    );

    let { messages, tools } = this.deps.context.build(sessionId, skill);
    const openaiTools = tools;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (signal.aborted) return;

      const accCalls: AccumulatedCall[] = [];
      let finalText = '';
      let interrupted = false;

      try {
        for await (const chunk of this.deps.model.chatStream({
          messages,
          tools: openaiTools,
          signal,
        })) {
          if (signal.aborted) {
            interrupted = true;
            break;
          }
          if (chunk.type === 'token') {
            finalText += chunk.delta;
            yield { ...meta, kind: 'token', delta: chunk.delta };
          } else if (chunk.type === 'tool_call_delta') {
            mergeCall(accCalls, chunk);
          }
        }
      } catch (e) {
        yield { ...meta, kind: 'error', message: e instanceof Error ? e.message : String(e) };
        return;
      }

      const readyCalls = extractReady(accCalls);

      if (readyCalls.length === 0) {
        this.deps.memory.appendMessage(
          { sessionId, role: 'assistant', content: finalText, partial: interrupted },
          this.deps.now(),
        );
        if (interrupted) return;
        yield { ...meta, kind: 'done', finalText };
        return;
      }

      this.deps.memory.appendMessage(
        {
          sessionId,
          role: 'assistant',
          content: finalText || null,
          toolCalls: readyCalls,
          partial: false,
        },
        this.deps.now(),
      );

      for (const call of readyCalls) {
        yield { ...meta, kind: 'tool_call', id: call.id, name: call.name, args: call.args };
        const bridge = this.deps.onApprovalRequest;
        const ctx: ToolCtx = {
          sessionId,
          workspaceDir: this.deps.getWorkspaceDir?.() ?? null,
          signal,
          requestApproval: async (req) =>
            (await bridge?.(sessionId, req)) ?? {
              callId: req.callId,
              allow: false,
              remember: false,
            },
        };
        const result = await this.deps.tools.invoke(call.name, call.args, ctx);
        yield { ...meta, kind: 'tool_result', id: call.id, ...result };
        this.deps.memory.appendMessage(
          {
            sessionId,
            role: 'tool',
            content: JSON.stringify(result),
            toolCallId: call.id,
          },
          this.deps.now(),
        );
      }

      ({ messages, tools } = this.deps.context.build(sessionId, skill));
    }

    yield { ...meta, kind: 'error', message: `reached MAX_TURNS=${MAX_TURNS}` };
  }
}

function mergeCall(
  acc: AccumulatedCall[],
  chunk: Extract<ModelChunk, { type: 'tool_call_delta' }>,
): void {
  let slot = acc[chunk.index];
  if (!slot) {
    slot = { id: chunk.id ?? '', name: chunk.name ?? '', argsBuf: '' };
    acc[chunk.index] = slot;
  }
  if (chunk.id) slot.id = chunk.id;
  if (chunk.name) slot.name = chunk.name;
  if (chunk.argsDelta) slot.argsBuf += chunk.argsDelta;
}

function extractReady(acc: AccumulatedCall[]): ToolCallRecord[] {
  const ready: ToolCallRecord[] = [];
  for (const c of acc) {
    if (!c) continue;
    try {
      const args = c.argsBuf.trim() ? JSON.parse(c.argsBuf) : {};
      ready.push({ id: c.id, name: c.name, args });
    } catch {
      // args JSON not complete → drop this call (v1: treat as no tool call)
    }
  }
  return ready;
}
