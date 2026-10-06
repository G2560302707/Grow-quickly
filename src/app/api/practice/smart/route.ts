import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@grow/shared/ai";
import { unauthorized, badRequest, notFound, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { AI_SUBJECT_OPTIONS } from "@grow/shared/subjects";
import { buildWeaknessReport } from "@/lib/diagnosis";
import { buildTargetedAnchor, bigramSimilarity } from "@/lib/smart-practice";
import { replayElo, difficultyForRating } from "@/lib/elo";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:practice:smart');

const DIFFICULTIES = ["easy", "medium", "hard", "harder"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const DEDUP_THRESHOLD = 0.6; // 与既有题目的二元组 Jaccard 相似度上限
const ANCHOR_LIMIT = 4;

/**
 * POST /api/practice/smart
 * 薄弱点定向出题：给定考点（缺省时自动取诊断 Top1），检索用户该考点下
 * 权重最高的原错题+错因作为锚，走既有 generateSimilarQuestion 管道接地生成。
 * body: { tagId?: string, difficulty?: "easy"|"medium"|"hard"|"harder" }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return unauthorized("Authentication required");
    }

    // 限流：AI 接口按用户每分钟 10 次，防滥用与成本失控
    const aiLimit = rateLimit(`ai:practice-smart:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
    if (!aiLimit.allowed) {
        return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
    }

    try {
        const body = await req.json().catch(() => ({}));
        const requestedDifficulty = DIFFICULTIES.includes(body?.difficulty) ? body.difficulty as Difficulty : null;

        let user;
        if (session.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }
        if (!user) {
            return unauthorized("Authentication required");
        }

        // ---- 选定目标考点：显式指定，或取诊断 Top1 ----
        let tagId: string = typeof body?.tagId === "string" ? body.tagId : "";
        if (!tagId) {
            const [errorItems, practiceRecords] = await Promise.all([
                prisma.errorItem.findMany({
                    where: { userId: user.id },
                    select: { id: true, createdAt: true, masteryLevel: true, tags: { select: { id: true, name: true, parentId: true } } },
                }),
                prisma.practiceRecord.findMany({
                    where: { userId: user.id },
                    select: { tagId: true, difficulty: true, isCorrect: true, createdAt: true },
                }),
            ]);
            const report = buildWeaknessReport({ errorItems, practiceRecords });
            const top = report.topKps[0];
            if (!top) {
                return badRequest("薄弱点证据积累不足，请先在错题上补充知识点标签");
            }
            tagId = top.tagId;
        }

        const tag = await prisma.knowledgeTag.findFirst({
            where: { id: tagId, OR: [{ userId: user.id }, { isSystem: true }] },
            select: { id: true, name: true, parentId: true },
        });
        if (!tag) {
            return notFound("知识点不存在或不可访问");
        }

        // ---- 锚题检索：复习到期的错题优先，其余取最近、按掌握度降权 ----
        const dueReviews = await prisma.reviewSchedule.findMany({
            where: {
                completedAt: null,
                scheduledFor: { lte: new Date() },
                errorItem: { userId: user.id, tags: { some: { id: tagId } } },
            },
            orderBy: { scheduledFor: "asc" },
            take: ANCHOR_LIMIT,
            select: {
                errorItem: {
                    select: {
                        id: true,
                        questionText: true,
                        mistakeAnalysis: true,
                        masteryLevel: true,
                        gradeSemester: true,
                        subject: { select: { name: true } },
                    },
                },
            },
        });
        const dueItems = dueReviews.map(d => d.errorItem).filter(a => (a.questionText || "").trim().length > 0);

        const anchorItems = await prisma.errorItem.findMany({
            where: { userId: user.id, tags: { some: { id: tagId } } },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
                id: true,
                questionText: true,
                mistakeAnalysis: true,
                masteryLevel: true,
                gradeSemester: true,
                subject: { select: { name: true } },
            },
        });
        const dueIds = new Set(dueItems.map(d => d.id));
        const recentUsable = anchorItems
            .filter(a => (a.questionText || "").trim().length > 0 && !dueIds.has(a.id))
            .slice(0, ANCHOR_LIMIT - dueItems.length);
        const usable = [...dueItems, ...recentUsable].slice(0, ANCHOR_LIMIT);
        const primaryAnchor = usable[0] || null;

        // ---- 难度：显式指定 > Elo 回放该考点练习历史 ----
        const kpRecords = await prisma.practiceRecord.findMany({
            where: { userId: user.id, tagId },
            select: { difficulty: true, isCorrect: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
        const elo = replayElo(kpRecords);
        const difficulty: Difficulty = requestedDifficulty || difficultyForRating(elo.rating);

        // ---- 组装锚文本并复用现有生成管道 ----
        const anchorBrief = buildTargetedAnchor({
            tagName: tag.name,
            exemplars: usable.map(a => ({
                id: a.id,
                questionText: a.questionText,
                mistakeAnalysis: a.mistakeAnalysis,
                masteryLevel: a.masteryLevel,
            })),
        });

        // ---- 生成 + 去重：与锚题、近期生成题及题库存题做二元组相似度检查，超阈值带提示重生成一次 ----
        const existingQuestions = [
            ...usable.map(a => a.questionText || ""),
            ...(await prisma.practiceRecord.findMany({
                where: { userId: user.id, tagId, questionText: { not: null } },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: { questionText: true },
            })).map(p => p.questionText || ""),
            // 题库存量题（含待做）也参与去重：没做过的生成题同样不能重复生成，避免重复花钱
            ...(await prisma.practiceQuestion.findMany({
                where: { userId: user.id, tagId, status: { not: "discarded" } },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: { questionText: true },
            })).map(q => q.questionText),
        ].filter(q => q && q.trim().length > 0);

        const generateOnce = async (brief: string) =>
            getAIService().generateSimilarQuestion(brief, [tag.name], "zh", difficulty, primaryAnchor?.gradeSemester ?? null);

        let question = await generateOnce(anchorBrief);
        const maxSim = (text: string) =>
            existingQuestions.reduce((m, q) => Math.max(m, bigramSimilarity(text, q)), 0);

        let duplicated = maxSim(question.questionText || "") >= DEDUP_THRESHOLD;
        if (duplicated) {
            logger.info({ tagId }, 'Targeted question too similar to existing ones, regenerating once');
            question = await generateOnce(
                buildTargetedAnchor({
                    tagName: tag.name,
                    exemplars: usable.map(a => ({
                        id: a.id,
                        questionText: a.questionText,
                        mistakeAnalysis: a.mistakeAnalysis,
                        masteryLevel: a.masteryLevel,
                    })),
                    extraInstruction: "严禁与以下旧题在题干素材、数字或选项结构上重复：" + existingQuestions.slice(0, 3).map(q => q.slice(0, 80)).join("／"),
                })
            );
            duplicated = maxSim(question.questionText || "") >= DEDUP_THRESHOLD;
        }

        const subjectName = primaryAnchor?.subject?.name || "其他";
        question.subject = (AI_SUBJECT_OPTIONS as readonly string[]).includes(subjectName)
            ? subjectName as typeof AI_SUBJECT_OPTIONS[number]
            : "其他";

        // 生成即入库：题进待做题库（channel=smart），做不做都保留
        let questionId: string | null = null;
        if ((question.questionText || "").trim()) {
            const saved = await prisma.practiceQuestion.create({
                data: {
                    userId: user.id,
                    channel: "smart",
                    difficulty,
                    subject: subjectName,
                    tagId: tag.id,
                    errorItemId: primaryAnchor?.id ?? null,
                    questionText: question.questionText || "",
                    answerText: question.answerText ?? null,
                    analysis: question.analysis ?? null,
                    eloRating: Math.round(elo.rating),
                },
                select: { id: true },
            });
            questionId = saved.id;
        }

        return NextResponse.json({
            ...question,
            questionId,
            meta: {
                mode: "weakness",
                tagId: tag.id,
                tagName: tag.name,
                anchorCount: usable.length,
                primaryErrorItemId: primaryAnchor?.id ?? null,
                difficulty,
                difficultySource: requestedDifficulty ? "explicit" : "elo",
                elo: { rating: elo.rating, attempts: elo.attempts },
                source: dueItems.length > 0 ? "review_due" : "weakness",
                reviewCount: dueItems.length,
                duplicate: duplicated,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Error generating targeted practice');
        return internalError("Failed to generate targeted practice question");
    }
}
