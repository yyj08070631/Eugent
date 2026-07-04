# Eugent v1 · 设计规约

- 状态：Draft（等 Eugene 复审后进入 planning 阶段）
- 版本：v1（首个可用版本）
- 日期：2026-07-01

## 1 · 概述

**Eugent** 是一个基于「分层解耦架构」的桌面端 Mini Agent 客户端。核心思路：把 Agent 拆成 Core / Skill / Main 三层、六大组件（ModelManager / ToolManager / MemoryManager / ContextBuilder / SkillEngine / AgentLoop），通过内部路由把「场景化 prompt + 工具白名单」打包成 Skill，模型层默认对接 DeepSeek。

**v1 定位**：单用户（作者自用）、仅 macOS、以 DeepSeek 为唯一模型供应商。

## 2 · 需求收敛

| # | 维度 | 决策 |
|---|---|---|
| 1 | 目标场景 | 通用聊天 + 工具调用助手（类 ChatGPT Desktop 形态） |
| 2 | MVP 范围 | 五大组件 + 简易 SkillEngine；**不做**长期记忆 / 向量检索 |
| 3 | 内置 Tools | 文件读写、Shell、网页搜索+抓取、代码执行（Python/JS） |
| 4 | 权限策略 | 分级：读类自动放行，写类弹框确认 + 本会话免确认 |
| 5 | 会话组织 | 多会话 + 侧边栏（类 Claude Desktop） |
| 6 | Skill 可见度 | 内部路由 + **斜杠指令手动切**（`/research` / `/code` / `/default`），flash 分类结果不可见，手动指令显 badge |
| 7 | 目标平台 | 仅 macOS |
| — | 模型 | DeepSeek `deepseek-v4-pro`（默认）/ `deepseek-v4-flash` 二选一；OpenAI 兼容协议接入；base_url `https://api.deepseek.com` |
| — | 技术栈 | Bun（开发期 runtime）+ Electron + React + TS + Vite + SQLite + Tailwind 4 + shadcn/ui |

## 3 · 架构总览

### 3.1 · 进程模型

两进程强隔离：**Main 承载 Agent Core 与 Infra**，**Renderer 只做 UI**，中间用类型强对齐的窄 IPC 通信。

- `nodeIntegration: false` / `contextIsolation: true` / `sandbox: true`
- Preload 层暴露一个 `window.eugent` 对象，方法白名单强类型
- Main → Renderer 的流式事件统一走 `agent:event` 频道，内部再分 `token` / `tool_call` / `tool_result` / `done` / `error` 子 kind

```
┌────────────── Electron Main (Node runtime) ──────────────┐
│ Agent Core                                               │
│  ├── ModelManager    DeepSeek 客户端 + 模型偏好           │
│  ├── ToolManager     Tool 注册 + 参数校验 + 权限 gate     │
│  ├── MemoryManager   短期会话记忆 (messages[])            │
│  ├── ContextBuilder  拼系统提示 + skill overlay + history │
│  ├── SkillEngine     斜杠指令解析 + flash 分类兜底        │
│  └── AgentLoop       think→act→observe 循环 (max 20 轮)   │
│ Infra                                                    │
│  ├── SQLite (better-sqlite3, 同步 API)                   │
│  ├── safeStorage (Electron 内置，加密 API key)            │
│  └── IPC Router (ipcMain.handle + webContents.send)      │
└──────────────────────────────────────────────────────────┘
             ▲                              ▼
        请求 (invoke)               事件流 (send)
             ▲                              ▼
┌────────── Electron Renderer (Chromium, isolated) ────────┐
│ React + TS + Vite + Tailwind + shadcn/ui                 │
│  ├── stores/     Zustand: sessions / messages / streaming│
│  ├── ipc/        typed preload wrapper                    │
│  ├── views/      Sidebar / Chat / Settings / Approval     │
│  └── components/                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 · 目录布局（monorepo）

```
packages/
  main/       Electron main + Agent Core
  renderer/   React app (Vite)
  preload/    IPC 白名单 + 类型桥
  shared/     跨进程 TS 类型 (Message / ToolSpec / AgentEvent 等)
