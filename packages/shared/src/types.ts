export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string | null;
  toolCalls: ToolCallRecord[] | null;
  toolCallId: string | null;
  skillId: SkillId | null;
  partial: boolean;
  createdAt: number;
}

export type SkillId = 'default' | 'research' | 'code';

export interface Skill {
  id: SkillId;
  systemPrompt: string;
  toolAllowlist: string[];
}

export type JsonSchema = Record<string, unknown>;

export interface ToolCtx {
  sessionId: string;
  workspaceDir: string | null;
  signal: AbortSignal;
  requestApproval(payload: ApprovalRequest): Promise<ApprovalReply>;
}

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
  risk: 'read' | 'write';
  run(args: unknown, ctx: ToolCtx): Promise<ToolResult>;
}

export interface ApprovalRequest {
  callId: string;
  kind: 'tool_write' | 'pick_workspace';
  toolName?: string;
  argsPreview?: unknown;
}

export interface ApprovalReply {
  callId: string;
  allow: boolean;
  remember: boolean;
  workspaceDir?: string | null;
}

export type AgentEvent =
  | { runId: string; sessionId: string; kind: 'token'; delta: string }
  | { runId: string; sessionId: string; kind: 'tool_call'; id: string; name: string; args: unknown }
  | {
      runId: string;
      sessionId: string;
      kind: 'tool_result';
      id: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  | { runId: string; sessionId: string; kind: 'done'; finalText: string }
  | { runId: string; sessionId: string; kind: 'error'; message: string };

export type ModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash';
export const MODEL_IDS = ['deepseek-v4-pro', 'deepseek-v4-flash'] as const;

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const MAX_TURNS = 20;
export const MAX_HISTORY_ROUNDS = 20;
