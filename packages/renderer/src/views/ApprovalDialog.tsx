import { useEffect, useState, type ReactElement } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.js';
import { Button } from '../components/ui/button.js';
import { ipc } from '../ipc/client.js';

interface Request {
  callId: string;
  kind: 'tool_write' | 'pick_workspace';
  toolName?: string;
  argsPreview?: unknown;
  sessionId?: string;
}

export function ApprovalDialog(): ReactElement | null {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    return ipc.on('approval:request', (raw) => setReq(raw as Request));
  }, []);

  async function reply(
    allow: boolean,
    remember: boolean,
    workspaceDir?: string | null,
  ): Promise<void> {
    if (!req) return;
    await ipc.approval.reply({
      callId: req.callId,
      allow,
      remember,
      ...(workspaceDir !== undefined ? { workspaceDir } : {}),
    });
    setReq(null);
  }

  async function pickDir(): Promise<void> {
    // grill B1：走 main 侧 dialog.showOpenDialog（sandbox renderer 里 window.prompt 不可用）
    const r = await ipc.dialog.pickDir();
    if (r.ok) await reply(true, false, r.path);
    else await reply(false, false, null);
  }

  if (!req) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && void reply(false, false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {req.kind === 'pick_workspace'
              ? 'AI 想访问文件，请选择工作区目录'
              : `允许调用工具 ${req.toolName}？`}
          </DialogTitle>
        </DialogHeader>
        {req.kind === 'tool_write' && req.argsPreview ? (
          <pre className="text-xs bg-neutral-50 dark:bg-neutral-900 rounded p-2 overflow-x-auto">
            {JSON.stringify(req.argsPreview, null, 2)}
          </pre>
        ) : null}
        <div className="flex gap-2 justify-end">
          {req.kind === 'pick_workspace' ? (
            <>
              <Button variant="outline" onClick={() => void reply(false, false)}>
                拒绝本次
              </Button>
              <Button onClick={() => void pickDir()}>选择目录</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => void reply(false, false)}>
                拒绝
              </Button>
              <Button variant="ghost" onClick={() => void reply(true, false)}>
                仅本次允许
              </Button>
              <Button onClick={() => void reply(true, true)}>本会话总是允许</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
