import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { inferSubjectFromName } from "@/lib/knowledge-tags";

const logger = createLogger('api:practice:record');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    try {
        const { subject, difficulty, isCorrect, errorItemId, tagId, questionText, answerText, analysis, knowledgePoints } = await req.json();

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
                answerText: typeof answerText === "string" ? answerText.slice(0, 4000) : null,
                analysis: typeof analysis === "string" ? analysis.slice(0, 12000) : null,
            },
        });

        // 练习答错自动收录错题本：AI 生成的练习题是一次性的，错题应沉淀进错题本并标注来源渠道
        let savedErrorItemId: string | null = null;
        if (isCorrect === false && typeof questionText === "string" && questionText.trim()) {
            try {
                savedErrorItemId = await saveWrongQuestionToNotebook({
                    userId,
                    subjectName: typeof subject === "string" ? subject : null,
                    questionText: questionText.slice(0, 2000),
                    answerText: typeof answerText === "string" ? answerText.slice(0, 4000) : null,
                    analysis: typeof analysis === "string" ? analysis.slice(0, 12000) : null,
                    origin: safeTagId ? "smart" : safeErrorItemId ? "similar" : "practice",
                    tagNames: Array.isArray(knowledgePoints)
                        ? knowledgePoints.filter((t): t is string => typeof t === "string").slice(0, 10)
                        : [],
                });
            } catch (saveError) {
                // 收录失败不阻塞练习记录本身
                logger.error({ error: saveError }, 'Failed to auto-save wrong practice question');
            }
        }

        return NextResponse.json({ ...record, savedErrorItemId });
    } catch (error) {
        logger.error({ error }, 'Error saving practice record');
        return internalError("Failed to save record");
    }
}

/**
 * 把答错的练习题沉淀为错题本条目（带来源渠道标注）。
 * 返回错题 ID；同用户同题干已收录过（练习渠道）时去重，返回已存在条目 ID。
 */
async function saveWrongQuestionToNotebook(input: {
    userId: string;
    subjectName: string | null;
    questionText: string;
    answerText: string | null;
    analysis: string | null;
    origin: "similar" | "smart" | "practice";
    tagNames: string[];
}): Promise<string> {
    const { userId, subjectName, questionText, answerText, analysis, origin, tagNames } = input;

    // 去重：同一题干已通过练习渠道收录过则不再重复创建
    const duplicate = await prisma.errorItem.findFirst({
        where: { userId, questionText, origin: { not: null } },
        select: { id: true },
    });
    if (duplicate) {
        return duplicate.id;
    }

    // 错题本（科目）find-or-create
    const name = subjectName?.trim() || "其他";
    const existingSubject = await prisma.subject.findFirst({
        where: { userId, name },
        select: { id: true },
    });
    const subjectId = existingSubject?.id
        ?? (await prisma.subject.create({ data: { userId, name }, select: { id: true } })).id;

    // 知识点标签 find-or-create（优先挂系统标签）
    const tagConnections: { id: string }[] = [];
    for (const rawName of tagNames) {
        const tagName = rawName.trim();
        if (!tagName) continue;
        let tag = await prisma.knowledgeTag.findFirst({
            where: { name: tagName, OR: [{ isSystem: true }, { userId }] },
            select: { id: true },
        });
        if (!tag) {
            tag = await prisma.knowledgeTag.create({
                data: {
                    name: tagName,
                    subject: inferSubjectFromName(name) || "other",
                    isSystem: false,
                    userId,
                },
                select: { id: true },
            });
        }
        tagConnections.push({ id: tag.id });
    }

    const item = await prisma.errorItem.create({
        data: {
            userId,
            subjectId,
            originalImageUrl: "",
            questionText,
            answerText,
            analysis,
            origin,
            mistakeStatus: "wrong_attempt",
            ...(tagConnections.length ? { tags: { connect: tagConnections } } : {}),
        },
        select: { id: true },
    });
    logger.info({ errorItemId: item.id, origin }, 'Wrong practice question saved to notebook');
    return item.id;
}
