import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tags/stats
 * 获取标签使用频率统计
 */
export async function GET(req: Request) {
    try {
        // 获取所有错题的知识点
        const errorItems = await prisma.errorItem.findMany({
            select: {
                knowledgePoints: true,
            },
        });

        // 统计标签使用频率
        const tagStats: Record<string, number> = {};

        errorItems.forEach((item: any) => {
            if (item.knowledgePoints && Array.isArray(item.knowledgePoints)) {
                (item.knowledgePoints as string[]).forEach((tag: string) => {
                    tagStats[tag] = (tagStats[tag] || 0) + 1;
                });
            }
        });

        // 转换为数组并按使用次数排序
        const sortedStats = Object.entries(tagStats)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

        return NextResponse.json({
            stats: sortedStats,
            total: errorItems.length,
            uniqueTags: sortedStats.length,
        });
    } catch (error) {
        console.error("Error getting tag stats:", error);
        return NextResponse.json(
            { message: "Failed to get tag statistics" },
            { status: 500 }
        );
    }
}
