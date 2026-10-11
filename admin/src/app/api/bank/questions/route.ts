import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, notFound, badRequest, conflict, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { hashQuestionText, normalizeDifficulty, normalizeQuestionType } from "@grow/shared/bank-utils";

const logger = createLogger("api:bank:questions");

const STATUSES = ["raw", "parse_lock", "pending", "published", "disabled"] as const;

/**
 * GET /api/bank/questions
 * 题库题目列表（审核工作区）。过滤：status/subject/difficulty/duplicate/batchId/q 关键词。
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status") || "pending";
        const status = (STATUSES as readonly string[]).includes(statusParam) || statusParam === "all" ? statusParam : "pending";
        const subject = searchParams.get("subject") || null;
        const difficulty = searchParams.get("difficulty") || null;
        const batchId = searchParams.get("batchId") || null;
        const duplicateOnly = searchParams.get("duplicate") === "true";
        const q = (searchParams.get("q") || "").trim();
        const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20));

        const where = {
            ...(status !== "all" ? { status } : {}),
            ...(subject ? { subject } : {}),
            ...(difficulty ? { difficulty } : {}),
            ...(batchId ? { importBatchId: batchId } : {}),
            ...(duplicateOnly ? { duplicateOf: { not: null } } : {}),
            ...(q ? { questionText: { contains: q } } : {}),
        };

        const [total, statusCounts, questions] = await Promise.all([
            prisma.bankQuestion.count({ where }),
            prisma.bankQuestion.groupBy({ by: ["status"], _count: { _all: true } }),
            prisma.bankQuestion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    subject: true,
                    difficulty: true,
                    questionType: true,
                    questionText: true,
                    answerText: true,
                    analysis: true,
                    requiresImage: true,
                    source: true,
                    status: true,
                    duplicateOf: true,
                    confidence: true,
                    rawText: true,
                    attemptCount: true,
                    correctCount: true,
                    createdAt: true,
                    primaryTag: { select: { id: true, name: true, parentId: true } },
                    importBatch: { select: { id: true, name: true } },
                },
            }),
        ]);

        const counts: Record<string, number> = {};
        for (const row of statusCounts) counts[row.status] = row._count._all;

        return NextResponse.json({
            total,
            page,
            pageSize,
            counts,
            items: questions.map(item => ({
                ...item,
                rawText: item.status === "raw" ? item.rawText : null, // 已解析的题不再回传大段原文
            })),
        });
    } catch (error) {
        logger.error({ error }, "Error listing bank questions");
        return internalError("Failed to list bank questions");
    }
}

/**
 * PATCH /api/bank/questions
 * 编辑题库题（题干/答案/解析/分类/难度/考点/状态）。改题干会重算 contentHash。
 */
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const body = await req.json().catch(() => null);
        const id = typeof body?.id === "string" ? body.id : "";
        if (!id) return badRequest("id is required");

        const existing = await prisma.bankQuestion.findUnique({ where: { id } });
        if (!existing) return notFound("题目不存在");

        const data: Record<string, unknown> = {};

        if (typeof body.questionText === "string" && body.questionText.trim()) {
            data.questionText = body.questionText.trim();
            data.contentHash = hashQuestionText(body.questionText);
        }
        if (typeof body.answerText === "string") data.answerText = body.answerText.trim() || "需人工核对";
        if (typeof body.analysis === "string") data.analysis = body.analysis.trim() || null;
        if (typeof body.subject === "string" && body.subject.trim()) data.subject = body.subject.trim();
        if (typeof body.difficulty === "string") {
            const d = normalizeDifficulty(body.difficulty);
            if (!d) return badRequest("非法难度值");
            data.difficulty = d;
        }
        if (typeof body.questionType === "string") data.questionType = normalizeQuestionType(body.questionType);
        if (typeof body.requiresImage === "boolean") data.requiresImage = body.requiresImage;
        if (typeof body.primaryTagId === "string" || body.primaryTagId === null) {
            if (body.primaryTagId) {
                const tag = await prisma.knowledgeTag.findFirst({
                    where: { id: body.primaryTagId, subject: "gongkao", isSystem: true },
                    select: { id: true },
                });
                if (!tag) return badRequest("考点标签不存在");
                data.primaryTagId = tag.id;
            } else {
                data.primaryTagId = null;
            }
        }
        if (Array.isArray(body.extraTagIds)) {
            const validIds: string[] = [];
            for (const tagId of body.extraTagIds.slice(0, 4)) {
                if (typeof tagId !== "string") continue;
                const tag = await prisma.knowledgeTag.findFirst({
                    where: { id: tagId, subject: "gongkao", isSystem: true },
                    select: { id: true },
                });
                if (tag) validIds.push(tag.id);
            }
            data.extraTagIds = validIds.length ? JSON.stringify(validIds) : null;
        }
        if (typeof body.status === "string") {
            if (!(STATUSES as readonly string[]).includes(body.status)) return badRequest("非法状态值");
            const nextStatus = body.status;
            if (nextStatus === "published") {
                const tagId = (data.primaryTagId as string | undefined) ?? existing.primaryTagId;
                if (!tagId) return badRequest("发布前需要先指定考点标签");
                const qText = (data.questionText as string | undefined) ?? existing.questionText;
                if (!qText.trim()) return badRequest("题目内容为空，无法发布");
            }
            data.status = nextStatus;
        }

        // 改了题干时防精确重复
        if (data.contentHash && data.contentHash !== existing.contentHash) {
            const dup = await prisma.bankQuestion.findFirst({
                where: { contentHash: data.contentHash as string, id: { not: id } },
                select: { id: true },
            });
            if (dup) return conflict("题库中已存在相同题干的题目");
        }

        const updated = await prisma.bankQuestion.update({
            where: { id },
            data,
            select: { id: true, status: true, primaryTagId: true },
        });
        return NextResponse.json(updated);
    } catch (error) {
        logger.error({ error }, "Error updating bank question");
        return internalError("Failed to update bank question");
    }
}

/**
 * DELETE /api/bank/questions?id=xxx
 * 删除题库题（raw/待审或已下架均可删；已发布且有作答统计的题建议下架而不是删除）
 */
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const id = new URL(req.url).searchParams.get("id");
        if (!id) return badRequest("id is required");
        const existing = await prisma.bankQuestion.findUnique({
            where: { id },
            select: { id: true, attemptCount: true },
        });
        if (!existing) return notFound("题目不存在");
        if (existing.attemptCount > 0) {
            return badRequest("该题已有用户作答记录，建议改为下架（disabled）而不是删除");
        }
        await prisma.bankQuestion.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        logger.error({ error }, "Error deleting bank question");
        return internalError("Failed to delete bank question");
    }
}
