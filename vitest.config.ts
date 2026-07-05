import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.test.ts', '**/*.config.ts', 'packages/renderer/**'],
    },
  },
  resolve: { alias: { '@eugent/shared': resolve('packages/shared/src/index.ts') } },
});
