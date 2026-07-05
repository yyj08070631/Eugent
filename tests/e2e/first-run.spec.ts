import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './helpers.js';

test('首次启动强制展示设置抽屉，填 key 后关闭', async () => {
  const { app, page } = await launchApp();

  await expect(page.getByText('设置', { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('DeepSeek API Key')).toBeVisible();

  // 无 key 时点击遮罩不能关闭
  await page.keyboard.press('Escape');
  await expect(page.getByText('DeepSeek API Key')).toBeVisible();

  await page.getByPlaceholder('sk-...').fill('sk-fake-e2e');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('已保存')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByText('DeepSeek API Key')).not.toBeVisible({ timeout: 5_000 });

  await closeApp(app);
});
