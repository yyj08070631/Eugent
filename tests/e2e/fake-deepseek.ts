import http from 'node:http';
import type { AddressInfo } from 'node:net';

export function startFakeDeepSeek(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url?.endsWith('/chat/completions')) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
      const emit = (obj: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      };

      emit({ choices: [{ index: 0, delta: { content: '你好，' } }] });
      emit({ choices: [{ index: 0, delta: { content: '我在。' } }] });
      emit({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

// grill 第 B2 项：为 tool-approval E2E 补齐完整 fake（返回 tool_call 事件 + 第 2 轮回复）
export function startFakeDeepSeekWithTool(): Promise<{ url: string; close: () => Promise<void> }> {
  let turn = 0;
  const server = http.createServer((req, res) => {
    if (req.url?.endsWith('/chat/completions')) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
      const emit = (obj: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      };

      if (turn === 0) {
        // 第 1 轮：助手要调 file_list（read 类，自动放行）
        emit({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'c1',
                    type: 'function',
                    function: { name: 'file_list', arguments: '{"path":"."}' },
                  },
                ],
              },
            },
          ],
        });
        emit({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
      } else {
        // 第 2 轮：工具结果已回喂，助手回终态回复
        emit({ choices: [{ index: 0, delta: { content: '已列出目录内容。' } }] });
        emit({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
      }
      turn++;
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
