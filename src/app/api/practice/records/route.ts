import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError, notFound } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:practice:records');

/**
 * 练习记录列表（分页，倒序）。
 * 渠道已固化为 channel 字段（free/similar/smart，历史数据已回填）；
 * 未传 channel 时返回全部，可选 ?channel= 过滤。?id= 为单条详情查询。
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

        // 单条查询（练习记录详情页）
        const id = searchParams.get("id");
        if (id) {
            const record = await prisma.practiceRecord.findFirst({
                where: { id, userId },
                select: {
                    id: true,
                    subject: true,
                    difficulty: true,
                    isCorrect: true,
                    questionText: true,
                    answerText: true,
                    analysis: true,
                    errorItemId: true,
                    tagId: true,
                    channel: true,
                    questionId: true,
                    createdAt: true,
                    tag: { select: { name: true } },
                },
            });
            if (!record) return notFound("Record not found");
            return NextResponse.json(record);
        }

        const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
        const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20));
        const channelParam = searchParams.get("channel");
        const channel = ["free", "similar", "smart"].includes(channelParam || "") ? channelParam : null;

        const where = channel ? { userId, channel } : { userId };
        const [total, records] = await Promise.all([
            prisma.practiceRecord.count({ where }),
            prisma.practiceRecord.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    subject: true,
                    difficulty: true,
                    isCorrect: true,
                    questionText: true,
                    answerText: true,
                    analysis: true,
                    errorItemId: true,
                    tagId: true,
                    channel: true,
                    questionId: true,
                    createdAt: true,
                    tag: { select: { name: true } },
                },
            }),
        ]);

        return NextResponse.json({ total, page, pageSize, records });
    } catch (error) {
        logger.error({ error }, 'Error fetching practice records');
        return internalError("Failed to fetch practice records");
    }
}
