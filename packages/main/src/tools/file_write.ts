import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolSpec } from '@eugent/shared';
import { ensureWorkspace, resolveWithinWorkspace } from './workspace.js';

export const fileWrite: ToolSpec = {
  name: 'file_write',
  description: 'Create or overwrite a text file inside the workspace.',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
  run: async (args, ctx) => {
    try {
      const ws = await ensureWorkspace(ctx);
      const { path, content } = args as { path: string; content: string };
      const abs = resolveWithinWorkspace(ws, path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, 'utf8');
      return { ok: true, result: { path: abs, bytes: Buffer.byteLength(content) } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
