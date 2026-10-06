import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, notFound, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:practice:question');

async function getOwnedQuestion(id: string, userId: string) {
    return prisma.practiceQuestion.findFirst({
        where: { id, userId },
        include: {
            tag: { select: { id: true, name: true } },
            errorItem: { select: { id: true, questionText: true, subject: { select: { name: true } } } },
        },
    });
}

/** 单题详情（"去做"进入答题前取题） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return unauthorized();

    const { id } = await params;

    try {
        // @ts-ignore
        const userId = session.user.id;
        const question = await getOwnedQuestion(id, userId);
        if (!question) return notFound("Question not found");
        return NextResponse.json(question);
    } catch (error) {
        logger.error({ error }, 'Error fetching practice question');
        return internalError("Failed to fetch practice question");
    }
}

/**
 * 生命周期操作：pending -> discarded（不做这道）；discarded -> pending（恢复）。
 * 已答的题不允许再改状态。
 * body: { action: "discard" | "restore" }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return unauthorized();

    const { id } = await params;

    try {
        // @ts-ignore
        const userId = session.user.id;

        const body = await req.json().catch(() => ({}));
        const action = body?.action;
        if (action !== "discard" && action !== "restore") {
            return badRequest("action 必须为 discard 或 restore");
        }

        const question = await getOwnedQuestion(id, userId);
        if (!question) return notFound("Question not found");
        if (question.status === "answered") {
            return badRequest("已作答的题目不能更改状态");
        }

        const nextStatus = action === "discard" ? "discarded" : "pending";
        if (question.status === nextStatus) {
            return NextResponse.json(question);
        }

        const updated = await prisma.practiceQuestion.update({
            where: { id: question.id },
            data: { status: nextStatus },
        });
        return NextResponse.json(updated);
    } catch (error) {
        logger.error({ error }, 'Error updating practice question');
        return internalError("Failed to update practice question");
    }
}
