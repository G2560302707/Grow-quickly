/**
 * /api/practice/questions 集成测试
 * 练习题库（生成即入库）：列表筛选、单题详情、生命周期操作（弃题/恢复）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetRateLimits } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({
    mockPrismaPracticeQuestion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
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

vi.mock('@/lib/prisma', () => ({
    prisma: {
        practiceQuestion: mocks.mockPrismaPracticeQuestion,
    },
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

import { GET as QUESTIONS_GET } from '@/app/api/practice/questions/route';
import { GET as QUESTION_GET, PATCH as QUESTION_PATCH } from '@/app/api/practice/questions/[id]/route';
import { getServerSession } from 'next-auth';

const ownedQuestion = {
    id: 'pq-1',
    userId: 'user-123',
    channel: 'smart',
    difficulty: 'medium',
    subject: '常识判断',
    tagId: 'tag-1',
    errorItemId: null,
    questionText: '题目内容',
    answerText: '答案',
    analysis: '解析',
    eloRating: 1200,
    status: 'pending',
    isCorrect: null,
    answeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tag: { name: '公务员处分' },
    errorItem: null,
};

describe('/api/practice/questions', () => {
    beforeEach(() => {
        resetRateLimits();
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
    });

    describe('GET 列表', () => {
        it('默认返回待做题并带 pendingCount', async () => {
            mocks.mockPrismaPracticeQuestion.count.mockResolvedValue(3);
            mocks.mockPrismaPracticeQuestion.findMany.mockResolvedValue([ownedQuestion]);

            const response = await QUESTIONS_GET(new Request('http://localhost/api/practice/questions'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.total).toBe(3);
            expect(data.pendingCount).toBe(3);
            expect(data.questions).toHaveLength(1);
            expect(mocks.mockPrismaPracticeQuestion.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ userId: 'user-123', status: 'pending' }),
                })
            );
        });

        it('支持渠道/难度/状态筛选', async () => {
            mocks.mockPrismaPracticeQuestion.count.mockResolvedValue(0);
            mocks.mockPrismaPracticeQuestion.findMany.mockResolvedValue([]);

            await QUESTIONS_GET(new Request(
                'http://localhost/api/practice/questions?status=answered&channel=similar&difficulty=hard'
            ));

            expect(mocks.mockPrismaPracticeQuestion.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-123',
                        status: 'answered',
                        channel: 'similar',
                        difficulty: 'hard',
                    }),
                })
            );
        });

        it('非法渠道参数被忽略而非报错', async () => {
            mocks.mockPrismaPracticeQuestion.count.mockResolvedValue(0);
            mocks.mockPrismaPracticeQuestion.findMany.mockResolvedValue([]);

            const response = await QUESTIONS_GET(new Request(
                'http://localhost/api/practice/questions?channel=hacked'
            ));

            expect(response.status).toBe(200);
            expect(mocks.mockPrismaPracticeQuestion.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({ channel: 'hacked' }),
                })
            );
        });

        it('未登录返回 401', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null as any);
            const response = await QUESTIONS_GET(new Request('http://localhost/api/practice/questions'));
            expect(response.status).toBe(401);
        });
    });

    describe('GET 单题', () => {
        it('返回自己的题目详情', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue(ownedQuestion);
            const response = await QUESTION_GET(
                new Request('http://localhost/api/practice/questions/pq-1'),
                { params: Promise.resolve({ id: 'pq-1' }) }
            );
            const data = await response.json();
            expect(response.status).toBe(200);
            expect(data.id).toBe('pq-1');
            expect(mocks.mockPrismaPracticeQuestion.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'pq-1', userId: 'user-123' } })
            );
        });

        it('题目不存在或不属于自己返回 404', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue(null);
            const response = await QUESTION_GET(
                new Request('http://localhost/api/practice/questions/other'),
                { params: Promise.resolve({ id: 'other' }) }
            );
            expect(response.status).toBe(404);
        });
    });

    describe('PATCH 生命周期', () => {
        it('待做 → 弃置', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue(ownedQuestion);
            mocks.mockPrismaPracticeQuestion.update.mockResolvedValue({ ...ownedQuestion, status: 'discarded' });

            const response = await QUESTION_PATCH(
                new Request('http://localhost/api/practice/questions/pq-1', {
                    method: 'PATCH',
                    body: JSON.stringify({ action: 'discard' }),
                }),
                { params: Promise.resolve({ id: 'pq-1' }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('discarded');
            expect(mocks.mockPrismaPracticeQuestion.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'pq-1' }, data: { status: 'discarded' } })
            );
        });

        it('弃置 → 恢复待做', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue({ ...ownedQuestion, status: 'discarded' });
            mocks.mockPrismaPracticeQuestion.update.mockResolvedValue({ ...ownedQuestion });

            const response = await QUESTION_PATCH(
                new Request('http://localhost/api/practice/questions/pq-1', {
                    method: 'PATCH',
                    body: JSON.stringify({ action: 'restore' }),
                }),
                { params: Promise.resolve({ id: 'pq-1' }) }
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('pending');
        });

        it('已答的题不允许改状态', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue({ ...ownedQuestion, status: 'answered' });

            const response = await QUESTION_PATCH(
                new Request('http://localhost/api/practice/questions/pq-1', {
                    method: 'PATCH',
                    body: JSON.stringify({ action: 'discard' }),
                }),
                { params: Promise.resolve({ id: 'pq-1' }) }
            );

            expect(response.status).toBe(400);
            expect(mocks.mockPrismaPracticeQuestion.update).not.toHaveBeenCalled();
        });

        it('非法 action 返回 400', async () => {
            const response = await QUESTION_PATCH(
                new Request('http://localhost/api/practice/questions/pq-1', {
                    method: 'PATCH',
                    body: JSON.stringify({ action: 'delete' }),
                }),
                { params: Promise.resolve({ id: 'pq-1' }) }
            );
            expect(response.status).toBe(400);
        });
    });
});
