/**
 * 题库抽题（学习端）：薄弱点专项出题时优先从全局题库检索，
 * 命中即毫秒返回、零 AI 成本；未命中由调用方回退现有 AI 生成管道。
 */
import { prisma } from "@grow/shared/prisma";
import { adjacentDifficulties } from "@grow/shared/bank-utils";

/** 收集考点及其全部子孙考点 id（题库按考点子树检索） */
export async function collectTagSubtreeIds(rootTagId: string): Promise<string[]> {
    const tags = await prisma.knowledgeTag.findMany({
        select: { id: true, parentId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const t of tags) {
        if (!t.parentId) continue;
        const list = childrenOf.get(t.parentId) || [];
        list.push(t.id);
        childrenOf.set(t.parentId, list);
    }
    const out = [rootTagId];
    const queue = [rootTagId];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const child of childrenOf.get(cur) || []) {
            out.push(child);
            queue.push(child);
        }
    }
    return out;
}

export interface BankPick {
    id: string;
    subject: string;
    difficulty: string;
    questionText: string;
    answerText: string | null;
    analysis: string | null;
}

/**
 * 从全局题库抽题：考点子树 ∩ 已发布 ∩ 单选 ∩ 非图形题 ∩ 难度±一档 ∩ 用户没做过。
 * 随机抽样避免固定顺序；返回条数可能少于 count（题库存量不足时由 AI 兜底）。
 */
export async function pickBankQuestions(opts: {
    tagId: string;
    userId: string;
    count: number;
    difficulty: string;
}): Promise<BankPick[]> {
    const [subtreeIds, doneRows] = await Promise.all([
        collectTagSubtreeIds(opts.tagId),
        prisma.practiceQuestion.findMany({
            where: { userId: opts.userId, bankQuestionId: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 500,
            select: { bankQuestionId: true },
        }),
    ]);
    const excludeIds = doneRows.map(r => r.bankQuestionId).filter((x): x is string => !!x);

    const candidates = await prisma.bankQuestion.findMany({
        where: {
            primaryTagId: { in: subtreeIds },
            status: "published",
            requiresImage: false,
            questionType: "single",
            difficulty: { in: adjacentDifficulties(opts.difficulty) },
            ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: Math.max(opts.count * 3, 10),
        select: {
            id: true,
            subject: true,
            difficulty: true,
            questionText: true,
            answerText: true,
            analysis: true,
        },
    });
    if (candidates.length === 0) return [];

    // 洗牌后取前 count 题（池内轮转）
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, opts.count);
}
