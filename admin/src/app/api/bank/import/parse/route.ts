import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, notFound, badRequest, internalError } from "@grow/shared/api-errors";

/** 管理端本地 429 响应（shared/api-errors 未提供 tooManyRequests） */
function tooManyRequests(retryAfterSeconds: number, message: string) {
    return NextResponse.json(
        { message, code: "TOO_MANY_REQUESTS" },
        { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } },
    );
}
import { createLogger } from "@grow/shared/logger";
import { getAIService } from "@grow/shared/ai";
import {
    BANK_SUBJECTS,
    adjacentDifficulties,
    bigramSimilarity,
    hashQuestionText,
    normalizeDifficulty,
    normalizeQuestionType,
} from "@grow/shared/bank-utils";
import { loadGongkaoLeaves, resolveGongkaoTagIds, adminRateLimit } from "@/lib/bank";

const logger = createLogger("api:bank:import:parse");

const DEDUP_SIMILARITY_THRESHOLD = 0.6; // 与库内既有题的二元组相似度上限（超过判疑似重复）
const NEAR_DUP_CANDIDATES = 100;        // 近重复比对的同科目候选题池

/** 批次内各状态题量 */
async function progressOf(batchId: string) {
    const rows = await prisma.bankQuestion.groupBy({
        by: ["status"],
        where: { importBatchId: batchId },
        _count: { _all: true },
    });
    const progress: Record<string, number> = { raw: 0, parse_lock: 0, pending: 0, published: 0, disabled: 0 };
    for (const r of rows) progress[r.status] = r._count._all;
    return progress;
}

/**
 * POST /api/bank/import/parse  body: { batchId: string, batchSize?: number }
 * 推进一轮解析：取下一批 raw 切片 → AI 批量整理 → 分类/去重/落库。
 * 客户端循环调用直到 done=true；中断后可继续（raw 行还在）。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    const limit = adminRateLimit(`bank-parse:${session?.user?.email || "anon"}`, 40, 60 * 1000);
    if (!limit.allowed) {
        return tooManyRequests(limit.retryAfterSeconds, "解析请求过于频繁，请稍后再试");
    }

    let batchId = "";
    let batchSize = 4;
    try {
        const body = await req.json().catch(() => ({}));
        batchId = typeof body?.batchId === "string" ? body.batchId : "";
        batchSize = Math.min(Math.max(Number(body?.batchSize) || 4, 1), 8);
        if (!batchId) return badRequest("batchId is required");

        const batch = await prisma.bankImportBatch.findUnique({ where: { id: batchId } });
        if (!batch) return notFound("导入批次不存在");

        // 自愈：上次调用中断遗留的 parse_lock 行解锁重排
        await prisma.bankQuestion.updateMany({
            where: { importBatchId: batchId, status: "parse_lock" },
            data: { status: "raw" },
        });

        const rows = await prisma.bankQuestion.findMany({
            where: { importBatchId: batchId, status: "raw" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: batchSize,
            select: { id: true, rawText: true },
        });

        if (rows.length === 0) {
            await prisma.bankImportBatch.update({ where: { id: batchId }, data: { status: "parsed" } });
            return NextResponse.json({ done: true, progress: await progressOf(batchId) });
        }

        // 抢占式加锁：并发调用时后到者拿不到行，直接返回当前进度
        const claimed = await prisma.bankQuestion.updateMany({
            where: { id: { in: rows.map(r => r.id) }, status: "raw" },
            data: { status: "parse_lock" },
        });
        if (claimed.count === 0) {
            return NextResponse.json({ done: false, progress: await progressOf(batchId), busy: true });
        }

        try {
            const leaves = await loadGongkaoLeaves();
            const tagNames = Array.from(new Set(leaves.map(l => l.name)));

            const items = await getAIService().parseBankQuestions(
                rows.map(r => r.rawText || ""),
                tagNames,
            );

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // 优先按 AI 回传的 index 对位，失败时按顺序兜底
                const item = items.find(x => x.index === i + 1) ?? items[i];
                if (!item || !item.questionText?.trim()) {
                    // 该切片解析失败：保留原文进待审，由人工处理
                    await prisma.bankQuestion.update({
                        where: { id: row.id },
                        data: {
                            status: "pending",
                            questionText: (row.rawText || "").slice(0, 4000),
                            confidence: "low",
                        },
                    });
                    continue;
                }

                const subject = (BANK_SUBJECTS as readonly string[]).includes(item.subject) ? item.subject : "其他";
                const difficulty = normalizeDifficulty(item.difficulty) ?? "medium";
                const questionType = normalizeQuestionType(item.questionType);

                // 考点解析：主考点解析失败则强制进待审
                const tagIdMap = await resolveGongkaoTagIds([item.primaryTag, ...item.extraTags]);
                const primaryTagId = tagIdMap.get(item.primaryTag) ?? null;
                const extraTagIds = item.extraTags.map(n => tagIdMap.get(n)).filter((x): x is string => !!x);

                // 去重：contentHash 精确重复 → bigram 近重复
                const contentHash = hashQuestionText(item.questionText);
                const exactDup = await prisma.bankQuestion.findFirst({
                    where: { contentHash, id: { not: row.id } },
                    select: { id: true, questionText: true },
                });
                let duplicateOf = exactDup?.id ?? null;
                if (!duplicateOf) {
                    const candidates = await prisma.bankQuestion.findMany({
                        where: { subject, status: { in: ["pending", "published"] }, id: { not: row.id } },
                        orderBy: { createdAt: "desc" },
                        take: NEAR_DUP_CANDIDATES,
                        select: { id: true, questionText: true },
                    });
                    let bestId: string | null = null;
                    let bestSim = 0;
                    for (const c of candidates) {
                        const sim = bigramSimilarity(item.questionText, c.questionText || "");
                        if (sim > bestSim) {
                            bestSim = sim;
                            bestId = c.id;
                        }
                    }
                    if (bestSim >= DEDUP_SIMILARITY_THRESHOLD && bestId) duplicateOf = bestId;
                }

                const canAutoPublish =
                    batch.autoPublish &&
                    item.confidence !== "low" &&
                    !duplicateOf &&
                    !!primaryTagId;

                await prisma.bankQuestion.update({
                    where: { id: row.id },
                    data: {
                        questionText: item.questionText,
                        answerText: item.answerText || "需人工核对",
                        analysis: item.analysis || null,
                        subject,
                        primaryTagId,
                        extraTagIds: extraTagIds.length ? JSON.stringify(extraTagIds) : null,
                        difficulty,
                        questionType,
                        requiresImage: item.requiresImage,
                        confidence: item.confidence,
                        contentHash,
                        duplicateOf,
                        status: canAutoPublish ? "published" : "pending",
                    },
                });
            }

            return NextResponse.json({ done: false, progress: await progressOf(batchId) });
        } catch (error) {
            // 解析失败：解锁这批行回到 raw，等待重试
            await prisma.bankQuestion.updateMany({
                where: { id: { in: rows.map(r => r.id) }, status: "parse_lock" },
                data: { status: "raw" },
            });
            throw error;
        }
    } catch (error) {
        logger.error({ error, batchId }, "Error parsing bank batch");
        return internalError("AI 解析失败，本批已回滚为待解析，请重试");
    }
}
