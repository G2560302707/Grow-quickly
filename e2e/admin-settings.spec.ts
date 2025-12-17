import { test, expect } from '@playwright/test';

test('Admin can configure OpenAI settings', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@localhost');
    await page.locator('input[name="password"]').fill('123456');
    await page.locator('button[type="submit"]').click();

    // Wait for login to complete
    await page.waitForURL('**/', { timeout: 15000 });

    // 2. Open Settings
    await page.getByRole('button', { name: '设置' }).click();

    // 3. Switch to AI Tab
    await page.getByRole('tab', { name: 'AI 提供商' }).click();

    // 4. Select OpenAI Provider
    // Use a locator that finds the select trigger near the AI Provider label if possible,
    // or just the first combobox in the tab content.
    // Since we just switched tabs, the combobox for provider is likely the first one.
    const providerTrigger = page.locator('[role="dialog"] button[role="combobox"]');
    await providerTrigger.click();

    // Select OpenAI option
    await page.getByRole('option', { name: 'OpenAI / Compatible' }).click();

    // 5. Enter Credentials
    const apiKey = 'sk-aaa';
    const baseURL = 'https://new.xxx.net/v1';
    const modelName = 'claude-haiku-4.5';

    // API Key Input associated by placeholder
    await page.locator('input[placeholder="sk-..."]').fill(apiKey);

    // Base URL Input associated by placeholder
    await page.locator('input[placeholder="https://api.openai.com/v1"]').fill(baseURL);

    // Model Name Input
    // Since we haven't fetched models, the custom input should be visible.
    // Placeholder for OpenAI custom model input is "gpt-4o"
    await page.locator('input[placeholder="gpt-4o"]').fill(modelName);

    // 6. Save Settings
    // Use page.once to handle the dialog immediately when it appears, preventing deadlock
    page.once('dialog', async dialog => {
        console.log(`Dialog message: ${dialog.message()}`);
        expect(dialog.message()).toContain('设置已保存');
        await dialog.accept();
    });

    await page.getByRole('button', { name: '保存 AI 设置' }).click();

    // 7. Verify Persistence
    // Reload the page to ensure data was saved to backend and can be retrieved
    await page.reload();

    // Open Settings again
    await page.getByRole('button', { name: '设置' }).click();

    // Switch to AI Tab
    await page.getByRole('tab', { name: 'AI 提供商' }).click();

    // Verify values match
    await expect(page.locator('button[role="combobox"]')).toHaveText('OpenAI / Compatible');
    await expect(page.locator('input[placeholder="sk-..."]')).toHaveValue(apiKey);
    await expect(page.locator('input[placeholder="https://api.openai.com/v1"]')).toHaveValue(baseURL);
    await expect(page.locator('input[placeholder="gpt-4o"]')).toHaveValue(modelName);
});
