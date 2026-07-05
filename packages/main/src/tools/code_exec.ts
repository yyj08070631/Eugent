import { Worker } from 'node:worker_threads';
import type { ToolSpec, ToolResult } from '@eugent/shared';

const DEFAULT_TIMEOUT_MS = 5_000;

// Worker 内部脚本：跑 vm.runInNewContext + 硬 timeout，通过 postMessage 回主线程。
// context 为空对象 `{}` —— 无 require / console / fetch / setTimeout；仅纯计算。
const WORKER_SOURCE = `
const vm = require('node:vm');
const { parentPort, workerData } = require('node:worker_threads');
function serialize(v) {
  if (v === undefined) return null;
  try { JSON.stringify(v); return v; } catch { return String(v); }
}
try {
  // vm.runInNewContext 返回最后一个 expression/statement 的值。
  // 不套 IIFE (return-wrapped) — 因为 statement 类代码 (while/if) 无法作为 return 表达式。
  const result = vm.runInNewContext(workerData.code, {}, {
    timeout: workerData.timeoutMs,
    displayErrors: true,
  });
  parentPort.postMessage({ ok: true, result: serialize(result) });
} catch (e) {
  const msg = e && e.message ? String(e.message) : String(e);
  if (/Script execution timed out/.test(msg)) {
    parentPort.postMessage({ ok: false, error: 'timeout' });
  } else {
    parentPort.postMessage({ ok: false, error: msg });
  }
}
`;

export const codeExec: ToolSpec = {
  name: 'code_exec',
  description:
    'Run a JavaScript snippet in an isolated worker + vm context. Only pure computation — no fs/net access. Returns the value of the last expression.',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      timeoutMs: { type: 'number', minimum: 100, maximum: 30_000 },
    },
    required: ['code'],
  },
  run: (args, ctx) =>
    new Promise<ToolResult>((resolve) => {
      const { code, timeoutMs = DEFAULT_TIMEOUT_MS } = args as {
        code: string;
        timeoutMs?: number;
      };
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { code, timeoutMs },
      });
      let settled = false;
      const settle = (v: ToolResult): void => {
        if (settled) return;
        settled = true;
        ctx.signal.removeEventListener('abort', onAbort);
        void worker.terminate();
        resolve(v);
      };
      const onAbort = (): void => settle({ ok: false, error: 'aborted' });
      ctx.signal.addEventListener('abort', onAbort, { once: true });
      worker.on('message', (msg: ToolResult) => settle(msg));
      worker.on('error', (e: Error) => settle({ ok: false, error: e.message }));
    }),
};
