import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, badRequest, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger("api:bank:questions:batch");

const ACTIONS = ["publish", "disable", "pending", "delete"] as const;

/**
 * POST /api/bank/questions/batch  body: { ids: string[], action: publish|disable|pending|delete }
 * 批量审核操作：发布（仅 pending/parse_lock/raw 中已有考点的题）、下架、退回待审、删除。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const body = await req.json().catch(() => null);
        const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
        const action = typeof body?.action === "string" ? body.action : "";
        if (ids.length === 0) return badRequest("ids is required");
        if (ids.length > 200) return badRequest("单次批量操作最多 200 题");
        if (!(ACTIONS as readonly string[]).includes(action)) return badRequest("非法操作");

        if (action === "delete") {
            // 已有作答统计的题不允许删（会被 PracticeQuestion 引用），仅删无作答的
            const result = await prisma.bankQuestion.deleteMany({
                where: { id: { in: ids }, attemptCount: 0 },
            });
            const skipped = ids.length - result.count;
            return NextResponse.json({ ok: true, affected: result.count, skipped });
        }

        if (action === "publish") {
            // 无考点的题发布没有意义（出题按考点检索），先统计后拒绝并提示
            const tagless = await prisma.bankQuestion.count({
                where: { id: { in: ids }, primaryTagId: null },
            });
            if (tagless > 0) {
                return badRequest(`${tagless} 题尚未指定考点标签，请先编辑指定后再发布`);
            }
            const result = await prisma.bankQuestion.updateMany({
                where: { id: { in: ids }, status: { not: "published" } },
                data: { status: "published" },
            });
            return NextResponse.json({ ok: true, affected: result.count });
        }

        const nextStatus = action === "disable" ? "disabled" : "pending";
        const result = await prisma.bankQuestion.updateMany({
            where: { id: { in: ids } },
            data: { status: nextStatus },
        });
        return NextResponse.json({ ok: true, affected: result.count });
    } catch (error) {
        logger.error({ error }, "Error batch updating bank questions");
        return internalError("Failed to batch update bank questions");
    }
}
