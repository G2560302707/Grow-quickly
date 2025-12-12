/**
 * /api/stats API 集成测试
 * 测试练习统计和数据清除接口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are initialized before module imports
const mocks = vi.hoisted(() => ({
    mockPrismaPracticeRecord: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
    },
    mockPrismaErrorItem: {
        deleteMany: vi.fn(),
    },
    mockSession: {
        user: {
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
        },
        expires: '2025-12-31',
    },
}));

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
    prisma: {
        practiceRecord: mocks.mockPrismaPracticeRecord,
        errorItem: mocks.mockPrismaErrorItem,
    },
}));

// Mock next-auth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Import after mocks
import { GET as GET_PRACTICE_STATS } from '@/app/api/stats/practice/route';
import { DELETE as DELETE_PRACTICE_STATS } from '@/app/api/stats/practice/clear/route';
import { DELETE as DELETE_ERROR_ITEMS } from '@/app/api/error-items/clear/route';
import { getServerSession } from 'next-auth';

describe('/api/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
    });

    describe('GET /api/stats/practice (获取练习统计)', () => {
        it('应该返回练习统计数据', async () => {
            // Mock subject stats
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValueOnce([
                { subject: '数学', _count: { id: 10 } },
                { subject: '英语', _count: { id: 5 } },
            ]);

            // Mock activity stats
            mocks.mockPrismaPracticeRecord.findMany.mockResolvedValue([
                { createdAt: new Date(), isCorrect: true, difficulty: 'medium' },
                { createdAt: new Date(), isCorrect: false, difficulty: 'hard' },
            ]);

            // Mock difficulty stats
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValueOnce([
                { difficulty: 'easy', _count: { id: 3 } },
                { difficulty: 'medium', _count: { id: 7 } },
                { difficulty: 'hard', _count: { id: 5 } },
            ]);

            // Mock total and correct counts
            mocks.mockPrismaPracticeRecord.count
                .mockResolvedValueOnce(15)
                .mockResolvedValueOnce(10);

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subjectStats).toBeDefined();
            expect(data.activityStats).toBeDefined();
            expect(data.difficultyStats).toBeDefined();
            expect(data.overallStats).toBeDefined();
        });

        it('应该返回正确的学科分布', async () => {
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValueOnce([
                { subject: '数学', _count: { id: 20 } },
            ]);
            mocks.mockPrismaPracticeRecord.findMany.mockResolvedValue([]);
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValueOnce([]);
            mocks.mockPrismaPracticeRecord.count.mockResolvedValue(0);

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subjectStats[0].name).toBe('数学');
            expect(data.subjectStats[0].value).toBe(20);
        });

        it('应该返回正确的正确率', async () => {
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValue([]);
            mocks.mockPrismaPracticeRecord.findMany.mockResolvedValue([]);
            mocks.mockPrismaPracticeRecord.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(75);  // correct

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.overallStats.total).toBe(100);
            expect(data.overallStats.correct).toBe(75);
            expect(data.overallStats.rate).toBe('75.0');
        });

        it('应该处理零记录情况', async () => {
            mocks.mockPrismaPracticeRecord.groupBy.mockResolvedValue([]);
            mocks.mockPrismaPracticeRecord.findMany.mockResolvedValue([]);
            mocks.mockPrismaPracticeRecord.count.mockResolvedValue(0);

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.overallStats.total).toBe(0);
            expect(data.overallStats.rate).toBe(0);
        });

        it('应该拒绝未登录用户', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该拒绝 session 中没有 user 的请求', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                user: undefined,
                expires: '2025-12-31',
            } as any);

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaPracticeRecord.groupBy.mockRejectedValue(
                new Error('Database connection failed')
            );

            const request = new Request('http://localhost/api/stats/practice');
            const response = await GET_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to fetch stats');
        });
    });

    describe('DELETE /api/stats/practice/clear (清除练习记录)', () => {
        it('应该成功清除练习记录', async () => {
            mocks.mockPrismaPracticeRecord.deleteMany.mockResolvedValue({ count: 50 });

            const request = new Request('http://localhost/api/stats/practice/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe('Practice history cleared successfully');
            expect(data.count).toBe(50);
        });

        it('应该返回清除的记录数量', async () => {
            mocks.mockPrismaPracticeRecord.deleteMany.mockResolvedValue({ count: 100 });

            const request = new Request('http://localhost/api/stats/practice/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.count).toBe(100);
        });

        it('应该处理没有记录的情况', async () => {
            mocks.mockPrismaPracticeRecord.deleteMany.mockResolvedValue({ count: 0 });

            const request = new Request('http://localhost/api/stats/practice/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.count).toBe(0);
        });

        it('应该拒绝未登录用户', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const request = new Request('http://localhost/api/stats/practice/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaPracticeRecord.deleteMany.mockRejectedValue(
                new Error('Database error')
            );

            const request = new Request('http://localhost/api/stats/practice/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_PRACTICE_STATS(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to clear stats');
        });
    });

    describe('DELETE /api/error-items/clear (清除所有错题)', () => {
        it('应该成功清除所有错题', async () => {
            mocks.mockPrismaErrorItem.deleteMany.mockResolvedValue({ count: 30 });

            const request = new Request('http://localhost/api/error-items/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_ERROR_ITEMS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe('Error data cleared successfully');
        });

        it('应该只清除当前用户的错题', async () => {
            mocks.mockPrismaErrorItem.deleteMany.mockResolvedValue({ count: 10 });

            const request = new Request('http://localhost/api/error-items/clear', {
                method: 'DELETE',
            });

            await DELETE_ERROR_ITEMS(request);

            expect(mocks.mockPrismaErrorItem.deleteMany).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
            });
        });

        it('应该拒绝未登录用户', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const request = new Request('http://localhost/api/error-items/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_ERROR_ITEMS(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该拒绝 session 中没有 user 的请求', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                user: undefined,
                expires: '2025-12-31',
            } as any);

            const request = new Request('http://localhost/api/error-items/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_ERROR_ITEMS(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaErrorItem.deleteMany.mockRejectedValue(
                new Error('Database error')
            );

            const request = new Request('http://localhost/api/error-items/clear', {
                method: 'DELETE',
            });

            const response = await DELETE_ERROR_ITEMS(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to clear error data');
        });
    });
});
