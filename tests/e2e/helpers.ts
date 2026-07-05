import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let currentUserData: string | null = null;

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  currentUserData = mkdtempSync(join(tmpdir(), 'eugent-e2e-'));
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${currentUserData}`],
    env: {
      ...process.env,
      EUGENT_USER_DATA: currentUserData,
    },
  });
  const page = await app.firstWindow();
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
  if (currentUserData) {
    rmSync(currentUserData, { recursive: true, force: true });
    currentUserData = null;
  }
}
