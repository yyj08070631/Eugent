import type { ReactElement } from 'react';
import { Button } from './components/ui/button.js';

export function App(): ReactElement {
  return (
    <div className="h-full flex items-center justify-center bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">Eugent</h1>
        <Button
          onClick={() => void window.eugent.settings.get().then((s) => alert(JSON.stringify(s)))}
        >
          读取设置
        </Button>
      </div>
    </div>
  );
}
