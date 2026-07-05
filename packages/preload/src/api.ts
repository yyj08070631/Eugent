import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type Session,
  type Message,
  type SettingsGetResult,
  type SettingsSetPayload,
  type ChatSendPayload,
  type ChatSendResult,
  type ApprovalReplyPayload,
  type DialogPickDirResult,
} from '@eugent/shared';

export const api = {
  sessions: {
    list: (): Promise<Session[]> => ipcRenderer.invoke(IPC.sessions.list),
    create: (title?: string): Promise<Session> => ipcRenderer.invoke(IPC.sessions.create, title),
    rename: (sessionId: string, title: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.sessions.rename, { sessionId, title }),
    delete: (sessionId: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.sessions.delete, sessionId),
    messages: (sessionId: string): Promise<Message[]> =>
      ipcRenderer.invoke(IPC.sessions.messages, sessionId),
  },
  settings: {
    get: (): Promise<SettingsGetResult> => ipcRenderer.invoke(IPC.settings.get),
    set: (patch: SettingsSetPayload): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.settings.set, patch),
    testConnection: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.settings.testConnection),
  },
  chat: {
    send: (payload: ChatSendPayload): Promise<ChatSendResult> =>
      ipcRenderer.invoke(IPC.chat.send, payload),
    cancel: (runId: string): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.chat.cancel, runId),
  },
  approval: {
    reply: (payload: ApprovalReplyPayload): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.approval.reply, payload),
  },
  dialog: {
    pickDir: (): Promise<DialogPickDirResult> => ipcRenderer.invoke(IPC.dialog.pickDir),
  },
  on(channel: 'agent:event' | 'approval:request', handler: (payload: unknown) => void): () => void {
    const listener = (_e: unknown, payload: unknown): void => handler(payload);
    ipcRenderer.on(channel, listener);
    return (): void => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
} as const;

export type EugentApi = typeof api;

contextBridge.exposeInMainWorld('eugent', api);
