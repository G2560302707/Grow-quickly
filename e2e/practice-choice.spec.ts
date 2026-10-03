import { test, expect } from '@playwright/test';

// 选择题按钮作答回归：mock 掉出题与记录接口，验证选项按钮渲染、
// 自动判分（错选标红 + 正确项标绿）以及「下一题」继续出题的完整闭环。
const MOCK_QUESTION = {
    questionText: [
        '以下哪项最能削弱上述论证？',
        '某研究表明常喝咖啡的人心脏更好。',
        'A. 咖啡有益健康',
        'B. 研究样本存在偏差',
        'C. 咖啡价格上涨',
        'D. 很多人不喝咖啡',
    ].join('\n'),
    answerText: 'B',
    analysis: '**考点**：削弱论证。\n样本偏差是经典削弱方式。',
    subject: '判断推理',
    knowledgePoints: ['削弱论证'],
    meta: {
        tagId: 'e2e-tag',
        tagName: '削弱论证',
        primaryErrorItemId: null,
        difficulty: 'medium',
        source: 'ai_generated',
    },
};

test('选择题以按钮作答并自动判分', async ({ page }) => {
    await page.route('**/api/practice/smart', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUESTION) })
    );
    await page.route('**/api/practice/record', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    // 登录
    await page.goto('/login');
    await page.getByLabel(/邮箱|Email/).fill('admin@localhost');
    await page.getByLabel(/^密码$|^Password$/).fill('123456');
    await page.getByRole('button', { name: /登录|Login/ }).click();
    await page.waitForURL('**/', { timeout: 15000 });

    await page.goto('/practice/smart?tagId=e2e-tag');

    // 题干剥离选项行后展示，选项渲染为 4 个可点按钮
    await expect(page.getByText('研究样本存在偏差')).toBeVisible();
    const options = page.getByRole('radio');
    await expect(options).toHaveCount(4);
    await expect(page.getByText('以下哪项最能削弱上述论证？')).toBeVisible();
    // 提交按钮在未选择时禁用
    await expect(page.getByRole('button', { name: /提交并查看答案/ })).toBeDisabled();

    // 错选 C：判分错误，正确项 B 标绿、所选项 C 标红，解析可见
    await options.nth(2).click();
    await page.getByRole('button', { name: /提交并查看答案/ }).click();
    await expect(page.getByText(/回答有误/)).toBeVisible();
    await expect(options.nth(1)).toHaveClass(/border-green-600/);
    await expect(options.nth(2)).toHaveClass(/border-red-600/);
    await expect(page.getByText('样本偏差是经典削弱方式')).toBeVisible();

    // 下一题（mock 再次返回同一题），选项恢复可选
    await page.getByRole('button', { name: /下一题/ }).click();
    await expect(page.getByRole('radio')).toHaveCount(4);

    // 选正确答案 B：回答正确
    await page.getByRole('radio').nth(1).click();
    await page.getByRole('button', { name: /提交并查看答案/ }).click();
    await expect(page.getByText(/回答正确/)).toBeVisible();
});
