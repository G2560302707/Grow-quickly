import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, forbidden, notFound, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { normalizeMistakeStatusForSave } from "@grow/shared/mistake-status";
import { resolveTagIdForErrorItem, USER_TAG_SUBJECT } from "@/lib/user-tag-tree";
import { createShareToken } from "@/lib/share-token";

const logger = createLogger('api:error-items:id');

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const errorItem = await prisma.errorItem.findUnique({
            where: {
                id: id,
            },
            include: {
                subject: true,
                tags: true, // 包含标签关联
            },
        });

        if (!errorItem) {
            return notFound("Item not found");
        }

        // Ensure the user owns this item
        if (errorItem.userId !== user.id) {
            return forbidden("Not authorized to access this item");
        }

        // 附带分享令牌：小程序端生成分享卡片时直接复用，无需额外请求
        return NextResponse.json({
            ...errorItem,
            shareToken: createShareToken(errorItem.id),
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching item');
        return internalError("Failed to fetch error item");
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const body = await req.json();
        const { knowledgePoints, questionText, answerText, analysis, subjectId,  wrongAnswerText, mistakeAnalysis, mistakeStatus, geogebraCommands } = body;

        const errorItem = await prisma.errorItem.findUnique({
            where: { id },
            include: { subject: true },
        });

        if (!errorItem) {
            return notFound("Item not found");
        }

        if (errorItem.userId !== user.id) {
            return forbidden("Not authorized to update this item");
        }

        // 构建更新数据
        const updateData: Prisma.ErrorItemUpdateInput = {};
        if (questionText !== undefined) updateData.questionText = questionText;
        if (answerText !== undefined) updateData.answerText = answerText;
        if (analysis !== undefined) updateData.analysis = analysis;
        if (wrongAnswerText !== undefined) updateData.wrongAnswerText = wrongAnswerText || null;
        if (mistakeAnalysis !== undefined) updateData.mistakeAnalysis = mistakeAnalysis || null;
        if (subjectId !== undefined) {
            // 验证目标错题本存在且属于该用户
            const targetSubject = await prisma.subject.findUnique({ where: { id: subjectId } });
            if (!targetSubject || targetSubject.userId !== user.id) {
                return forbidden("Not authorized to move to this notebook");
            }
            updateData.subject = subjectId === "" ? { disconnect: true } : { connect: { id: subjectId } };
        }
        if (mistakeStatus !== undefined || wrongAnswerText !== undefined || mistakeAnalysis !== undefined) {
            const nextWrongAnswerText = wrongAnswerText !== undefined ? wrongAnswerText : errorItem.wrongAnswerText;
            const nextMistakeAnalysis = mistakeAnalysis !== undefined ? mistakeAnalysis : errorItem.mistakeAnalysis;
            updateData.mistakeStatus = normalizeMistakeStatusForSave(
                mistakeStatus,
                nextWrongAnswerText
            );
        }
        if (geogebraCommands !== undefined) updateData.geogebraCommands = geogebraCommands || null;

        // 处理 knowledgePoints (标签)
        if (knowledgePoints !== undefined) {
            const tagNames: string[] = Array.isArray(knowledgePoints)
                ? knowledgePoints
                : typeof knowledgePoints === 'string'
                    ? JSON.parse(knowledgePoints)
                    : [];

            const tagConnections: { id: string }[] = [];
            for (const tagName of tagNames) {
                const resolvedId = await resolveTagIdForErrorItem(user.id, tagName, USER_TAG_SUBJECT);
                tagConnections.push({ id: resolvedId });
            }

            // 更新标签关联: 先断开所有，再连接新的
            updateData.tags = {
                set: [], // 先清空
                connect: tagConnections,
            };

            // 保留旧字段兼容
            updateData.knowledgePoints = JSON.stringify(tagNames);
        }

        logger.info({ id }, 'Updating error item');

        const updated = await prisma.errorItem.update({
            where: { id },
            data: updateData,
            include: { tags: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        logger.error({ error }, 'Error updating item');
        return internalError("Failed to update error item");
    }
}
