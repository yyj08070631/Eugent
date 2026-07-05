import { ipcMain } from 'electron';
import { IPC } from '@eugent/shared';
import type { SettingsGetResult, SettingsSetPayload } from '@eugent/shared';
import type { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { ModelManager } from '../core/ModelManager.js';

export function registerSettings(settings: SettingsRepo, model: ModelManager): void {
  ipcMain.handle(
    IPC.settings.get,
    (): SettingsGetResult => ({
      selectedModel: settings.getModel(),
      hasApiKey: settings.hasApiKey(),
      theme: settings.getTheme(),
      workspaceDir: settings.getWorkspaceDir(),
      searchProvider: settings.getSearchProvider(),
      hasSearchKey: settings.getSearchApiKey() !== null,
    }),
  );
  ipcMain.handle(IPC.settings.set, (_e, payload: SettingsSetPayload) => {
    if (payload.selectedModel !== undefined) settings.setModel(payload.selectedModel);
    if (payload.apiKey !== undefined) settings.setApiKey(payload.apiKey);
    if (payload.theme !== undefined) settings.setTheme(payload.theme);
    if (payload.workspaceDir !== undefined) settings.setWorkspaceDir(payload.workspaceDir);
    if (payload.searchProvider !== undefined || payload.searchApiKey !== undefined) {
      settings.setSearch(payload.searchProvider ?? null, payload.searchApiKey);
    }
    return { ok: true };
  });
  ipcMain.handle(IPC.settings.testConnection, () => model.testConnection());
}
