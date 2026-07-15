import { type ModelMessage } from "ai";
import { createInterface } from "node:readline";
import { ToolRegistry } from "./tool-registry.js";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "./mock-model";
import "dotenv/config";
import { agentLoop, type BudgetState } from "./loop";
import { allTools } from "./tools";

// mock 声明的是 v2 spec，ai SDK 会打一条 "compatibility mode" warning——已知且预期，
// 本地开发不需要看到；真要排查 SDK 内部问题时把这行注掉即可。
(globalThis as any).AI_SDK_LOG_WARNINGS = false;

console.log("process.env.DASHSCOPE_API_KEY: ", process.env.DASHSCOPE_API_KEY);

const ds = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DASHSCOPE_API_KEY,
});

const model = process.env.DASHSCOPE_API_KEY
  ? ds.chat("deepseek-v4-flash")
  : createMockModel();

const registry = new ToolRegistry();
registry.register(...allTools);

console.log(`已注册 ${registry.getAll().length} 个工具：`);
for (const tool of registry.getAll()) {
  const flags = [
    tool.isConcurrencySafe ? "可并发" : "串行",
    tool.isReadOnly ? "只读" : "读写",
  ].join(", ");
  console.log(`  - ${tool.name}（${flags}）`);
}

const messages: ModelMessage[] = [];
// 预算由调用方持有，跨轮持续累计——agentLoop 只负责消费它
const budget: BudgetState = { used: 0, limit: 1500000 };
const rl = createInterface({ input: process.stdin, output: process.stdout });

const SYSTEM = `你是 Super Agent，一个有工具调用能力的 AI 助手。
需要查询信息时，主动使用工具，不要编造数据。
回答要简洁直接。`;

function ask() {
  rl.question("\nYou: ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === "exit") {
      console.log("Bye!");
      rl.close();
      return;
    }

    messages.push({ role: "user", content: trimmed });

    await agentLoop(model, registry, messages, SYSTEM, budget);

    ask();
  });
}

console.log('Super Agent v0.3 — Fuses (type "exit" to quit)\n');
console.log('试试输入："测试死循环"、"测试重试"、"测试预算" 看三层防护效果\n');
ask();
