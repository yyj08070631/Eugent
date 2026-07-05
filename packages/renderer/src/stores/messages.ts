import { create } from 'zustand';
import type { Message } from '@eugent/shared';
import { ipc } from '../ipc/client.js';

interface MessagesState {
  bySession: Record<string, Message[]>;
  load: (sessionId: string) => Promise<void>;
  append: (msg: Message) => void;
  updateLastAssistantContent: (sessionId: string, delta: string) => void;
}

export const useMessages = create<MessagesState>((set) => ({
  bySession: {},
  async load(sessionId) {
    const list = await ipc.sessions.messages(sessionId);
    set((st) => ({ bySession: { ...st.bySession, [sessionId]: list } }));
  },
  append(msg) {
    set((st) => ({
      bySession: {
        ...st.bySession,
        [msg.sessionId]: [...(st.bySession[msg.sessionId] ?? []), msg],
      },
    }));
  },
  updateLastAssistantContent(sessionId, delta) {
    set((st) => {
      const list = st.bySession[sessionId] ?? [];
      const revIdx = [...list].reverse().findIndex((m) => m.role === 'assistant');
      if (revIdx < 0) return st;
      const realIdx = list.length - 1 - revIdx;
      const target = list[realIdx]!;
      const updated: Message = { ...target, content: (target.content ?? '') + delta };
      const next = [...list];
      next[realIdx] = updated;
      return { bySession: { ...st.bySession, [sessionId]: next } };
    });
  },
}));
