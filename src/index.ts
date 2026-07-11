import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createInterface } from "node:readline";
import { calculatorTool, weatherTool } from "./tools/utility-tools";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "./mock-model";
import "dotenv/config";
import { agentLoop, type BudgetState } from "./agent/loop";

console.log("process.env.DASHSCOPE_API_KEY: ", process.env.DASHSCOPE_API_KEY);

const ds = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DASHSCOPE_API_KEY,
});

const model = process.env.DASHSCOPE_API_KEY
  ? ds.chat("deepseek-v4-flash")
  : createMockModel();

const tools = { get_weather: weatherTool, calculator: calculatorTool };
const messages: ModelMessage[] = [];
// 预算由调用方持有，跨轮持续累计——agentLoop 只负责消费它
const budget: BudgetState = { used: 0, limit: 15000 };
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

    await agentLoop(model, tools, messages, SYSTEM, budget);

    ask();
  });
}

console.log('Super Agent v0.3 — Fuses (type "exit" to quit)\n');
console.log('试试输入："测试死循环"、"测试重试"、"测试预算" 看三层防护效果\n');
ask();