```

## 4 · 六大组件

### 4.1 · 共享类型（`packages/shared/types.ts`）

```ts
interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;       // 给 DeepSeek function calling
  risk: 'read' | 'write';       // 决定是否权限弹框
  run(args: unknown, ctx: ToolCtx): Promise<ToolResult>;
}

interface Skill {
  id: 'default' | 'research' | 'code';
  systemPrompt: string;
  toolAllowlist: string[];
}

type AgentEvent =
  | { kind: 'token';       delta: string }
  | { kind: 'tool_call';   id: string; name: string; args: unknown }
  | { kind: 'tool_result'; id: string; ok: boolean; result?: unknown; error?: string }
  | { kind: 'done';        finalText: string }
  | { kind: 'error';       message: string };

interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}
```

### 4.2 · 组件职责表

| 组件 | 关键方法 | 说明 |
|---|---|---|
| **ModelManager** | `chatStream(params) → AsyncIterable<Chunk>`<br>`getSelected() / setSelected(id)`<br>`getApiKey() / setApiKey(raw)` | `openai` SDK 指向 `https://api.deepseek.com`；模型偏好写 sqlite `settings.selected_model`；API key 走 `safeStorage.encryptString` → base64 → `settings.api_key_enc`。SkillEngine 分类调用固定 `deepseek-v4-flash` 非思考模式 |
| **ToolManager** | `register(spec)`<br>`list(allowlist?) → ToolSpec[]`<br>`invoke(name, args, ctx) → ToolResult` | 参数用 `ajv` 校验；`risk:'write'` 首次调用向 renderer 发权限请求事件、等回执；「本会话免确认」列表 `Map<sessionId, Set<toolName>>` 存内存 |
| **MemoryManager** | `createSession() / listSessions() / renameSession() / deleteSession()`<br>`appendMessage(sid, msg)`<br>`getMessages(sid, limit?) → Message[]` | sqlite CRUD；上下文裁剪用**滑窗**：首条 system + 最近 20 轮 |
| **ContextBuilder** | `build(sid, skill) → { messages, tools }` | `base_system` + `skill.systemPrompt` → system message；追加 history；`tools = ToolManager.list(skill.toolAllowlist)` |
| **SkillEngine** | `select(userInput, recentHistory) → { skill, cleanedInput }` | **优先**斜杠指令（`/research`/`/code`/`/default`）；否则 `deepseek-v4-flash` 分类；未知斜杠指令原样送分类。Skill 定义写死在 `packages/main/src/skills/*.ts` |
| **AgentLoop** | `run(sid, userInput) → AsyncIterable<AgentEvent>` | think→act→observe 循环，`MAX_TURNS = 20`；每步 emit 事件；`AbortController` 支持中断 |

### 4.3 · 内置 Skill

| id | systemPrompt 主旨 | toolAllowlist |
|---|---|---|
| `default` | 通用聊天助手；按需调工具 | 全部 |
| `research` | 优先并行搜索+抓取多源，交叉验证，输出带引用的结论 | `web_search`, `web_fetch`, `file_write` |
| `code` | 先 list 目录、再 read 文件；给最小复现；改动小、可回退 | `file_read`, `file_write`, `shell` |

### 4.4 · 内置 Tools

| name | risk | 备注 |
|---|---|---|
| `file_read` | read | 限定「工作区目录」（用户在设置里选） |
| `file_list` | read | 同上 |
| `file_write` | write | 同上；首次弹权限 |
| `shell` | write | 用 `child_process.spawn`；默认 zsh；首次弹权限 |
| `web_search` | read | 第三方 API（v1 用 Tavily/Serper 之一，用户填 key） |
| `web_fetch` | read | 拉 URL 转 markdown（`@mozilla/readability` + `turndown`） |
| `code_exec` | write | 沙箱内跑 Python 或 JS；具体沙箱方案（`vm2` / Docker / `deno`）v1 起手用 `deno run --allow-none`，最安全；首次弹权限 |

