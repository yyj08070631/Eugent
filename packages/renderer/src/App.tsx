import { useState, type ReactElement } from 'react';
import { Sidebar } from './views/Sidebar.js';
import { Chat } from './views/Chat.js';

export function App(): ReactElement {
  const [, setSettingsOpen] = useState(false);
  return (
    <div className="flex h-full text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-950">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex-1 flex flex-col">
        <Chat />
      </main>
      {/* SettingsDrawer inserted in Task 28 */}
    </div>
  );
}
