import { useState, useRef, useEffect, type KeyboardEvent, type ReactElement } from 'react';
import { Button } from './ui/button.js';
import { ipc } from '../ipc/client.js';
import { useStreaming } from '../stores/streaming.js';

export function InputArea({ sessionId }: { sessionId: string }): ReactElement {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const runId = useStreaming((s) => s.runIdBySession[sessionId] ?? null);
  const setRun = useStreaming((s) => s.setRun);
  const streaming = runId !== null;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [sessionId]);

  async function send(): Promise<void> {
    if (!value.trim() || streaming) return;
    const { runId: newRunId } = await ipc.chat.send({ sessionId, input: value });
    setRun(sessionId, newRunId);
    setValue('');
  }

  async function stop(): Promise<void> {
    if (!runId) return;
    await ipc.chat.cancel(runId);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    } else if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      void stop();
    }
  }

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="说点什么...（⌘⏎ 发送 / Esc 停止）"
          className="flex-1 resize-none rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none"
        />
        {streaming ? (
          <Button variant="destructive" onClick={() => void stop()}>
            停止
          </Button>
        ) : (
          <Button onClick={() => void send()} disabled={!value.trim()}>
            发送
          </Button>
        )}
      </div>
    </div>
  );
}
