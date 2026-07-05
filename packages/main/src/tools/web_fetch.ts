import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ToolSpec } from '@eugent/shared';

const td = new TurndownService({ headingStyle: 'atx' });

export const webFetch: ToolSpec = {
  name: 'web_fetch',
  description: 'Fetch a URL, extract main content, return markdown.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', format: 'uri' } },
    required: ['url'],
  },
  run: async (args, ctx) => {
    try {
      const { url } = args as { url: string };
      const resp = await fetch(url, { signal: ctx.signal });
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` };
      const html = await resp.text();
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      if (!article) return { ok: false, error: 'no_readable_content' };
      const md = td.turndown(article.content ?? '');
      return {
        ok: true,
        result: { title: article.title, byline: article.byline, markdown: md.slice(0, 100_000) },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
