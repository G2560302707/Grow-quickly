import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";
import { notFound, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { AI_SUBJECT_OPTIONS } from "@/lib/subjects";

const logger = createLogger('api:practice:generate');

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

        return NextResponse.json(similarQuestion);
    } catch (error) {
        logger.error({ error }, 'Error generating practice');
        // 不把 AI provider 的原始错误信息回传前端，避免泄漏内部细节
        return internalError("Failed to generate practice question");
    }
}
