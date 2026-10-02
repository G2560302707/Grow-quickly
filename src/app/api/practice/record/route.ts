import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:practice:record');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    try {
        const { subject, difficulty, isCorrect, errorItemId, tagId, questionText } = await req.json();

        // @ts-ignore
        const userId = session.user.id;

        // 归因字段校验：仅接受属于当前用户的锚题 / 可访问的考点；非法值静默置空，不影响记录本身
        let safeErrorItemId: string | null = null;
        if (typeof errorItemId === "string" && errorItemId) {
            const owned = await prisma.errorItem.findFirst({
                where: { id: errorItemId, userId },
                select: { id: true },
            });
            safeErrorItemId = owned?.id ?? null;
        }

        let safeTagId: string | null = null;
        if (typeof tagId === "string" && tagId) {
            const tag = await prisma.knowledgeTag.findFirst({
                where: { id: tagId, OR: [{ userId }, { isSystem: true }] },
                select: { id: true },
            });
            safeTagId = tag?.id ?? null;
        }

        const record = await prisma.practiceRecord.create({
            data: {
                userId,
                subject,
                difficulty,
                isCorrect,
                errorItemId: safeErrorItemId,
                tagId: safeTagId,
                questionText: typeof questionText === "string" ? questionText.slice(0, 2000) : null,
            },
        });

        return NextResponse.json(record);
    } catch (error) {
        logger.error({ error }, 'Error saving practice record');
        return internalError("Failed to save record");
    }
}
