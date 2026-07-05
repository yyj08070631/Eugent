import type { ApprovalReply, ModelId } from './types.js';

export const IPC = {
  chat: {
    send: 'chat:send',
    cancel: 'chat:cancel',
  },
  sessions: {
    list: 'sessions:list',
    create: 'sessions:create',
    rename: 'sessions:rename',
    delete: 'sessions:delete',
    messages: 'sessions:messages',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    testConnection: 'settings:testConnection',
  },
  approval: {
    reply: 'approval:reply',
  },
  dialog: {
    pickDir: 'dialog:pickDir',
  },
  events: {
    agent: 'agent:event',
    approvalRequest: 'approval:request',
  },
} as const;

export interface ChatSendPayload {
  sessionId: string;
  input: string;
}
export interface ChatSendResult {
  runId: string;
}

export interface SessionsRenamePayload {
  sessionId: string;
  title: string;
}

export interface SettingsGetResult {
  selectedModel: ModelId;
  hasApiKey: boolean;
  theme: 'system' | 'light' | 'dark';
  workspaceDir: string | null;
  searchProvider: 'tavily' | 'serper' | null;
  hasSearchKey: boolean;
}

export interface SettingsSetPayload {
  selectedModel?: ModelId;
  apiKey?: string;
  theme?: 'system' | 'light' | 'dark';
  workspaceDir?: string | null;
  searchProvider?: 'tavily' | 'serper' | null;
  searchApiKey?: string;
}

export type ApprovalReplyPayload = ApprovalReply;

export type DialogPickDirResult =
  | { ok: true; path: string }
  | { ok: false; error: 'cancelled' };
