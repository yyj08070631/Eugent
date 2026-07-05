import type { ToolManager } from '../core/ToolManager.js';
import type { SettingsRepo } from '../db/repo/SettingsRepo.js';
import { fileRead } from './file_read.js';
import { fileList } from './file_list.js';
import { fileWrite } from './file_write.js';
import { shell } from './shell.js';
import { webFetch } from './web_fetch.js';
import { codeExec } from './code_exec.js';
import { makeWebSearch } from './web_search.js';

export function registerAllTools(tm: ToolManager, settings: SettingsRepo): void {
  tm.register(fileRead);
  tm.register(fileList);
  tm.register(fileWrite);
  tm.register(shell);
  tm.register(webFetch);
  tm.register(codeExec);
  tm.register(makeWebSearch(settings));
}
