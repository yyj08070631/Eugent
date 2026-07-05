import type { ModelId } from '@eugent/shared';
import type { SettingsRepo } from '../db/repo/SettingsRepo.js';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OpenAITool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export type ModelChunk =
  | { type: 'token'; delta: string }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: 'done' };

export interface OpenAIClientLike {
  stream(params: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    signal?: AbortSignal;
    thinking: 'on' | 'off';
  }): AsyncIterable<ModelChunk>;
}

export interface ChatStreamParams {
  model?: ModelId;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  signal?: AbortSignal;
  thinking?: 'on' | 'off';
}

export class ModelManager {
  constructor(
    private settings: SettingsRepo,
    private clientFactory: (apiKey: string) => OpenAIClientLike,
  ) {}

  getSelected(): ModelId {
    return this.settings.getModel();
  }
  setSelected(id: ModelId): void {
    this.settings.setModel(id);
  }
  hasApiKey(): boolean {
    return this.settings.hasApiKey();
  }
  setApiKey(raw: string): void {
    this.settings.setApiKey(raw);
  }

  async *chatStream(params: ChatStreamParams): AsyncIterable<ModelChunk> {
    const apiKey = this.settings.getApiKey();
    if (!apiKey) throw new Error('No API key configured');
    const client = this.clientFactory(apiKey);
    const model = params.model ?? this.getSelected();
    yield* client.stream({
      model,
      messages: params.messages,
      tools: params.tools,
      signal: params.signal,
      thinking: params.thinking ?? 'off',
    });
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.settings.hasApiKey()) return { ok: false, error: 'no_api_key' };
    try {
      const iter = this.chatStream({
        messages: [{ role: 'user', content: 'ping' }],
        model: 'deepseek-v4-flash',
      });
      for await (const c of iter) {
        if (c.type === 'done') break;
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
