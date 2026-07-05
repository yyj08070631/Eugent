import { create } from 'zustand';
import type { Session } from '@eugent/shared';
import { ipc } from '../ipc/client.js';

interface SessionsState {
  sessions: Session[];
  activeId: string | null;
  refresh: () => Promise<void>;
  create: () => Promise<string>;
  select: (id: string) => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useSessions = create<SessionsState>((set, get) => ({
  sessions: [],
  activeId: null,
  async refresh() {
    const sessions = await ipc.sessions.list();
    set({ sessions });
    if (!get().activeId && sessions.length) set({ activeId: sessions[0]!.id });
  },
  async create() {
    const s = await ipc.sessions.create();
    set((st) => ({ sessions: [s, ...st.sessions], activeId: s.id }));
    return s.id;
  },
  select(id) {
    set({ activeId: id });
  },
  async rename(id, title) {
    await ipc.sessions.rename(id, title);
    await get().refresh();
  },
  async remove(id) {
    await ipc.sessions.delete(id);
    set((st) => {
      const remaining = st.sessions.filter((s) => s.id !== id);
      return {
        sessions: remaining,
        activeId: st.activeId === id ? (remaining[0]?.id ?? null) : st.activeId,
      };
    });
  },
}));
