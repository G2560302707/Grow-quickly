/**
 * /api/practice API 集成测试
 * 测试举一反三功能（生成类似题目和记录练习结果）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetRateLimits } from "@/lib/rate-limit";

// Use vi.hoisted to ensure mocks are initialized before module imports
const mocks = vi.hoisted(() => ({
    mockPrismaErrorItem: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    mockPrismaUser: {
        findUnique: vi.fn(),
    },
    mockPrismaPracticeRecord: {
        create: vi.fn(),
    },
    mockPrismaPracticeQuestion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
    },
    mockPrismaSubject: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    mockPrismaKnowledgeTag: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    mockAIService: {
        generateSimilarQuestion: vi.fn(),
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
        errorItem: mocks.mockPrismaErrorItem,
        user: mocks.mockPrismaUser,
        practiceRecord: mocks.mockPrismaPracticeRecord,
        practiceQuestion: mocks.mockPrismaPracticeQuestion,
        subject: mocks.mockPrismaSubject,
        knowledgeTag: mocks.mockPrismaKnowledgeTag,
        $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
            fn({
                practiceRecord: mocks.mockPrismaPracticeRecord,
                practiceQuestion: mocks.mockPrismaPracticeQuestion,
                errorItem: mocks.mockPrismaErrorItem,
            })
        ),
    },
}));

// Mock AI service
vi.mock('@/lib/ai', () => ({
    getAIService: vi.fn(() => mocks.mockAIService),
}));

// Mock next-auth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(() => Promise.resolve(mocks.mockSession)),
}));

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Import after mocks
import { POST as GENERATE_POST } from '@/app/api/practice/generate/route';
import { POST as RECORD_POST } from '@/app/api/practice/record/route';
import { getServerSession } from 'next-auth';

describe('/api/practice', () => {
    beforeEach(() => {
        resetRateLimits();
        vi.clearAllMocks();
        vi.mocked(getServerSession).mockResolvedValue(mocks.mockSession);
        // 生成即入库：默认成功创建题库题
        mocks.mockPrismaPracticeQuestion.create.mockResolvedValue({ id: 'pool-question-1' });
        // 默认不带 questionId 作答
        mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue(null);
    });

    describe('POST /api/practice/generate (生成类似题目)', () => {
        const mockErrorItem = {
            id: 'error-item-1',
            userId: 'user-123',
            questionText: '求解 x + 2 = 5',
            knowledgePoints: '["一元一次方程", "移项"]',
            subject: { id: 'math', name: '数学' },
        };

        beforeEach(() => {
            // 属主校验：当前用户可查到自己的错题
            mocks.mockPrismaUser.findUnique.mockResolvedValue({
                id: 'user-123',
                email: 'user@example.com',
            });
            mocks.mockPrismaErrorItem.findFirst.mockImplementation(async (args: any) => {
                const item = await mocks.mockPrismaErrorItem.findUnique({ where: { id: args?.where?.id } });
                if (item && item.userId === args?.where?.userId) {
                    return item;
                }
                return null;
            });
        });

        it('应该成功生成类似题目', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(mockErrorItem);
            const aiResult = {
                questionText: '求解 2x - 3 = 7',
                answerText: 'x = 5',
                analysis: '移项得 2x = 10, x = 5',
                knowledgePoints: ['一元一次方程'],
                subject: '数学',
            };
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue(aiResult);

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                    difficulty: 'medium',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.questionText).toBe('求解 2x - 3 = 7');
            expect(data.subject).toBe('数学');
        });

        it('应该支持不同难度级别', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(mockErrorItem);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '简单题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const difficulties = ['easy', 'medium', 'hard', 'harder'];

            for (const difficulty of difficulties) {
                const request = new Request('http://localhost/api/practice/generate', {
                    method: 'POST',
                    body: JSON.stringify({
                        errorItemId: 'error-item-1',
                        language: 'zh',
                        difficulty,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                });

                const response = await GENERATE_POST(request);
                expect(response.status).toBe(200);
            }

            // 验证 AI 服务被调用时使用了不同难度
            expect(mocks.mockAIService.generateSimilarQuestion).toHaveBeenCalledTimes(4);
        });

        it('应该默认使用 medium 难度', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(mockErrorItem);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                    // 不指定 difficulty
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            await GENERATE_POST(request);

            expect(mocks.mockAIService.generateSimilarQuestion).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                'zh',
                'medium', // 默认难度
                undefined
            );
        });

        it('应该返回 404 当错题不存在', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(null);

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'not-exist',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.message).toBe('Item not found');
        });

        it('应该拒绝为他人错题生成练习（越权返回 404）', async () => {
            // 错题存在但属于其他用户
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue({
                ...mockErrorItem,
                userId: 'someone-else',
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);

            expect(response.status).toBe(404);
            expect(mocks.mockAIService.generateSimilarQuestion).not.toHaveBeenCalled();
        });

        it('应该正确解析知识点标签', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(mockErrorItem);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: ['一元一次方程'],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            await GENERATE_POST(request);

            expect(mocks.mockAIService.generateSimilarQuestion).toHaveBeenCalledWith(
                '求解 x + 2 = 5',
                ['一元一次方程', '移项'], // 解析后的标签数组
                'zh',
                'medium',
                undefined
            );
        });

        it('应该处理无效的知识点 JSON', async () => {
            const errorItemWithInvalidTags = {
                ...mockErrorItem,
                knowledgePoints: 'invalid json{',
            };
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(errorItemWithInvalidTags);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);

            expect(response.status).toBe(200);
            // 应该使用空数组作为标签
            expect(mocks.mockAIService.generateSimilarQuestion).toHaveBeenCalledWith(
                expect.any(String),
                [], // 空数组
                'zh',
                'medium',
                undefined
            );
        });

        it('应该处理空的知识点', async () => {
            const errorItemWithNoTags = {
                ...mockErrorItem,
                knowledgePoints: null,
            };
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(errorItemWithNoTags);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);

            expect(response.status).toBe(200);
        });

        it('应该从数据库获取正确的学科', async () => {
            const errorItemWithPhysics = {
                ...mockErrorItem,
                subject: { id: 'physics', name: '物理' },
            };
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(errorItemWithPhysics);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '物理题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
                subject: undefined, // AI 返回的可能没有学科
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subject).toBe('物理'); // 应该从数据库注入
        });

        it('应该处理未知学科为"其他"', async () => {
            const errorItemWithUnknownSubject = {
                ...mockErrorItem,
                subject: { id: 'unknown', name: '未知学科' },
            };
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(errorItemWithUnknownSubject);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subject).toBe('其他');
        });

        it('应该处理没有关联学科的错题', async () => {
            const errorItemWithNoSubject = {
                ...mockErrorItem,
                subject: null,
            };
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(errorItemWithNoSubject);
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '题目',
                answerText: '答案',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subject).toBe('其他');
        });


        it('生成即入库：练习题落库为待做（channel=similar）并返回 questionId', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue({
                id: 'error-item-1',
                userId: 'user-123',
                questionText: '求解 x + 2 = 5',
                knowledgePoints: '["一元一次方程"]',
                subject: { id: 'math', name: '数学' },
            });
            mocks.mockAIService.generateSimilarQuestion.mockResolvedValue({
                questionText: '求解 3x + 1 = 10',
                answerText: 'x = 3',
                analysis: '解析',
                knowledgePoints: [],
            });

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({ errorItemId: 'error-item-1', language: 'zh', difficulty: 'hard' }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.questionId).toBe('pool-question-1');
            expect(mocks.mockPrismaPracticeQuestion.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'user-123',
                        channel: 'similar',
                        difficulty: 'hard',
                        errorItemId: 'error-item-1',
                    }),
                })
            );
        });

        it('应该处理 AI 服务错误', async () => {
            mocks.mockPrismaErrorItem.findUnique.mockResolvedValue(mockErrorItem);
            mocks.mockAIService.generateSimilarQuestion.mockRejectedValue(
                new Error('AI service unavailable')
            );

            const request = new Request('http://localhost/api/practice/generate', {
                method: 'POST',
                body: JSON.stringify({
                    errorItemId: 'error-item-1',
                    language: 'zh',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await GENERATE_POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            // 不把 AI provider 的原始错误信息回传前端
            expect(data.message).toBe('Failed to generate practice question');
            expect(data.message).not.toContain('AI service unavailable');
        });
    });

    describe('POST /api/practice/record (记录练习结果)', () => {
        it('应该成功记录正确的练习结果', async () => {
            const createdRecord = {
                id: 'record-1',
                userId: 'user-123',
                subject: '数学',
                difficulty: 'medium',
                isCorrect: true,
                createdAt: new Date(),
            };
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue(createdRecord);

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '数学',
                    difficulty: 'medium',
                    isCorrect: true,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.subject).toBe('数学');
            expect(data.isCorrect).toBe(true);
        });

        it('答错的练习题自动收录错题本并标注来源', async () => {
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue({
                id: 'record-9',
                userId: 'user-123',
                subject: '常识判断',
                difficulty: 'medium',
                isCorrect: false,
                createdAt: new Date(),
            });
            mocks.mockPrismaErrorItem.findFirst.mockResolvedValue(null); // 无重复收录
            mocks.mockPrismaSubject.findFirst.mockResolvedValue({ id: 'subject-1' });
            mocks.mockPrismaKnowledgeTag.findFirst.mockResolvedValue({ id: 'tag-1' });
            mocks.mockPrismaErrorItem.create.mockResolvedValue({ id: 'new-error-item' });

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '常识判断',
                    difficulty: 'medium',
                    isCorrect: false,
                    tagId: 'tag-1',
                    questionText: '下列属于公务员法定处分种类的是？',
                    answerText: 'B',
                    analysis: '考点：公务员处分种类',
                    knowledgePoints: ['公务员处分'],
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.savedErrorItemId).toBe('new-error-item');
            expect(mocks.mockPrismaErrorItem.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        origin: 'smart',
                        sourceType: 'practice',
                        subjectId: 'subject-1',
                        mistakeStatus: 'wrong_attempt',
                        questionText: '下列属于公务员法定处分种类的是？',
                    }),
                })
            );
        });

        it('同题干已收录过时去重不再重复创建', async () => {
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue({
                id: 'record-10',
                isCorrect: false,
                createdAt: new Date(),
            });
            mocks.mockPrismaErrorItem.findFirst.mockResolvedValue({ id: 'existing-item' });

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '常识判断',
                    difficulty: 'medium',
                    isCorrect: false,
                    questionText: '重复的题目',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.savedErrorItemId).toBe('existing-item');
            expect(mocks.mockPrismaErrorItem.create).not.toHaveBeenCalled();
        });

        it('应该成功记录错误的练习结果', async () => {
            const createdRecord = {
                id: 'record-2',
                userId: 'user-123',
                subject: '英语',
                difficulty: 'hard',
                isCorrect: false,
                createdAt: new Date(),
            };
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue(createdRecord);

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '英语',
                    difficulty: 'hard',
                    isCorrect: false,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.isCorrect).toBe(false);
        });

        it('应该记录不同学科的练习结果', async () => {
            const subjects = ['数学', '物理', '化学', '英语', '语文'];

            for (const subject of subjects) {
                mocks.mockPrismaPracticeRecord.create.mockResolvedValue({
                    id: `record-${subject}`,
                    userId: 'user-123',
                    subject,
                    difficulty: 'medium',
                    isCorrect: true,
                });

                const request = new Request('http://localhost/api/practice/record', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject,
                        difficulty: 'medium',
                        isCorrect: true,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                });

                const response = await RECORD_POST(request);
                expect(response.status).toBe(200);
            }
        });

        it('应该拒绝未登录用户', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '数学',
                    difficulty: 'medium',
                    isCorrect: true,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该拒绝 session 中没有 user 的请求', async () => {
            vi.mocked(getServerSession).mockResolvedValue({
                user: undefined,
                expires: '2025-12-31',
            } as any);

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '数学',
                    difficulty: 'medium',
                    isCorrect: true,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.message).toBe('Unauthorized');
        });

        it('应该处理数据库错误', async () => {
            mocks.mockPrismaPracticeRecord.create.mockRejectedValue(
                new Error('Database connection failed')
            );

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '数学',
                    difficulty: 'medium',
                    isCorrect: true,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.message).toBe('Failed to save record');
        });


        it('带 questionId 作答：联动题库状态为已答，归因与渠道取自题库题', async () => {
            mocks.mockPrismaPracticeQuestion.findFirst.mockResolvedValue({
                id: 'pool-question-1',
                channel: 'smart',
                tagId: 'tag-1',
                errorItemId: 'error-item-9',
            });
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue({
                id: 'record-q',
                userId: 'user-123',
                isCorrect: true,
                createdAt: new Date(),
            });

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({
                    subject: '常识判断',
                    difficulty: 'medium',
                    isCorrect: true,
                    questionId: 'pool-question-1',
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            expect(response.status).toBe(200);
            expect(mocks.mockPrismaPracticeRecord.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        channel: 'smart',
                        questionId: 'pool-question-1',
                        tagId: 'tag-1',
                        errorItemId: 'error-item-9',
                    }),
                })
            );
            expect(mocks.mockPrismaPracticeQuestion.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'pool-question-1' },
                    data: expect.objectContaining({ status: 'answered', isCorrect: true }),
                })
            );
        });

        it('不带 questionId 时按归因推导渠道（无归因 → free）', async () => {
            mocks.mockPrismaPracticeRecord.create.mockResolvedValue({
                id: 'record-c1',
                isCorrect: true,
                createdAt: new Date(),
            });

            const request = new Request('http://localhost/api/practice/record', {
                method: 'POST',
                body: JSON.stringify({ subject: '数学', difficulty: 'medium', isCorrect: true }),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await RECORD_POST(request);
            expect(response.status).toBe(200);
            expect(mocks.mockPrismaPracticeRecord.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ channel: 'free' }),
                })
            );
            expect(mocks.mockPrismaPracticeQuestion.update).not.toHaveBeenCalled();
        });
    });
});
