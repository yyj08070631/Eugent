import { ipcMain, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC } from '@eugent/shared';
import type { ChatSendPayload, ChatSendResult, ApprovalRequest } from '@eugent/shared';
import type { AppServices } from './router.js';
import { awaitApproval } from './approval.js';

export function registerChat(
  services: AppServices,
  getWindow: () => BrowserWindow | null,
): void {
  const runs = new Map<string, AbortController>();

  ipcMain.handle(
    IPC.chat.send,
    async (_e, payload: ChatSendPayload): Promise<ChatSendResult> => {
      const runId = randomUUID();
      const ac = new AbortController();
      runs.set(runId, ac);

      void (async () => {
        try {
          for await (const evt of services.loop.run(
            payload.sessionId,
            payload.input,
            runId,
            ac.signal,
          )) {
            const win = getWindow();
            if (!win || win.isDestroyed()) break;
            win.webContents.send(IPC.events.agent, evt);
          }
        } finally {
          runs.delete(runId);
        }
      })();

      return { runId };
    },
  );

  ipcMain.handle(IPC.chat.cancel, (_e, runId: string) => {
    runs.get(runId)?.abort();
    return { ok: true };
  });

  // Provide the approval bridge that AgentLoop uses
  services.loop.setApprovalBridge(async (sessionId, req: ApprovalRequest) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.events.approvalRequest, { sessionId, ...req });
    }
    return awaitApproval(req.callId);
  });
}
