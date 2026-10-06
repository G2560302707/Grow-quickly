import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {

    test('Registration and fallback Login', async ({ page }) => {
        // 增加测试超时时间
        test.setTimeout(60000);

        const user = {
            name: 'jason',
            email: 'jason@qq.com',
            password: '123456',
            stage: 'junior_high',
            year: '2024' // 使用当前年份确保有效
        };

        // --- Try Registration ---
        await page.goto('/register');

        // Wait for page to be ready (bypassing loading state)
        // "注册" or "Create an Account"
        await expect(page.locator('body')).toContainText(/注册|Register/, { timeout: 15000 });

        // Selectors by NAME (Robust now)
        await page.locator('input[name="name"]').fill(user.name);
        await page.locator('input[name="email"]').fill(user.email);
        await page.locator('input[name="password"]').fill(user.password);
        await page.locator('input[name="confirmPassword"]').fill(user.password);

        // Education Stage
        await page.locator('select[name="educationStage"]').selectOption(user.stage);

        // Enrollment Year
        await page.locator('input[name="enrollmentYear"]').fill(user.year);

        // Submit
        await page.locator('button[type="submit"]').click();

        // --- Handle Result ---
        try {
            // Error: "该邮箱已被注册"
            const errorLocator = page.locator('.text-red-500');

            // Race: Error text OR redirect to login
            await Promise.race([
                expect(errorLocator).toBeVisible({ timeout: 5000 }),
                page.waitForURL('**/login', { timeout: 5000 })
            ]);

            if (await errorLocator.isVisible()) {
                console.log('Registration error visible, going to login.');
                await page.goto('/login');
            }
        } catch (e) {
            if (page.url().includes('/login')) {
                console.log('Redirected to login page automatically.');
            } else {
                console.log('State unclear, forcing login.');
                await page.goto('/login');
            }
        }

        // --- Login Flow ---
        // Ensure we are on login page
        await page.waitForURL('**/login');

        await page.locator('input[name="email"]').fill(user.email);
        await page.locator('input[name="password"]').fill(user.password);

        await page.locator('button[type="submit"]').click();

        // --- Verify Success ---
        // Wait for redirect to home
        await page.waitForURL('/', { timeout: 10000 });

        // Verify Content
        await expect(page.locator('body')).toContainText(user.name);

        // --- Logout User ---
        await page.locator('button[title*="Logout"], button[title*="退出"]').click();
        await page.waitForURL('**/login');

        // --- Login as Admin ---
        await page.locator('input[name="email"]').fill('admin@localhost');
        await page.locator('input[name="password"]').fill('123456');
        await page.locator('button[type="submit"]').click();

        // Verify Admin Login and Home Page
        await page.waitForURL('**/');

    });

    // 2026-10 管理后台拆分：用户管理整体迁至管理端应用（admin/，:3001），
    // 学习端设置弹窗已无「用户管理」tab，原用例在此必然超时。
    // 待管理端用例补齐后恢复；跳过期间注册产生的 jason@qq.com 会留在库中，
    // 上方注册用例对「邮箱已被注册」做了兼容（回退登录），幂等不受影响。
    test.fixme('Admin deletes registered user', async ({ page }) => {
        // 需改为先访问管理端登录页（http://127.0.0.1:3001/login）登录 admin，
        // 再进入管理端用户管理删除 jason@qq.com。原步骤留作参考：
        const user = { email: 'jason@qq.com' };

        // --- Go to Settings > User Management ---
        // Open Settings (Button with gear icon, sr-only text "Settings" or "设置")
        await page.getByRole('button').filter({ has: page.locator('svg.lucide-settings') }).click();

        // Wait for Dialog
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

        // Click "User Management" / "用户管理" Tab
        await page.getByRole('tab', { name: /User Management|用户管理/ }).click();

        // 等待用户列表加载
        await page.waitForTimeout(1000);

        // --- Delete User 'jason' ---
        // Find row with 'jason@qq.com'
        const userRow = page.locator('tr').filter({ hasText: user.email });

        // 使用更长的超时时间等待用户行出现
        await expect(userRow).toBeVisible({ timeout: 10000 });

        // Click Delete button in that row (Trash icon)
        // The button has title "Delete" or "删除"
        await userRow.getByRole('button', { name: /Delete|删除/ }).click();

        // 改版后删除确认走应用内 confirmDialog（Radix Dialog）而非原生 confirm，
        // 点击弹出对话框中的确认按钮（外层设置对话框仍开启，取最后渲染的一层）
        await page.getByRole('dialog').last().getByRole('button', { name: /确认|确定|OK|Confirm/ }).click();

        // Verify user is gone
        await expect(page.locator('tr').filter({ hasText: user.email })).not.toBeVisible({ timeout: 5000 });

        // --- Logout Admin ---
        // Close dialog first
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).not.toBeVisible();

        // Click Logout
        await page.locator('button[title*="Logout"], button[title*="退出"]').click();
        await page.waitForURL('**/login');

    });
});
