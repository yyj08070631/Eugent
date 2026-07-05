import { useState, type ReactElement } from 'react';
import type { ToolCallRecord } from '@eugent/shared';

interface Props {
  call: ToolCallRecord;
  result?: { ok: boolean; result?: unknown; error?: string } | null;
}

export function ToolCard({ call, result }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const status = !result ? '⏳ 运行中' : result.ok ? '✅ 完成' : `❌ ${result.error ?? 'error'}`;
  return (
    <div className="my-2 border rounded-md text-xs bg-neutral-50 dark:bg-neutral-900">
      <button
        type="button"
        className="w-full flex justify-between px-3 py-2"
        onClick={() => setOpen(!open)}
      >
        <span className="font-mono">{call.name}</span>
        <span>{status}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-2">
          <pre className="whitespace-pre-wrap">args: {JSON.stringify(call.args, null, 2)}</pre>
          {result ? (
            <pre className="whitespace-pre-wrap">result: {JSON.stringify(result, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
