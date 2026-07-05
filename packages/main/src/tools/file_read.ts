import { readFile } from 'node:fs/promises';
import type { ToolSpec } from '@eugent/shared';
import { ensureWorkspace, resolveWithinWorkspace } from './workspace.js';

export const fileRead: ToolSpec = {
  name: 'file_read',
  description: 'Read a text file inside the workspace.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: 'workspace-relative or absolute path' } },
    required: ['path'],
  },
  run: async (args, ctx) => {
    try {
      const ws = await ensureWorkspace(ctx);
      const abs = resolveWithinWorkspace(ws, (args as { path: string }).path);
      const content = await readFile(abs, 'utf8');
      return { ok: true, result: content };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
