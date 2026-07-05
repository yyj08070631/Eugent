import Ajv, { type ValidateFunction } from 'ajv';
import { randomUUID } from 'node:crypto';
import type { ToolSpec, ToolCtx, ToolResult } from '@eugent/shared';

export class ToolManager {
  private tools = new Map<string, ToolSpec>();
  private validators = new Map<string, ValidateFunction>();
  private approved = new Map<string, Set<string>>();
  private ajv = new Ajv({ allErrors: true, strict: false });

  register(spec: ToolSpec): void {
    this.tools.set(spec.name, spec);
    this.validators.set(spec.name, this.ajv.compile(spec.parameters));
  }

  list(allowlist?: string[]): ToolSpec[] {
    const all = [...this.tools.values()];
    if (!allowlist) return all;
    const set = new Set(allowlist);
    return all.filter((t) => set.has(t.name));
  }

  resetApprovals(sessionId: string): void {
    this.approved.delete(sessionId);
  }

  async invoke(name: string, args: unknown, ctx: ToolCtx): Promise<ToolResult> {
    const spec = this.tools.get(name);
    if (!spec) return { ok: false, error: 'tool_not_found' };

    const validate = this.validators.get(name)!;
    if (!validate(args)) {
      return { ok: false, error: 'invalid_args', result: validate.errors };
    }

    if (spec.risk === 'write' && !this.isApproved(ctx.sessionId, name)) {
      const reply = await ctx.requestApproval({
        callId: randomUUID(),
        kind: 'tool_write',
        toolName: name,
        argsPreview: args,
      });
      if (!reply.allow) return { ok: false, error: 'user_denied' };
      if (reply.remember) this.remember(ctx.sessionId, name);
    }

    try {
      return await spec.run(args, ctx);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private isApproved(sid: string, name: string): boolean {
    return this.approved.get(sid)?.has(name) ?? false;
  }
  private remember(sid: string, name: string): void {
    let set = this.approved.get(sid);
    if (!set) {
      set = new Set();
      this.approved.set(sid, set);
    }
    set.add(name);
  }
}