## 5 · 数据流

### 5.1 · AgentLoop 主循环伪代码

```ts
async *run(sid: string, userInput: string, signal: AbortSignal): AsyncIterable<AgentEvent> {
  const { skill, cleanedInput } = await this.skillEngine.select(userInput);
  await this.memory.appendMessage(sid, { role: 'user', content: cleanedInput });

  let { messages, tools } = await this.contextBuilder.build(sid, skill);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal.aborted) { /* mark partial, return */ }

    const stream = this.model.chatStream({ messages, tools, signal });
    const toolCalls: ToolCall[] = [];
    let finalText = '';

    for await (const chunk of stream) {
      if (signal.aborted) break;
      if (chunk.type === 'token') {
        finalText += chunk.delta;
        yield { kind: 'token', delta: chunk.delta };
      } else if (chunk.type === 'tool_call_delta') {
        mergeToolCall(toolCalls, chunk);
      }
    }

    if (toolCalls.length === 0) {
      await this.memory.appendMessage(sid, {
        role: 'assistant', content: finalText, partial: signal.aborted,
      });
      yield { kind: 'done', finalText };
      return;
    }

    // args 完整才 emit tool_call 事件
    await this.memory.appendMessage(sid, {
      role: 'assistant', tool_calls: toolCalls, partial: false,
    });

    for (const call of toolCalls) {
      yield { kind: 'tool_call', id: call.id, name: call.name, args: call.args };
      const result = await this.toolManager.invoke(call.name, call.args, {
        sessionId: sid, signal,
        onNeedApproval: (req) => this.emitApproval(sid, req),
      });
      yield { kind: 'tool_result', id: call.id, ...result };
      await this.memory.appendMessage(sid, {
        role: 'tool', tool_call_id: call.id, content: JSON.stringify(result),
      });
    }

    ({ messages, tools } = await this.contextBuilder.build(sid, skill));
  }

  yield { kind: 'error', message: `已达最大轮数 ${MAX_TURNS}` };
}
```

### 5.2 · IPC 通道

| 通道 | 方向 | 用途 |
|---|---|---|
| `chat:send` | Renderer → Main（invoke） | 发送一条消息、启动 run；返回 runId |
| `chat:cancel` | Renderer → Main（invoke） | 触发 AbortController |
| `agent:event` | Main → Renderer（send） | 流式事件；每个 event 带 runId + sessionId |
| `approval:request` | Main → Renderer（send） | 请求写类工具权限 |
| `approval:reply` | Renderer → Main（invoke） | 回执 `{callId, allow, remember}` |
| `sessions:*` | Renderer → Main（invoke） | 会话 CRUD |
| `settings:*` | Renderer → Main（invoke） | 读写模型偏好、API key、主题 |

### 5.3 · 关键约定

- **runId**：每次 `chat:send` 生成一个，所有 event 都带；renderer 用它匹配"哪条消息在流式"
- **args 完整才显示**：main 内部累积 `tool_call_delta` 直到 args JSON 合法，再 emit `tool_call`；期间 renderer 在气泡下显"正在准备工具调用..."薄条
- **中断（Stop 按钮）**：调 `chat:cancel(runId)`；main 端 abort SDK 和运行中的 tool；已产生 token 保留在 DB，助手消息 `partial=1`

## 6 · SQLite Schema

**文件位置**：`app.getPath('userData')/eugent.sqlite`  
（macOS 实际路径：`~/Library/Application Support/eugent/eugent.sqlite`）

