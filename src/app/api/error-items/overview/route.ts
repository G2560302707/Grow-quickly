import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger('api:error-items:overview');

export const dynamic = "force-dynamic";

/**
 * GET /api/error-items/overview
 * 学习概览聚合统计（移动端首页/我的页使用）：
 * 累计错题、掌握度分布（0 未掌握 / 1 复习中 / 2+ 已掌握）、错题本数量、本周新增
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);

        const [masteryGroups, notebookCount, weekAdded] = await Promise.all([
            prisma.errorItem.groupBy({
                by: ["masteryLevel"],
                where: { userId: user.id },
                _count: { _all: true },
            }),
            prisma.subject.count({ where: { userId: user.id } }),
            prisma.errorItem.count({
                where: { userId: user.id, createdAt: { gte: weekStart } },
            }),
        ]);

        let totalItems = 0;
        let unmastered = 0;
        let reviewing = 0;
        let mastered = 0;

        for (const group of masteryGroups) {
            const count = group._count._all;
            totalItems += count;
            if (group.masteryLevel >= 2) {
                mastered += count;
            } else if (group.masteryLevel === 1) {
                reviewing += count;
            } else {
                unmastered += count;
            }
        }

        const masteryRate = totalItems > 0 ? Math.round((mastered / totalItems) * 100) : 0;

        return NextResponse.json({
            totalItems,
            unmastered,
            reviewing,
            mastered,
            masteryRate,
            notebookCount,
            weekAdded,
        });
    } catch (error) {
        logger.error({ error }, 'Error fetching overview stats');
        return internalError("Failed to fetch overview stats");
    }
}
