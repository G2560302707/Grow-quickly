/**
 * 个人考点树 API
 * GET    /api/tags          - 本人树；?flat=true 返回可选叶子
 * POST   /api/tags          - 新建节点
 * DELETE /api/tags?id=      - 删除节点（含子树，解绑题目）
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@grow/shared/prisma";
import { authOptions } from "@/lib/auth";
import { createLogger } from "@grow/shared/logger";
import {
    USER_TAG_SUBJECT,
    MAX_DEPTH,
    buildTagTree,
    countUserTags,
    listUserTags,
    selectableTagNames,
    assertOwnedTag,
    getNodeDepth,
    collectUserTagSubtreeIds,
} from "@/lib/user-tag-tree";

const logger = createLogger("api:tags");

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const flat = searchParams.get("flat") === "true";
        const subject = searchParams.get("subject") || USER_TAG_SUBJECT;
        if (subject !== USER_TAG_SUBJECT) {
            return NextResponse.json({ tags: [], needsImport: false, message: "仅支持考公考点树" });
        }

        const tags = await listUserTags(session.user.id);
        const needsImport = tags.length === 0;

        if (flat) {
            return NextResponse.json({
                tags: selectableTagNames(tags),
                needsImport,
                total: tags.length,
            });
        }

        return NextResponse.json({
            tags: buildTagTree(tags),
            needsImport,
            total: tags.length,
        });
    } catch (error) {
        logger.error({ error }, "Error fetching tags");
        return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const parentId = body.parentId || null;
        const order = typeof body.order === "number" ? body.order : 0;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }
        if (name.length > 40) {
            return NextResponse.json({ error: "名称过长（最多 40 字）" }, { status: 400 });
        }

        if (parentId) {
            const parent = await assertOwnedTag(session.user.id, parentId);
            if (!parent) {
                return NextResponse.json({ error: "父节点不存在" }, { status: 400 });
            }
            const depth = await getNodeDepth(parentId);
            if (depth >= MAX_DEPTH) {
                return NextResponse.json({ error: `最多 ${MAX_DEPTH} 层` }, { status: 400 });
            }
        }

        const existing = await prisma.knowledgeTag.findFirst({
            where: {
                name,
                subject: USER_TAG_SUBJECT,
                userId: session.user.id,
                isSystem: false,
                parentId,
            },
        });
        if (existing) {
            return NextResponse.json({ error: "同级下已有同名标签" }, { status: 409 });
        }

        const siblings = await prisma.knowledgeTag.count({
            where: {
                userId: session.user.id,
                subject: USER_TAG_SUBJECT,
                isSystem: false,
                parentId,
            },
        });

        const tag = await prisma.knowledgeTag.create({
            data: {
                name,
                subject: USER_TAG_SUBJECT,
                parentId,
                isSystem: false,
                userId: session.user.id,
                order: order || siblings + 1,
                code: "user",
            },
        });

        return NextResponse.json({ tag }, { status: 201 });
    } catch (error) {
        logger.error({ error }, "Error creating tag");
        return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tagId = new URL(request.url).searchParams.get("id");
        if (!tagId) {
            return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
        }

        const tag = await assertOwnedTag(session.user.id, tagId);
        if (!tag) {
            return NextResponse.json({ error: "Tag not found" }, { status: 404 });
        }

        const subtreeIds = await collectUserTagSubtreeIds(tagId, session.user.id);

        for (const id of subtreeIds) {
            await prisma.knowledgeTag.update({
                where: { id },
                data: { errorItems: { set: [] } },
            });
        }

        let deleted = 0;
        for (let i = 0; i < 8; i++) {
            const res = await prisma.knowledgeTag.deleteMany({
                where: {
                    id: { in: subtreeIds },
                    userId: session.user.id,
                    children: { none: {} },
                },
            });
            deleted += res.count;
            if (res.count === 0) break;
        }
        const rest = await prisma.knowledgeTag.deleteMany({
            where: { id: { in: subtreeIds }, userId: session.user.id },
        });
        deleted += rest.count;

        return NextResponse.json({
            success: true,
            deleted,
            remaining: await countUserTags(session.user.id),
        });
    } catch (error) {
        logger.error({ error }, "Error deleting tag");
        return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
    }
}
