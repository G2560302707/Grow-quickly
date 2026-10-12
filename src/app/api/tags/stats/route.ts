import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger("api:tags:stats");

export const dynamic = "force-dynamic";

/**
 * GET /api/tags/stats
 * 按 ErrorItem.tags（个人考点）统计使用次数；不再读旧 knowledgePoints JSON。
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return unauthorized();
        }
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!user) return unauthorized();

        const items = await prisma.errorItem.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                tags: { select: { id: true, name: true } },
            },
        });

        const tagStats: Record<string, { tag: string; tagId: string; count: number }> = {};
        let untagged = 0;

        for (const item of items) {
            if (!item.tags.length) {
                untagged++;
                continue;
            }
            for (const t of item.tags) {
                const cur = tagStats[t.id];
                if (cur) cur.count += 1;
                else tagStats[t.id] = { tag: t.name, tagId: t.id, count: 1 };
            }
        }

        const sortedStats = Object.values(tagStats).sort((a, b) => b.count - a.count);

        return NextResponse.json({
            stats: sortedStats,
            total: items.length,
            uniqueTags: sortedStats.length,
            untagged,
        });
    } catch (error) {
        logger.error({ error }, "Error getting tag stats");
        return internalError("Failed to get tag statistics");
    }
}
