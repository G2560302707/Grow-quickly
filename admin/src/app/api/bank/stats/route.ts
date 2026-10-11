import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { loadGongkaoLeaves } from "@/lib/bank";

const logger = createLogger("api:bank:stats");

/**
 * GET /api/bank/stats
 * 覆盖度统计：各模块 × 状态的题量、已发布题的难度分布、各考点已发布题数（缺口一目了然）。
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const [statusRows, difficultyRows, tagRows, leaves] = await Promise.all([
            prisma.bankQuestion.groupBy({
                by: ["subject", "status"],
                _count: { _all: true },
            }),
            prisma.bankQuestion.groupBy({
                by: ["subject", "difficulty"],
                where: { status: "published" },
                _count: { _all: true },
            }),
            prisma.bankQuestion.groupBy({
                by: ["primaryTagId"],
                where: { status: "published", primaryTagId: { not: null } },
                _count: { _all: true },
            }),
            loadGongkaoLeaves(),
        ]);

        const subjects = ["言语理解", "判断推理", "数量关系", "资料分析", "常识判断"];

        const bySubject = subjects.map(subject => {
            const counts: Record<string, number> = { raw: 0, pending: 0, published: 0, disabled: 0 };
            for (const row of statusRows) {
                if (row.subject === subject) counts[row.status] = row._count._all;
            }
            const difficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0, harder: 0 };
            for (const row of difficultyRows) {
                if (row.subject === subject) difficulty[row.difficulty] = row._count._all;
            }
            return { subject, counts, difficulty };
        });

        // 叶子考点 → 一级考点聚合（出题按考点子树检索，一级考点是主要维度）
        const leafIdToPoint = new Map(leaves.map(l => [l.id, l]));
        const byPoint: Record<string, number> = {};
        for (const leaf of leaves) {
            byPoint[leaf.pointName] = byPoint[leaf.pointName] || 0;
        }
        for (const row of tagRows) {
            const leaf = row.primaryTagId ? leafIdToPoint.get(row.primaryTagId) : null;
            if (leaf) byPoint[leaf.pointName] = (byPoint[leaf.pointName] || 0) + row._count._all;
        }

        return NextResponse.json({ bySubject, byPoint });
    } catch (error) {
        logger.error({ error }, "Error loading bank stats");
        return internalError("Failed to load bank stats");
    }
}
