import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: resolve('packages/main/src/index.ts') },
      outDir: 'out/main',
    },
    resolve: { alias: { '@eugent/shared': resolve('packages/shared/src/index.ts') } },
  },
  preload: {
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
