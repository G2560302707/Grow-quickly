import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLogger } from "@grow/shared/logger";
import { listUserTags, selectableTagNames } from "@/lib/user-tag-tree";

const logger = createLogger("api:tags:suggestions");

/**
 * GET /api/tags/suggestions
 * 从当前用户个人考点树的可选叶子中建议标签。
 * Query: q=搜索词
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ suggestions: [], total: 0 }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = (searchParams.get("q") || "").trim().toLowerCase();

        const tags = await listUserTags(session.user.id);
        let leaves = selectableTagNames(tags);

        if (query) {
            leaves = leaves.filter((t) => t.name.toLowerCase().includes(query));
        }

        const suggestions = leaves.slice(0, 30).map((t) => t.name);

        return NextResponse.json({
            suggestions,
            total: leaves.length,
            needsImport: tags.length === 0,
        });
    } catch (error) {
        logger.error({ error }, "Error getting tag suggestions");
        return NextResponse.json({ message: "Failed to get tag suggestions" }, { status: 500 });
    }
}
