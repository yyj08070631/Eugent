# Eugent · 开发环境注意事项

## Node ABI 与 better-sqlite3

系统 Node（v26+）和 Electron 32（内置 Node 22）用不同 ABI，`better-sqlite3` 编译后二进制只能匹配一边。

| 场景 | 用哪个 ABI | 怎么切换 |
|---|---|---|
| `pnpm dev` / `pnpm build:mac` | Electron ABI | `pnpm rebuild:electron` |
| `pnpm test` / vitest 单测 | 系统 Node ABI | `pnpm rebuild:node` |

**默认 `postinstall` 自动跑 `rebuild:electron`**——`pnpm install` 之后 dev 直接可用。
跑单测前手动 `pnpm rebuild:node` 一次即可。

## Electron postinstall 会静默失败

Electron 32.3.3 的 `install.js` 在这台机器上下载后 extract 不完整，`dist/` 只留一个 LICENSE 文件、`path.txt` 不生成，最终 electron-vite 报 `Error: Electron uninstall`。

修法：`.npmrc` 里已加 `electron_skip_binary_download=1`。zip 在 `~/Library/Caches/electron/` 里，用 `unzip` 直接解压到 `node_modules/electron/dist/`，然后写一行 `Electron.app/Contents/MacOS/Electron` 到 `path.txt`。

一键脚本（如需重装 electron 时）：

```bash
CACHE_ZIP=~/Library/Caches/electron/*/electron-v32.3.3-darwin-arm64.zip
cd node_modules/electron
rm -rf dist/*
unzip -q $CACHE_ZIP -d dist/
echo -n 'Electron.app/Contents/MacOS/Electron' > path.txt
```

## `node-linker=hoisted`

pnpm 严格模式下 `packages/main/node_modules/better-sqlite3` 无法被 `out/main/index.js` 里的 `require('better-sqlite3')` 解析（out/main 在 root 下，向上找 node_modules 找不到）。

`.npmrc` 里 `node-linker=hoisted` + `shamefully-hoist=true` 让所有依赖 hoist 到 root `node_modules/`，与 npm 布局一致。

## electron.vite.config.ts 里的 external

主进程里 `jsdom` 依赖可选 peer `canvas`、`openai` 的 `ws` 依赖 `bufferutil` / `utf-8-validate`。bundle 时 esbuild 找不到会报错。config 里显式 external：
- `canvas` (jsdom)
- `bufferutil` / `utf-8-validate` (ws)
- 所有 `packages/main/package.json` `dependencies`（读文件动态生成）

这样 main 输出从 7 MB → 37 KB。

## pnpm dev 到底 watch 什么

- **Renderer** (`packages/renderer/src/*.tsx`)：HMR，改动立即热更新，无需刷新
- **Preload** (`packages/preload/src/*.ts`)：rebuild + 重启 Electron（因为 preload 只在窗口创建时加载）
- **Main** (`packages/main/src/*.ts`)：rebuild + 重启 Electron 主进程

**不需要手动 build**——electron-vite dev 会 watch 三层同时响应。
