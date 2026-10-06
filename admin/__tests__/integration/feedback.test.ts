/**
 * /api/feedback 与 /api/settings/smtp-test 集成测试
 * 反馈提交（含邮件通知钩子）、管理员列表与状态流转、SMTP 测试邮件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    mockPrismaFeedback: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
    },
    mockPrismaUser: {
        findUnique: vi.fn(),
    },
    mockSendFeedbackNotification: vi.fn(),
    mockSendTestMail: vi.fn(),
    mockSession: {
        user: {
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
            role: 'user',
        },
        expires: '2025-12-31',
    },
}));

vi.mock('@grow/shared/prisma', () => ({
    prisma: {
        feedback: mocks.mockPrismaFeedback,
        user: mocks.mockPrismaUser,
    },
}));

// 邮件库整体 mock：不真正发信
vi.mock('@grow/shared/mailer', () => ({
    sendFeedbackNotification: mocks.mockSendFeedbackNotification,
    sendTestMail: mocks.mockSendTestMail,
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

import { POST as FEEDBACK_POST, GET as FEEDBACK_GET, PATCH as FEEDBACK_PATCH } from '@/app/api/feedback/route';
import { POST as SMTP_TEST_POST } from '@/app/api/settings/smtp-test/route';
import { getServerSession } from 'next-auth';

const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
};

describe('/api/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
        mocks.mockPrismaUser.findUnique.mockResolvedValue(mockUser);
        mocks.mockSendFeedbackNotification.mockResolvedValue(false);
    });

    describe('POST 提交反馈', () => {
        it('成功创建反馈并触发邮件通知', async () => {
            mocks.mockPrismaFeedback.create.mockResolvedValue({
                id: 'fb-1',
                type: 'bug',
                content: '练习页提交后偶尔白屏',
                contact: 'qq 123456',
                createdAt: new Date('2026-10-05T10:00:00Z'),
            });

            const request = new Request('http://localhost/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ type: 'bug', content: '练习页提交后偶尔白屏', contact: 'qq 123456' }),
            });

            const response = await FEEDBACK_POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(mocks.mockPrismaFeedback.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ type: 'bug', content: '练习页提交后偶尔白屏' }),
                })
            );
            expect(mocks.mockSendFeedbackNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'bug',
                    content: '练习页提交后偶尔白屏',
                    userEmail: 'user@example.com',
                })
            );
        });

        it('未配置邮件时通知静默返回 false，反馈不受影响', async () => {
            mocks.mockSendFeedbackNotification.mockResolvedValue(false);
            mocks.mockPrismaFeedback.create.mockResolvedValue({
                id: 'fb-2',
                type: 'other',
                content: '希望支持深色模式',
                contact: null,
                createdAt: new Date(),
            });

            const request = new Request('http://localhost/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ content: '希望支持深色模式' }),
            });

            const response = await FEEDBACK_POST(request);
            expect(response.status).toBe(201);
            expect(mocks.mockSendFeedbackNotification).toHaveBeenCalled();
        });

        it('内容太短返回 400 且不发邮件', async () => {
            const request = new Request('http://localhost/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ content: '短' }),
            });

            const response = await FEEDBACK_POST(request);
            expect(response.status).toBe(400);
            expect(mocks.mockPrismaFeedback.create).not.toHaveBeenCalled();
            expect(mocks.mockSendFeedbackNotification).not.toHaveBeenCalled();
        });

        it('未登录返回 401', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null as any);
            const request = new Request('http://localhost/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ content: '随便写点内容' }),
            });
            const response = await FEEDBACK_POST(request);
            expect(response.status).toBe(401);
        });
    });

    describe('GET 管理员列表', () => {
        it('管理员可查看反馈列表', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                ...mocks.mockSession,
                user: { ...mocks.mockSession.user, role: 'admin' },
            } as any);
            mocks.mockPrismaFeedback.count.mockResolvedValue(1);
            mocks.mockPrismaFeedback.findMany.mockResolvedValue([
                { id: 'fb-1', type: 'bug', content: 'x', user: mockUser },
            ]);

            const response = await FEEDBACK_GET(new Request('http://localhost/api/feedback?page=1&pageSize=20'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.total).toBe(1);
            expect(data.items[0].id).toBe('fb-1');
        });

        it('普通用户访问列表返回 403', async () => {
            const response = await FEEDBACK_GET(new Request('http://localhost/api/feedback'));
            expect(response.status).toBe(403);
        });
    });

    describe('PATCH 状态流转', () => {
        it('管理员标记已处理', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                ...mocks.mockSession,
                user: { ...mocks.mockSession.user, role: 'admin' },
            } as any);
            mocks.mockPrismaFeedback.findUnique.mockResolvedValue({ id: 'fb-1' });
            mocks.mockPrismaFeedback.update.mockResolvedValue({ id: 'fb-1', status: 'resolved' });

            const response = await FEEDBACK_PATCH(new Request('http://localhost/api/feedback', {
                method: 'PATCH',
                body: JSON.stringify({ id: 'fb-1', status: 'resolved' }),
            }));

            expect(response.status).toBe(200);
            expect(mocks.mockPrismaFeedback.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'fb-1' }, data: { status: 'resolved' } })
            );
        });

        it('非法状态返回 400', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                ...mocks.mockSession,
                user: { ...mocks.mockSession.user, role: 'admin' },
            } as any);

            const response = await FEEDBACK_PATCH(new Request('http://localhost/api/feedback', {
                method: 'PATCH',
                body: JSON.stringify({ id: 'fb-1', status: 'closed' }),
            }));
            expect(response.status).toBe(400);
        });
    });
});

describe('/api/settings/smtp-test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue({
            ...mocks.mockSession,
            user: { ...mocks.mockSession.user, role: 'admin' },
        } as any);
    });

    it('管理员用表单值发送测试邮件', async () => {
        mocks.mockSendTestMail.mockResolvedValue({ ok: true, message: '测试邮件已发送至 me@qq.com' });

        const response = await SMTP_TEST_POST(new Request('http://localhost/api/settings/smtp-test', {
            method: 'POST',
            body: JSON.stringify({ smtp: { host: 'smtp.qq.com', user: 'me@qq.com', pass: 'code' } }),
        }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(mocks.mockSendTestMail).toHaveBeenCalledWith(
            expect.objectContaining({ host: 'smtp.qq.com', user: 'me@qq.com' })
        );
    });

    it('普通用户返回 403', async () => {
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession as any);
        const response = await SMTP_TEST_POST(new Request('http://localhost/api/settings/smtp-test', {
            method: 'POST',
            body: JSON.stringify({}),
        }));
        expect(response.status).toBe(403);
    });
});
