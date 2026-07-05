import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './helpers.js';
import { startFakeDeepSeek } from './fake-deepseek.js';

test('填 key、新建会话、发消息、看到流式 token', async () => {
  const fake = await startFakeDeepSeek();
  process.env.EUGENT_FAKE_ENDPOINT = fake.url;
  const { app, page } = await launchApp();

  await page.getByPlaceholder('sk-...').fill('sk-fake');
  await page.getByRole('button', { name: '保存' }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /新会话/ }).click();
  await page.getByPlaceholder(/说点什么/).fill('你好');
  await page.keyboard.press('Meta+Enter');

  await expect(page.getByText('你好，我在。')).toBeVisible({ timeout: 15_000 });

  await closeApp(app);
  await fake.close();
  delete process.env.EUGENT_FAKE_ENDPOINT;
});
