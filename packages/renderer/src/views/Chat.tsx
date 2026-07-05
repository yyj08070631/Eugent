import { useEffect, useState, type ReactElement } from 'react';
import { useSessions } from '../stores/sessions.js';
import { useMessages } from '../stores/messages.js';
import { useStreaming } from '../stores/streaming.js';
import { MessageBubble } from '../components/MessageBubble.js';
import { ToolCard } from '../components/ToolCard.js';
import { InputArea } from '../components/InputArea.js';
import { ErrorBanner } from '../components/ErrorBanner.js';
import { ipc } from '../ipc/client.js';
import type { AgentEvent, Message, ToolCallRecord } from '@eugent/shared';

export function Chat(): ReactElement {
  const activeId = useSessions((s) => s.activeId);
  const messagesBySession = useMessages((s) => s.bySession);
  const loadMessages = useMessages((s) => s.load);
  const appendMsg = useMessages((s) => s.append);
  const updateStreaming = useMessages((s) => s.updateLastAssistantContent);
  const setRun = useStreaming((s) => s.setRun);
  const [lastError, setLastError] = useState<{ message: string; input: string } | null>(null);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    const off = ipc.on('agent:event', (raw) => {
      const evt = raw as AgentEvent;
      if (evt.kind === 'token') {
        // 若最后一条不是 streaming assistant，则先塞一条空 assistant 占位
        const list = messagesBySession[evt.sessionId] ?? [];
        const last = list.at(-1);
        if (!last || last.role !== 'assistant' || !last.partial) {
          const placeholder: Message = {
            id: `stream-${evt.runId}`,
            sessionId: evt.sessionId,
            role: 'assistant',
            content: '',
            toolCalls: null,
            toolCallId: null,
            skillId: null,
            partial: true,
            createdAt: Date.now(),
          };
          appendMsg(placeholder);
        }
        updateStreaming(evt.sessionId, evt.delta);
      } else if (evt.kind === 'error') {
        const list = messagesBySession[evt.sessionId] ?? [];
        const lastUser = [...list].reverse().find((m) => m.role === 'user');
        setLastError({ message: evt.message, input: lastUser?.content ?? '' });
        setRun(evt.sessionId, null);
        void loadMessages(evt.sessionId);
      } else if (evt.kind === 'done') {
        setLastError(null);
        setRun(evt.sessionId, null);
        void loadMessages(evt.sessionId);
      }
      // tool_call / tool_result 事件在 done 时通过 loadMessages 拉最终；tool 卡片渲染从 messages 派生
    });
    return (): void => off();
  }, [messagesBySession, appendMsg, updateStreaming, setRun, loadMessages]);

  if (!activeId) {
    return (
      <div className="flex-1 grid place-items-center text-neutral-500">选择或新建一个会话</div>
    );
  }

  const list = messagesBySession[activeId] ?? [];

  async function retry(): Promise<void> {
    if (!lastError || !activeId) return;
    const { runId } = await ipc.chat.send({ sessionId: activeId, input: lastError.input });
    setRun(activeId, runId);
    setLastError(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {list.map((m) => (
          <div key={m.id}>
            <MessageBubble m={m} />
            {m.role === 'assistant' && m.toolCalls
              ? m.toolCalls.map((c: ToolCallRecord) => (
                  <ToolCard key={c.id} call={c} result={findToolResult(list, c.id)} />
                ))
              : null}
          </div>
        ))}
        {lastError ? <ErrorBanner message={lastError.message} onRetry={() => void retry()} /> : null}
      </div>
      <InputArea sessionId={activeId} />
    </div>
  );
}

function findToolResult(
  list: Message[],
  callId: string,
): { ok: boolean; result?: unknown; error?: string } | null {
  const toolMsg = list.find((m) => m.role === 'tool' && m.toolCallId === callId);
  if (!toolMsg?.content) return null;
  try {
    return JSON.parse(toolMsg.content) as { ok: boolean; result?: unknown; error?: string };
  } catch {
    return { ok: false, error: 'unparsable' };
  }
}
