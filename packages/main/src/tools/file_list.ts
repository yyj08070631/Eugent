import { readdir } from 'node:fs/promises';
import type { ToolSpec } from '@eugent/shared';
import { ensureWorkspace, resolveWithinWorkspace } from './workspace.js';

export const fileList: ToolSpec = {
  name: 'file_list',
  description: 'List direct children of a directory inside the workspace.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
  run: async (args, ctx) => {
    try {
      const ws = await ensureWorkspace(ctx);
      const abs = resolveWithinWorkspace(ws, (args as { path: string }).path);
      const entries = await readdir(abs, { withFileTypes: true });
      return {
        ok: true,
        result: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
        })),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
