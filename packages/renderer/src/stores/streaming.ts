import { create } from 'zustand';

interface StreamingState {
  runIdBySession: Record<string, string | null>;
  setRun: (sessionId: string, runId: string | null) => void;
}

export const useStreaming = create<StreamingState>((set) => ({
  runIdBySession: {},
  setRun(sessionId, runId) {
    set((st) => ({ runIdBySession: { ...st.runIdBySession, [sessionId]: runId } }));
  },
}));
