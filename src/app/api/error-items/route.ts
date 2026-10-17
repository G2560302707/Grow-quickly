import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError, validationError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { inferSubjectFromName } from "@/lib/knowledge-tags";
import { resolveTagIdForErrorItem } from "@/lib/user-tag-tree";
import { normalizeMistakeStatusForSave } from "@grow/shared/mistake-status";

const logger = createLogger('api:error-items');

// base64 图片数据上限（约 10MB 解码后大小），防止超大 payload 撑爆 SQLite
const MAX_IMAGE_DATA_LENGTH = 14_000_000;

export async function POST(req: Request) {
    logger.info('POST /api/error-items called');

    const session = await getServerSession(authOptions);

    try {
        const body = await req.json();
        const {
            questionText,
            answerText,
            analysis,
            wrongAnswerText,
            mistakeAnalysis,
            mistakeStatus,
            knowledgePoints,
            originalImageUrl,
            subjectId,
            geogebraCommands,
            explanationSource,
        } = body;

        // 图片大小校验：base64 数据超限直接拒绝
        if (typeof originalImageUrl === 'string' && originalImageUrl.length > MAX_IMAGE_DATA_LENGTH) {
            logger.warn({ size: originalImageUrl.length }, 'Image data exceeds size limit');
            return validationError("Image is too large. Please compress or crop the image before uploading.");
        }

        // 记录请求参数（不记录完整图片数据）
        logger.debug({
            hasQuestionText: !!questionText,
            questionTextLength: questionText?.length || 0,
            hasAnswerText: !!answerText,
            hasAnalysis: !!analysis,
            hasWrongAnswerText: !!wrongAnswerText,
            hasMistakeAnalysis: !!mistakeAnalysis,
            mistakeStatus,
            knowledgePointsCount: Array.isArray(knowledgePoints) ? knowledgePoints.length : 0,
            hasImage: !!originalImageUrl,
            imageSize: originalImageUrl?.length || 0,
            subjectId,
            hasGeogebraCommands: !!geogebraCommands,
        }, 'Request parameters received');

        // 查找用户
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
            logger.debug({ userId: user?.id, email: session.user.email }, 'User lookup result');
        } else {
            logger.warn('No session email found');
        }

        if (!user) {
            logger.warn({ sessionEmail: session?.user?.email }, 'User not found in DB');
            return unauthorized("No user found in DB");
        }

        // ========== 去重检查：2秒内同一用户提交相同题目视为重复 ==========
        const DEDUP_WINDOW_MS = 2000; // 2秒去重窗口
        const questionTextPrefix = questionText?.substring(0, 100) || ''; // 取前100字符比较

        if (questionTextPrefix) {
            const recentDuplicate = await prisma.errorItem.findFirst({
                where: {
                    userId: user.id,
                    questionText: {
                        startsWith: questionTextPrefix,
                    },
                    createdAt: {
                        gte: new Date(Date.now() - DEDUP_WINDOW_MS),
                    },
                },
                include: {
                    tags: true,
                },
            });

            if (recentDuplicate) {
                logger.info({
                    existingId: recentDuplicate.id,
                    userId: user.id,
                    timeDiff: Date.now() - recentDuplicate.createdAt.getTime()
                }, 'Duplicate submission detected within dedup window, returning existing record');

                return NextResponse.json({
                    ...recentDuplicate,
                    duplicate: true, // 标记为重复提交
                }, { status: 200 }); // 返回 200 而非 201
            }
        }

        // 处理知识点标签（挂到用户已有标签；无则建无父节点自定义标签）
        const tagNames: string[] = Array.isArray(knowledgePoints) ? knowledgePoints : [];
        const tagConnections: { id: string }[] = [];

        const subject = await prisma.subject.findUnique({ where: { id: subjectId || '' } });
        const subjectKey = inferSubjectFromName(subject?.name ?? null) || 'gongkao';
        logger.debug({ subjectId, subjectName: subject?.name, subjectKey }, 'Subject inferred');

        for (const tagName of tagNames) {
            try {
                const tagId = await resolveTagIdForErrorItem(user.id, tagName, subjectKey);
                tagConnections.push({ id: tagId });
            } catch (tagError) {
                logger.error({ tagName, error: tagError }, 'Error processing tag');
                throw tagError;
            }
        }

        logger.info({ tagNames, tagConnectionsCount: tagConnections.length }, 'Creating ErrorItem with tags');

        try {
            const errorItem = await prisma.errorItem.create({
                data: {
                    userId: user.id,
                    subjectId: subjectId || undefined,
                    originalImageUrl,
                    questionText,
                    answerText,
                    analysis,
                    explanationSource: typeof explanationSource === 'string' && ['ai', 'ocr'].includes(explanationSource) ? explanationSource : null,
                    wrongAnswerText: wrongAnswerText || null,
                    mistakeAnalysis: mistakeAnalysis || null,
                    mistakeStatus: normalizeMistakeStatusForSave(mistakeStatus, wrongAnswerText),
                    knowledgePoints: JSON.stringify(tagNames),
                    geogebraCommands: geogebraCommands || null,
                    masteryLevel: 0,
                    sourceType: "manual",
                    tags: {
                        connect: tagConnections,
                    },
                },
                include: {
                    tags: true,
                },
            });

            logger.info({ errorItemId: errorItem.id, tagsCount: errorItem.tags?.length || 0 }, 'ErrorItem created successfully');
            return NextResponse.json(errorItem, { status: 201 });
        } catch (dbError) {
            logger.error({
                error: dbError,
                userId: user.id,
                subjectId,
                tagConnectionsCount: tagConnections.length
            }, 'Database error creating ErrorItem');
            throw dbError;
        }
    } catch (error) {
        logger.error({
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
        }, 'Error saving item');
        return internalError("Failed to save error item");
    }
}
