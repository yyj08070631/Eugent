import { ipcMain, dialog, type BrowserWindow } from 'electron';
import { IPC, type DialogPickDirResult } from '@eugent/shared';

// v1 只暴露 pickDir：让 renderer 触发原生目录选择器
// （替代 Task 30 里 window.prompt() —— sandbox renderer 里 prompt 不可用；grill 第 B1 项）
export function registerDialog(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.dialog.pickDir, async (): Promise<DialogPickDirResult> => {
    const win = getWindow();
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'cancelled' };
    return { ok: true, path: result.filePaths[0] };
  });
}
