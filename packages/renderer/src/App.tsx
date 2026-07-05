import { useEffect, useState, type ReactElement } from 'react';
import { Sidebar } from './views/Sidebar.js';
import { Chat } from './views/Chat.js';
import { SettingsDrawer } from './views/SettingsDrawer.js';
import { ApprovalDialog } from './views/ApprovalDialog.js';
import { useSettings } from './stores/settings.js';

export function App(): ReactElement {
  const { data, loaded, refresh } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loaded && data && !data.hasApiKey) setSettingsOpen(true);
  }, [loaded, data]);

  const force = loaded && data ? !data.hasApiKey : false;

  return (
    <div className="flex h-full text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-950">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex-1 flex flex-col">
        <Chat />
      </main>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} forceUntilKey={force} />
      <ApprovalDialog />
    </div>
  );
}
