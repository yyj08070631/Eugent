import type { ReactElement } from 'react';
import { useSessions } from '../stores/sessions.js';

export function Chat(): ReactElement {
  const activeId = useSessions((s) => s.activeId);
  if (!activeId) {
    return (
      <div className="flex-1 grid place-items-center text-neutral-500">选择或新建一个会话</div>
    );
  }
  return <div className="flex-1 p-6">Chat for session: {activeId}</div>;
}
