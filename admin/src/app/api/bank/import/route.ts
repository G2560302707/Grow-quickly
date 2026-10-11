import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { splitQuestionBlocks } from "@grow/shared/bank-utils";

const logger = createLogger("api:bank:import");

const MAX_RAW_TEXT_CHARS = 400_000;

/**
 * POST /api/bank/import
 * 创建导入批次：把粘贴/上传的题册文本按题号切分，逐题建 raw 状态的 BankQuestion 行。
 * body: { name: string, rawText: string, source?: string, autoPublish?: boolean }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const body = await req.json().catch(() => null);
        const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "粘贴导入";
        const source = typeof body?.source === "string" ? body.source.trim().slice(0, 200) : null;
        const rawText = typeof body?.rawText === "string" ? body.rawText : "";
        const autoPublish = body?.autoPublish !== false; // 默认直接发布（低置信度/疑似重复仍强制待审）

        if (rawText.trim().length < 30) {
            return badRequest("题目文本太短，请粘贴完整的题目内容");
        }
        if (rawText.length > MAX_RAW_TEXT_CHARS) {
            return badRequest(`文本过长（${rawText.length} 字符），单次导入上限 ${MAX_RAW_TEXT_CHARS} 字符，请分批导入`);
        }

        const blocks = splitQuestionBlocks(rawText);
        if (blocks.length === 0) {
            return badRequest("未能从文本中切分出题目，请检查题号格式（如 1. 2、12．）");
        }

        const batch = await prisma.bankImportBatch.create({
            data: {
                name,
                source,
                rawText,
                autoPublish,
                totalCount: blocks.length,
                status: "parsing",
            },
            select: { id: true },
        });

        await prisma.bankQuestion.createMany({
            data: blocks.map(block => ({
                rawText: block,
                source,
                status: "raw",
                importBatchId: batch.id,
            })),
        });

        logger.info({ batchId: batch.id, blocks: blocks.length, name }, "Bank import batch created");
        return NextResponse.json({ batchId: batch.id, totalCount: blocks.length });
    } catch (error) {
        logger.error({ error }, "Error creating bank import batch");
        return internalError("Failed to create import batch");
    }
}

/**
 * GET /api/bank/import
 * 导入批次列表（含各状态题量进度，供续跑解析）
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const batches = await prisma.bankImportBatch.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                name: true,
                source: true,
                totalCount: true,
                autoPublish: true,
                status: true,
                createdAt: true,
                _count: { select: { questions: true } },
            },
        });

        const progressRows = await prisma.bankQuestion.groupBy({
            by: ["importBatchId", "status"],
            where: { importBatchId: { in: batches.map(b => b.id) } },
            _count: { _all: true },
        });

        const items = batches.map(batch => {
            const counts: Record<string, number> = { raw: 0, pending: 0, published: 0, disabled: 0 };
            for (const row of progressRows) {
                if (row.importBatchId === batch.id) counts[row.status] = row._count._all;
            }
            return {
                id: batch.id,
                name: batch.name,
                source: batch.source,
                totalCount: batch.totalCount,
                autoPublish: batch.autoPublish,
                status: batch.status,
                createdAt: batch.createdAt,
                progress: counts,
            };
        });

        return NextResponse.json({ items });
    } catch (error) {
        logger.error({ error }, "Error listing bank import batches");
        return internalError("Failed to list import batches");
    }
}
