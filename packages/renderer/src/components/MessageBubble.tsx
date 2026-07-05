import type { ReactElement } from 'react';
import type { Message } from '@eugent/shared';

export function MessageBubble({ m }: { m: Message }): ReactElement | null {
  const isUser = m.role === 'user';
  const isAssistant = m.role === 'assistant';
  if (m.role === 'system' || m.role === 'tool') return null;
  const badge = isUser && m.skillId && m.skillId !== 'default' ? m.skillId : null;

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
            : 'bg-neutral-100 dark:bg-neutral-800'
        } ${m.partial ? 'opacity-70' : ''}`}
      >
        {badge ? (
          <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500 text-white">
            {badge}
          </span>
        ) : null}
        {m.content}
        {isAssistant && m.partial ? <span className="ml-1 text-xs italic">（已中断）</span> : null}
      </div>
    </div>
  );
}
