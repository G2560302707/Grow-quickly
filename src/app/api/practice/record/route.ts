import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { inferSubjectFromName } from "@/lib/knowledge-tags";
import { isValidNotebookName } from "@/lib/name-validation";

const logger = createLogger('api:practice:record');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    try {
        const { subject, difficulty, isCorrect, errorItemId, tagId, questionId, questionText, answerText, analysis, knowledgePoints } = await req.json();

        // @ts-ignore
        const userId = session.user.id;

        // 题库关联校验：questionId 必须属于当前用户；命中时其归因（锚题/考点/渠道）作为本次作答的权威来源
        const ownedQuestion = typeof questionId === "string" && questionId
            ? await prisma.practiceQuestion.findFirst({
                  where: { id: questionId, userId },
                  select: { id: true, channel: true, tagId: true, errorItemId: true, bankQuestionId: true },
              })
            : null;

        // 归因字段校验：仅接受属于当前用户的锚题 / 可访问的考点；非法值静默置空，不影响记录本身
        // 传了题库 questionId 时优先用题库上的归因，客户端显式传参作为兜底
        let safeErrorItemId: string | null = ownedQuestion?.errorItemId ?? null;
        if (!safeErrorItemId && typeof errorItemId === "string" && errorItemId) {
            const owned = await prisma.errorItem.findFirst({
                where: { id: errorItemId, userId },
                select: { id: true },
            });
            safeErrorItemId = owned?.id ?? null;
        }

        let safeTagId: string | null = ownedQuestion?.tagId ?? null;
        if (!safeTagId && typeof tagId === "string" && tagId) {
            const tag = await prisma.knowledgeTag.findFirst({
                where: { id: tagId, OR: [{ userId }, { isSystem: true }] },
                select: { id: true },
            });
            safeTagId = tag?.id ?? null;
        }

        // 渠道固化：题库题自带渠道；否则按归因推导（tagId → 薄弱点专项，errorItemId → 举一反三，其余 → 自由练习）
        const channel = ownedQuestion?.channel ?? (safeTagId ? "smart" : safeErrorItemId ? "similar" : "free");

        const record = await prisma.$transaction(async (tx) => {
            const created = await tx.practiceRecord.create({
                data: {
                    userId,
                    subject,
                    difficulty,
                    isCorrect,
                    errorItemId: safeErrorItemId,
                    tagId: safeTagId,
                    channel,
                    questionId: ownedQuestion?.id ?? null,
                    questionText: typeof questionText === "string" ? questionText.slice(0, 2000) : null,
                    answerText: typeof answerText === "string" ? answerText.slice(0, 4000) : null,
                    analysis: typeof analysis === "string" ? analysis.slice(0, 12000) : null,
                },
            });

            // 题库题随作答落定生命周期：pending -> answered
            if (ownedQuestion) {
                await tx.practiceQuestion.update({
                    where: { id: ownedQuestion.id },
                    data: {
                        status: "answered",
                        isCorrect: typeof isCorrect === "boolean" ? isCorrect : null,
                        answeredAt: new Date(),
                    },
                });
            }

            // 全局题库题作答统计回写：供管理端按真实正确率校准难度
            if (ownedQuestion?.bankQuestionId) {
                await tx.bankQuestion.update({
                    where: { id: ownedQuestion.bankQuestionId },
                    data: {
                        attemptCount: { increment: 1 },
                        ...(isCorrect === true ? { correctCount: { increment: 1 } } : {}),
                    },
                });
            }

            return created;
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
    // 编码校验：LLM 返回的科目名若含 U+FFFD 等解码损坏标记，回退到「其他」而非建脏错题本
    const name = isValidNotebookName(subjectName) ? subjectName.trim() : "其他";
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
            sourceType: "practice", // 练习答错自动收录的题在数据大类上归属"练习收录"
            mistakeStatus: "wrong_attempt",
            ...(tagConnections.length ? { tags: { connect: tagConnections } } : {}),
        },
        select: { id: true },
    });
    logger.info({ errorItemId: item.id, origin }, 'Wrong practice question saved to notebook');
    return item.id;
}
