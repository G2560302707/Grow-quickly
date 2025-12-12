/**
 * /api/settings API 集成测试
 * 测试应用配置获取和更新接口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are initialized before module imports
const mocks = vi.hoisted(() => ({
    mockGetAppConfig: vi.fn(() => ({
        aiProvider: 'gemini',
        allowRegistration: true,
        openai: {
            apiKey: 'sk-test-key',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
        },
        gemini: {
            apiKey: 'AIza-test-key',
            baseUrl: '',
            model: 'gemini-2.5-flash',
        },
        prompts: {
            analyze: '',
            similar: '',
        },
    })),
    mockUpdateAppConfig: vi.fn((config: any) => ({
        ...config,
        aiProvider: config.aiProvider || 'gemini',
    })),
}));

// Mock config module
vi.mock('@/lib/config', () => ({
    getAppConfig: mocks.mockGetAppConfig,
    updateAppConfig: mocks.mockUpdateAppConfig,
}));

// Import after mocks
import { GET, POST } from '@/app/api/settings/route';

describe('/api/settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/settings', () => {
        it('应该返回完整的应用配置', async () => {
            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.aiProvider).toBe('gemini');
            expect(data.openai).toBeDefined();
            expect(data.gemini).toBeDefined();
            expect(data.prompts).toBeDefined();
        });

        it('应该返回 AI 提供商设置', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.openai.apiKey).toBe('sk-test-key');
            expect(data.gemini.apiKey).toBe('AIza-test-key');
            expect(data.gemini.model).toBe('gemini-2.5-flash');
        });

        it('应该返回注册开关状态', async () => {
            const response = await GET();
            const data = await response.json();

            expect(data.allowRegistration).toBe(true);
        });
    });

    describe('POST /api/settings', () => {
        it('应该成功更新 AI 提供商', async () => {
            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ aiProvider: 'openai' }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(mocks.mockUpdateAppConfig).toHaveBeenCalledWith(
                expect.objectContaining({ aiProvider: 'openai' })
            );
        });

        it('应该成功更新 OpenAI 配置', async () => {
            const newConfig = {
                openai: {
                    apiKey: 'sk-new-key',
                    baseUrl: 'https://custom.api.com',
                    model: 'gpt-4-turbo',
                },
            };

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify(newConfig),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mocks.mockUpdateAppConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    openai: expect.objectContaining({
                        apiKey: 'sk-new-key',
                        model: 'gpt-4-turbo',
                    }),
                })
            );
        });

        it('应该成功更新 Gemini 配置', async () => {
            const newConfig = {
                gemini: {
                    apiKey: 'AIza-new-key',
                    model: 'gemini-3.0-flash',
                },
            };

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify(newConfig),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mocks.mockUpdateAppConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    gemini: expect.objectContaining({
                        apiKey: 'AIza-new-key',
                    }),
                })
            );
        });

        it('应该忽略掩码的 API Key（********）', async () => {
            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({
                    openai: { apiKey: '********' },
                    gemini: { apiKey: '********' },
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            // 验证更新时不包含掩码的 key
            const updateCall = mocks.mockUpdateAppConfig.mock.calls[0][0];
            expect(updateCall.openai?.apiKey).toBeUndefined();
            expect(updateCall.gemini?.apiKey).toBeUndefined();
        });

        it('应该成功更新自定义提示词', async () => {
            const newConfig = {
                prompts: {
                    analyze: '自定义分析提示词',
                    similar: '自定义类似题提示词',
                },
            };

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify(newConfig),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mocks.mockUpdateAppConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompts: expect.objectContaining({
                        analyze: '自定义分析提示词',
                    }),
                })
            );
        });

        it('应该成功更新注册开关', async () => {
            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ allowRegistration: false }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mocks.mockUpdateAppConfig).toHaveBeenCalledWith(
                expect.objectContaining({ allowRegistration: false })
            );
        });

        it('应该处理更新失败的情况', async () => {
            mocks.mockUpdateAppConfig.mockImplementationOnce(() => {
                throw new Error('Write failed');
            });

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ aiProvider: 'openai' }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to update settings');
        });
    });
});
