import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ToolCtx } from '@eugent/shared';

export async function ensureWorkspace(ctx: ToolCtx): Promise<string> {
  if (ctx.workspaceDir) return ctx.workspaceDir;
  const reply = await ctx.requestApproval({
    callId: randomUUID(),
    kind: 'pick_workspace',
  });
  if (!reply.allow || !reply.workspaceDir) throw new Error('no_workspace');
  return reply.workspaceDir;
}

export function resolveWithinWorkspace(workspace: string, requested: string): string {
  const abs = path.isAbsolute(requested) ? requested : path.resolve(workspace, requested);
  const normalized = path.normalize(abs);
  const wsNorm = path.normalize(workspace);
  if (!normalized.startsWith(wsNorm + path.sep) && normalized !== wsNorm) {
    throw new Error('path_outside_workspace');
  }
  return normalized;
}
