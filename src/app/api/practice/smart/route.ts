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
import { pickBankQuestions } from "@/lib/bank-select";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const logger = createLogger('api:practice:smart');

const DIFFICULTIES = ["easy", "medium", "hard", "harder"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const DEDUP_THRESHOLD = 0.6; // 与既有题目的二元组 Jaccard 相似度上限
const ANCHOR_LIMIT = 4;

/**
 * POST /api/practice/smart
 * 薄弱点定向出题：给定考点（缺省时自动取诊断 Top1）。
 * 出题顺序：① 全局题库按考点子树+难度抽题（毫秒级、零 AI 成本）；② 库存不足的部分
 * 检索用户该考点下权重最高的原错题+错因作为锚，走既有 generateSimilarQuestion 管道接地生成。
 * body: { tagId?: string, difficulty?: "easy"|"medium"|"hard"|"harder", count?: number }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return unauthorized("Authentication required");
    }

    // 端点级宽松限流：题库抽题本身零 AI 成本，只防刷库；AI 严格限流在真正调 AI 前单独检查
    const endpointLimit = rateLimit(`practice-smart:${session.user?.email || "anon"}`, { limit: 30, windowMs: 60 * 1000 });
    if (!endpointLimit.allowed) {
        return tooManyRequests(endpointLimit.retryAfterSeconds, "请求过于频繁，请稍后再试");
    }

    /** AI 生成前的配额检查（题库命中不占用 AI 配额） */
    const ensureAiQuota = () => {
        const aiLimit = rateLimit(`ai:practice-smart:${session.user?.email || "anon"}`, { limit: 10, windowMs: 60 * 1000 });
        if (!aiLimit.allowed) return tooManyRequests(aiLimit.retryAfterSeconds, "AI 请求过于频繁，请稍后再试");
        return null;
    };

    try {
        const body = await req.json().catch(() => ({}));
        const requestedDifficulty = DIFFICULTIES.includes(body?.difficulty) ? body.difficulty as Difficulty : null;
        // 批量出题：count>1 时一次 AI 调用生成一组（会话模式），1 为默认单题
        const requestedCount = Math.min(Math.max(Math.round(Number(body?.count)) || 1, 1), 5);

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

        // ---- 难度：显式指定 > Elo 回放该考点练习历史 ----
        const kpRecords = await prisma.practiceRecord.findMany({
            where: { userId: user.id, tagId },
            select: { difficulty: true, isCorrect: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
        const elo = replayElo(kpRecords);
        const difficulty: Difficulty = requestedDifficulty || difficultyForRating(elo.rating);

        // ---- 题库优先：考点子树+难度抽题，命中部分即时可用，不足部分再走 AI ----
        const bankPicks = await pickBankQuestions({
            tagId: tag.id,
            userId: user.id,
            count: requestedCount,
            difficulty,
        });
        const bankShortfall = requestedCount - bankPicks.length;

        const eloSnapshot = { rating: elo.rating, attempts: elo.attempts };
        const bankMeta = (id: string | null) => ({
            mode: "weakness",
            tagId: tag.id,
            tagName: tag.name,
            anchorCount: 0,
            primaryErrorItemId: null,
            difficulty,
            difficultySource: requestedDifficulty ? "explicit" : "elo",
            elo: eloSnapshot,
            source: "bank",
            reviewCount: 0,
            duplicate: false,
            fromBank: true,
            bankQuestionId: id,
        });

        // ---- 题库完全覆盖（含单题模式）：直接落库返回，不碰 AI ----
        if (bankShortfall <= 0) {
            const items = [];
            for (const pick of bankPicks) {
                const saved = await prisma.practiceQuestion.create({
                    data: {
                        userId: user.id,
                        channel: "smart",
                        difficulty,
                        subject: (AI_SUBJECT_OPTIONS as readonly string[]).includes(pick.subject)
                            ? pick.subject as typeof AI_SUBJECT_OPTIONS[number]
                            : "其他",
                        tagId: tag.id,
                        bankQuestionId: pick.id,
                        questionText: pick.questionText,
                        answerText: pick.answerText,
                        analysis: pick.analysis,
                        eloRating: Math.round(elo.rating),
                    },
                    select: { id: true },
                });
                items.push({
                    questionText: pick.questionText,
                    answerText: pick.answerText ?? "需人工核对",
                    analysis: pick.analysis ?? "暂无解析",
                    subject: pick.subject,
                    knowledgePoints: [tag.name],
                    wrongAnswerText: "",
                    mistakeAnalysis: "",
                    mistakeStatus: "unknown",
                    requiresImage: false,
                    questionId: saved.id,
                    meta: bankMeta(pick.id),
                });
            }
            logger.info({ tagId, requested: requestedCount, fromBank: bankPicks.length }, 'Targeted practice fully served from question bank');
            return NextResponse.json({
                ...(requestedCount === 1 ? items[0] : {}),
                ...(requestedCount === 1 ? {} : { questions: items }),
                meta: requestedCount === 1 ? items[0].meta : {
                    requested: requestedCount,
                    returned: items.length,
                    tagId: tag.id,
                    tagName: tag.name,
                    difficulty,
                    difficultySource: requestedDifficulty ? "explicit" : "elo",
                    fromBank: true,
                },
            });
        }

        // ---- AI 兜底路径：先校验 AI 配额，再检索锚题 ----
        const aiQuotaError = ensureAiQuota();
        if (aiQuotaError) return aiQuotaError;

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

        const subjectName = primaryAnchor?.subject?.name || "其他";
        const normalizedSubject = (AI_SUBJECT_OPTIONS as readonly string[]).includes(subjectName)
            ? subjectName as typeof AI_SUBJECT_OPTIONS[number]
            : "其他" as typeof AI_SUBJECT_OPTIONS[number];

        /** 把题库抽中的题落库为待做练习题（channel=smart，关联 BankQuestion） */
        const createBankItems = async () => {
            const items = [];
            for (const pick of bankPicks) {
                const saved = await prisma.practiceQuestion.create({
                    data: {
                        userId: user.id,
                        channel: "smart",
                        difficulty,
                        subject: (AI_SUBJECT_OPTIONS as readonly string[]).includes(pick.subject)
                            ? pick.subject as typeof AI_SUBJECT_OPTIONS[number]
                            : "其他",
                        tagId: tag.id,
                        bankQuestionId: pick.id,
                        questionText: pick.questionText,
                        answerText: pick.answerText,
                        analysis: pick.analysis,
                        eloRating: Math.round(elo.rating),
                    },
                    select: { id: true },
                });
                items.push({
                    questionText: pick.questionText,
                    answerText: pick.answerText ?? "需人工核对",
                    analysis: pick.analysis ?? "暂无解析",
                    subject: pick.subject,
                    knowledgePoints: [tag.name],
                    wrongAnswerText: "",
                    mistakeAnalysis: "",
                    mistakeStatus: "unknown",
                    requiresImage: false,
                    questionId: saved.id,
                    meta: bankMeta(pick.id),
                });
            }
            return items;
        };

        // ---- 批量出题：一次 AI 调用生成缺口数量，批内互相去重，逐题入库 ----
        if (requestedCount > 1) {
            const generateBatch = async (brief: string) =>
                getAIService().generateSimilarQuestions(brief, [tag.name], "zh", difficulty, bankShortfall, primaryAnchor?.gradeSemester ?? null);

            let batch = await generateBatch(anchorBrief);
            let kept = batch.filter(q => {
                const t = (q.questionText || "").trim();
                return t && !existingQuestions.some(s => bigramSimilarity(t, s) >= DEDUP_THRESHOLD);
            });

            if (kept.length === 0) {
                logger.info({ tagId, count: bankShortfall }, 'Batch all duplicated, regenerating once with anti-dup instruction');
                batch = await generateBatch(buildTargetedAnchor({
                    tagName: tag.name,
                    exemplars: usable.map(a => ({
                        id: a.id,
                        questionText: a.questionText,
                        mistakeAnalysis: a.mistakeAnalysis,
                        masteryLevel: a.masteryLevel,
                    })),
                    extraInstruction: "严禁与以下旧题在题干素材、数字或选项结构上重复：" + existingQuestions.slice(0, 3).map(q => q.slice(0, 80)).join("／"),
                }));
                const seen = [...existingQuestions];
                kept = [];
                for (const q of batch) {
                    const t = (q.questionText || "").trim();
                    if (!t || seen.some(s => bigramSimilarity(t, s) >= DEDUP_THRESHOLD)) continue;
                    kept.push(q);
                    seen.push(t);
                }
            }

            const eloRating = Math.round(elo.rating);
            const aiQuestions = kept.map(q => ({
                ...q,
                subject: normalizedSubject,
            }));

            const bankItems = await createBankItems();

            // AI 生成题逐题入库（await 拿真实 id 供答题联动）
            const aiItems = [];
            for (const q of aiQuestions) {
                if ((q.questionText || "").trim()) {
                    const saved = await prisma.practiceQuestion.create({
                        data: {
                            userId: user.id,
                            channel: "smart",
                            difficulty,
                            subject: subjectName,
                            tagId: tag.id,
                            errorItemId: primaryAnchor?.id ?? null,
                            questionText: q.questionText || "",
                            answerText: q.answerText ?? null,
                            analysis: q.analysis ?? null,
                            eloRating,
                        },
                        select: { id: true },
                    });
                    aiItems.push({
                        ...q,
                        questionId: saved.id,
                        meta: {
                            mode: "weakness",
                            tagId: tag.id,
                            tagName: tag.name,
                            anchorCount: usable.length,
                            primaryErrorItemId: primaryAnchor?.id ?? null,
                            difficulty,
                            difficultySource: requestedDifficulty ? "explicit" : "elo",
                            elo: eloSnapshot,
                            source: dueItems.length > 0 ? "review_due" : "weakness",
                            duplicate: false,
                        },
                    });
                }
            }

            const items = [...bankItems, ...aiItems];
            logger.info({ tagId, requested: requestedCount, fromBank: bankItems.length, ai: aiItems.length }, 'Targeted practice generated (bank + AI)');
            return NextResponse.json({
                questions: items,
                meta: {
                    requested: requestedCount,
                    returned: items.length,
                    tagId: tag.id,
                    tagName: tag.name,
                    difficulty,
                    difficultySource: requestedDifficulty ? "explicit" : "elo",
                    fromBank: bankItems.length > 0,
                },
            });
        }

        // ---- 单题模式：题库未命中，AI 生成一道 ----
        const generateOnceSafe = (brief: string) =>
            getAIService().generateSimilarQuestion(brief, [tag.name], "zh", difficulty, primaryAnchor?.gradeSemester ?? null);

        let question = await generateOnceSafe(anchorBrief);
        const maxSim = (text: string) =>
            existingQuestions.reduce((m, q) => Math.max(m, bigramSimilarity(text, q)), 0);

        let duplicated = maxSim(question.questionText || "") >= DEDUP_THRESHOLD;
        if (duplicated) {
            logger.info({ tagId }, 'Targeted question too similar to existing ones, regenerating once');
            question = await generateOnceSafe(
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

        question.subject = normalizedSubject;

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
                elo: eloSnapshot,
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
