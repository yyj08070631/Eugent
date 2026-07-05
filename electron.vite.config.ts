import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// 读 packages/main/package.json 的 dependencies，全部外部化（不 bundle 进 out/main/index.js）
// 原因：native 模块（better-sqlite3）+ 带可选 peer 的模块（jsdom/canvas, ws/bufferutil）
// 若被 bundle 会因缺 optional peer 而启动失败。
const mainDeps = Object.keys(
  (JSON.parse(readFileSync(resolve('packages/main/package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  }).dependencies ?? {},
).filter((d) => d !== '@eugent/shared'); // shared 是 workspace，通过 alias inlined

const OPTIONAL_PEERS = ['canvas', 'bufferutil', 'utf-8-validate']; // jsdom / ws 的可选 peer

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('packages/main/src/index.ts'),
        external: [...mainDeps, ...OPTIONAL_PEERS],
      },
      outDir: 'out/main',
    },
    resolve: { alias: { '@eugent/shared': resolve('packages/shared/src/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: resolve('packages/preload/src/index.ts') },
      outDir: 'out/preload',
    },
    resolve: { alias: { '@eugent/shared': resolve('packages/shared/src/index.ts') } },
  },
  renderer: {
    root: resolve('packages/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: { input: resolve('packages/renderer/index.html') },
      outDir: 'out/renderer',
    },
    resolve: { alias: { '@eugent/shared': resolve('packages/shared/src/index.ts') } },
  },
});
