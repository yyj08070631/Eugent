import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, closeApp } from './helpers.js';
import { startFakeDeepSeekWithTool } from './fake-deepseek.js';

// grill 第 B2 项：完整 tool-approval E2E 脚本
test('触发文件类工具 → 结果回传 → 助手完成回复', async () => {
  const fake = await startFakeDeepSeekWithTool();
  process.env.EUGENT_FAKE_ENDPOINT = fake.url;
  const { app, page } = await launchApp();

  // 走完首次启动引导
  await page.getByPlaceholder('sk-...').fill('sk-fake');
  await page.getByRole('button', { name: '保存' }).click();
  await page.keyboard.press('Escape');

  // 预设 workspace_dir，跳过 pick_workspace 交互（走 dialog.showOpenDialog 是 GUI 交互，
  // E2E 里直接注入 settings 更简单可靠）
  const ws = mkdtempSync(join(tmpdir(), 'eugent-e2e-ws-'));
  await page.evaluate((dir) => window.eugent.settings.set({ workspaceDir: dir }), ws);

  await page.getByRole('button', { name: /新会话/ }).click();
  await page.getByPlaceholder(/说点什么/).fill('列一下当前目录');
  await page.keyboard.press('Meta+Enter');

  // file_list 是 read 类工具，自动放行（无权限弹框）
  // 期望看到工具卡片
  await expect(page.getByText('file_list')).toBeVisible({ timeout: 15_000 });

  // 期望看到助手最终回复
  await expect(page.getByText('已列出目录内容。')).toBeVisible({ timeout: 15_000 });

  await closeApp(app);
  await fake.close();
  delete process.env.EUGENT_FAKE_ENDPOINT;
});
