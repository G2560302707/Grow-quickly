import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";
import { notFound, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { AI_SUBJECT_OPTIONS } from "@/lib/subjects";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:practice:generate');

const DIFFICULTIES = ["easy", "medium", "hard", "harder"] as const;

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return unauthorized("Authentication required");
    }

    try {
        const { errorItemId, language, difficulty } = await req.json();

        // 属主校验：防止用他人错题 ID 借 AI 生成套出题目内容
        let user;
        if (session.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }
        if (!user) {
            return unauthorized("Authentication required");
        }

    // 限流：AI 接口按用户每分钟 10 次，防滥用与成本失控
    const aiLimit = rateLimit(`ai:practice-generate:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
    if (!aiLimit.allowed) {
        return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
    }


        const errorItemWithSubject = await prisma.errorItem.findFirst({
            where: { id: errorItemId, userId: user.id },
            include: { subject: true }
        });

        if (!errorItemWithSubject) {
            return notFound("Item not found");
        }

        let tags: string[] = [];
        try {
            tags = JSON.parse(errorItemWithSubject.knowledgePoints || "[]");
        } catch (e) {
            tags = [];
        }

        const aiService = getAIService();
        const similarQuestion = await aiService.generateSimilarQuestion(
            errorItemWithSubject.questionText || "",
            tags,
            language,
            difficulty || 'medium',
            errorItemWithSubject.gradeSemester
        );

        // Inject the subject from the database with type safety
        const subjectName = errorItemWithSubject.subject?.name || "其他";
        similarQuestion.subject = (AI_SUBJECT_OPTIONS as readonly string[]).includes(subjectName)
            ? subjectName as typeof AI_SUBJECT_OPTIONS[number]
            : "其他";

        // 生成即入库：AI 生成的题是花钱产生的资产，未作答也保留在待做题库（channel=similar 锚定原错题）
        let questionId: string | null = null;
        if ((similarQuestion.questionText || "").trim()) {
            const saved = await prisma.practiceQuestion.create({
                data: {
                    userId: user.id,
                    channel: "similar",
                    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : "medium",
                    subject: subjectName,
                    errorItemId: errorItemWithSubject.id,
                    questionText: similarQuestion.questionText || "",
                    answerText: similarQuestion.answerText ?? null,
                    analysis: similarQuestion.analysis ?? null,
                },
                select: { id: true },
            });
            questionId = saved.id;
        }

        return NextResponse.json({ ...similarQuestion, questionId });
    } catch (error) {
        logger.error({ error }, 'Error generating practice');
        // 不把 AI provider 的原始错误信息回传前端，避免泄漏内部细节
        return internalError("Failed to generate practice question");
    }
}
