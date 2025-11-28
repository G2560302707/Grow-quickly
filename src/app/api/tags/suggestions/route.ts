import { NextResponse } from "next/server";
import { getAllStandardTags } from "@/lib/knowledge-tags";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tags/suggestions
 * 获取标签建议（支持搜索）
 * Query params: ?q=搜索词
 * 注意：自定义标签在客户端（TagInput组件）中合并
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.toLowerCase() || "";

        // 获取所有标准标签
        const standardTags = getAllStandardTags();

        // 获取所有已使用的标签（从数据库）
        const errorItems = await prisma.errorItem.findMany({
            select: {
                knowledgePoints: true,
            },
        });

        const usedTags = new Set<string>();
        errorItems.forEach((item: any) => {
            if (item.knowledgePoints && Array.isArray(item.knowledgePoints)) {
                (item.knowledgePoints as string[]).forEach((tag: string) => {
                    usedTags.add(tag);
                });
            }
        });

        // 合并标准标签和已使用标签
        const allTags = Array.from(new Set([
            ...standardTags,
            ...Array.from(usedTags)
        ]));

        // 如果有搜索词，过滤标签
        let suggestions = allTags;
        if (query) {
            suggestions = allTags.filter((tag) =>
                tag.toLowerCase().includes(query)
            );
        }

        // 限制返回数量
        const maxResults = 20;
        suggestions = suggestions.slice(0, maxResults);

        return NextResponse.json({
            suggestions,
            total: suggestions.length,
        });
    } catch (error) {
        console.error("Error getting tag suggestions:", error);
        return NextResponse.json(
            { message: "Failed to get tag suggestions" },
            { status: 500 }
        );
    }
}
