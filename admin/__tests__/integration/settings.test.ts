/**
 * /api/settings API 集成测试
 * 测试应用配置获取和更新接口（含鉴权与 API Key 掩码）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are initialized before module imports
const mocks = vi.hoisted(() => ({
    mockSession: {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
        },
        expires: '2025-12-31',
    },
    mockGetAppConfig: vi.fn(() => ({
        aiProvider: 'gemini',
        allowRegistration: true,
        openai: {
            instances: [{
                id: 'test-instance',
                name: 'Test',
                apiKey: 'sk-test-key',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-4o',
            }],
            activeInstanceId: 'test-instance',
        },
        gemini: {
            apiKey: 'AIza-test-key',
            baseUrl: '',
            model: 'gemini-2.5-flash',
        },
        azure: {
            apiKey: 'azure-test-key',
            endpoint: 'https://test.openai.azure.com',
            deploymentName: 'gpt-4o',
        },
        prompts: {
            analyze: '',
            similar: '',
        },
        timeouts: {
            analyze: 180000,
        },
    })),
    mockUpdateAppConfig: vi.fn((config: any) => ({
        ...config,
        aiProvider: config.aiProvider || 'gemini',
    })),
}));

// Mock config module
vi.mock('@grow/shared/config', () => ({
    getAppConfig: mocks.mockGetAppConfig,
    updateAppConfig: mocks.mockUpdateAppConfig,
}));

// Mock next-auth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Import after mocks
import { GET, POST } from '@/app/api/settings/route';
import { getServerSession } from 'next-auth';

describe('/api/settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
    });

    describe('鉴权', () => {
        it('未登录 GET 应返回 401', async () => {
            vi.mocked(getServerSession).mockResolvedValueOnce(null as any);

            const response = await GET();
            expect(response.status).toBe(401);
        });

        it('未登录 POST 应返回 401', async () => {
            vi.mocked(getServerSession).mockResolvedValueOnce(null as any);

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ aiProvider: 'openai' }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            expect(response.status).toBe(401);
            expect(mocks.mockUpdateAppConfig).not.toHaveBeenCalled();
        });

        it('非管理员 POST 应返回 403', async () => {
            vi.mocked(getServerSession).mockResolvedValueOnce({
                user: { id: 'user-123', email: 'user@example.com', name: 'User', role: 'user' },
                expires: '2025-12-31',
            } as any);

            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({ aiProvider: 'openai' }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            expect(response.status).toBe(403);
            expect(mocks.mockUpdateAppConfig).not.toHaveBeenCalled();
        });
    });

    describe('API Key 掩码', () => {
        it('管理员 GET 应返回完整配置（含明文 API Key）', async () => {
            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.openai.instances[0].apiKey).toBe('sk-test-key');
            expect(data.gemini.apiKey).toBe('AIza-test-key');
            expect(data.azure.apiKey).toBe('azure-test-key');
        });

        it('非管理员 GET 应返回掩码后的 API Key', async () => {
            vi.mocked(getServerSession).mockResolvedValueOnce({
                user: { id: 'user-123', email: 'user@example.com', name: 'User', role: 'user' },
                expires: '2025-12-31',
            } as any);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.openai.instances[0].apiKey).toBe('********');
            expect(data.gemini.apiKey).toBe('********');
            expect(data.azure.apiKey).toBe('********');
            // 非敏感字段不受影响
            expect(data.aiProvider).toBe('gemini');
            expect(data.timeouts.analyze).toBe(180000);
        });

        it('非管理员 GET 不应泄漏空值 Key 以外的信息', async () => {
            mocks.mockGetAppConfig.mockImplementationOnce(() => ({
                aiProvider: 'gemini',
                gemini: { apiKey: '', baseUrl: '', model: 'gemini-2.5-flash' },
                azure: { apiKey: '', endpoint: '', deploymentName: '' },
            } as any));

            vi.mocked(getServerSession).mockResolvedValueOnce({
                user: { id: 'user-123', email: 'user@example.com', name: 'User', role: 'user' },
                expires: '2025-12-31',
            } as any);

            const response = await GET();
            const data = await response.json();

            expect(data.gemini.apiKey).toBe('');
            expect(data.openai.instances).toEqual([]);
        });
    });

    describe('GET /api/settings（管理员）', () => {
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

            expect(data.openai.instances[0].apiKey).toBe('sk-test-key');
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
                    instances: [{
                        id: 'new-instance',
                        name: 'New Instance',
                        apiKey: 'sk-new-key',
                        baseUrl: 'https://custom.api.com',
                        model: 'gpt-4-turbo',
                    }],
                    activeInstanceId: 'new-instance',
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
                        instances: expect.arrayContaining([
                            expect.objectContaining({
                                apiKey: 'sk-new-key',
                                model: 'gpt-4-turbo',
                            }),
                        ]),
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

        it('应该保留掩码 API Key（********）的原有值', async () => {
            const request = new Request('http://localhost/api/settings', {
                method: 'POST',
                body: JSON.stringify({
                    openai: {
                        instances: [{
                            id: 'test-instance', // 使用 mock 中已存在的实例 ID
                            name: 'Masked',
                            apiKey: '********',
                            baseUrl: 'https://api.openai.com/v1',
                            model: 'gpt-4o',
                        }],
                    },
                    gemini: { apiKey: '********' },
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            // 验证更新时保留了原有的 key
            const updateCall = mocks.mockUpdateAppConfig.mock.calls[0][0];
            // OpenAI instances 应该保留，且 apiKey 应为原有值
            expect(updateCall.openai?.instances?.length).toBe(1);
            expect(updateCall.openai?.instances?.[0]?.apiKey).toBe('sk-test-key');
            expect(updateCall.gemini?.apiKey).toBe('AIza-test-key');
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
