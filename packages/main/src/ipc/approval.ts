import { ipcMain } from 'electron';
import { IPC } from '@eugent/shared';
import type { ApprovalReply } from '@eugent/shared';

const pending = new Map<string, (r: ApprovalReply) => void>();

export function registerApproval(): void {
  ipcMain.handle(IPC.approval.reply, (_e, reply: ApprovalReply) => {
    const resolve = pending.get(reply.callId);
    if (resolve) {
      pending.delete(reply.callId);
      resolve(reply);
    }
    return { ok: true };
  });
}

export function awaitApproval(callId: string): Promise<ApprovalReply> {
  return new Promise((resolve) => pending.set(callId, resolve));
}
