import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:practice:questions');

const STATUSES = ["pending", "answered", "discarded"] as const;
const CHANNELS = ["free", "similar", "smart"] as const;
const DIFFICULTIES = ["easy", "medium", "hard", "harder"] as const;

/**
 * 练习题库列表（分页，倒序）。生成即入库的题目都在这里：
 * ?status=pending|answered|discarded|all（默认 pending 待做）
 * ?channel=free|similar|smart  ?difficulty=easy|medium|hard|harder  ?tagId= 过滤
 * 响应额外带 pendingCount（全部待做总数），供入口卡展示。
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return unauthorized();
    }

    try {
        // @ts-ignore
        const userId = session.user.id;

        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status") || "pending";
        const status = STATUSES.includes(statusParam as (typeof STATUSES)[number]) || statusParam === "all"
            ? statusParam
            : "pending";
        const channelParam = searchParams.get("channel");
        const channel = CHANNELS.includes(channelParam as (typeof CHANNELS)[number]) ? channelParam : null;
        const difficultyParam = searchParams.get("difficulty");
        const difficulty = DIFFICULTIES.includes(difficultyParam as (typeof DIFFICULTIES)[number]) ? difficultyParam : null;
        const tagId = searchParams.get("tagId");
        const errorItemId = searchParams.get("errorItemId");

        const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
        const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20));

        const where = {
            userId,
            ...(status !== "all" ? { status } : {}),
            ...(channel ? { channel } : {}),
            ...(difficulty ? { difficulty } : {}),
            ...(tagId ? { tagId } : {}),
            ...(errorItemId ? { errorItemId } : {}),
        };

        const [total, pendingCount, questions] = await Promise.all([
            prisma.practiceQuestion.count({ where }),
            prisma.practiceQuestion.count({ where: { userId, status: "pending" } }),
            prisma.practiceQuestion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    channel: true,
                    difficulty: true,
                    subject: true,
                    tagId: true,
                    errorItemId: true,
                    bankQuestionId: true,
                    questionText: true,
                    answerText: true,
                    status: true,
                    isCorrect: true,
                    answeredAt: true,
                    createdAt: true,
                    tag: { select: { name: true } },
                    errorItem: { select: { id: true, questionText: true } },
                },
            }),
        ]);

        return NextResponse.json({ total, page, pageSize, pendingCount, questions });
    } catch (error) {
        logger.error({ error }, 'Error fetching practice questions');
        return internalError("Failed to fetch practice questions");
    }
}
