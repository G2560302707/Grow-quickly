/**
 * PATCH /api/tags/[id]  改名 / 移父 / 排序
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { createLogger } from "@grow/shared/logger";
import {
    USER_TAG_SUBJECT,
    MAX_DEPTH,
    assertOwnedTag,
    getNodeDepth,
    collectUserTagSubtreeIds,
} from "@/lib/user-tag-tree";

const logger = createLogger("api:tags:id");

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const tag = await assertOwnedTag(session.user.id, id);
        if (!tag) {
            return NextResponse.json({ error: "Tag not found" }, { status: 404 });
        }

        const body = await request.json();
        const data: { name?: string; parentId?: string | null; order?: number; code?: string } = {};

        if (typeof body.name === "string") {
            const name = body.name.trim();
            if (!name) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
            if (name.length > 40) return NextResponse.json({ error: "名称过长" }, { status: 400 });
            data.name = name;
            data.code = "user";
        }

        if (body.parentId !== undefined) {
            const newParentId = body.parentId || null;
            if (newParentId === id) {
                return NextResponse.json({ error: "不能把节点移到自己下面" }, { status: 400 });
            }
            if (newParentId) {
                const parent = await assertOwnedTag(session.user.id, newParentId);
                if (!parent) {
                    return NextResponse.json({ error: "父节点不存在" }, { status: 400 });
                }
                const subtree = await collectUserTagSubtreeIds(id, session.user.id);
                if (subtree.includes(newParentId)) {
                    return NextResponse.json({ error: "不能移到自己的子孙节点下" }, { status: 400 });
                }
                const depth = await getNodeDepth(newParentId);
                if (depth >= MAX_DEPTH) {
                    return NextResponse.json({ error: `最多 ${MAX_DEPTH} 层` }, { status: 400 });
                }
            }
            data.parentId = newParentId;
        }

        if (typeof body.order === "number") {
            data.order = body.order;
        }

        if (data.name !== undefined || data.parentId !== undefined) {
            const parentId = data.parentId !== undefined ? data.parentId : tag.parentId;
            const name = data.name !== undefined ? data.name : tag.name;
            const clash = await prisma.knowledgeTag.findFirst({
                where: {
                    userId: session.user.id,
                    subject: USER_TAG_SUBJECT,
                    isSystem: false,
                    name,
                    parentId,
                    NOT: { id },
                },
            });
            if (clash) {
                return NextResponse.json({ error: "同级下已有同名标签" }, { status: 409 });
            }
        }

        const updated = await prisma.knowledgeTag.update({
            where: { id },
            data,
        });

        return NextResponse.json({ tag: updated });
    } catch (error) {
        logger.error({ error }, "Error updating tag");
        return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
    }
}
