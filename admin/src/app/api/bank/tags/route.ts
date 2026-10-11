import { NextResponse } from "next/server";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { unauthorized, forbidden, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";

const logger = createLogger("api:bank:tags");

/**
 * GET /api/bank/tags
 * 行测考点标签树（编辑题库题时选考点用）：模块 → 一级考点 → 二级叶子。
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!requireAdmin(session)) {
        return session ? forbidden("Admin access required") : unauthorized("Authentication required");
    }

    try {
        const tags = await prisma.knowledgeTag.findMany({
            where: { subject: "gongkao", isSystem: true },
            select: { id: true, name: true, parentId: true },
            orderBy: { order: "asc" },
        });

        const byId = new Map(tags.map(t => [t.id, t]));
        const childrenOf = (parentId: string) => tags.filter(t => t.parentId === parentId);

        const modules = tags
            .filter(t => t.parentId === null)
            .map(mod => ({
                id: mod.id,
                name: mod.name,
                points: childrenOf(mod.id).map(point => ({
                    id: point.id,
                    name: point.name,
                    leaves: childrenOf(point.id).map(leaf => ({ id: leaf.id, name: leaf.name })),
                })),
            }));

        return NextResponse.json({ modules });
    } catch (error) {
        logger.error({ error }, "Error loading gongkao tag tree");
        return internalError("Failed to load tag tree");
    }
}
