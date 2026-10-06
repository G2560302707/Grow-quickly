/**
 * /api/focus 专注（番茄钟/模考掐表）接口集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    mockPrismaFocusSession: {
        create: vi.fn(),
        findMany: vi.fn(),
    },
    mockSession: {
        user: { id: 'user-123', email: 'user@example.com', name: 'User' },
        expires: '2025-12-31',
    },
}));

vi.mock('@grow/shared/prisma', () => ({
    prisma: {
        focusSession: mocks.mockPrismaFocusSession,
    },
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

import { POST as SESSIONS_POST, GET as SESSIONS_GET } from '@/app/api/focus/sessions/route';
import { GET as STATS_GET } from '@/app/api/focus/stats/route';
import { getServerSession } from 'next-auth';

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/focus/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('/api/focus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
    });

    describe('POST /api/focus/sessions', () => {
        it('应成功记录一次完成的专注', async () => {
            mocks.mockPrismaFocusSession.create.mockResolvedValue({ id: 'focus-1' });

            const response = await SESSIONS_POST(
                makeRequest({ mode: 'pomodoro', moduleName: '言语理解', targetSeconds: 1500, durationSeconds: 1500, completed: true })
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe('focus-1');
            expect(mocks.mockPrismaFocusSession.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-123',
                    mode: 'pomodoro',
                    moduleName: '言语理解',
                    completed: true,
                }),
            });
        });

        it('应拒绝无效模式', async () => {
            const response = await SESSIONS_POST(makeRequest({ mode: 'hack', targetSeconds: 1500, durationSeconds: 100 }));
            expect(response.status).toBe(400);
        });

        it('应拒绝超上限的时长', async () => {
            const response = await SESSIONS_POST(
                makeRequest({ mode: 'pomodoro', targetSeconds: 99_999_999, durationSeconds: 100 })
            );
            expect(response.status).toBe(400);
        });

        it('专注不足 60 秒视为误触不入库', async () => {
            const response = await SESSIONS_POST(
                makeRequest({ mode: 'pomodoro', targetSeconds: 1500, durationSeconds: 30, completed: false })
            );
            const data = await response.json();
            expect(response.status).toBe(200);
            expect(data.skipped).toBe(true);
            expect(mocks.mockPrismaFocusSession.create).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/focus/stats', () => {
        it('应聚合今日/近 7 天/连续打卡', async () => {
            const now = new Date();
            const daysAgo = (n: number, hour = 12) => {
                const d = new Date(now);
                d.setDate(d.getDate() - n);
                d.setHours(hour, 0, 0, 0);
                return d;
            };
            mocks.mockPrismaFocusSession.findMany.mockResolvedValue([
                // 今天两次
                { durationSeconds: 1500, createdAt: daysAgo(0, 9), completed: true },
                { durationSeconds: 1500, createdAt: daysAgo(0, 20), completed: true },
                // 昨天
                { durationSeconds: 1800, createdAt: daysAgo(1), completed: true },
                // 2 天前断档 → 连续 = 今天 + 昨天 = 2 天
                { durationSeconds: 600, createdAt: daysAgo(3), completed: true },
            ]);

            const response = await STATS_GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.todaySeconds).toBe(3000);
            expect(data.weekSeconds).toBe(5400);
            expect(data.totalSessions).toBe(4);
            expect(data.totalSeconds).toBe(5400);
            // 今天有记录 → 从今天回数：今天 1 天，昨天断档
            expect(data.streakDays).toBe(2);
            expect(data.last7Days).toHaveLength(7);
            expect(data.last7Days[6].seconds).toBe(3000);
        });

        it('无任何记录时全为零且连续打卡为 0', async () => {
            mocks.mockPrismaFocusSession.findMany.mockResolvedValue([]);
            const response = await STATS_GET();
            const data = await response.json();
            expect(data.todaySeconds).toBe(0);
            expect(data.streakDays).toBe(0);
            expect(data.totalSessions).toBe(0);
        });
    });
});
