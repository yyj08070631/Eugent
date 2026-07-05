import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { openDb } from './db/connect.js';
import { SessionsRepo } from './db/repo/SessionsRepo.js';
import { MessagesRepo } from './db/repo/MessagesRepo.js';
import { SettingsRepo } from './db/repo/SettingsRepo.js';
import { realSafeStorage } from './infra/safeStorage.js';
import { ModelManager } from './core/ModelManager.js';
import { makeDeepSeekClient } from './core/openaiClient.js';
import { ToolManager } from './core/ToolManager.js';
import { MemoryManager } from './core/MemoryManager.js';
import { ContextBuilder } from './core/ContextBuilder.js';
import { SkillEngine } from './core/SkillEngine.js';
import { AgentLoop } from './core/AgentLoop.js';
import { registerAllTools } from './tools/index.js';
import { registerIpc } from './ipc/router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Eugent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: resolve(__dirname, '../preload/index.mjs'),
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(resolve(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // 支持 E2E 里通过 --user-data-dir=<path> 传入独立 sandbox 目录
  const custom = process.argv.find((a) => a.startsWith('--user-data-dir='));
  if (custom) app.setPath('userData', custom.slice('--user-data-dir='.length));

  const dbPath = join(app.getPath('userData'), 'eugent.sqlite');
  const db = openDb(dbPath);
  const sessions = new SessionsRepo(db);
  const messages = new MessagesRepo(db);
  const settings = new SettingsRepo(db, realSafeStorage);
  const memory = new MemoryManager(sessions, messages);
  const model = new ModelManager(settings, makeDeepSeekClient);
  const tools = new ToolManager();
  registerAllTools(tools, settings);
  const context = new ContextBuilder(memory, tools);
  const skills = new SkillEngine(model);
  const loop = new AgentLoop({
    model,
    tools,
    memory,
    context,
    skills,
    now: () => Date.now(),
    getWorkspaceDir: () => settings.getWorkspaceDir(),
  });

  registerIpc(
    { memory, settings, model, tools, context, skills, loop },
    () => mainWindow,
  );

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
