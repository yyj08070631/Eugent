import { useEffect, type ReactElement } from 'react';
import { useSessions } from '../stores/sessions.js';
import { Button } from '../components/ui/button.js';
import { PlusIcon } from 'lucide-react';

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }): ReactElement {
  const { sessions, activeId, refresh, create, select, remove } = useSessions();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <aside className="flex flex-col w-60 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
      <div className="p-3">
        <Button className="w-full" onClick={() => void create()}>
          <PlusIcon className="w-4 h-4 mr-2" /> 新会话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => select(s.id)}
            onKeyDown={(e) => e.key === 'Enter' && select(s.id)}
            className={`group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer text-sm ${
              activeId === s.id
                ? 'bg-neutral-200 dark:bg-neutral-800'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
            }`}
          >
            <span className="truncate">{s.title}</span>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-xs text-neutral-500"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('删除会话？')) void remove(s.id);
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="w-full justify-start"
        >
          ⚙ 设置
        </Button>
      </div>
    </aside>
  );
}
