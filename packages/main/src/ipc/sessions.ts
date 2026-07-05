import { ipcMain } from 'electron';
import { IPC } from '@eugent/shared';
import type { MemoryManager } from '../core/MemoryManager.js';

export function registerSessions(memory: MemoryManager): void {
  ipcMain.handle(IPC.sessions.list, () => memory.listSessions());
  ipcMain.handle(IPC.sessions.create, (_e, title?: string) =>
    memory.createSession(Date.now(), title ?? '新会话'),
  );
  ipcMain.handle(IPC.sessions.rename, (_e, payload: { sessionId: string; title: string }) => {
    memory.renameSession(payload.sessionId, payload.title, Date.now());
    return { ok: true };
  });
  ipcMain.handle(IPC.sessions.delete, (_e, sessionId: string) => {
    memory.deleteSession(sessionId);
    return { ok: true };
  });
  ipcMain.handle(IPC.sessions.messages, (_e, sessionId: string) => memory.getMessages(sessionId));
}