```sql
CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version VALUES (1);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,           -- 截用户首条消息前 24 字；可手动重命名
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

CREATE TABLE messages (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  role           TEXT NOT NULL
                 CHECK (role IN ('user','assistant','tool','system')),
  content        TEXT,                 -- 文本；tool role 时是 JSON 字符串
  tool_calls     TEXT,                 -- 内嵌 JSON array；否则 NULL
  tool_call_id   TEXT,                 -- role='tool' 时关联
  skill_id       TEXT,                 -- 调试用：本轮走了哪个 skill
  partial        INTEGER NOT NULL DEFAULT 0,  -- 0/1；中断/异常导致的未完成
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
-- 预置:
--   selected_model  -> 'deepseek-v4-pro' | 'deepseek-v4-flash'
--   api_key_enc     -> base64(safeStorage.encryptString(rawKey))
--   theme           -> 'system' | 'light' | 'dark'
--   workspace_dir   -> 文件类工具允许操作的根目录（用户设置）
--   search_provider -> 'tavily' | 'serper'
--   search_api_key  -> 明文（第三方搜索 key 非核心机密，暂不加密；可后续升级）
```

**关键决策速查**：

| 决策 | 选择 | 理由 |
|---|---|---|
| tool_calls 存法 | 内嵌 messages 表 JSON 列 | 免 join；v1 不做工具聚合分析 |
| API key 存法 | safeStorage 加密后 base64 | 绑定当前 mac 用户，拷走无法解 |
| 删除会话 | 硬删（CASCADE） | v1 单用户；避免隐藏历史消息占 token |
| 会话标题 | 截首句前 24 字，可重命名 | 免额外 API 调用 |
| 迁移策略 | `schema_version` + 代码 migrations 数组 | v1 只有 v1；预留机制 |

## 7 · UI 结构

