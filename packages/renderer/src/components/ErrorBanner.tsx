import type { ReactElement } from 'react';

export function ErrorBanner({
  message,
  onRetry,
  onOpenSettings,
}: {
  message: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}): ReactElement {
  const isAuth = /no api key|401|auth/i.test(message);
  return (
    <div className="mx-6 my-2 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm">
      <div className="text-red-700 dark:text-red-300">{message}</div>
      <div className="mt-2 flex gap-2">
        {isAuth && onOpenSettings ? (
          <button type="button" onClick={onOpenSettings} className="underline">
            打开设置
          </button>
        ) : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="underline">
            重试
          </button>
        ) : null}
      </div>
    </div>
  );
}
