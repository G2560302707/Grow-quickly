import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAdmin } from "@/lib/auth-utils";
import { unauthorized, forbidden, badRequest, notFound, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:announcements:id');

/**
 * PATCH /api/announcements/[id]
 * 管理员编辑公告：{ title?, content?, isActive? }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const { id } = await params;
        const body = await req.json().catch(() => null);

        const updateData: { title?: string; content?: string; isActive?: boolean } = {};
        if (typeof body?.title === "string") {
            const title = body.title.trim();
            if (!title || title.length > 100) return badRequest("标题不能为空且不能超过 100 字");
            updateData.title = title;
        }
        if (typeof body?.content === "string") {
            const content = body.content.trim();
            if (!content || content.length > 2000) return badRequest("内容不能为空且不能超过 2000 字");
            updateData.content = content;
        }
        if (typeof body?.isActive === "boolean") {
            updateData.isActive = body.isActive;
        }

        if (Object.keys(updateData).length === 0) {
            return badRequest("没有需要更新的字段");
        }

        const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!existing) {
            return notFound("公告不存在");
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(announcement);
    } catch (error) {
        logger.error({ error }, 'Error updating announcement');
        return internalError("Failed to update announcement");
    }
}

/**
 * DELETE /api/announcements/[id]
 * 管理员删除公告（级联删除已读记录）
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const { id } = await params;

        const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!existing) {
            return notFound("公告不存在");
        }

        await prisma.announcement.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Error deleting announcement');
        return internalError("Failed to delete announcement");
    }
}
