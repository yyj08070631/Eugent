import OpenAI from 'openai';
import { DEEPSEEK_BASE_URL } from '@eugent/shared';
import type { OpenAIClientLike, ModelChunk, OpenAIMessage, OpenAITool } from './ModelManager.js';

export function makeDeepSeekClient(apiKey: string): OpenAIClientLike {
  const baseURL = process.env.EUGENT_FAKE_ENDPOINT ?? DEEPSEEK_BASE_URL;
  const client = new OpenAI({ apiKey, baseURL });

  return {
    async *stream(params: {
      model: string;
      messages: OpenAIMessage[];
      tools?: OpenAITool[];
      signal?: AbortSignal;
      thinking: 'on' | 'off';
    }): AsyncIterable<ModelChunk> {
      // DeepSeek 兼容协议里通过 `thinking` 字段控制思考模式（extra_body）。
      // openai SDK v4 的类型不识别，直接透传进 body；DeepSeek 侧解析。
      const body = {
        model: params.model,
        messages: params.messages as OpenAI.ChatCompletionMessageParam[],
        tools: params.tools as OpenAI.ChatCompletionTool[] | undefined,
        stream: true,
        ...(params.thinking === 'off' ? { thinking: { type: 'disabled' } } : {}),
      } as OpenAI.ChatCompletionCreateParamsStreaming & Record<string, unknown>;
      const resp = await client.chat.completions.create(body, { signal: params.signal });
      for await (const chunk of resp) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta.content) {
          yield { type: 'token', delta: delta.content };
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              type: 'tool_call_delta',
              index: tc.index,
              ...(tc.id !== undefined ? { id: tc.id } : {}),
              ...(tc.function?.name !== undefined ? { name: tc.function.name } : {}),
              ...(tc.function?.arguments !== undefined ? { argsDelta: tc.function.arguments } : {}),
            };
          }
        }
        if (choice.finish_reason) {
          yield { type: 'done' };
        }
      }
    },
  };
}
