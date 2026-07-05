import { create } from 'zustand';
import type { SettingsGetResult, SettingsSetPayload } from '@eugent/shared';
import { ipc } from '../ipc/client.js';

interface SettingsState {
  loaded: boolean;
  data: SettingsGetResult | null;
  refresh: () => Promise<void>;
  update: (patch: SettingsSetPayload) => Promise<void>;
  test: () => Promise<{ ok: boolean; error?: string }>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  data: null,
  async refresh() {
    const data = await ipc.settings.get();
    set({ data, loaded: true });
  },
  async update(patch) {
    await ipc.settings.set(patch);
    await get().refresh();
  },
  test: () => ipc.settings.testConnection(),
}));
