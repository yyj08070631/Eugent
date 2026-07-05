import type { BrowserWindow } from 'electron';
import type { MemoryManager } from '../core/MemoryManager.js';
import type { SettingsRepo } from '../db/repo/SettingsRepo.js';
import type { ModelManager } from '../core/ModelManager.js';
import type { ToolManager } from '../core/ToolManager.js';
import type { ContextBuilder } from '../core/ContextBuilder.js';
import type { SkillEngine } from '../core/SkillEngine.js';
import type { AgentLoop } from '../core/AgentLoop.js';
import { registerSessions } from './sessions.js';
import { registerSettings } from './settings.js';
import { registerApproval } from './approval.js';
import { registerChat } from './chat.js';
import { registerDialog } from './dialog.js';

export interface AppServices {
  memory: MemoryManager;
  settings: SettingsRepo;
  model: ModelManager;
  tools: ToolManager;
  context: ContextBuilder;
  skills: SkillEngine;
  loop: AgentLoop;
}

export function registerIpc(
  services: AppServices,
  getWindow: () => BrowserWindow | null,
): void {
  registerSessions(services.memory);
  registerSettings(services.settings, services.model);
  registerApproval();
  registerChat(services, getWindow);
  registerDialog(getWindow); // grill B1
}
