const RESPONSES: Record<string, string> = {
  default:
    "你好！我是模拟模型。填了 DASHSCOPE_API_KEY 后会自动切换到真实的 Qwen。",
  greeting: "你好！虽然是模拟的，但流式输出的效果和真实 API 一致 :)",
  name: '你刚才告诉我了呀！我能"记住"是因为代码把对话历史传给了我。',
  intro: "我是通义千问（模拟版），在本地模拟回复，机制和真实 API 完全一致。",
  budget:
    "本轮我故意报了一个很大的 usage，多问几次就能撞到预算上限，看到熔断日志。",
};

// —— 意图识别：只看"最后一条 user 消息"，因为多轮对话里 assistant/tool
// 消息夹杂在中间，仅按 role 过滤就能拿到用户当前的诉求。
type ToolIntent = "loop-forever" | "error-429" | null;

function extractLastUserText(prompt: any[]): string {
  const userMsgs = (prompt || []).filter((m: any) => m.role === "user");
  const last = userMsgs[userMsgs.length - 1];
  return (last?.content || [])
    .map((c: any) => c.text || "")
    .join("")
    .toLowerCase();
}

function detectToolIntent(prompt: any[]): ToolIntent {
  const text = extractLastUserText(prompt);
  // 模拟"每次都调同一个工具、结果也从不变"的失败模式——loop-detection 应当兜住
  if (text.includes("测试死循环")) return "loop-forever";
  // 模拟真实 provider 的 429，让上层可以试验重试/降级
  if (text.includes("测试重试")) return "error-429";
  return null;
}

function pickResponse(prompt: any[]): string {
  const text = extractLastUserText(prompt);
  if (text.includes("介绍你自己") || text.includes("你是谁"))
    return RESPONSES.intro;
  if (text.includes("你好") || text.includes("hello"))
    return RESPONSES.greeting;
  if (text.includes("叫什么") || text.includes("记住")) return RESPONSES.name;
  if (text.includes("测试预算")) return RESPONSES.budget;
  if (text.includes("请换一个思路解决问题"))
    return `根据查询结果：${prompt[prompt.length - 1].content[0].output.value}`;
  return RESPONSES.default;
}

// mock 声明的是 v2 spec，usage 就得按 v2 的 flat 结构给数字，
// 否则 ai SDK 内部的 v2→v3→final 转换链会把嵌套对象当成 token 数，
// 最终 totalTokens 变成对象/NaN，调用方读到的 spent = 0，budget 就永远兜不住。
const USAGE_DEFAULT = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
// 「测试预算」专用：单轮就烧掉预算的一大半，两三轮即可撞穿 15000 的默认 limit，
// 方便本地验证第三层熔断。真实模型的 usage 也是自报数字，与响应文本长度无关。
const USAGE_BUDGET_DRAIN = {
  inputTokens: 3000,
  outputTokens: 7000,
  totalTokens: 10000,
};

function pickUsage(prompt: any[]) {
  const text = extractLastUserText(prompt);
  if (text.includes("测试预算")) return USAGE_BUDGET_DRAIN;
  return USAGE_DEFAULT;
}

function make429(): any {
  const err: any = new Error(
    "[mock] 429 Too Many Requests: rate limit exceeded",
  );
  err.status = 429;
  err.statusCode = 429;
  err.name = "MockAPIError";
  return err;
}

// 同步 throw 会绕过 streamText 的 onError 兜底、直接把进程干掉；
// 把 429 塞进 stream 的 error chunk，上层可以走 onError 或未来的 retry 层拦。
function buildErrorChunks(usage: typeof USAGE_DEFAULT) {
  return [
    { type: "error", error: make429() },
    {
      type: "finish",
      finishReason: { unified: "error", raw: undefined },
      usage,
    },
  ];
}

function createDelayedStream(chunks: any[], delayMs = 30): ReadableStream {
  return new ReadableStream({
    start(controller) {
      let i = 0;
      function next() {
        if (i < chunks.length) {
          controller.enqueue(chunks[i++]);
          setTimeout(next, delayMs);
        } else {
          controller.close();
        }
      }
      next();
    },
  });
}

function buildStuckToolCallChunks(usage: typeof USAGE_DEFAULT) {
  const id = "tool-1";
  const toolName = "get_weather";
  const input = JSON.stringify({ city: "北京" });
  return [
    { type: "tool-input-start", id, toolName },
    { type: "tool-input-delta", id, delta: input },
    { type: "tool-input-end", id },
    { type: "tool-call", toolCallId: id, toolName, input },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage,
    },
  ];
}

function buildTextChunks(text: string, usage: typeof USAGE_DEFAULT) {
  const id = "text-1";
  return [
    { type: "text-start", id },
    ...text
      .split("")
      .map((char: string) => ({ type: "text-delta", id, delta: char })),
    { type: "text-end", id },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage,
    },
  ];
}

export function createMockModel() {
  return {
    specificationVersion: "v2" as const,
    provider: "mock",
    modelId: "mock-model",
    get supportedUrls() {
      return Promise.resolve({});
    },

    async doGenerate({ prompt }: any) {
      const intent = detectToolIntent(prompt);
      const usage = pickUsage(prompt);
      if (intent === "error-429") throw make429();
      if (intent === "loop-forever") {
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: "tool-1",
              toolName: "get_weather",
              input: JSON.stringify({ city: "北京" }),
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: pickResponse(prompt) }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },

    async doStream({ prompt }: any) {
      const intent = detectToolIntent(prompt);
      const usage = pickUsage(prompt);
      const chunks =
        intent === "error-429"
          ? buildErrorChunks(usage)
          : intent === "loop-forever"
            ? buildStuckToolCallChunks(usage)
            : buildTextChunks(pickResponse(prompt), usage);
      return { stream: createDelayedStream(chunks, 30) };
    },
  };
}
