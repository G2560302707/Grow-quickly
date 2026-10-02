import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:announcements:read-all');

/**
 * POST /api/announcements/read-all
 * 当前用户把全部启用中的公告标记为已读（铃铛打开时调用）
 */
export async function POST() {
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const active = await prisma.announcement.findMany({
            where: { isActive: true },
            select: { id: true },
        });
        const existing = await prisma.announcementRead.findMany({
            where: { userId: user.id, announcementId: { in: active.map(a => a.id) } },
            select: { announcementId: true },
        });
        const readSet = new Set(existing.map(e => e.announcementId));
        const missing = active.filter(a => !readSet.has(a.id));

        if (missing.length > 0) {
            await prisma.announcementRead.createMany({
                data: missing.map(a => ({ announcementId: a.id, userId: user.id })),
            });
        }

        return NextResponse.json({ success: true, marked: missing.length });
    } catch (error) {
        logger.error({ error }, 'Error marking announcements read');
        return internalError("Failed to mark announcements read");
    }
}
