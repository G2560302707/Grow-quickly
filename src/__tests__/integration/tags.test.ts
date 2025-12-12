/**
 * /api/tags API 集成测试
 * 测试标签统计和标签建议接口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are initialized before module imports
const mocks = vi.hoisted(() => ({
    mockPrismaErrorItem: {
        findMany: vi.fn(),
    },
    mockGetAllStandardTags: vi.fn(() => [
        '一元一次方程',
        '二元一次方程',
        '函数',
        '三角形',
        '圆',
        '概率',
    ]),
}));

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
    prisma: {
        errorItem: mocks.mockPrismaErrorItem,
    },
}));

// Mock knowledge-tags
vi.mock('@/lib/knowledge-tags', () => ({
    getAllStandardTags: mocks.mockGetAllStandardTags,
}));

// Import after mocks
import { GET as GET_STATS } from '@/app/api/tags/stats/route';
import { GET as GET_SUGGESTIONS } from '@/app/api/tags/suggestions/route';

describe('/api/tags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/tags/stats (标签统计)', () => {
        it('应该返回标签使用频率统计', async () => {
            const errorItems = [
                { knowledgePoints: '["一元一次方程", "移项"]' },
                { knowledgePoints: '["一元一次方程", "函数"]' },
                { knowledgePoints: '["函数", "图像"]' },
            ];
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue(errorItems);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.stats).toBeDefined();
            expect(data.total).toBe(3);
            expect(data.uniqueTags).toBeGreaterThan(0);

            // 验证排序（按使用次数降序）
            const stats = data.stats;
            for (let i = 1; i < stats.length; i++) {
                expect(stats[i - 1].count).toBeGreaterThanOrEqual(stats[i].count);
            }
        });

        it('应该正确统计每个标签的使用次数', async () => {
            const errorItems = [
                { knowledgePoints: '["一元一次方程"]' },
                { knowledgePoints: '["一元一次方程"]' },
                { knowledgePoints: '["一元一次方程"]' },
                { knowledgePoints: '["函数"]' },
            ];
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue(errorItems);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);

            const equationStat = data.stats.find((s: any) => s.tag === '一元一次方程');
            expect(equationStat).toBeDefined();
            expect(equationStat.count).toBe(3);

            const functionStat = data.stats.find((s: any) => s.tag === '函数');
            expect(functionStat).toBeDefined();
            expect(functionStat.count).toBe(1);
        });

        it('应该处理空的错题列表', async () => {
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.stats).toEqual([]);
            expect(data.total).toBe(0);
            expect(data.uniqueTags).toBe(0);
        });

        it('应该处理无效的 JSON 知识点', async () => {
            const errorItems = [
                { knowledgePoints: 'invalid json{' },
                { knowledgePoints: '["有效标签"]' },
            ];
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue(errorItems);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            // 应该只统计有效的标签
            expect(data.stats.length).toBe(1);
            expect(data.stats[0].tag).toBe('有效标签');
        });

        it('应该处理空的知识点字段', async () => {
            const errorItems = [
                { knowledgePoints: null },
                { knowledgePoints: '' },
                { knowledgePoints: '["有效标签"]' },
            ];
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue(errorItems);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.total).toBe(3);
            expect(data.uniqueTags).toBe(1);
        });

        it('应该忽略非字符串的标签', async () => {
            const errorItems = [
                { knowledgePoints: '[123, null, "有效标签", true]' },
            ];
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue(errorItems);

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.stats.length).toBe(1);
            expect(data.stats[0].tag).toBe('有效标签');
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaErrorItem.findMany.mockRejectedValue(
                new Error('Database connection failed')
            );

            const request = new Request('http://localhost/api/tags/stats');
            const response = await GET_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to get tag statistics');
        });
    });

    describe('GET /api/tags/suggestions (标签建议)', () => {
        it('应该返回所有标签建议（无搜索词）', async () => {
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions).toBeDefined();
            expect(Array.isArray(data.suggestions)).toBe(true);
            expect(data.total).toBeGreaterThan(0);
        });

        it('应该根据搜索词过滤标签', async () => {
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions?q=方程');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            // 所有结果应该包含搜索词
            data.suggestions.forEach((tag: string) => {
                expect(tag.toLowerCase()).toContain('方程');
            });
        });

        it('应该支持大小写不敏感搜索', async () => {
            mocks.mockGetAllStandardTags.mockReturnValue(['Function', 'Array', 'Object']);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions?q=function');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions).toContain('Function');
        });

        it('应该合并标准标签和已使用标签', async () => {
            mocks.mockGetAllStandardTags.mockReturnValue(['标准标签1', '标准标签2']);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([
                { knowledgePoints: ['自定义标签1', '自定义标签2'] },
            ]);

            const request = new Request('http://localhost/api/tags/suggestions');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions).toContain('标准标签1');
            expect(data.suggestions).toContain('标准标签2');
            expect(data.suggestions).toContain('自定义标签1');
            expect(data.suggestions).toContain('自定义标签2');
        });

        it('应该去重标签', async () => {
            mocks.mockGetAllStandardTags.mockReturnValue(['重复标签', '唯一标签']);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([
                { knowledgePoints: ['重复标签'] },
            ]);

            const request = new Request('http://localhost/api/tags/suggestions');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            // 重复标签应该只出现一次
            const duplicateCount = data.suggestions.filter(
                (tag: string) => tag === '重复标签'
            ).length;
            expect(duplicateCount).toBe(1);
        });

        it('应该限制返回结果数量（最多 20 个）', async () => {
            // 创建超过 20 个标签
            const manyTags = Array.from({ length: 30 }, (_, i) => `标签${i + 1}`);
            mocks.mockGetAllStandardTags.mockReturnValue(manyTags);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions.length).toBeLessThanOrEqual(20);
        });

        it('应该处理空搜索词', async () => {
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions?q=');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            // 空搜索词应该返回所有标签
            expect(data.suggestions.length).toBeGreaterThan(0);
        });

        it('应该处理无匹配结果', async () => {
            mocks.mockGetAllStandardTags.mockReturnValue(['一元一次方程']);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions?q=不存在的标签xyz');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions).toEqual([]);
            expect(data.total).toBe(0);
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaErrorItem.findMany.mockRejectedValue(
                new Error('Database connection failed')
            );

            const request = new Request('http://localhost/api/tags/suggestions');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to get tag suggestions');
        });

        it('应该支持部分匹配', async () => {
            mocks.mockGetAllStandardTags.mockReturnValue([
                '一元一次方程',
                '二元一次方程',
                '一元二次方程',
                '函数',
            ]);
            mocks.mockPrismaErrorItem.findMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/tags/suggestions?q=一次');
            const response = await GET_SUGGESTIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.suggestions).toContain('一元一次方程');
            expect(data.suggestions).toContain('二元一次方程');
            expect(data.suggestions).not.toContain('函数');
        });
    });
});
