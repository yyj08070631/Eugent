import { spawn } from 'node:child_process';
import type { ToolSpec, ToolResult } from '@eugent/shared';
import { ensureWorkspace } from './workspace.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export const shell: ToolSpec = {
  name: 'shell',
  description: 'Run a shell command with zsh inside the workspace. Returns stdout, stderr, exitCode.',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      timeoutMs: { type: 'number', minimum: 100, maximum: 300_000 },
    },
    required: ['command'],
  },
  run: async (args, ctx): Promise<ToolResult> => {
    let ws: string;
    try {
      ws = await ensureWorkspace(ctx);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const { command, timeoutMs = DEFAULT_TIMEOUT_MS } = args as {
      command: string;
      timeoutMs?: number;
    };
    return new Promise<ToolResult>((resolve) => {
      const child = spawn('zsh', ['-lc', command], { cwd: ws });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const settle = (result: ToolResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ctx.signal.removeEventListener('abort', onAbort);
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));

      const timer = setTimeout(() => settle({ ok: false, error: 'timeout' }), timeoutMs);
      const onAbort = (): void => settle({ ok: false, error: 'aborted' });
      ctx.signal.addEventListener('abort', onAbort, { once: true });

      child.on('close', (exitCode) => {
        settle({ ok: true, result: { stdout, stderr, exitCode: exitCode ?? -1 } });
      });
    });
  },
};
