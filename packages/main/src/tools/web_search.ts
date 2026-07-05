import type { ToolSpec, ToolResult } from '@eugent/shared';
import type { SettingsRepo } from '../db/repo/SettingsRepo.js';

export function makeWebSearch(settings: SettingsRepo): ToolSpec {
  return {
    name: 'web_search',
    description:
      'Search the web via configured provider (tavily or serper). Returns list of {title, url, snippet}.',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: { q: { type: 'string' }, limit: { type: 'number', minimum: 1, maximum: 20 } },
      required: ['q'],
    },
    run: async (args, ctx): Promise<ToolResult> => {
      try {
        const provider = settings.getSearchProvider();
        const key = settings.getSearchApiKey();
        if (!provider || !key) return { ok: false, error: 'search_not_configured' };
        const { q, limit = 8 } = args as { q: string; limit?: number };
        if (provider === 'tavily') return await tavily(q, limit, key, ctx.signal);
        return await serper(q, limit, key, ctx.signal);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

async function tavily(
  q: string,
  limit: number,
  key: string,
  signal: AbortSignal,
): Promise<ToolResult> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: q, max_results: limit }),
    signal,
  });
  if (!resp.ok) return { ok: false, error: `tavily_${resp.status}` };
  const data = (await resp.json()) as {
    results: Array<{ title: string; url: string; content: string }>;
  };
  return {
    ok: true,
    result: data.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content })),
  };
}

async function serper(
  q: string,
  limit: number,
  key: string,
  signal: AbortSignal,
): Promise<ToolResult> {
  const resp = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q, num: limit }),
    signal,
  });
  if (!resp.ok) return { ok: false, error: `serper_${resp.status}` };
  const data = (await resp.json()) as {
    organic?: Array<{ title: string; link: string; snippet: string }>;
  };
  return {
    ok: true,
    result: (data.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet })),
  };
}