### 7.1 · 主窗口布局

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙ Eugent                                                       │
├─────────────┬───────────────────────────────────────────────────┤
│ ＋ 新会话   │  [助手] 你好，我可以帮你...                        │
│             │                                                   │
│ 今天        │  [你] /research Rust async runtime 都有哪些         │
│  · Rust... │      └─ badge: [research]                         │
│  · 死循环 * │                                                   │
│             │  ▸ [tool] web_search {"q":"Rust async..."}         │
│ 昨天        │    └ ✅ 12 results                                 │
│  · ...      │                                                   │
│             │  [助手] Tokio 是主流选择...（流式）                │
│             │                                                   │
│             │  ┌──────────────────────────────────┐             │
│             │  │ 说点什么...           (⌘⏎ 发送) │▷│           │
│             │  └──────────────────────────────────┘             │
│  ⚙ 设置     │                                                   │
└─────────────┴───────────────────────────────────────────────────┘
```

### 7.2 · 视图清单

| 视图 | 触发 | 内容 |
|---|---|---|
| 侧边栏会话列表 | 常驻 | `updated_at DESC`，按「今天/昨天/本周/更早」分组；hover 出重命名/删除按钮 |
| 消息区 | 常驻 | 用户气泡（右）+ 助手气泡（左）+ tool 卡片（贴触发它的助手气泡下） |
| tool 卡片 | 有 `tool_call` 事件 | 折叠：工具名 · 简短参数 · 状态图标；展开：完整 args + result JSON |
| 权限确认弹框 | 写类工具首次调用 | 工具名 + args 预览 + 三按钮：仅本次 / 本会话总是 / 拒绝 |
| 设置抽屉 | 点击左下 ⚙ | 模型下拉 + API key + 「测试连通性」 + 主题 + 工作区目录 + 搜索 provider/key |
| 首次启动引导 | `api_key_enc` 为空 | **强制推设置抽屉**，填完才能开聊 |

### 7.3 · 交互约定

- **快捷键**：⌘N 新会话、⌘⏎ 发送、Esc 停止流式、⌘, 打开设置
- **skill badge**：手动 `/xxx` 才在用户气泡右上角显 badge；flash 自动分类结果不显
- **流式渲染**：直接 append，不做打字机 CSS 动画；tool pending 时用 spinner
- **停止按钮**：流式时右下角 ▷ 变 ⏹；点击后 abort；已产生 token 保留、消息 `partial=1`
- **首字节空白**：SkillEngine flash 分类 + pro 主调用**串行**，UI 先显 "..." skeleton，token 到达替换
- **主题**：system / light / dark 三档，Tailwind `dark:` + `prefers-color-scheme`

### 7.4 · 样式栈

- Tailwind CSS 4（Vite 官方支持）
- shadcn/ui 少量组件（Dialog / DropdownMenu / Tooltip / ScrollArea）
- 不做完整 shadcn 移植，保持轻量

## 8 · 错误处理

**核心原则**：
1. 模型能自愈的错误 → 转成 `tool_result` 反馈给模型（工具错、参数错、用户拒绝）
2. 模型无法自愈的错误 → 中止 + 用户可见错误 + 明确的下一步（网络、认证、超限）
3. 数据完整性优先 → sqlite 错误绝不静默

| 错误类型 | 触发 | 处理 |
|---|---|---|
| 网络错误 | DeepSeek 超时/断网/5xx | AgentLoop 中止；UI 红 banner + 「重试」 |
| 认证错误 | 401（key 无效/余额不足） | toast + 「打开设置」按钮；不自动重试 |
| Rate limit | 429 | 指数退避 3 次（1s/2s/4s）后按网络错误处理；UI 显 "限流中 x/3" |
| 权限拒绝 | 用户点"拒绝" | 作为 `{ok:false, error:'user_denied'}` 送回模型；tool 卡片"已拒绝"红标 |
| 工具执行错误 | 文件不存在 / shell 非零退出 / API 报错 | 作为 `{ok:false, error:...}` 送回模型 |
| 参数校验失败 | 模型生成的 args 不满 JSON Schema | 不执行；作为 `{ok:false, error:'invalid_args'}` 送回模型 |
| Loop 超限 | 20 轮未终局 | 中止 + 错误 event；已产生内容保留在 DB；**不提供「继续」按钮**（用户新建会话继续） |
| IPC 异常 | main 抛错 | preload 层 try/catch 转 `{ok:false}`；renderer 弹 toast |
| sqlite 写失败 | 磁盘满 / DB 损坏 | 阻塞式对话框 + DB 路径 + 「导出到桌面」；不静默继续 |
| DeepSeek 流式中断 | SDK 抛错 / 用户 stop | 已收 token 保留、写 DB；助手消息 `partial=1` |

## 9 · 测试策略

**技术栈**：Vitest（单元/集成）+ Playwright（E2E，`_electron.launch`）

**三层金字塔**：

| 层 | 内容 | 覆盖目标 |
|---|---|---|
| **单元** | `ContextBuilder.build`、`SkillEngine.select`（斜杠解析）、`ToolManager.invoke`（校验 + 权限 gate）、`MemoryManager` CRUD | ~70% 逻辑覆盖 |
| **集成** | `AgentLoop.run` + 真 ContextBuilder/Memory/Tool + `FakeModelManager` 喂脚本 chunk 序列。覆盖：单轮无工具 / 一次工具 → 结果回喂 / 权限拒绝 / Loop 超限 / abort | 主要路径全覆盖 |
| **E2E** | Playwright + Electron 打包产物 + mock DeepSeek 端点。关键路径 3-5 条：首次启动引导 / 新建会话+发消息+流式 / 触发工具+权限允许 / 点停止 | 主要用户流 |

**约定**：
- 测试文件与源同目录（`Foo.ts` 旁边 `Foo.test.ts`）
- 不 mock sqlite：单测用 `:memory:` DB
- 不 mock Electron API：涉及 `safeStorage` / `app.getPath` 的模块用薄封装 + 依赖注入
- 不引 mock 库：手写 `FakeModelManager` / `FakeToolManager`

**v1 跳过**：视觉回归、性能基准、负载测试。

## 10 · v1 明确不做（Out of Scope）

- 长期记忆 / 向量检索 / RAG
- 多模型供应商（OpenAI/Anthropic/本地）—— 仅 DeepSeek
- Windows / Linux
- 用户自定义 Skill（Skill 定义写死代码里）
- 用户自定义 Tool / 插件市场
- MCP 协议对接
- 多会话搜索（⌘K）
- Loop 超限的「继续」按钮
- 会话导出/导入
- 云同步 / 多设备
- 视觉回归 / 性能基准 / 负载测试

## 11 · 打包与分发

- Electron Builder + `dmg` 打包
- 仅签名（不公证，v1 自用即可）
- 自动更新：v1 不做，手动下载新版覆盖
- 崩溃上报：v1 不做

## 12 · 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 进程模型 | Main + Renderer 双进程（方案 B） | 安全隔离 + Tool 天然 Node API + UI 不阻塞 |
| 模型 SDK | `openai` SDK 指向 DeepSeek | 兼容协议 + 后续切换成本低 |
| Bun 定位 | 仅开发期 runtime | Electron 打包后是 Node runtime，避免运行时兼容坑 |
| SQLite 驱动 | `better-sqlite3` | 同步 API + 社区最成熟 |
| API key 存储 | Electron `safeStorage` | 内置无 native binding；`keytar` 已 archived |
| 状态管理 | Zustand | 小、TS 友好、无样板 |
| 会话 UI | 多会话 + 侧边栏 | 类 Claude Desktop |
| 权限策略 | 分级（读自动、写弹框 + 本会话免确认） | 平衡安全与体验 |
| Skill 路由 | 斜杠指令优先 + flash 分类兜底 | 用户可控 + 内部智能 |
| MAX_TURNS | 20 | 平衡自由度与失控风险 |
| tool_call args | 完整才显示 | 避免流式 JSON 抖动 |
| 中断标记 | `messages.partial` 列 | 未来复原/统计能用上 |

## 13 · 复审前待确认

以下 3 项在 brainstorming 阶段未展开，写 spec 时点亮，等 Eugene 复审拍板后落到 planning：

### 13.1 · Bun 在 v1 的具体角色

「仅开发期 runtime」需要落到具体：

- (a) **只作为 package manager**：用 `bun install` 替代 npm/pnpm，锁 `bun.lockb`；Vite / Vitest / scripts 都还走 node
- (b) **package manager + script runner**：`bun run dev`、`bun run test` 走 bun，Vite 的 dev server 也由 bun 起
- (c) **package manager + script runner + Vite 的 TS transform 都用 bun**：最大程度替代 node，只在打包 Electron 时切回 node

推荐 **(b)**：`bun install` 比 npm 快 10x+，`bun run` 比 node 快启动；但 Vite 有独立 esbuild/rollup 流水线，不动更稳。

### 13.2 · `workspace_dir` 首次启动是否必填

三种方案：
- (a) **必填**：首次引导抽屉里 API key 和 workspace_dir 都要填才能开聊；简单可预测
- (b) **可选，工具触发时懒选**：不填也能开聊；模型第一次调用 file 类工具时，UI 弹目录选择器让用户当场选，选完后写入 settings，后续用户还能改
- (c) **默认给个安全值**：默认 `~/Documents/EugentWorkspace`（不存在则自动创建）；用户随时能在设置里改

推荐 **(b)**：起手最轻，也不牺牲安全（用户能看到"AI 想访问哪个目录"的时刻）；(c) 会导致大量新用户根本不知道有 workspace 这回事，工具行为会诡异。

### 13.3 · deno 沙箱如何交付

`code_exec` tool 用 `deno run --allow-none` 跑 JS/Python（deno 自带 pyodide-ish 能力有限，Python 可能要退化）。deno 是独立二进制约 100MB。两种交付：

- (a) **随 app 打包**：Electron Builder 里把 deno macOS 二进制放到 `extraResources`，打包体积 +100MB，但即装即用
- (b) **用户预装**：首次调用 `code_exec` 检查 `which deno`，缺失就在 UI 上给一键"用 brew 安装"引导；app 本身轻
- (c) **v1 暂不做 Python**：`code_exec` 只支持 JS，用 `vm.runInNewContext`（Node 内置），无需外部二进制；v2 再补 Python

推荐 **(c)**：v1 用作者自用，纯 JS 已经能解绝大多数"跑个片段验证"场景；避免打包 100MB 或引一次外部安装流程。
